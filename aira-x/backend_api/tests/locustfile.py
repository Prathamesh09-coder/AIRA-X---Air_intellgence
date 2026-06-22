import random
from locust import HttpUser, task, between

class SmartCityAQIUser(HttpUser):
    # Simulate a user waiting between 1 to 3 seconds between actions
    wait_time = between(1, 3)
    
    @task(3)
    def query_forecast(self):
        """
        Simulate queries to the GNN Forecasting engine (which leverages Redis caching).
        """
        payload = {
            "lat": 12.9716 + random.uniform(-0.05, 0.05),
            "lon": 77.5946 + random.uniform(-0.05, 0.05),
            "hours": 12
        }
        self.client.post("/api/v1/forecast/", json=payload)

    @task(1)
    def query_agent_workflow(self):
        """
        Simulate queries triggering the multi-agent decision graph.
        """
        payload = {
            "query": f"Analyze spikes in Sector {random.randint(1, 10)}",
            "lat": 28.6139 + random.uniform(-0.05, 0.05),
            "lon": 77.2090 + random.uniform(-0.05, 0.05)
        }
        self.client.post("/api/v1/health-risk/advisory", json=payload)

    @task(2)
    def search_knowledge_graph(self):
        """
        Simulate queries fetching elements from the Neo4j Knowledge Graph.
        """
        keywords = ["Okhla", "Apex", "Metro", "Silk", "Junction", "Central"]
        kw = random.choice(keywords)
        self.client.get(f"/api/v1/knowledge-graph/search?query={kw}")
