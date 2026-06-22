# Detailed Cloud Deployment Guide: Vercel (Frontend) & Render (Backend)

This operations guide explains how to deploy the **AIRA-X Platform** using a modern cloud-native hybrid architecture: serving the **FastAPI/PostGIS/Redis backend** on **Render** (via automated blueprints) and the **Vite/React frontend** on **Vercel** (with SPA path routing).

---

## 🛠️ Step 1: Deploy Backend Stack on Render

Render will host the FastAPI application, a managed PostgreSQL database, and a Redis instance using the project's [render.yaml](../render.yaml) blueprint configuration.

### 1. Set Up Managed Neo4j on AuraDB
Since Render does not offer managed Neo4j instances on the free/starter tier, we utilize **Neo4j AuraDB** (which is the official cloud service from Neo4j).
1. Go to [Neo4j Aura Console](https://console.neo4j.io/) and log in (or sign up for a free account).
2. Click **Create Database** ➜ Choose the **AuraDB Free** instance.
3. Once the database is provisioned, download the `.env` credentials file containing:
   * **Connection URI**: e.g., `neo4j+s://cf9f6491.databases.neo4j.io`
   * **Username**: `neo4j` (or your database instance ID like `cf9f6491`)
   * **Password**: `UFdxeNHTbFBNvzLjDeWqGiyQEWUCjjdcx4wkObD4zjU`
4. Confirm that these credentials match the environment keys in your local [render.yaml](../render.yaml) file.

### 2. Deploy Render Blueprints
1. Go to the [Render Dashboard](https://dashboard.render.com/) and log in.
2. Click the **New** button (top right) and select **Blueprint**.
3. Connect your GitHub repository: `Prathamesh09-coder/AIRA-X---Air_intellgence`.
4. Render will read your `render.yaml` configuration and list the resources to create:
   * `aira-x-db` (PostgreSQL Database)
   * `aira-x-redis` (Redis cache service)
   * `aira-x-api` (FastAPI Docker web service)
5. Review the variables:
   * Render will automatically pre-fill your Neo4j credentials from the pushed `render.yaml` file.
   * Render will auto-generate a secure `JWT_SECRET_KEY` on startup.
6. Click **Apply**. Render will first spin up PostgreSQL and Redis. Once they are healthy, it will trigger the multi-stage Docker build for the `api` service.
7. Once the API status turns green (**Live**), copy your public API URL from the dashboard (e.g. `https://aira-x-api.onrender.com`).

### 3. Ingest and Seed the Knowledge Graph
After deployment, you must seed the tables and Neo4j relations:
* Send a POST request to:
  `https://your-render-api-url.onrender.com/api/v1/knowledge-graph/ingest`
  *(You can trigger this by running `curl -X POST https://your-render-api-url.onrender.com/api/v1/knowledge-graph/ingest` in your local terminal or by hitting the endpoint in Postman).*

---

## 💻 Step 2: Deploy Frontend on Vercel

Vercel will build the frontend assets and host the static SPA, routing client requests to your Render API.

### 1. Import Project
1. Log into your [Vercel Dashboard](https://vercel.com).
2. Click **Add New** ➜ **Project**.
3. Import your GitHub repository: `Prathamesh09-coder/AIRA-X---Air_intellgence`.

### 2. Configure Build Settings
Configure Vercel with these settings:
* **Framework Preset**: Choose **Vite** (or let it auto-detect).
* **Root Directory**: Click *Edit* and select **`aira-x/frontend`**. This is critical because the frontend code is in a subdirectory.
* **Build Command**: `npm run build`
* **Output Directory**: `dist/client`

### 3. Set Up Environment Variables
Under the **Environment Variables** section, add your API connection token:
* **Key**: `VITE_API_URL`
* **Value**: Your Render API URL with the `/api/v1` suffix (e.g., `https://aira-x-api.onrender.com/api/v1`).
  *(Note: Do not add a trailing slash).*

### 4. Deploy and Verify
* Click **Deploy**. Vercel will install dependencies, build the assets, and deploy the application.
* The frontend will be assigned a public URL (e.g. `https://aira-x-frontend.vercel.app`).
* Vercel will automatically configure rewrite rules using the pushed [vercel.json](./vercel.json) to map all frontend client routing (like refreshing on `/forecasting` or `/source-attribution`) back to `index.html` preventing 404 errors.

---

## 🔒 Step 3: Verify the Live Integration

To verify that the frontend is successfully communicating with the live Render backend:
1. Open your Vercel deployment link in the browser.
2. Select a role (e.g., **City Administrator**) from the dropdown. This injects the `X-Demo-Role` header.
3. Navigate to **Hyperlocal Forecasting** or **Source Attribution** to confirm that the charts are drawing real, structured data from your PostGIS and GNN engines.
4. Navigate to the **Citizen Health** page, toggle localized tabs (English, Hindi, Marathi), and verify the LangGraph translations match the backend.
