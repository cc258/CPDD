import uuid
from pathlib import Path

import aiofiles
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..db import get_db
from ..deps import get_current_user, get_staff
from ..models import FileRecord, User
from ..schemas import FileOut, FileUpdate

router = APIRouter(prefix="/files", tags=["文件"])


@router.post("/upload", response_model=FileOut, status_code=201, summary="上传文件")
async def upload_file(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    stored_name = f"{uuid.uuid4().hex}_{file.filename}"
    stored_path = settings.upload_dir / stored_name

    size = 0
    async with aiofiles.open(stored_path, "wb") as f:
        while chunk := await file.read(1024 * 1024):
            size += len(chunk)
            await f.write(chunk)

    record = FileRecord(
        filename=file.filename,
        content_type=file.content_type or "application/octet-stream",
        size=size,
        stored_path=str(stored_path),
        owner_id=user.id,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return record


@router.get("", response_model=list[FileOut], summary="文件列表")
async def list_files(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return list(await db.scalars(select(FileRecord).order_by(FileRecord.id.desc())))


@router.get("/{file_id}", response_model=FileOut, summary="文件详情")
async def get_file(
    file_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    record = await db.get(FileRecord, file_id)
    if record is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "文件不存在")
    return record


@router.get("/{file_id}/download", summary="下载文件")
async def download_file(
    file_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    record = await db.get(FileRecord, file_id)
    if record is None or not Path(record.stored_path).exists():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "文件不存在")
    return FileResponse(
        record.stored_path,
        media_type=record.content_type,
        filename=record.filename,
    )


@router.patch("/{file_id}", response_model=FileOut, summary="编辑文件信息")
async def update_file(
    file_id: int,
    body: FileUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    record = await db.get(FileRecord, file_id)
    if record is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "文件不存在")
    if body.filename is not None:
        record.filename = body.filename
    await db.commit()
    await db.refresh(record)
    return record


@router.delete("/{file_id}", status_code=204, summary="删除文件")
async def delete_file(
    file_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_staff),
):
    record = await db.get(FileRecord, file_id)
    if record is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "文件不存在")

    path = Path(record.stored_path)
    if path.exists():
        path.unlink()
    await db.delete(record)
    await db.commit()
