"""Database setup for persistent application data (FastAPI edition).

DATABASE_URL should point to PostgreSQL in production. SQLite is supported for local
development and isolated tests.

What changed from the Flask version
  * No Flask dependency. The engine and session factory live in this module, not on `current_app`.
  * Same public API for the rest of the code: configure_database(app), get_db_session(),
    DatabaseUnavailable.
  * Connection pooling is tunable (DB_POOL_SIZE, DB_MAX_OVERFLOW, DB_POOL_TIMEOUT, DB_POOL_RECYCLE).
  * PostgreSQL gets connect and statement timeouts so one slow query can't hang a worker.
  * Self-healing: if the database is down at startup (common on Render/Heroku cold starts) the
    app still boots, and the next request retries the connection instead of staying broken
    until a restart.
  * check_database() does a real `SELECT 1` for /health.
  * purge_expired_sessions() cleans old login sessions; dispose_database() closes the pool on shutdown.
"""
from __future__ import annotations

import logging
import os
import threading
import time
from contextlib import contextmanager
from typing import Any, Iterator, Optional

from sqlalchemy import create_engine, delete, event, inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool
from sqlalchemy.schema import CreateColumn

from src.models import AuthSession, Base, utcnow

log = logging.getLogger("database")

RETRY_INTERVAL_SECONDS = 5.0  # minimum gap between lazy reconnection attempts


class DatabaseUnavailable(RuntimeError):
    """Raised when authentication storage has not been configured or cannot be reached."""


class _State:
    def __init__(self) -> None:
        self.engine: Optional[Engine] = None
        self.factory: Optional[sessionmaker] = None
        self.ready = False
        self.url: Optional[str] = None
        self.config: dict[str, Any] = {}
        self.secret_ok = False
        self.last_attempt = 0.0
        self.lock = threading.Lock()


_state = _State()


# --------------------------------------------------------------------------- helpers
def normalize_database_url(url: str) -> str:
    # Render and Heroku commonly provide the older postgres:// scheme.
    if url.startswith("postgres://"):
        return "postgresql+psycopg://" + url[len("postgres://"):]
    if url.startswith("postgresql://"):
        return "postgresql+psycopg://" + url[len("postgresql://"):]
    return url


def _setting(name: str, default: Any, cast=int) -> Any:
    raw = _state.config.get(name)
    if raw is None:
        raw = os.environ.get(name)
    if raw in (None, ""):
        return default
    try:
        return cast(raw)
    except (TypeError, ValueError):
        log.warning("Ignoring invalid %s=%r", name, raw)
        return default


def _build_engine(database_url: str) -> Engine:
    url = normalize_database_url(database_url)
    options: dict[str, Any] = {"future": True, "pool_pre_ping": True}

    if url.startswith("sqlite"):
        options["connect_args"] = {"check_same_thread": False}
        if url in ("sqlite://", "sqlite:///:memory:"):
            options["poolclass"] = StaticPool  # one shared in-memory DB (tests)
    else:
        options.update(
            pool_size=_setting("DB_POOL_SIZE", 5),
            max_overflow=_setting("DB_MAX_OVERFLOW", 10),
            pool_timeout=_setting("DB_POOL_TIMEOUT", 10),
            pool_recycle=_setting("DB_POOL_RECYCLE", 1800),  # avoid connections killed by the host's idle timeout
        )
        if url.startswith("postgresql"):
            statement_ms = _setting("DB_STATEMENT_TIMEOUT_MS", 15000)
            options["connect_args"] = {
                "connect_timeout": _setting("DB_CONNECT_TIMEOUT", 10),
                "options": f"-c statement_timeout={statement_ms}",
            }
    engine = create_engine(url, **options)
    if url.startswith("sqlite"):
        @event.listens_for(engine, "connect")
        def _enforce_foreign_keys(dbapi_connection, _record):  # SQLite ignores FKs unless asked
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()
    return engine


