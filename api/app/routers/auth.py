import base64
import io
import json
import secrets
import uuid

import qrcode
import qrcode.image.svg
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..db import get_db
from ..deps import get_current_user, invalidate_user_cache
from ..models import ROLE_ROBOT, ROLE_SUPER_ADMIN, ROLE_USER, User
from ..redis import redis_client
from ..schemas import (
    ForgotPasswordIn,
    ForgotPasswordOut,
    LoginIn,
    QRCodeOut,
    QRStatusOut,
    RegisterIn,
    ResetPasswordIn,
    Token,
    UserOut,
)
from ..security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["认证"])

RESET_TOKEN_TTL = 15 * 60
QR_TTL = 120


def _make_qr_svg(url: str) -> str:
    """生成二维码 SVG 的 data URI"""
    image = qrcode.make(url, image_factory=qrcode.image.svg.SvgPathImage)
    buffer = io.BytesIO()
    image.save(buffer)
    encoded = base64.b64encode(buffer.getvalue()).decode()
    return f"data:image/svg+xml;base64,{encoded}"


@router.post("/register", response_model=Token, summary="注册")
async def register(body: RegisterIn, db: AsyncSession = Depends(get_db)):
    exists = await db.scalar(select(User).where(User.username == body.username))
    if exists:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "用户名已存在")
    if body.email:
        exists_email = await db.scalar(select(User).where(User.email == body.email))
        if exists_email:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "邮箱已被注册")

    # 第一个注册的用户为超级管理员
    is_first = (await db.scalar(select(func.count()).select_from(User))) == 0
    user = User(
        username=body.username,
        email=body.email,
        password_hash=hash_password(body.password),
        role=ROLE_SUPER_ADMIN if is_first else ROLE_USER,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    return Token(
        access_token=create_access_token(user.id),
        user=UserOut.model_validate(user),
    )


@router.post("/login", response_model=Token, summary="登录")
async def login(body: LoginIn, db: AsyncSession = Depends(get_db)):
    user = await db.scalar(select(User).where(User.username == body.username))
    if user is None or user.role == ROLE_ROBOT:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "用户名或密码错误")
    if not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "用户名或密码错误")

    return Token(
        access_token=create_access_token(user.id),
        user=UserOut.model_validate(user),
    )


@router.get("/me", response_model=UserOut, summary="当前用户")
async def me(user: User = Depends(get_current_user)):
    return user


@router.post("/forgot-password", response_model=ForgotPasswordOut, summary="忘记密码")
async def forgot_password(body: ForgotPasswordIn, db: AsyncSession = Depends(get_db)):
    user = await db.scalar(select(User).where(User.username == body.username))
    # 无论用户是否存在都返回相同提示，避免用户名枚举
    reset_token = None
    if user is not None:
        reset_token = secrets.token_urlsafe(32)
        await redis_client.setex(f"reset:{reset_token}", RESET_TOKEN_TTL, str(user.id))

    return ForgotPasswordOut(
        message="重置令牌已生成，请在 15 分钟内完成重置",
        reset_token=reset_token if settings.expose_reset_token else None,
    )


@router.post("/reset-password", summary="重置密码")
async def reset_password(body: ResetPasswordIn, db: AsyncSession = Depends(get_db)):
    user_id = await redis_client.get(f"reset:{body.token}")
    if user_id is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "重置令牌无效或已过期")

    user = await db.get(User, int(user_id))
    if user is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "用户不存在")

    user.password_hash = hash_password(body.new_password)
    await db.commit()
    await redis_client.delete(f"reset:{body.token}")
    await invalidate_user_cache(user.id)
    return {"message": "密码已重置，请使用新密码登录"}


@router.post("/qr/create", response_model=QRCodeOut, summary="创建登录二维码")
async def create_qr():
    qr_id = uuid.uuid4().hex
    await redis_client.setex(
        f"qr:{qr_id}", QR_TTL, json.dumps({"status": "pending"})
    )
    qr_url = f"{settings.web_base_url}/qr/{qr_id}"
    return QRCodeOut(
        qr_id=qr_id,
        qr_url=qr_url,
        qr_image=_make_qr_svg(qr_url),
        expires_in=QR_TTL,
    )


@router.get("/qr/{qr_id}/status", response_model=QRStatusOut, summary="轮询扫码状态")
async def qr_status(qr_id: str, db: AsyncSession = Depends(get_db)):
    raw = await redis_client.get(f"qr:{qr_id}")
    if raw is None:
        return QRStatusOut(status="expired")

    state = json.loads(raw)
    if state.get("status") != "confirmed":
        return QRStatusOut(status="pending")

    user = await db.get(User, int(state["user_id"]))
    if user is None:
        return QRStatusOut(status="expired")

    # 扫码确认后一次性消费二维码
    await redis_client.delete(f"qr:{qr_id}")
    return QRStatusOut(
        status="confirmed",
        token=Token(
            access_token=create_access_token(user.id),
            user=UserOut.model_validate(user),
        ),
    )


@router.post("/qr/{qr_id}/confirm", summary="确认扫码登录")
async def confirm_qr(qr_id: str, user: User = Depends(get_current_user)):
    raw = await redis_client.get(f"qr:{qr_id}")
    if raw is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "二维码已过期")

    await redis_client.setex(
        f"qr:{qr_id}",
        QR_TTL,
        json.dumps({"status": "confirmed", "user_id": user.id}),
    )
    return {"message": "确认成功，请回到登录页面"}
