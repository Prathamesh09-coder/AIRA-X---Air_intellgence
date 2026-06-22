import os
import numpy as np
import torch
from torch.utils import data
from geopy.distance import geodesic
from datetime import datetime, timedelta

# List of 10 virtual/reference monitoring stations in India
STATION_METADATA = [
    {"id": 0, "name": "Delhi Central", "lat": 28.6139, "lon": 77.2090, "traffic_density": 0.9},
    {"id": 1, "name": "Delhi North", "lat": 28.7041, "lon": 77.1025, "traffic_density": 0.8},
    {"id": 2, "name": "Noida", "lat": 28.5355, "lon": 77.3910, "traffic_density": 0.7},
    {"id": 3, "name": "Gurugram", "lat": 28.4595, "lon": 77.0266, "traffic_density": 0.75},
    {"id": 4, "name": "Mumbai Colaba", "lat": 18.9067, "lon": 72.8147, "traffic_density": 0.85},
    {"id": 5, "name": "Mumbai Bandra", "lat": 19.0596, "lon": 72.8295, "traffic_density": 0.95},
    {"id": 6, "name": "Bengaluru City", "lat": 12.9716, "lon": 77.5946, "traffic_density": 0.8},
    {"id": 7, "name": "Bengaluru Whitefield", "lat": 12.9698, "lon": 77.7500, "traffic_density": 0.65},
    {"id": 8, "name": "Chennai Central", "lat": 13.0827, "lon": 80.2707, "traffic_density": 0.85},
    {"id": 9, "name": "Kolkata Victoria", "lat": 22.5448, "lon": 88.3426, "traffic_density": 0.75}
]

class STGraph:
    """
    Spatiotemporal graph representing monitoring stations.
    """
    def __init__(self, dist_threshold_km=500.0):
        self.stations = STATION_METADATA
        self.node_num = len(self.stations)
        self.dist_threshold_km = dist_threshold_km
        self.edge_index, self.edge_attr = self._build_graph()

    def _build_graph(self):
        edge_index = []
        edge_attr = []
        
        for i in range(self.node_num):
            for j in range(self.node_num):
                if i == j:
                    continue
                loc_i = (self.stations[i]["lat"], self.stations[i]["lon"])
                loc_j = (self.stations[j]["lat"], self.stations[j]["lon"])
                dist_km = geodesic(loc_i, loc_j).kilometers
                
                # Connect if stations are within distance threshold
                if dist_km <= self.dist_threshold_km:
                    edge_index.append([i, j])
                    
                    # Calculate angle direction from i to j in degrees
                    dy = self.stations[j]["lat"] - self.stations[i]["lat"]
                    dx = self.stations[j]["lon"] - self.stations[i]["lon"]
                    angle = np.degrees(np.arctan2(dy, dx))
                    if angle < 0:
                        angle += 360.0
                        
                    edge_attr.append([dist_km, angle])
                    
        if not edge_index:
            # Fallback if no edges found under threshold (ensure fully connected)
            for i in range(self.node_num):
                for j in range(self.node_num):
                    if i != j:
                        edge_index.append([i, j])
                        edge_attr.append([1.0, 0.0])

        return np.array(edge_index).T, np.array(edge_attr)

