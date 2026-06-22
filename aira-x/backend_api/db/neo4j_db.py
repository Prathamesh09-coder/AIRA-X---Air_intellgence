from neo4j import AsyncGraphDatabase
from core.config import settings
from core.logging import logger

class Neo4jConnection:
    def __init__(self):
        self.driver = None

    async def connect(self):
        try:
            self.driver = AsyncGraphDatabase.driver(
                settings.NEO4J_URI,
                auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD)
            )
            logger.info("Connected to Neo4j successfully")
        except Exception as e:
            logger.error(f"Failed to connect to Neo4j: {e}")

    async def close(self):
        if self.driver:
            await self.driver.close()

neo4j_db = Neo4jConnection()

async def get_neo4j_session():
    async with neo4j_db.driver.session() as session:
        yield session
