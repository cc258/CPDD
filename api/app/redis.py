import redis.asyncio as redis

from .config import settings

# Redis：缓存用户会话信息
redis_client = redis.from_url(settings.redis_url, decode_responses=True)
