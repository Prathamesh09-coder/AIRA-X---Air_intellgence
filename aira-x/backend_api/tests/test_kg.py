import pytest
import httpx

@pytest.mark.asyncio
async def test_knowledge_graph_endpoints(client: httpx.AsyncClient):
    # 1. Ingest/Seed Data
    ingest_res = await client.post("/api/v1/knowledge-graph/ingest")
    assert ingest_res.status_code == 200
    assert ingest_res.json()["status"] == "success"
    
    # 2. General Search
    search_res = await client.get("/api/v1/knowledge-graph/search?query=Apex")
    assert search_res.status_code == 200
    search_json = search_res.json()
    assert isinstance(search_json, list)
    assert len(search_json) > 0
    assert "Apex Brick Kiln" in [n["name"] for n in search_json]
    
    # 3. Impact Analysis Traversal
    impact_res = await client.get("/api/v1/knowledge-graph/impact-analysis?source=Apex%20Brick%20Kiln")
    assert impact_res.status_code == 200
    impact_json = impact_res.json()
    assert isinstance(impact_json, list)
    assert len(impact_json) > 0
    first_impact = impact_json[0]
    assert first_impact["source"]["name"] == "Apex Brick Kiln"
    assert "pollutant" in first_impact
    assert "impacted_population" in first_impact
    
    # 4. Root Cause Traicing Traversal
    root_res = await client.get("/api/v1/knowledge-graph/root-cause?target=Okhla%20Vihar%20Residential")
    assert root_res.status_code == 200
    root_json = root_res.json()
    assert isinstance(root_json, list)
    assert len(root_json) > 0
    first_cause = root_json[0]
    assert first_cause["target"]["name"] == "Okhla Vihar Residential"
    assert "source" in first_cause
    assert "type" in first_cause["source"]
