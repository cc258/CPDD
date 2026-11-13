import asyncio

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import SessionLocal, get_db
from ..deps import get_current_user
from ..models import ROLE_ROBOT, STAFF_ROLES, ChatMessage, Robot, RobotContact, User
from ..schemas import ContactOut, MessageOut
from ..security import decode_token

router = APIRouter(tags=["聊天"])


class ConnectionManager:
    """按用户路由 WebSocket 连接，同一用户可多端在线"""

    def __init__(self):
        self.active: dict[int, list[WebSocket]] = {}

    async def connect(self, user_id: int, ws: WebSocket):
        await ws.accept()
        self.active.setdefault(user_id, []).append(ws)

    def disconnect(self, user_id: int, ws: WebSocket):
        sockets = self.active.get(user_id, [])
        if ws in sockets:
            sockets.remove(ws)
        if not sockets:
            self.active.pop(user_id, None)

    async def send_to_user(self, user_id: int, message: dict):
        for ws in list(self.active.get(user_id, [])):
            try:
                await ws.send_json(message)
            except Exception:
                self.disconnect(user_id, ws)


manager = ConnectionManager()


def _message_payload(msg: ChatMessage, user: User) -> dict:
    return MessageOut(
        id=msg.id,
        user_id=msg.user_id,
        recipient_id=msg.recipient_id,
        username=user.username,
        role=user.role,
        avatar_url=user.avatar_url,
        content=msg.content,
        created_at=msg.created_at,
    ).model_dump(mode="json")


@router.get("/chat/online", response_model=list[int], summary="在线用户 ID")
async def online_users(me: User = Depends(get_current_user)):
    return [uid for uid in manager.active if uid != me.id]


@router.get("/chat/contacts", response_model=list[ContactOut], summary="会话列表（按最近对话排序）")
async def contacts(
    db: AsyncSession = Depends(get_db),
    me: User = Depends(get_current_user),
):
    users = list(
        await db.scalars(
            select(User).where(User.id != me.id, User.role != ROLE_ROBOT)
        )
    )
    robot_rows = (
        await db.execute(
            select(Robot, User)
            .join(User, Robot.user_id == User.id)
            .join(RobotContact, RobotContact.robot_id == Robot.id)
            .where(
                RobotContact.user_id == me.id,
                *([] if me.role in STAFF_ROLES else [Robot.owner_id == me.id]),
            )
        )
    ).all()

    # 每个会话的最后一条消息
    recent = (
        await db.scalars(
            select(ChatMessage)
            .where(or_(ChatMessage.user_id == me.id, ChatMessage.recipient_id == me.id))
            .order_by(ChatMessage.id.desc())
            .limit(2000)
        )
    ).all()
    last = {}
    for msg in recent:
        peer_id = msg.recipient_id if msg.user_id == me.id else msg.user_id
        last.setdefault(peer_id, msg)

    items = []
    for user in users:
        msg = last.get(user.id)
        items.append(
            ContactOut(
                id=user.id,
                username=user.username,
                role=user.role,
                avatar_url=user.avatar_url,
                last_message=msg.content if msg else None,
                last_at=msg.created_at if msg else None,
            )
        )
    for robot, robot_user in robot_rows:
        msg = last.get(robot_user.id)
        items.append(
            ContactOut(
                id=robot_user.id,
                username=robot_user.username,
                role=robot_user.role,
                avatar_url=robot_user.avatar_url,
                intro=robot.intro,
                last_message=msg.content if msg else None,
                last_at=msg.created_at if msg else None,
            )
        )

    chatty = sorted([i for i in items if i.last_at], key=lambda i: i.last_at, reverse=True)
    idle = sorted([i for i in items if not i.last_at], key=lambda i: (i.username.lower(), i.id))
    return chatty + idle


