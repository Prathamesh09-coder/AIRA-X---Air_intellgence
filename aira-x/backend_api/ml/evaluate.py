import os
import json
import torch
import numpy as np

from ml.dataset import STGraph, AQIDataset
from ml.model import PM25_GNN
from ml.train import calculate_metrics
from core.logging import logger

def evaluate_model():
    logger.info("Starting model evaluation...")
    ml_dir = os.path.dirname(os.path.abspath(__file__))
    
    # 1. Load Scalers
    scalers_path = os.path.join(ml_dir, "scalers.json")
    if not os.path.exists(scalers_path):
        logger.error("No scalers.json found. Please run the training pipeline first.")
        return
        
    with open(scalers_path, "r") as f:
        scalers = json.load(f)
        
    hist_len = scalers["hist_len"]
    pred_len = scalers["pred_len"]
    in_dim = scalers["in_dim"]
    out_dim = scalers["out_dim"]
    
    # 2. Setup Graph and test dataset
    graph = STGraph()
    dataset = AQIDataset(graph, seq_len=hist_len+pred_len, hist_len=hist_len, pred_len=pred_len, samples=50)
    test_loader = torch.utils.data.DataLoader(dataset, batch_size=8, shuffle=False)
    
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    
    # 3. Load Model
    model = PM25_GNN(
        hist_len=hist_len,
        pred_len=pred_len,
        in_dim=in_dim,
        city_num=scalers["node_num"],
        batch_size=8, # match test loader
        device=device,
        edge_index=graph.edge_index,
        edge_attr=graph.edge_attr,
        wind_mean=np.array(scalers["wind_mean"]),
        wind_std=np.array(scalers["wind_std"]),
        out_dim=out_dim
    ).to(device)
    
    best_model_path = os.path.join(ml_dir, "saved_models", "best_model.pth")
    if not os.path.exists(best_model_path):
        logger.error("No best_model.pth found. Please run the training pipeline first.")
        return
        
    model.load_state_dict(torch.load(best_model_path, map_location=device))
    model.eval()
    
    # 4. Predict
    preds_list = []
    labels_list = []
    
    with torch.no_grad():
        for pm25, feature, _ in test_loader:
            # Batch size alignment for remainder batch
            if pm25.shape[0] != 8:
                continue
                
            pm25 = pm25.to(device)
            feature = feature.to(device)
            
            pm25_hist = pm25[:, :hist_len]
            pm25_label = pm25[:, hist_len:]
            
            pred = model(pm25_hist, feature)
            
            preds_denorm = pred.cpu().numpy() * scalers["pm25_std"] + scalers["pm25_mean"]
            labels_denorm = pm25_label.cpu().numpy() * scalers["pm25_std"] + scalers["pm25_mean"]
            
            preds_list.append(preds_denorm)
            labels_list.append(labels_denorm)
            
    if not preds_list:
        logger.error("No evaluation samples processed.")
        return
        
    all_preds = np.concatenate(preds_list, axis=0)
    all_labels = np.concatenate(labels_list, axis=0)
    
    # Calculate global metrics
    rmse_glob, mae_glob, mape_glob = calculate_metrics(all_preds, all_labels)
    
    print("\n" + "="*50)
    print("           MODEL EVALUATION SUMMARY           ")
    print("="*50)
    print(f"Global RMSE : {rmse_glob:.4f}")
    print(f"Global MAE  : {mae_glob:.4f}")
    print(f"Global MAPE : {mape_glob:.4f}%")
    print("-"*50)
    
    # Breakdown per target [PM2.5, PM10, NO2, SO2, AQI]
    targets = ["PM2.5", "PM10", "NO2", "SO2", "AQI"]
    for t_idx, target_name in enumerate(targets):
        pred_t = all_preds[:, :, :, t_idx]
        label_t = all_labels[:, :, :, t_idx]
        
        # Calculate metrics for this specific target
        mae_t = np.mean(np.abs(pred_t - label_t))
        rmse_t = np.sqrt(np.mean(np.square(pred_t - label_t)))
        
        denom = np.abs(label_t)
        denom[denom == 0] = 1e-5
        mape_t = np.mean(np.abs(pred_t - label_t) / denom) * 100.0
        
        print(f"Pollutant: {target_name:<7} | RMSE: {rmse_t:7.2f} | MAE: {mae_t:7.2f} | MAPE: {mape_t:6.2f}%")
        
    print("="*50 + "\n")

if __name__ == "__main__":
    evaluate_model()
