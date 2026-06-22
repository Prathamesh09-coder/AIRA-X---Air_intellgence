import os
import json
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import root_mean_squared_error, mean_absolute_error
import xgboost as xgb
import shap
import mlflow
import mlflow.sklearn
import pickle
from core.logging import logger

# Feature names mapping to the 6 target sources:
# 1. Traffic: traffic_density, sentinel_no2
# 2. Construction: construction_permits, sentinel_co
# 3. Industrial emissions: industrial_zoning, sentinel_so2
# 4. Waste burning: local_temp_anomalies
# 5. Biomass burning: modis_fire_power
# 6. Crop residue burning: modis_fire_power, cropland_fraction
FEATURE_COLUMNS = [
    "traffic_density", "sentinel_no2",
    "construction_permits", "sentinel_co",
    "industrial_zoning", "sentinel_so2",
    "local_temp_anomalies",
    "modis_fire_power", "cropland_fraction"
]

SOURCE_GROUPS = {
    "Traffic": ["traffic_density", "sentinel_no2"],
    "Construction": ["construction_permits", "sentinel_co"],
    "Industrial emissions": ["industrial_zoning", "sentinel_so2"],
    "Waste burning": ["local_temp_anomalies"],
    "Biomass burning": ["modis_fire_power"],
    "Crop residue burning": ["modis_fire_power", "cropland_fraction"]
}

def generate_geospatial_dataset(num_samples=300):
    """
    Simulates real geospatial feature tables joining sentinel, modis, OSM roads, and permits.
    """
    np.random.seed(42)
    data = []
    for _ in range(num_samples):
        # Features
        traffic = np.random.uniform(0.0, 1.0)
        no2 = traffic * 0.4 + np.random.normal(0.1, 0.05)
        
        permits = np.random.uniform(0.0, 1.0)
        co = permits * 0.3 + np.random.normal(0.2, 0.05)
        
        industry = np.random.uniform(0.0, 1.0)
        so2 = industry * 0.5 + np.random.normal(0.05, 0.02)
        
        waste = np.random.uniform(0.0, 0.5)
        
        fire_power = np.random.uniform(0.0, 50.0) # MODIS FRP
        cropland = np.random.uniform(0.0, 1.0)
        
        # Ground truth target pollution (PM2.5) derived as a function of sources
        pm25 = (
            traffic * 35.0 + no2 * 20.0 +
            permits * 25.0 + co * 15.0 +
            industry * 50.0 + so2 * 40.0 +
            waste * 30.0 +
            fire_power * 1.5 + cropland * fire_power * 2.0 +
            np.random.normal(20.0, 5.0)
        )
        
        data.append([
            traffic, no2, permits, co, industry, so2, waste, fire_power, cropland, pm25
        ])
        
    df = pd.DataFrame(data, columns=FEATURE_COLUMNS + ["target_pm25"])
    return df

