from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .routers import auth, chat, files, robots, users

settings.upload_dir.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="CPDD API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_PREFIX = "/api"
app.include_router(auth.router, prefix=API_PREFIX)
app.include_router(users.router, prefix=API_PREFIX)
app.include_router(files.router, prefix=API_PREFIX)
app.include_router(robots.router, prefix=API_PREFIX)
app.include_router(chat.router, prefix=API_PREFIX)


@app.get(f"{API_PREFIX}/health", tags=["系统"], summary="健康检查")
async def health():
    return {"status": "ok"}
