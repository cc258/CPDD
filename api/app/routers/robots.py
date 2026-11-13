from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..deps import get_current_user
from ..models import ROLE_ROBOT, STAFF_ROLES, Robot, RobotContact, User
from ..schemas import RobotCreate, RobotMeta, RobotOut, RobotUpdate

router = APIRouter(prefix="/robots", tags=["机器人"])


def _clean_presets(presets) -> list[dict]:
    cleaned = []
    for item in presets:
        user_line = (item.user or "").strip()
        robot_line = (item.robot or "").strip()
        # 任意一侧有内容都保留，避免单侧填写的预设丢失
        if user_line or robot_line:
            cleaned.append({"user": user_line, "robot": robot_line})
    return cleaned


async def _robot_out(db: AsyncSession, robot: Robot, owner: User, added: bool) -> RobotOut:
    robot_user = await db.get(User, robot.user_id)
    return RobotOut(
        id=robot.id,
        user_id=robot.user_id,
        name=robot_user.username,
        intro=robot.intro,
        owner_id=robot.owner_id,
        owner_name=owner.username,
        preset_count=len(robot.presets or []),
        added=added,
        created_at=robot.created_at,
    )


@router.get("/by-user/{user_id}", response_model=RobotMeta, summary="机器人脚本")
async def robot_meta(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    me: User = Depends(get_current_user),
):
    robot = await db.scalar(select(Robot).where(Robot.user_id == user_id))
    if robot is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "机器人不存在")
    if me.role not in STAFF_ROLES and robot.owner_id != me.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "无权查看该机器人")

    robot_user = await db.get(User, user_id)
    return RobotMeta(
        name=robot_user.username,
        intro=robot.intro,
        presets=robot.presets or [],
    )


@router.get("", response_model=list[RobotOut], summary="机器人列表（仅自己可见，管理员可见全部）")
async def list_robots(
    db: AsyncSession = Depends(get_db),
    me: User = Depends(get_current_user),
):
    stmt = select(Robot, User).join(User, Robot.owner_id == User.id)
    if me.role not in STAFF_ROLES:
        stmt = stmt.where(Robot.owner_id == me.id)
    rows = (await db.execute(stmt.order_by(Robot.id.desc()))).all()
    added_ids = set(
        await db.scalars(select(RobotContact.robot_id).where(RobotContact.user_id == me.id))
    )
    return [await _robot_out(db, robot, owner, robot.id in added_ids) for robot, owner in rows]


@router.post("", response_model=RobotOut, status_code=201, summary="创建机器人")
async def create_robot(
    body: RobotCreate,
    db: AsyncSession = Depends(get_db),
    me: User = Depends(get_current_user),
):
    if await db.scalar(select(User).where(User.username == body.name)):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "该名称已被使用")

    # 机器人是特殊用户账号，密码不可用，无法登录
    robot_user = User(
        username=body.name,
        password_hash="!",
        role=ROLE_ROBOT,
        avatar_url=None,
    )
    db.add(robot_user)
    await db.flush()

    robot = Robot(
        user_id=robot_user.id,
        owner_id=me.id,
        intro=body.intro.strip(),
        presets=_clean_presets(body.presets),
    )
    db.add(robot)
    await db.flush()

    # 创建者自动添加到通讯录
    db.add(RobotContact(user_id=me.id, robot_id=robot.id))
    await db.commit()
    await db.refresh(robot)
    return await _robot_out(db, robot, me, True)


@router.put("/{robot_id}", response_model=RobotOut, summary="修改机器人")
async def update_robot(
    robot_id: int,
    body: RobotUpdate,
    db: AsyncSession = Depends(get_db),
    me: User = Depends(get_current_user),
):
    robot = await db.get(Robot, robot_id)
    if robot is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "机器人不存在")
    if me.role not in STAFF_ROLES and robot.owner_id != me.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "无权修改该机器人")

    robot_user = await db.get(User, robot.user_id)
    if body.name is not None:
        name = body.name.strip()
        if name != robot_user.username:
            exists = await db.scalar(
                select(User).where(User.username == name, User.id != robot_user.id)
            )
            if exists:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, "该名称已被使用")
            robot_user.username = name
    if body.intro is not None:
        robot.intro = body.intro.strip()
    if body.presets is not None:
        robot.presets = _clean_presets(body.presets)

    await db.commit()
    await db.refresh(robot)

    owner = await db.get(User, robot.owner_id)
    added = await db.scalar(
        select(RobotContact).where(
            RobotContact.user_id == me.id, RobotContact.robot_id == robot.id
        )
    )
    return await _robot_out(db, robot, owner, added is not None)


@router.post("/{robot_id}/add", status_code=204, summary="添加机器人")
async def add_robot(
    robot_id: int,
    db: AsyncSession = Depends(get_db),
    me: User = Depends(get_current_user),
):
    robot = await db.get(Robot, robot_id)
    if robot is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "机器人不存在")
    if me.role not in STAFF_ROLES and robot.owner_id != me.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "无权添加该机器人")

    exists = await db.scalar(
        select(RobotContact).where(
            RobotContact.user_id == me.id, RobotContact.robot_id == robot_id
        )
    )
    if exists is None:
        db.add(RobotContact(user_id=me.id, robot_id=robot_id))
        await db.commit()