@router.get("/chat/history", response_model=list[MessageOut], summary="与某人的聊天记录")
async def chat_history(
    peer_id: int = Query(..., description="对方用户 ID"),
    db: AsyncSession = Depends(get_db),
    me: User = Depends(get_current_user),
):
    peer_robot = await db.scalar(select(Robot).where(Robot.user_id == peer_id))
    if peer_robot is not None and me.role not in STAFF_ROLES and peer_robot.owner_id != me.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "无权查看该会话")

    rows = (
        await db.execute(
            select(ChatMessage, User)
            .join(User, ChatMessage.user_id == User.id)
            .where(
                or_(
                    (ChatMessage.user_id == me.id) & (ChatMessage.recipient_id == peer_id),
                    (ChatMessage.user_id == peer_id) & (ChatMessage.recipient_id == me.id),
                )
            )
            .order_by(ChatMessage.id)
            .limit(200)
        )
    ).all()
    return [_message_payload(msg, sender) for msg, sender in rows]


@router.websocket("/ws/chat")
async def chat(ws: WebSocket):
    # 通过 query 参数传 JWT 鉴权
    try:
        user_id = decode_token(ws.query_params.get("token", ""))
    except Exception:
        await ws.close(code=4401)
        return

    async with SessionLocal() as db:
        user = await db.get(User, user_id)
    if user is None:
        await ws.close(code=4401)
        return

    await manager.connect(user_id, ws)
    try:
        while True:
            data = await ws.receive_json()
            content = (data.get("content") or "").strip()
            is_start = bool(data.get("start"))
            try:
                recipient_id = int(data.get("to"))
            except (TypeError, ValueError):
                continue
            if recipient_id == user_id:
                continue
            if not content and not is_start:
                continue

            msg = None
            replies = []
            async with SessionLocal() as db:
                recipient = await db.get(User, recipient_id)
                if recipient is None:
                    continue
                robot = await db.scalar(select(Robot).where(Robot.user_id == recipient_id))
                # 机器人仅创建者与管理员可聊天
                if robot is not None and user.role not in STAFF_ROLES and robot.owner_id != user_id:
                    continue

                if not is_start:
                    msg = ChatMessage(
                        user_id=user_id,
                        recipient_id=recipient_id,
                        content=content,
                    )
                    db.add(msg)
                    await db.commit()
                    await db.refresh(msg)

                # 机器人脚本：一句话的回复可以是连续的，不一定只有一条
                if robot is not None:
                    try:
                        preset_index = int(data.get("preset_index", 0))
                    except (TypeError, ValueError):
                        preset_index = 0
                    presets = robot.presets or []
                    lines = []
                    if is_start:
                        # 开场由机器人主动发言（左侧为空的行）
                        j = 0
                        while j < len(presets) and not (presets[j].get("user") or "").strip():
                            text = (presets[j].get("robot") or "").strip()
                            if text:
                                lines.append(text)
                            j += 1
                    elif 0 <= preset_index < len(presets):
                        # 当前行的回复
                        text = (presets[preset_index].get("robot") or "").strip()
                        if text:
                            lines.append(text)
                        # 后续没有用户发言的行，机器人继续连续说
                        j = preset_index + 1
                        while j < len(presets) and not (presets[j].get("user") or "").strip():
                            text = (presets[j].get("robot") or "").strip()
                            if text:
                                lines.append(text)
                            j += 1

                    for text in lines:
                        reply = ChatMessage(
                            user_id=recipient_id,
                            recipient_id=user_id,
                            content=text,
                        )
                        db.add(reply)
                        await db.commit()
                        await db.refresh(reply)
                        replies.append({"type": "message", "data": _message_payload(reply, recipient)})

            if msg is not None:
                payload = {"type": "message", "data": _message_payload(msg, user)}
                # 只推送给收发双方，发送方的其他设备也能同步
                await manager.send_to_user(recipient_id, payload)
                await manager.send_to_user(user_id, payload)

            # 机器人回复稍作延迟，避免和用户消息同时出现
            for reply_payload in replies:
                await asyncio.sleep(0.6)
                await manager.send_to_user(user_id, reply_payload)
    except WebSocketDisconnect:
        manager.disconnect(user_id, ws)
