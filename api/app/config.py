from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://cpdd:cpdd@localhost:5432/cpdd"
    redis_url: str = "redis://localhost:6379/0"

    jwt_secret: str = "change-me-in-production"
    jwt_alg: str = "HS256"
    token_expire_minutes: int = 60 * 24

    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://localhost:5174",
    ]

    # 前端地址，用于二维码登录生成的扫码链接
    web_base_url: str = "http://localhost:5173"

    # 未接入邮件服务时，是否在接口响应中返回密码重置令牌（仅开发环境开启）
    expose_reset_token: bool = True

    upload_dir: Path = Path("uploads")


settings = Settings()
