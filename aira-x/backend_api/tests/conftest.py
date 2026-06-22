import pytest
import httpx
from typing import AsyncGenerator
from main import app
from db.redis_db import redis_db
from db.neo4j_db import neo4j_db

@pytest.fixture(autouse=True)
async def initialize_db_connections():
    """
    Connect to Redis and Neo4j on the exact event loop of the current test
    to prevent cross-loop task conflicts.
    """
    await redis_db.connect()
    await neo4j_db.connect()
    yield
    await redis_db.close()
    await neo4j_db.close()

@pytest.fixture
async def client() -> AsyncGenerator[httpx.AsyncClient, None]:
    """
    HTTPX asynchronous client fixture using the current test's event loop.
    """
    async with httpx.AsyncClient(app=app, base_url="http://test") as ac:
        yield ac
