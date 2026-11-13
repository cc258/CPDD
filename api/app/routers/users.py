from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..deps import get_current_user, get_staff, invalidate_user_cache
from ..models import ROLE_ROBOT, ROLE_SUPER_ADMIN, ROLES, STAFF_ROLES, User
from ..schemas import UserCreate, UserOut, UserUpdate
from ..security import hash_password

router = APIRouter(prefix="/users", tags=["用户"])


def _assert_role_value(role: str) -> None:
    if role not in ROLES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"无效的角色：{role}")


def _assert_can_manage(actor: User, target: User | None = None) -> None:
    """管理员只能管理普通用户和 VIP，超级管理员可管理所有用户"""
    if actor.role == ROLE_SUPER_ADMIN:
        return
    if target is not None and target.role in STAFF_ROLES:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "无权管理管理员账号")


@router.get("", response_model=list[UserOut], summary="用户列表")
async def list_users(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return list(
        await db.scalars(
            select(User).where(User.role != ROLE_ROBOT).order_by(User.id)
        )
    )


@router.get("/{user_id}", response_model=UserOut, summary="用户详情")
async def get_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "用户不存在")
    return user


@router.post("", response_model=UserOut, status_code=201, summary="新增用户")
async def create_user(
    body: UserCreate,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(get_staff),
):
    _assert_role_value(body.role)
    if actor.role != ROLE_SUPER_ADMIN and body.role in STAFF_ROLES:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "只有超级管理员可以创建管理员")

    exists = await db.scalar(select(User).where(User.username == body.username))
    if exists:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "用户名已存在")

    user = User(
        username=body.username,
        email=body.email,
        password_hash=hash_password(body.password),
        role=body.role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.put("/{user_id}", response_model=UserOut, summary="编辑用户")
async def update_user(
    user_id: int,
    body: UserUpdate,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(get_staff),
):
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "用户不存在")

    _assert_can_manage(actor, user)

    if body.role is not None:
        _assert_role_value(body.role)
        if actor.role != ROLE_SUPER_ADMIN and body.role in STAFF_ROLES:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "只有超级管理员可以设置管理员角色")
        if user.id == actor.id and body.role != ROLE_SUPER_ADMIN:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "不能降低自己的角色")

    if body.username is not None:
        user.username = body.username
    if body.email is not None:
        user.email = body.email
    if body.password:
        user.password_hash = hash_password(body.password)
    if body.role is not None:
        user.role = body.role
    if body.avatar_url is not None:
        user.avatar_url = body.avatar_url

    await db.commit()
    await db.refresh(user)
    await invalidate_user_cache(user_id)
    return user


@router.delete("/{user_id}", status_code=204, summary="删除用户")
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(get_staff),
):
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "用户不存在")

    if user.id == actor.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "不能删除自己")

    _assert_can_manage(actor, user)

    await db.delete(user)
    await db.commit()
    await invalidate_user_cache(user_id)
