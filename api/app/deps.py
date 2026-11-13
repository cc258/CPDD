import json
from datetime import datetime

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from .db import get_db
from .models import ROLE_ADMIN, ROLE_SUPER_ADMIN, User
from .redis import redis_client

bearer = HTTPBearer()


def _user_from_cache(data: dict) -> User:
    return User(
        id=data["id"],
        username=data["username"],
        email=data.get("email"),
        password_hash="",
        role=data.get("role", "user"),
        avatar_url=data.get("avatar_url"),
        created_at=datetime.fromisoformat(data["created_at"]),
    )


async def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    try:
        from .security import decode_token

        user_id = decode_token(creds.credentials)
    except jwt.PyJWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "无效的登录凭证")

    # 先查 Redis 会话缓存
    cached = await redis_client.get(f"user:{user_id}")
    if cached:
        return _user_from_cache(json.loads(cached))

    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "用户不存在")

    await redis_client.setex(
        f"user:{user_id}",
        60,
        json.dumps(
            {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "role": user.role,
                "avatar_url": user.avatar_url,
                "created_at": user.created_at.isoformat(),
            }
        ),
    )
    return user


async def get_staff(user: User = Depends(get_current_user)) -> User:
    """管理员或超级管理员"""
    if user.role not in (ROLE_SUPER_ADMIN, ROLE_ADMIN):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "需要管理员权限")
    return user


async def get_super_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != ROLE_SUPER_ADMIN:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "需要超级管理员权限")
    return user


async def invalidate_user_cache(user_id: int) -> None:
    await redis_client.delete(f"user:{user_id}")
