from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class LoginIn(BaseModel):
    username: str
    password: str


class RegisterIn(BaseModel):
    username: str = Field(min_length=2, max_length=32)
    password: str = Field(min_length=6, max_length=64)
    email: EmailStr | None = None


class UserCreate(BaseModel):
    username: str = Field(min_length=2, max_length=32)
    password: str = Field(min_length=6, max_length=64)
    email: EmailStr | None = None
    role: str = "user"


class UserUpdate(BaseModel):
    username: str | None = None
    password: str | None = None
    email: EmailStr | None = None
    role: str | None = None
    avatar_url: str | None = None


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: str | None
    role: str
    avatar_url: str | None
    created_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class ForgotPasswordIn(BaseModel):
    username: str


class ResetPasswordIn(BaseModel):
    token: str
    new_password: str = Field(min_length=6, max_length=64)


class ForgotPasswordOut(BaseModel):
    message: str
    # 未配置邮件服务时，开发环境直接返回重置令牌
    reset_token: str | None = None


class QRCodeOut(BaseModel):
    qr_id: str
    qr_url: str
    qr_image: str
    expires_in: int


class QRStatusOut(BaseModel):
    status: str
    token: Token | None = None


class FileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    filename: str
    content_type: str
    size: int
    owner_id: int
    created_at: datetime


class FileUpdate(BaseModel):
    filename: str | None = None


class MessageOut(BaseModel):
    id: int
    user_id: int
    recipient_id: int
    username: str
    role: str
    avatar_url: str | None
    content: str
    created_at: datetime


class RobotPreset(BaseModel):
    # 允许只填一侧：只填 user 表示连续发送、机器人不回复
    user: str = ""
    robot: str = ""


class RobotCreate(BaseModel):
    name: str = Field(min_length=2, max_length=32)
    intro: str = ""
    presets: list[RobotPreset] = []


class RobotUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=32)
    intro: str | None = None
    presets: list[RobotPreset] | None = None


class RobotOut(BaseModel):
    id: int
    user_id: int
    name: str
    intro: str
    owner_id: int
    owner_name: str
    preset_count: int
    added: bool
    created_at: datetime


class RobotMeta(BaseModel):
    name: str
    intro: str
    presets: list[RobotPreset]


class ContactOut(BaseModel):
    id: int
    username: str
    role: str
    avatar_url: str | None
    intro: str = ""
    last_message: str | None = None
    last_at: datetime | None = None
