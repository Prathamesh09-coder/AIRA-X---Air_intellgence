import redis.asyncio as redis
from core.config import settings
from core.logging import logger

class RedisConnection:
    def __init__(self):
        self.client = None

    async def connect(self):
        try:
            self.client = redis.from_url(settings.REDIS_URL, decode_responses=True)
            await self.client.ping()
            logger.info("Connected to Redis successfully")
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")

    async def close(self):
        if self.client:
            await self.client.close()

redis_db = RedisConnection()

async def get_redis():
    return redis_db.client
