import pytest
import httpx

@pytest.mark.asyncio
async def test_forecast_and_cache(client: httpx.AsyncClient):
    payload = {
        "lat": 12.9716,
        "lon": 77.5946,
        "hours": 3
    }
    
    # 1. Fetch live forecast (computes using GNN)
    response_1 = await client.post("/api/v1/forecast/", json=payload)
    assert response_1.status_code == 200
    forecast_data = response_1.json()
    assert isinstance(forecast_data, list)
    assert len(forecast_data) == 3
    
    first_item = forecast_data[0]
    assert "timestamp" in first_item
    assert "pm25" in first_item
    assert "aqi" in first_item
    
    # 2. Fetch again (triggers Redis cache hit)
    response_2 = await client.post("/api/v1/forecast/", json=payload)
    assert response_2.status_code == 200
    cache_data = response_2.json()
    
    assert len(cache_data) == len(forecast_data)
    assert cache_data[0]["timestamp"] == first_item["timestamp"]
    assert abs(cache_data[0]["pm25"] - first_item["pm25"]) < 1e-4