def _apply_additive_migrations(engine: Engine) -> None:
    """Adds columns that exist in the models but not yet in the database.

    create_all() only creates missing TABLES; it never touches existing ones. This fills that gap for the
    simple case of new nullable (or defaulted) columns, so upgrading the code does not break a live database.
    Anything else (renames, type changes, new NOT NULL columns without a default) is reported and skipped:
    use Alembic for those.
    """
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())
    preparer = engine.dialect.identifier_preparer
    for table in Base.metadata.sorted_tables:
        if table.name not in existing_tables:
            continue  # brand-new tables were already created by create_all()
        present = {column["name"] for column in inspector.get_columns(table.name)}
        for column in table.columns:
            if column.name in present:
                continue
            if column.primary_key or (not column.nullable and column.server_default is None):
                log.error("Column %s.%s is missing and needs a real migration (not additive)", table.name, column.name)
                continue
            statement = f"ALTER TABLE {preparer.format_table(table)} ADD COLUMN {CreateColumn(column).compile(dialect=engine.dialect)}"
            try:
                with engine.begin() as connection:
                    connection.execute(text(statement))
                log.info("Added column %s.%s", table.name, column.name)
            except Exception:
                # Another worker may have added it at the same moment: only fail if it is still missing.
                refreshed = {c["name"] for c in inspect(engine).get_columns(table.name)}
                if column.name not in refreshed:
                    raise


def _initialize(retries: int) -> bool:
    """(Re)create the engine and make sure the tables exist. Returns True when ready."""
    _state.last_attempt = time.monotonic()
    last_error: Optional[BaseException] = None
    for attempt in range(max(1, retries)):
        engine = None
        try:
            engine = _build_engine(_state.url or "")
            Base.metadata.create_all(engine)
            _apply_additive_migrations(engine)
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            old = _state.engine
            _state.engine = engine
            _state.factory = sessionmaker(bind=engine, expire_on_commit=False)
            _state.ready = True
            if old is not None and old is not engine:
                old.dispose()
            return True
        except Exception as error:  # driver errors differ by backend
            last_error = error
            if engine is not None:
                engine.dispose()
            if attempt + 1 < retries:
                time.sleep(0.25 * (attempt + 1))
    _state.ready = False
    log.error("Database initialization failed: %s", type(last_error).__name__)
    return False


# --------------------------------------------------------------------------- public API
def configure_database(app) -> None:
    """Call once from create_app(). Safe to call again (e.g. in tests): the old pool is replaced."""
    config = getattr(getattr(app, "state", None), "config", None) or getattr(app, "config", {}) or {}
    with _state.lock:
        _state.config = dict(config)
        _state.url = config.get("DATABASE_URL")
        _state.secret_ok = bool(config.get("SESSION_TOKEN_SECRET"))
        _state.ready = False
        _state.last_attempt = 0.0
        if _state.url:
            _initialize(int(config.get("DATABASE_INIT_RETRIES", 3)))
        else:
            log.warning("DATABASE_URL is not set: login and registration are disabled")
    # Compatibility flags (health endpoint and older code read these).
    app.state.auth_db_ready = _state.ready
    if hasattr(app, "extensions"):
        app.extensions["auth_db_ready"] = _state.ready


def get_db_session() -> Session:
    """Returns a new Session. The caller must close it (auth.py's get_db dependency does)."""
    if not _state.url or not _state.secret_ok:
        raise DatabaseUnavailable("Authentication database is unavailable")
    if not _state.ready and time.monotonic() - _state.last_attempt >= RETRY_INTERVAL_SECONDS:
        with _state.lock:  # one thread retries; the others fail fast
            if not _state.ready and time.monotonic() - _state.last_attempt >= RETRY_INTERVAL_SECONDS:
                _initialize(1)
    if not _state.ready or _state.factory is None:
        raise DatabaseUnavailable("Authentication database is unavailable")
    return _state.factory()


@contextmanager
def session_scope() -> Iterator[Session]:
    """For background jobs/scripts:  with session_scope() as db: ...  (commits, or rolls back on error)."""
    db = get_db_session()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def check_database() -> bool:
    """True if the database answers a trivial query right now (used by /health)."""
    try:
        db = get_db_session()
    except DatabaseUnavailable:
        return False
    try:
        db.execute(text("SELECT 1"))
        return True
    except Exception:
        _state.ready = False  # let the next request try to reconnect
        return False
    finally:
        db.close()


def purge_expired_sessions() -> int:
    """Deletes login sessions past their expiry. Returns how many were removed."""
    with session_scope() as db:
        result = db.execute(delete(AuthSession).where(AuthSession.expires_at <= utcnow()))
        return result.rowcount or 0


def dispose_database() -> None:
    """Closes all pooled connections (call on shutdown)."""
    with _state.lock:
        if _state.engine is not None:
            _state.engine.dispose()
        _state.engine, _state.factory, _state.ready = None, None, False