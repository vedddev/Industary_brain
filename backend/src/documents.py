"""Records uploaded documents in the database (best effort).

Uploading must keep working even when the database is down, so every function here swallows
database errors and just logs them.
"""
from __future__ import annotations

import logging
import uuid
from typing import Iterable

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError

from src.database import DatabaseUnavailable, session_scope
from src.models import Document

log = logging.getLogger("documents")


def record_uploads(items: Iterable[dict], user_id: uuid.UUID | None = None) -> None:
    """items: dicts with file, doc_id, file_type, size_bytes, chunks (as built by /upload).
    Re-uploading the same content by the same owner updates the row instead of adding another."""
    try:
        with session_scope() as db:
            for item in items:
                owner = Document.user_id == user_id if user_id else Document.user_id.is_(None)
                row = db.scalar(select(Document).where(Document.doc_id == item["doc_id"], owner))
                if row is None:
                    row = Document(user_id=user_id, doc_id=item["doc_id"])
                    db.add(row)
                row.filename = item["file"][:255]
                row.file_type = item["file_type"][:10]
                row.size_bytes = int(item.get("size_bytes", 0))
                row.chunk_count = int(item["chunks"])
    except (DatabaseUnavailable, SQLAlchemyError):
        log.warning("Could not record uploaded documents (database unavailable); upload itself succeeded")


def list_documents(user_id: uuid.UUID, limit: int = 100) -> list[dict]:
    """Documents owned by one user, newest first (for a future GET /documents)."""
    with session_scope() as db:
        rows = db.scalars(
            select(Document).where(Document.user_id == user_id).order_by(Document.created_at.desc()).limit(limit)
        ).all()
        return [row.public_dict() for row in rows]