class AQIDataset(data.Dataset):
    """
    PyTorch Dataset providing historical inputs and forecast targets.
    """
    def __init__(self, graph: STGraph, seq_len=48, hist_len=24, pred_len=24, samples=200):
        self.graph = graph
        self.hist_len = hist_len
        self.pred_len = pred_len
        self.seq_len = seq_len
        self.node_num = graph.node_num
        
        # 5 output targets: [PM2.5, PM10, NO2, SO2, AQI]
        self.out_dim = 5
        # 14 input features: 7 weather variables + 6 seasonal variables + 1 traffic feature
        self.feature_dim = 14
        
        self.pm25_data = []
        self.feature_data = []
        self.time_data = []
        
        self._generate_mock_dataset(samples)
        
        # Calculate normalization parameters
        self.pm25_mean = np.mean(self.pm25_data)
        self.pm25_std = np.std(self.pm25_data)
        if self.pm25_std == 0:
            self.pm25_std = 1.0
            
        self.feature_mean = np.mean(self.feature_data, axis=(0, 1, 2))
        self.feature_std = np.std(self.feature_data, axis=(0, 1, 2))
        self.feature_std[self.feature_std == 0] = 1.0
        
        self.wind_mean = self.feature_mean[-2:]
        self.wind_std = self.feature_std[-2:]

    def _generate_mock_dataset(self, samples):
        base_time = datetime(2026, 1, 1, 0, 0)
        
        for s in range(samples):
            sample_time = base_time + timedelta(hours=s)
            
            # 1. Generate target data [seq_len, node_num, out_dim]
            pm25_seq = []
            for t in range(self.seq_len):
                t_time = sample_time + timedelta(hours=t)
                pm25_nodes = []
                for n in range(self.node_num):
                    # Base levels plus cyclical daily variations
                    hour_factor = np.sin(2 * np.pi * t_time.hour / 24.0)
                    base_val = 50.0 + (n * 5.0) + (hour_factor * 15.0)
                    
                    # Generate [PM2.5, PM10, NO2, SO2, AQI]
                    pm25 = max(5.0, base_val + np.random.normal(0, 3.0))
                    pm10 = pm25 * 1.5 + np.random.normal(0, 5.0)
                    no2 = 20.0 + (hour_factor * 5.0) + np.random.normal(0, 2.0)
                    so2 = 10.0 + np.random.normal(0, 1.0)
                    aqi = pm25 * 1.2 # simplified translation
                    
                    pm25_nodes.append([pm25, pm10, no2, so2, aqi])
                pm25_seq.append(pm25_nodes)
            
            # 2. Generate feature data [seq_len, node_num, feature_dim]
            feature_seq = []
            for t in range(self.seq_len):
                t_time = sample_time + timedelta(hours=t)
                feature_nodes = []
                for n in range(self.node_num):
                    # Weather features: temp, pressure, humidity, precipitation, boundary height, wind U, wind V
                    temp = 25.0 + np.sin(2 * np.pi * t_time.hour / 24.0) * 5.0 + np.random.normal(0, 0.5)
                    pressure = 1010.0 + np.random.normal(0, 1.0)
                    humidity = 60.0 - np.sin(2 * np.pi * t_time.hour / 24.0) * 10.0 + np.random.normal(0, 2.0)
                    precipitation = max(0.0, np.random.normal(0, 0.1))
                    boundary_height = 800.0 + np.sin(2 * np.pi * t_time.hour / 24.0) * 300.0
                    
                    # Simulated Wind vectors: U component (eastward), V component (northward)
                    wind_u = 2.0 + np.random.normal(0, 1.0)
                    wind_v = -1.0 + np.random.normal(0, 1.0)
                    
                    # Seasonal features: cyclical representations
                    h_sin = np.sin(2 * np.pi * t_time.hour / 24.0)
                    h_cos = np.cos(2 * np.pi * t_time.hour / 24.0)
                    w_sin = np.sin(2 * np.pi * t_time.weekday() / 7.0)
                    w_cos = np.cos(2 * np.pi * t_time.weekday() / 7.0)
                    m_sin = np.sin(2 * np.pi * t_time.month / 12.0)
                    m_cos = np.cos(2 * np.pi * t_time.month / 12.0)
                    
                    # Traffic static feature
                    traffic = self.graph.stations[n]["traffic_density"]
                    
                    feature_nodes.append([
                        temp, pressure, humidity, precipitation, boundary_height,
                        h_sin, h_cos, w_sin, w_cos, m_sin, m_cos, traffic,
                        wind_u, wind_v
                    ])
                feature_seq.append(feature_nodes)
                
            self.pm25_data.append(pm25_seq)
            self.feature_data.append(feature_seq)
            self.time_data.append(sample_time.timestamp())
            
        self.pm25_data = np.float32(np.array(self.pm25_data))
        self.feature_data = np.float32(np.array(self.feature_data))
        self.time_data = np.float32(np.array(self.time_data))

    def __len__(self):
        return len(self.pm25_data)

    def __getitem__(self, index):
        # Normalize inputs/targets
        pm25_normalized = (self.pm25_data[index] - self.pm25_mean) / self.pm25_std
        feature_normalized = (self.feature_data[index] - self.feature_mean) / self.feature_std
        
        return pm25_normalized, feature_normalized, self.time_data[index]
