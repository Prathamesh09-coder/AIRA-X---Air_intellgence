import os
import json
import torch
import torch.nn as nn
import numpy as np
import mlflow
import mlflow.pytorch
from datetime import datetime

from ml.dataset import STGraph, AQIDataset
from ml.model import PM25_GNN
from core.config import settings
from core.logging import logger

def calculate_metrics(y_pred, y_true):
    """
    Calculate RMSE, MAE, and MAPE.
    y_pred, y_true shapes: [batch, pred_len, nodes, targets]
    """
    mae = np.mean(np.abs(y_pred - y_true))
    rmse = np.sqrt(np.mean(np.square(y_pred - y_true)))
    
    # Avoid division by zero in MAPE
    denominator = np.abs(y_true)
    denominator[denominator == 0] = 1e-5
    mape = np.mean(np.abs(y_pred - y_true) / denominator) * 100.0
    
    return rmse, mae, mape

def train_model():
    logger.info("Initializing AQI Forecasting model training pipeline...")
    
    # 1. Setup MLflow
    tracking_uri = os.getenv("MLFLOW_TRACKING_URI", "http://mlflow:5000")
    mlflow.set_tracking_uri(tracking_uri)
    mlflow.set_experiment("AQI_Forecasting")
    
    # 2. Hyperparameters
    epochs = 15
    lr = 0.001
    weight_decay = 0.0005
    batch_size = 8
    hist_len = 24
    pred_len = 24
    hid_dim = 64
    out_dim = 5  # AQI, PM2.5, PM10, NO2, SO2
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    
    # 3. Load Graph and Dataset
    graph = STGraph()
    dataset = AQIDataset(graph, seq_len=hist_len+pred_len, hist_len=hist_len, pred_len=pred_len, samples=150)
    
    # Split: 80% train, 20% val
    train_size = int(0.8 * len(dataset))
    val_size = len(dataset) - train_size
    train_data, val_data = torch.utils.data.RandomSubsetSplit(dataset, [train_size, val_size]) if hasattr(torch.utils.data, 'RandomSubsetSplit') else torch.utils.data.random_split(dataset, [train_size, val_size])
    
    train_loader = torch.utils.data.DataLoader(train_data, batch_size=batch_size, shuffle=True, drop_last=True)
    val_loader = torch.utils.data.DataLoader(val_data, batch_size=batch_size, shuffle=False, drop_last=True)
    
    # Node attributes size
    in_dim = dataset.feature_dim + out_dim  # weather features + seasonal + traffic + historical targets
    
    model = PM25_GNN(
        hist_len=hist_len,
        pred_len=pred_len,
        in_dim=in_dim,
        city_num=graph.node_num,
        batch_size=batch_size,
        device=device,
        edge_index=graph.edge_index,
        edge_attr=graph.edge_attr,
        wind_mean=dataset.wind_mean,
        wind_std=dataset.wind_std,
        out_dim=out_dim
    ).to(device)
    
    optimizer = torch.optim.Adam(model.parameters(), lr=lr, weight_decay=weight_decay)
    criterion = nn.MSELoss()
    
    # Save scalers metadata
    scalers = {
        "pm25_mean": float(dataset.pm25_mean),
        "pm25_std": float(dataset.pm25_std),
        "feature_mean": dataset.feature_mean.tolist(),
        "feature_std": dataset.feature_std.tolist(),
        "wind_mean": dataset.wind_mean.tolist(),
        "wind_std": dataset.wind_std.tolist(),
        "node_num": graph.node_num,
        "hist_len": hist_len,
        "pred_len": pred_len,
        "in_dim": in_dim,
        "out_dim": out_dim
    }
    
    ml_dir = os.path.dirname(os.path.abspath(__file__))
    scalers_path = os.path.join(ml_dir, "scalers.json")
    with open(scalers_path, "w") as f:
        json.dump(scalers, f, indent=4)
        
    best_val_loss = float("inf")
    
    with mlflow.start_run() as run:
        logger.info(f"MLflow Run Started. ID: {run.info.run_id}")
        mlflow.log_params({
            "epochs": epochs,
            "learning_rate": lr,
            "weight_decay": weight_decay,
            "batch_size": batch_size,
            "hist_len": hist_len,
            "pred_len": pred_len,
            "hid_dim": hid_dim,
            "out_dim": out_dim,
            "node_num": graph.node_num
        })
        
        # Log scaler parameters as artifact
        mlflow.log_artifact(scalers_path)
        
        for epoch in range(epochs):
            # Training
            model.train()
            train_loss = 0.0
            for batch_idx, (pm25, feature, _) in enumerate(train_loader):
                pm25 = pm25.to(device)
                feature = feature.to(device)
                
                # Split history and targets
                pm25_hist = pm25[:, :hist_len] # [batch, hist_len, nodes, out_dim]
                pm25_label = pm25[:, hist_len:] # [batch, pred_len, nodes, out_dim]
                
                optimizer.zero_grad()
                pred = model(pm25_hist, feature)
                loss = criterion(pred, pm25_label)
                loss.backward()
                optimizer.step()
                
                train_loss += loss.item()
                
            train_loss /= (batch_idx + 1)
            
            # Validation
            model.eval()
            val_loss = 0.0
            preds_list = []
            labels_list = []
            
            with torch.no_grad():
                for batch_idx, (pm25, feature, _) in enumerate(val_loader):
                    pm25 = pm25.to(device)
                    feature = feature.to(device)
                    
                    pm25_hist = pm25[:, :hist_len]
                    pm25_label = pm25[:, hist_len:]
                    
                    pred = model(pm25_hist, feature)
                    loss = criterion(pred, pm25_label)
                    val_loss += loss.item()
                    
                    # Store denormalized predictions and targets for metrics
                    preds_denorm = pred.cpu().numpy() * dataset.pm25_std + dataset.pm25_mean
                    labels_denorm = pm25_label.cpu().numpy() * dataset.pm25_std + dataset.pm25_mean
                    
                    preds_list.append(preds_denorm)
                    labels_list.append(labels_denorm)
                    
            val_loss /= (batch_idx + 1)
            
            # Compute evaluation metrics
            all_preds = np.concatenate(preds_list, axis=0)
            all_labels = np.concatenate(labels_list, axis=0)
            rmse, mae, mape = calculate_metrics(all_preds, all_labels)
            
            # Log metrics
            mlflow.log_metrics({
                "train_mse_loss": train_loss,
                "val_mse_loss": val_loss,
                "val_rmse": rmse,
                "val_mae": mae,
                "val_mape": mape
            }, step=epoch)
            
            logger.info(f"Epoch {epoch:02d} | Train Loss: {train_loss:.4f} | Val Loss: {val_loss:.4f} | RMSE: {rmse:.2f} | MAE: {mae:.2f} | MAPE: {mape:.2f}%")
            
            # Save best checkpoint locally and to MLflow registry
            if val_loss < best_val_loss:
                best_val_loss = val_loss
                checkpoint_dir = os.path.join(ml_dir, "saved_models")
                os.makedirs(checkpoint_dir, exist_ok=True)
                
                # Save PyTorch weights
                best_model_path = os.path.join(checkpoint_dir, "best_model.pth")
                torch.save(model.state_dict(), best_model_path)
                logger.info(f"New best model saved at {best_model_path} with Val Loss {val_loss:.4f}")
                
                # Register model in MLflow registry
                mlflow.pytorch.log_model(
                    pytorch_model=model,
                    artifact_path="model",
                    registered_model_name="PM25_GNN_Model"
                )
                
        logger.info("Training completed successfully!")

if __name__ == "__main__":
    train_model()
