import pytest
import httpx

@pytest.mark.asyncio
async def test_agent_workflow_flow(client: httpx.AsyncClient):
    payload = {
        "query": "Suggest warnings for Delhi Central",
        "lat": 28.6139,
        "lon": 77.2090
    }
    
    response = await client.post("/api/v1/health-risk/advisory", json=payload)
    assert response.status_code == 200
    
    workflow_json = response.json()
    assert workflow_json["spike_detected"] is True
    assert "messages" in workflow_json
    assert len(workflow_json["messages"]) == 5 # 5 agents execute
    
    # Assert specific logs exist for intermediate agents
    msgs = "".join(workflow_json["messages"])
    assert "Forecast Agent" in msgs
    assert "Source Attribution" in msgs
    assert "Enforcement Agent" in msgs
    assert "Health Agent" in msgs
    assert "Policy Agent" in msgs
    
    assert "forecast" in workflow_json
    assert "attribution" in workflow_json
    assert "enforcement_plan" in workflow_json
    assert "health_advisory" in workflow_json
    assert "policy_plan" in workflow_json
