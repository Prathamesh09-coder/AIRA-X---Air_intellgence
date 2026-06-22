import torch
from torch import nn
import torch.nn.functional as F
import numpy as np

class GRUCell(nn.Module):
    def __init__(self, input_size, hidden_size, bias=True):
        super(GRUCell, self).__init__()
        self.input_size = input_size
        self.hidden_size = hidden_size
        self.bias = bias
        self.x2h = nn.Linear(input_size, 3 * hidden_size, bias=bias)
        self.h2h = nn.Linear(hidden_size, 3 * hidden_size, bias=bias)
        self.reset_parameters()

    def reset_parameters(self):
        std = 1.0 / np.sqrt(self.hidden_size)
        for w in self.parameters():
            w.data.uniform_(-std, std)

    def forward(self, x, hidden):
        x = x.view(-1, x.size(-1))
        gate_x = self.x2h(x)
        gate_h = self.h2h(hidden)

        i_r, i_i, i_n = gate_x.chunk(3, 1)
        h_r, h_i, h_n = gate_h.chunk(3, 1)

        resetgate = torch.sigmoid(i_r + h_r)
        inputgate = torch.sigmoid(i_i + h_i)
        newgate = torch.tanh(i_n + (resetgate * h_n))

        hy = newgate + inputgate * (hidden - newgate)
        return hy

class GraphGNN(nn.Module):
    def __init__(self, device, edge_index, edge_attr, in_dim, out_dim, wind_mean, wind_std):
        super(GraphGNN, self).__init__()
        self.device = device
        # edge_index: [2, edge_num]
        self.edge_index = torch.LongTensor(edge_index).to(self.device)
        self.edge_attr = torch.Tensor(np.float32(edge_attr)).to(self.device)
        
        # Normalize edge attributes
        attr_mean = self.edge_attr.mean(dim=0, keepdim=True)
        attr_std = self.edge_attr.std(dim=0, keepdim=True)
        attr_std[attr_std == 0] = 1.0
        self.edge_attr_norm = (self.edge_attr - attr_mean) / attr_std
        
        self.wind_mean = torch.Tensor(np.float32(wind_mean)).to(self.device)
        self.wind_std = torch.Tensor(np.float32(wind_std)).to(self.device)
        self.wind_std[self.wind_std == 0] = 1.0
        
        e_h = 32
        e_out = 30
        self.edge_mlp = nn.Sequential(
            nn.Linear(in_dim * 2 + 2 + 1, e_h),
            nn.Sigmoid(),
            nn.Linear(e_h, e_out),
            nn.Sigmoid()
        )
        self.node_mlp = nn.Sequential(
            nn.Linear(e_out, out_dim),
            nn.Sigmoid()
        )

    def forward(self, x):
        batch_size, node_num, feat_dim = x.shape
        edge_src, edge_target = self.edge_index
        
        # [batch_size, edge_num, feat_dim]
        node_src = x[:, edge_src]
        node_target = x[:, edge_target]
        
        # Wind features are located in the last 2 feature dims of nodes
        src_wind = node_src[:, :, -2:] * self.wind_std[None, None, :] + self.wind_mean[None, None, :]
        src_wind_speed = src_wind[:, :, 0]
        src_wind_direc = src_wind[:, :, 1]
        
        # Dist & angle attributes
        self.edge_attr_ = self.edge_attr[None, :, :].repeat(batch_size, 1, 1)
        city_dist = self.edge_attr_[:, :, 0]
        city_direc = self.edge_attr_[:, :, 1]
        
        # Wind direction alignment factor
        theta = torch.abs(city_direc - src_wind_direc)
        edge_weight = F.relu(3 * src_wind_speed * torch.cos(theta) / (city_dist + 1e-5))
        
        edge_attr_norm = self.edge_attr_norm[None, :, :].repeat(batch_size, 1, 1).to(self.device)
        
        # Concat features: src node, target node, edge static attributes, wind dynamic weight
        out = torch.cat([node_src, node_target, edge_attr_norm, edge_weight[:, :, None]], dim=-1)
        
        # Edge representations: [batch_size, edge_num, e_out]
        out = self.edge_mlp(out)
        e_out_dim = out.shape[-1]
        
        # Native scatter_add aggregation (avoiding torch_scatter)
        # Summing edge representations into destination nodes
        idx_target = edge_target.view(1, -1, 1).expand(batch_size, -1, e_out_dim)
        out_add = torch.zeros(batch_size, node_num, e_out_dim, device=x.device)
        out_add.scatter_add_(1, idx_target, out)
        
        # Subtracting edge representations from source nodes (directionality constraint)
        idx_src = edge_src.view(1, -1, 1).expand(batch_size, -1, e_out_dim)
        out_sub = torch.zeros(batch_size, node_num, e_out_dim, device=x.device)
        out_sub.scatter_add_(1, idx_src, -out)
        
        # Node representations aggregation
        out = out_add + out_sub
        out = self.node_mlp(out)
        return out

class PM25_GNN(nn.Module):
    def __init__(self, hist_len, pred_len, in_dim, city_num, batch_size, device, edge_index, edge_attr, wind_mean, wind_std, out_dim=5):
        super(PM25_GNN, self).__init__()
        self.device = device
        self.hist_len = hist_len
        self.pred_len = pred_len
        self.city_num = city_num
        self.batch_size = batch_size
        self.in_dim = in_dim
        self.hid_dim = 64
        self.out_dim = out_dim
        self.gnn_out = 13

        self.fc_in = nn.Linear(self.in_dim, self.hid_dim)
        self.graph_gnn = GraphGNN(self.device, edge_index, edge_attr, self.in_dim, self.gnn_out, wind_mean, wind_std)
        self.gru_cell = GRUCell(self.in_dim + self.gnn_out, self.hid_dim)
        self.fc_out = nn.Linear(self.hid_dim, self.out_dim)

    def forward(self, pm25_hist, feature):
        # pm25_hist shape: [batch_size, hist_len, city_num, out_dim]
        # feature shape: [batch_size, hist_len + pred_len, city_num, feature_dim]
        pm25_pred = []
        h0 = torch.zeros(self.batch_size * self.city_num, self.hid_dim).to(self.device)
        hn = h0
        xn = pm25_hist[:, -1] # [batch_size, city_num, out_dim]
        
        for i in range(self.pred_len):
            # Concatenate historical/previous step predictions with weather/temporal covariates
            # x shape: [batch_size, city_num, out_dim + feature_dim]
            x = torch.cat((xn, feature[:, self.hist_len + i]), dim=-1)

            # Spatial Graph Convolution
            xn_gnn = self.graph_gnn(x) # [batch_size, city_num, gnn_out]
            
            # Combine spatial embeddings and local features
            x = torch.cat([xn_gnn, x], dim=-1) # [batch_size, city_num, gnn_out + out_dim + feature_dim]

            # GRU update
            hn = self.gru_cell(x, hn) # [batch_size * city_num, hid_dim]
            
            # Predict values for the next time step
            xn = hn.view(self.batch_size, self.city_num, self.hid_dim)
            xn = self.fc_out(xn) # [batch_size, city_num, out_dim]
            pm25_pred.append(xn)

        # Output shape: [batch_size, pred_len, city_num, out_dim]
        pm25_pred = torch.stack(pm25_pred, dim=1)
        return pm25_pred
