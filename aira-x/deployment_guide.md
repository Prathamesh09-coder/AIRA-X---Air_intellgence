# Production Deployment Guide: Urban Air Quality Intelligence Platform

This operations manual guides deployment, configuration, database initialization, and monitoring in a production setting.

---

## 1. System Requirements

* **Operating System**: Linux (Ubuntu 22.04 LTS recommended)
* **Processor**: 4 Cores minimum (8 Cores recommended for forecasting load)
* **Memory**: 16 GB RAM minimum
* **Storage**: 100 GB SSD storage minimum
* **Software**: Docker Engine 24.0.0+ and Docker Compose v2.20.0+

---

## 2. Configuration & Secrets (`.env`)

Create a secure `.env` file in the `backend_api` directory containing the following parameters:

```bash
# PostgreSQL Config
POSTGRES_USER=postgres
POSTGRES_PASSWORD=generate_a_secure_long_password
POSTGRES_DB=urban_aqi

# Neo4j Graph Config
NEO4J_PASSWORD=generate_a_secure_graph_password

# MLflow Config
MLFLOW_TRACKING_URI=http://mlflow:5000

# Security (JWT)
JWT_SECRET_KEY=generate_a_64_character_hex_key
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60

# Environment Mode
ENVIRONMENT=production
```

---

## 3. Running the Stack (Unified Container Deployment)

Both the backend services (PostGIS, Redis, Neo4j, MLflow, FastAPI) and the frontend Next.js/TanStack Start application are fully containerized. You can boot the entire platform with a single command.

### Production Mode (Hardened & Resource-Constrained)
To start the services with pinned resource limits, multiple Uvicorn worker clusters, and production builds:
```bash
docker compose -f docker-compose.prod.yml up -d --build
```
* **Frontend**: Exposed on `http://localhost:3000`
* **API Server**: Exposed on `http://localhost:8000`
* **MLflow Tracking**: Exposed on `http://localhost:5050`
* **Neo4j Browser**: Exposed on `http://localhost:7474`

### Development/Debugging Mode
To run with dynamic hot-reloading:
```bash
docker compose up -d --build
```

---

## 4. Cloud VPS Step-by-Step Deployment (AWS, DigitalOcean, GCP)

To deploy the unified stack to a clean cloud Virtual Private Server (VPS):

### Step 1: Provision the VM
* Launch a Virtual Machine (e.g., DigitalOcean Droplet, AWS EC2, or GCP Compute Engine) running **Ubuntu 22.04 LTS**.
* Recommended specs: **8 GB RAM, 4 vCPUs, 80 GB SSD**.

### Step 2: Install Docker and Docker Compose
Run the following script on the server to install Docker:
```bash
sudo apt update && sudo apt install -y curl git
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
newgrp docker
```

### Step 3: Clone the Repository
Clone the repository directly onto the VPS:
```bash
git clone https://github.com/Prathamesh09-coder/AIRA-X---Air_ntellgence.git
cd AIRA-X---Air_ntellgence/aira-x
```

### Step 4: Configure the Environment Variables
Create the production `.env` file inside the `backend_api` directory:
```bash
nano backend_api/.env
```
Populate the secure configurations (passwords, JWT secrets, etc.) as detailed in Section 2.

### Step 5: Start the Stack
Boot all containers in daemon mode:
```bash
docker compose -f docker-compose.prod.yml up -d --build
```

### Step 6: Post-Deployment Ingestion & Seeding
Once the stack is running, seed the Neo4j Knowledge Graph:
```bash
curl -X POST http://localhost:8000/api/v1/knowledge-graph/ingest
```

---

## 5. Production Hardening Checklist

* [ ] **SSL Termination (Nginx / Caddy)**: Configure a reverse proxy on ports 80/443 to handle SSL (HTTPS) certificates and forward requests to the frontend container (port 3000) and backend API (port 8000).
* [ ] **Change Default Credentials**: Verify that default passwords for PostGIS, Neo4j, and the JWT Secret Key are updated in `backend_api/.env`.
* [ ] **Network Firewalls (Cloud Security Groups)**: Block external access to ports `5432` (PostGIS), `6379` (Redis), and `7687` (Neo4j). Only expose ports `80` (HTTP) and `443` (HTTPS) to the public.
* [ ] **Log Rotation**: Configure Docker log limits in `/etc/docker/daemon.json` to prevent disk capacity exhaustion from long-running containers.
