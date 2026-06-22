import pytest
import httpx
import uuid

@pytest.mark.asyncio
async def test_auth_flow(client: httpx.AsyncClient):
    # Create unique email to prevent database conflicts
    email = f"test_{uuid.uuid4().hex[:6]}@smartcity.gov.in"
    password = "SecurePassword123"
    
    # 1. Register Citizen User
    reg_response = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password, "role": "citizen"}
    )
    assert reg_response.status_code == 200
    reg_json = reg_response.json()
    assert reg_json["email"] == email
    assert reg_json["role"] == "citizen"
    
    # 2. Re-registering Same Email (Should fail)
    fail_response = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password, "role": "citizen"}
    )
    assert fail_response.status_code == 400
    assert "already registered" in fail_response.json()["detail"]
    
    # 3. Retrieve Access Token
    token_response = await client.post(
        "/api/v1/auth/token",
        data={"username": email, "password": password}
    )
    assert token_response.status_code == 200
    token_json = token_response.json()
    assert "access_token" in token_json
    assert token_json["token_type"] == "bearer"
    
    # 4. Access Restricted Endpoint with role (citizen role calling analyst/admin endpoint should get 403 Forbidden)
    headers = {"Authorization": f"Bearer {token_json['access_token']}"}
    eval_response = await client.post(
        "/api/v1/policy/evaluate",
        json={"query": "test query", "lat": 28.6139, "lon": 77.2090},
        headers=headers
    )
    assert eval_response.status_code == 403
