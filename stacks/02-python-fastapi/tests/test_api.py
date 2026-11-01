import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app


@pytest.mark.asyncio
async def test_health_check():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"


@pytest.mark.asyncio
async def test_root():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "docs" in data


@pytest.mark.asyncio
async def test_auth_and_protected_flow():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Signup
        signup_payload = {
            "email": "testuser@example.com",
            "username": "testuser",
            "password": "Password123!",
        }
        signup_res = await ac.post("/api/auth/signup", json=signup_payload)
        assert signup_res.status_code in [201, 409]

        # Login
        login_payload = {
            "username_or_email": "testuser",
            "password": "Password123!",
        }
        login_res = await ac.post("/api/auth/login", json=login_payload)
        assert login_res.status_code == 200
        token_data = login_res.json()
        assert "access_token" in token_data

        token = token_data["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Get Profile
        me_res = await ac.get("/api/auth/me", headers=headers)
        assert me_res.status_code == 200
        assert me_res.json()["username"] == "testuser"

        # AI endpoint
        ai_res = await ac.post(
            "/api/ai/generate",
            json={"prompt": "Analyze hackathon feasibility"},
            headers=headers,
        )
        assert ai_res.status_code == 200
        assert "response" in ai_res.json()

