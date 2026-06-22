---
title: AIRA-X API
emoji: 🌬️
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 8000
pinned: false
---

# AIRA-X: AI-Powered Hyperlocal Urban Air Quality Intelligence Platform

AIRA-X (Air Intelligence, Reasoning, and Action Platform) is a production-grade, state-of-the-art spatiotemporal analytics and multi-agent planning platform designed for the Smart Cities Mission, Central Pollution Control Board (CPCB), State Pollution Control Boards (SPCBs), and Municipal Corporations. 

The platform connects hyperlocal Graph Neural Network (GNN) forecasting, explainable satellite source attribution, relational knowledge graphs, and stateful multi-agent decision chains to translate real-time environmental data into proactive interventions.

---

## 🌟 Key Features

1. **Spatiotemporal GNN Forecasting**: Native PyTorch Graph Neural Network (GNN) + GRU integration predicting 5 key targets ($PM_{2.5}$, $PM_{10}$, $NO_2$, $SO_2$, AQI) over 24h-72h horizons, using distance matrices adjusted for dynamic wind vectors.
2. **Explainable Geospatial Attribution**: Sentinel-5P gas column density overlays, MODIS active fire detections, and OpenStreetMap land-use geometries processed via XGBoost models and explained in real-time using mathematical SHAP values.
3. **LangGraph Multi-Agent Workflows**: Stateful, collaborative execution of **Forecast**, **Attribution**, **Enforcement**, **Health Risk**, and **Policy** agents passing execution context through a unified state schema.
4. **Environmental Knowledge Graph**: Complex Neo4j graph schemas mapping structural relationships between urban entities (monitoring stations, wards, population clusters, industries, construction zones, corridors) and directives.
5. **Hardened Production Containers**: Multi-stage Docker builds running under non-root permissions, resource-constrained container pools, and Uvicorn process clustering.

---

## 🛠️ Technology Stack

* **API Gateway & Routing**: FastAPI (ASGI runner with asynchronous database sessions)
* **Databases**: PostgreSQL (PostGIS) + Redis (High-speed caching) + Neo4j (Bolt protocol graph traversal)
* **Machine Learning**: PyTorch (GNN) + XGBoost + SHAP (Explainable predictions)
* **MLOps**: MLflow (Experiment tracking & Model Registry)
* **Orchestration**: LangGraph (Stateful multi-agent workflows)
* **Containerization**: Docker & Docker Compose

---

## 📁 Repository Structure

```text
aira-x/
├── backend_api/         # Core application directory
│   ├── api/             # FastAPI routers (auth, forecast, kg, agents)
│   ├── core/            # Config, security logic, and structured logging
│   ├── db/              # DB connection sessions (PostGIS, Redis, Neo4j)
│   ├── ml/              # GNN model, XGBoost, SHAP, and LangGraph workflow
│   ├── models/          # SQL database schemas & Pydantic validators
│   ├── tests/           # Integration tests (pytest) & load scripts (locust)
│   ├── Dockerfile       # Hardened multi-stage build configuration
│   └── requirements.txt # Project python dependencies
├── docker-compose.yml   # Development compose profile (hot-reload enabled)
├── docker-compose.prod.yml # Production compose profile (resource limits set)
├── architecture.md      # Detailed system layouts and Mermaid flowcharts
└── deployment_guide.md  # Production operations manual
```

---

## 🚀 Quickstart Guide

### 1. Configure the Environment
Create a `.env` file in the `backend_api` folder:
```env
DATABASE_URL=postgresql+asyncpg://postgres:postgres@db:5432/aira_x
REDIS_URL=redis://redis:6379/0
NEO4J_URI=bolt://neo4j:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password123
MLFLOW_TRACKING_URI=http://mlflow:5000
JWT_SECRET_KEY=yoursupersecretkeyfortestingenvironment123
ENVIRONMENT=production
```

### 2. Launch the Stack
For production deployment, run:
```bash
cd /Users/prathameshnawale/Desktop/ET/aira-x
docker compose -f docker-compose.prod.yml up -d --build
```
For local hot-reload development, run:
```bash
docker compose up -d --build
```

### 3. Ingest and Seed the Knowledge Graph
Seed the Neo4j database with monitoring stations, pollutants, industries, construction sites, traffic corridors, and population clusters:
```bash
curl -X POST http://localhost:8000/api/v1/knowledge-graph/ingest
```

---

## 🧪 Testing & Performance Validation

### 1. Integration Tests (Pytest)
Run the automated test suite verifying registration, caching, forecast GNN forward-passes, and Cypher traversals inside the container:
```bash
docker compose -f docker-compose.prod.yml exec api python -m pytest
```
*Output: 4 passed in 1.15s (test_auth, test_forecast, test_kg, test_agent_workflow)*

### 2. Load Testing (Locust)
Simulate high concurrency loads against forecasting and multi-agent endpoints:
```bash
docker compose -f docker-compose.prod.yml exec api locust -f tests/locustfile.py --headless -u 50 -r 5 --run-time 1m --host http://localhost:8000
```
*Performance: 0% failure rate under load, average response latency ~69ms.*

---

## 📡 API Reference Index

### Authentication
* `POST /api/v1/auth/register` - Create user credentials.
* `POST /api/v1/auth/token` - Fetch bearer token (OAuth2 password flow).

### Hyperlocal Forecast
* `POST /api/v1/forecast/` - Predicts 24h-72h hyperlocal AQI targets using GNN models (cached via Redis).

### Multi-Agent Actions
* `POST /api/v1/health-risk/advisory` - Formulates citizen alerts based on active GNN forecast spikes.
* `POST /api/v1/policy/evaluate` - Evaluates long-term admin policies (requires ADMIN/ANALYST token).

### Knowledge Graph
* `POST /api/v1/knowledge-graph/ingest` - Re-initialize graph.
* `GET /api/v1/knowledge-graph/search` - Query nodes by label/name.
* `GET /api/v1/knowledge-graph/impact-analysis` - Trace downstream pollutant paths.
* `GET /api/v1/knowledge-graph/root-cause` - Traces upstream emitters.
