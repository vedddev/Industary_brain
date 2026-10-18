"""Centralized runtime configuration for the API."""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BASE_DIR / ".env")
UPLOAD_DIR = BASE_DIR / "uploads"

# Separate PostgreSQL databases. The defaults are used by docker-compose.yml.
DOCUMENTS_DATABASE_URL = os.getenv("DOCUMENTS_DATABASE_URL", "postgresql+psycopg://industrial_app:industrial_app@localhost:5432/industrial_documents")
KNOWLEDGE_DATABASE_URL = os.getenv("KNOWLEDGE_DATABASE_URL", "postgresql+psycopg://industrial_app:industrial_app@localhost:5432/industrial_knowledge")
EMBEDDING_DIMENSIONS = int(os.getenv("EMBEDDING_DIMENSIONS", "768"))

MAX_UPLOAD_SIZE_BYTES = int(os.getenv("MAX_UPLOAD_SIZE_MB", "25")) * 1024 * 1024
MAX_FILES_PER_UPLOAD = int(os.getenv("MAX_FILES_PER_UPLOAD", "10"))
MAX_QUESTION_LENGTH = int(os.getenv("MAX_QUESTION_LENGTH", "4000"))


def allowed_origins() -> list[str]:
    """Return configured browser origins; local development works by default."""
    raw_origins = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,https://industary-brain.vercel.app",
    )
    return [origin.strip() for origin in raw_origins.split(",") if origin.strip()]
