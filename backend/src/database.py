"""SQLAlchemy engines, sessions, and one-time schema initialization."""

import logging
import os
import time

from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError, SQLAlchemyError
from sqlalchemy.orm import sessionmaker

from src.config import DOCUMENTS_DATABASE_URL, KNOWLEDGE_DATABASE_URL
from src.models import DocumentsBase, KnowledgeBase

logger = logging.getLogger(__name__)

documents_engine = create_engine(DOCUMENTS_DATABASE_URL, pool_pre_ping=True)
knowledge_engine = create_engine(KNOWLEDGE_DATABASE_URL, pool_pre_ping=True)
DocumentsSession = sessionmaker(bind=documents_engine, expire_on_commit=False)
KnowledgeSession = sessionmaker(bind=knowledge_engine, expire_on_commit=False)


def _create_schema_with_lock(engine, metadata, lock_name: str, create_extension: bool = False) -> None:
    """Create a database schema while holding a PostgreSQL advisory lock.

    ``create_all(checkfirst=True)`` is not safe if two processes inspect a
    missing table concurrently. The session-level advisory lock serializes
    initialization even if this command is accidentally started twice.
    """
    with engine.connect() as connection:
        connection.execute(text("SELECT pg_advisory_lock(hashtext(:lock_name))"), {"lock_name": lock_name})
        try:
            if create_extension:
                connection.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            metadata.create_all(connection)
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.execute(text("SELECT pg_advisory_unlock(hashtext(:lock_name))"), {"lock_name": lock_name})
            connection.commit()


def initialize_databases() -> None:
    """Safely create the current application schema once it is reachable."""
    _create_schema_with_lock(documents_engine, DocumentsBase.metadata, "industrial_documents_schema")
    _create_schema_with_lock(
        knowledge_engine,
        KnowledgeBase.metadata,
        "industrial_knowledge_schema",
        create_extension=True,
    )


def wait_for_database_initialization() -> None:
    """Retry initialization while PostgreSQL completes its entrypoint startup."""
    attempts = int(os.getenv("DATABASE_INIT_MAX_ATTEMPTS", "30"))
    delay_seconds = float(os.getenv("DATABASE_INIT_RETRY_SECONDS", "2"))

    for attempt in range(1, attempts + 1):
        try:
            initialize_databases()
            logger.info("Database schema initialization completed.")
            return
        except OperationalError as exc:
            if attempt == attempts:
                raise
            logger.warning(
                "Database is not ready for schema initialization (attempt %s/%s): %s",
                attempt,
                attempts,
                exc.orig,
            )
            time.sleep(delay_seconds)


def databases_available() -> bool:
    """Return whether both required databases accept a simple query."""
    try:
        with documents_engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        with knowledge_engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except SQLAlchemyError:
        return False
    return True
