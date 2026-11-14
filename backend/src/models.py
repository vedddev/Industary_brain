from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Integer, String, true
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, validates


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


# NOTE ON SCHEMA CHANGES
# Columns added after the first release are nullable or carry a server_default. That lets
# src/database.py add them to an existing database automatically (see _apply_additive_migrations).
# Anything that is not additive (renames, type changes, new NOT NULL columns without a default)
# needs a real migration tool such as Alembic.


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(512), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    # --- profile and account state (added later; all safe to add to an existing table) ---
    name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    plan: Mapped[str] = mapped_column(String(32), nullable=False, default="free", server_default="free")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default=true())
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    password_changed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, onupdate=utcnow)

    @validates("email")
    def _normalize_email(self, _key: str, value: str) -> str:
        return value.strip().casefold()  # defence in depth: stored emails are always lower-case

    def public_dict(self) -> dict:
        """Everything the frontend may see. Never include password_hash here."""
        return {
            "id": str(self.id),
            "email": self.email,
            "name": self.name,
            "plan": self.plan,
            "created_at": self.created_at.isoformat(),
        }

    def __repr__(self) -> str:  # keeps hashes out of logs and tracebacks
        return f"<User id={self.id} email={self.email!r}>"


class AuthSession(Base):
    __tablename__ = "auth_sessions"

    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    csrf_token: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)

    # --- device info and idle tracking (added later) ---
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(255), nullable=True)

    def __repr__(self) -> str:
        return f"<AuthSession user_id={self.user_id} expires_at={self.expires_at}>"


class Document(Base):
    """One uploaded file. The text itself lives in the vector store; this row records who uploaded
    what and when, so documents can be listed, owned and (later) deleted per user."""

    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )  # NULL = uploaded while logged out; kept if the user is deleted
    doc_id: Mapped[str] = mapped_column(String(32), index=True, nullable=False)  # content hash from src/ingest.py
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_type: Mapped[str] = mapped_column(String(10), nullable=False)
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    chunk_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    def public_dict(self) -> dict:
        return {
            "id": str(self.id),
            "doc_id": self.doc_id,
            "name": self.filename,
            "file_type": self.file_type,
            "size": self.size_bytes,
            "chunks": self.chunk_count,
            "created_at": self.created_at.isoformat(),
        }