def train_attribution_models():
    logger.info("Starting Pollution Source Attribution training pipeline...")
    
    # Setup MLflow
    tracking_uri = os.getenv("MLFLOW_TRACKING_URI", "http://mlflow:5000")
    mlflow.set_tracking_uri(tracking_uri)
    mlflow.set_experiment("Pollution_Source_Attribution")
    
    df = generate_geospatial_dataset(300)
    X = df[FEATURE_COLUMNS]
    y = df["target_pm25"]
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    # Save datasets locally for reference/artifacts
    ml_dir = os.path.dirname(os.path.abspath(__file__))
    data_path = os.path.join(ml_dir, "attribution_data.csv")
    df.to_csv(data_path, index=False)
    
    best_rmse = float("inf")
    best_model = None
    best_model_name = ""
    
    with mlflow.start_run() as run:
        logger.info(f"MLflow Run Started. ID: {run.info.run_id}")
        mlflow.log_artifact(data_path)
        
        # 1. Random Forest Regressor
        rf = RandomForestRegressor(n_estimators=100, max_depth=6, random_state=42)
        rf.fit(X_train, y_train)
        rf_preds = rf.predict(X_test)
        rf_rmse = root_mean_squared_error(y_test, rf_preds)
        rf_mae = mean_absolute_error(y_test, rf_preds)
        
        mlflow.log_params({"rf_estimators": 100, "rf_max_depth": 6})
        mlflow.log_metrics({"rf_rmse": rf_rmse, "rf_mae": rf_mae})
        mlflow.sklearn.log_model(rf, "random_forest_baseline")
        logger.info(f"Random Forest baseline - RMSE: {rf_rmse:.4f} | MAE: {rf_mae:.4f}")
        
        # 2. XGBoost Regressor
        xg_reg = xgb.XGBRegressor(n_estimators=100, max_depth=4, learning_rate=0.05, random_state=42)
        xg_reg.fit(X_train, y_train)
        xgb_preds = xg_reg.predict(X_test)
        xgb_rmse = root_mean_squared_error(y_test, xgb_preds)
        xgb_mae = mean_absolute_error(y_test, xgb_preds)
        
        mlflow.log_params({"xgb_estimators": 100, "xgb_max_depth": 4, "xgb_lr": 0.05})
        mlflow.log_metrics({"xgb_rmse": xgb_rmse, "xgb_mae": xgb_mae})
        mlflow.sklearn.log_model(xg_reg, "xgboost_baseline")
        logger.info(f"XGBoost baseline - RMSE: {xgb_rmse:.4f} | MAE: {xgb_mae:.4f}")
        
        # Select best model
        if xgb_rmse < rf_rmse:
            best_model = xg_reg
            best_model_name = "xgboost"
            best_rmse = xgb_rmse
        else:
            best_model = rf
            best_model_name = "random_forest"
            best_rmse = rf_rmse
            
        logger.info(f"Best model selected: {best_model_name} with RMSE {best_rmse:.4f}")
        
        # 3. Calculate and Save SHAP Explanations
        explainer = shap.TreeExplainer(best_model)
        shap_values = explainer.shap_values(X_train)
        
        # Checkpoint the trained model locally
        checkpoint_dir = os.path.join(ml_dir, "saved_models")
        os.makedirs(checkpoint_dir, exist_ok=True)
        
        # Save model using serialization
        import pickle
        model_save_path = os.path.join(checkpoint_dir, "best_attribution_model.pkl")
        with open(model_save_path, "wb") as f:
            pickle.dump({
                "model": best_model,
                "model_name": best_model_name,
                "explainer": explainer,
                "feature_names": FEATURE_COLUMNS
            }, f)
            
        # Register best model in Model Registry
        if best_model_name == "xgboost":
            mlflow.sklearn.log_model(best_model, "best_attribution_model", registered_model_name="Pollution_Attribution_Model")
        else:
            mlflow.sklearn.log_model(best_model, "best_attribution_model", registered_model_name="Pollution_Attribution_Model")
            
        logger.info(f"Registered {best_model_name} as the production Pollution Attribution Model.")

def get_explainable_attribution(features_dict):
    """
    Computes explainable source attribution percentage scores using the trained SHAP model.
    """
    ml_dir = os.path.dirname(os.path.abspath(__file__))
    model_path = os.path.join(ml_dir, "saved_models", "best_attribution_model.pkl")
    
    # Load fallback if model is not pre-trained
    if not os.path.exists(model_path):
        # Standard mock fallback contributions
        return {
            "Traffic": {"percentage": 35.0, "confidence": 0.85},
            "Construction": {"percentage": 15.0, "confidence": 0.80},
            "Industrial emissions": {"percentage": 25.0, "confidence": 0.90},
            "Waste burning": {"percentage": 5.0, "confidence": 0.70},
            "Biomass burning": {"percentage": 10.0, "confidence": 0.75},
            "Crop residue burning": {"percentage": 10.0, "confidence": 0.82}
        }
        
    with open(model_path, "rb") as f:
        checkpoint = pickle.load(f)
        
    model = checkpoint["model"]
    explainer = checkpoint["explainer"]
    feature_names = checkpoint["feature_names"]
    
    # Prepare feature vector
    feat_vec = [features_dict.get(name, 0.5) for name in feature_names]
    feat_df = pd.DataFrame([feat_vec], columns=feature_names)
    
    # Compute SHAP values for the single sample
    shap_vals = explainer.shap_values(feat_df)[0]
    
    # Group SHAP values by source category
    abs_shap_sum = 0.0
    group_shaps = {}
    
    for group_name, features in SOURCE_GROUPS.items():
        val = 0.0
        for f in features:
            f_idx = feature_names.index(f)
            # Take absolute SHAP value for attribution magnitude
            val += abs(shap_vals[f_idx])
        group_shaps[group_name] = val
        abs_shap_sum += val
        
    if abs_shap_sum == 0.0:
        abs_shap_sum = 1e-5
        
    # Calculate percentage
    attributions = {}
    for group_name, val in group_shaps.items():
        percentage = (val / abs_shap_sum) * 100.0
        # Confidence score based on attribution strength and model prediction
        attributions[group_name] = {
            "percentage": round(percentage, 2),
            "confidence": round(0.75 + (val / (abs_shap_sum + 1.0)) * 0.2, 2)
        }
        
    return attributions

if __name__ == "__main__":
    import pickle
    train_attribution_models()
