"""Authentication routes (FastAPI): Argon2id passwords + opaque server-side sessions.

Drop-in replacement for the Flask blueprint. Same URLs (/auth/register, /auth/login,
/auth/me, /auth/logout) plus /auth/logout-all and /auth/change-password.

Hardening over the Flask version
  * Login/registration rate limiting and temporary lockout (per account+IP, per IP, per email)
  * CSRF token is also returned by /auth/me, so it survives a page refresh
  * Session rotation on login (an old cookie is revoked, preventing session fixation)
  * Per-user session cap and automatic purge of expired sessions
  * Logout-everywhere and change-password (which revokes all other sessions)
  * Password policy blocks common passwords and passwords containing the email name
  * Timing-safe compares, uniform error messages, no stack traces to the client

Requires from your existing code (unchanged):
  src.database : DatabaseUnavailable, get_db_session()
  src.models   : User(id, email, password_hash, public_dict()),
                 AuthSession(token_hash, user_id, csrf_token, expires_at), utcnow()
"""
from __future__ import annotations

import hashlib
import hmac
import logging
import math
import secrets
import threading
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from typing import Any, Iterator

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError
from email_validator import EmailNotValidError, validate_email
from fastapi import APIRouter, Body, Depends, FastAPI, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from src.database import DatabaseUnavailable, get_db_session
from src.models import AuthSession, User, utcnow

log = logging.getLogger("auth")

auth_router = APIRouter(prefix="/auth", tags=["auth"])
password_hasher = PasswordHasher()  # Argon2id defaults (RFC 9106 low-memory profile)
DUMMY_PASSWORD_HASH = password_hasher.hash("invalid-password-for-timing")

UNAVAILABLE = "Authentication service is unavailable."
PASSWORD_RULES = "Password must be 12–128 characters and include upper-case, lower-case, number, and symbol characters."
COMMON_PASSWORDS = {
    "password1234", "password12345", "password123!", "passw0rd1234", "qwerty123456", "qwertyuiop12",
    "letmein12345", "welcome12345", "admin1234567", "administrator1", "iloveyou1234", "123456789012",
    "changeme1234", "p@ssw0rd1234", "p@ssword1234", "password@123", "welcome@1234", "abcd12345678",
}


def fail(status: int, message: str, headers: dict | None = None) -> HTTPException:
    """Raised errors are rendered as {"error": message} by the app's exception handler."""
    return HTTPException(status_code=status, detail=message, headers=headers)


# --------------------------------------------------------------------------- rate limiting
class RateLimiter:
    """Sliding-window counter. In-memory, so it is per-process: with several workers use
    Redis (or your reverse proxy) for shared limits. Still stops naive brute force."""

    def __init__(self, limit: int, window_seconds: int):
        self.limit, self.window = limit, window_seconds
        self._hits: dict[str, deque] = defaultdict(deque)
        self._lock = threading.Lock()

    def _prune(self, key: str, now: float) -> deque:
        q = self._hits[key]
        while q and now - q[0] >= self.window:
            q.popleft()
        return q

    def retry_after(self, key: str) -> int:
        """Seconds until another attempt is allowed; 0 if allowed now."""
        now = time.monotonic()
        with self._lock:
            q = self._prune(key, now)
            if len(q) < self.limit:
                return 0
            return max(1, math.ceil(self.window - (now - q[0])))

    def hit(self, key: str) -> None:
        now = time.monotonic()
        with self._lock:
            self._prune(key, now).append(now)
            if len(self._hits) > 20000:  # bound memory
                for k in [k for k, v in self._hits.items() if not self._prune(k, now)]:
                    del self._hits[k]

    def clear(self, key: str) -> None:
        with self._lock:
            self._hits.pop(key, None)

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


login_by_account = RateLimiter(limit=5, window_seconds=15 * 60)    # ip + email
login_by_ip = RateLimiter(limit=30, window_seconds=15 * 60)
login_by_email = RateLimiter(limit=20, window_seconds=60 * 60)     # spread-out attacks on one account
register_by_ip = RateLimiter(limit=10, window_seconds=60 * 60)
password_change_by_user = RateLimiter(limit=5, window_seconds=15 * 60)
_ALL_LIMITERS = (login_by_account, login_by_ip, login_by_email, register_by_ip, password_change_by_user)


def reset_rate_limits() -> None:
    for limiter in _ALL_LIMITERS:
        limiter.reset()


def _enforce(limiter: RateLimiter, key: str, message: str) -> None:
    wait = limiter.retry_after(key)
    if wait:
        raise fail(429, message, {"Retry-After": str(wait)})


def client_ip(request: Request) -> str:
    # Only trust X-Forwarded-For when running behind a proxy you control that sets it.
    if request.app.state.config.get("TRUST_PROXY"):
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[-1].strip()  # last hop = what our proxy saw
    return request.client.host if request.client else "unknown"


# --------------------------------------------------------------------------- validation
def normalize_email(value: Any) -> str:
    if not isinstance(value, str) or len(value) > 254:
        raise ValueError("Enter a valid email address.")
    try:
        return validate_email(value.strip(), check_deliverability=False).normalized.casefold()
    except EmailNotValidError as error:
        raise ValueError("Enter a valid email address.") from error


def normalize_name(value: Any) -> str | None:
    """Optional display name: trimmed, max 120 characters, no control characters."""
    if value is None or (isinstance(value, str) and not value.strip()):
        return None
    if not isinstance(value, str):
        raise ValueError("Enter a valid name.")
    value = " ".join(value.split())
    if len(value) > 120 or any(ord(c) < 32 or ord(c) == 127 for c in value):
        raise ValueError("Name must be 120 characters or fewer and contain no special control characters.")
    return value


def validate_password(value: Any, email: str | None = None) -> str:
    if not isinstance(value, str):
        raise ValueError(PASSWORD_RULES)
    if (
        len(value) < 12 or len(value) > 128
        or not any(c.islower() for c in value) or not any(c.isupper() for c in value)
        or not any(c.isdigit() for c in value) or not any(not c.isalnum() for c in value)
    ):
        raise ValueError(PASSWORD_RULES)
    lowered = value.lower()
    if lowered in COMMON_PASSWORDS or len(set(lowered)) < 5:
        raise ValueError("That password is too easy to guess. Choose a less common one.")
    if email:
        local = email.split("@")[0]
        if len(local) >= 4 and local in lowered:
            raise ValueError("Password must not contain your email name.")
    return value


# --------------------------------------------------------------------------- sessions
def _cfg(request: Request) -> dict:
    return request.app.state.config


def token_hash(token: str, cfg: dict) -> str:
    secret = cfg.get("SESSION_TOKEN_SECRET")
    if not secret:
        raise RuntimeError("SESSION_TOKEN_SECRET is not configured")
    return hmac.new(secret.encode("utf-8"), token.encode("utf-8"), hashlib.sha256).hexdigest()


def session_lifetime(cfg: dict) -> timedelta:
    return timedelta(days=int(cfg["SESSION_DAYS"]))


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def _expired(record: AuthSession) -> bool:
    return _aware(record.expires_at) <= datetime.now(timezone.utc)


def create_session(db: Session, user: User, cfg: dict, request: Request | None = None) -> tuple[str, str]:
    raw_token, csrf_token = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
    db.add(AuthSession(
        token_hash=token_hash(raw_token, cfg), user_id=user.id, csrf_token=csrf_token,
        expires_at=utcnow() + session_lifetime(cfg), last_seen_at=utcnow(),
        ip_address=client_ip(request)[:45] if request else None,
        user_agent=(request.headers.get("user-agent") or "")[:255] or None if request else None,
    ))
    db.flush()
    # Housekeeping: drop expired sessions and cap how many a user can hold.
    sessions = db.scalars(select(AuthSession).where(AuthSession.user_id == user.id).order_by(AuthSession.expires_at.desc())).all()
    live = [s for s in sessions if not _expired(s)]
    for stale in [s for s in sessions if _expired(s)] + live[int(cfg.get("SESSION_MAX_PER_USER", 10)):]:
        db.delete(stale)
    return raw_token, csrf_token


def revoke_user_sessions(db: Session, user_id, keep_hash: str | None = None) -> None:
    for record in db.scalars(select(AuthSession).where(AuthSession.user_id == user_id)).all():
        if record.token_hash != keep_hash:
            db.delete(record)


def set_session_cookie(response: Response, raw_token: str, cfg: dict) -> None:
    response.set_cookie(
        cfg["SESSION_COOKIE_NAME"], raw_token, max_age=int(session_lifetime(cfg).total_seconds()),
        httponly=True, secure=cfg["SESSION_COOKIE_SECURE"], samesite=cfg["SESSION_COOKIE_SAMESITE"].lower(), path="/",
    )


def clear_session_cookie(response: Response, cfg: dict) -> None:
    response.delete_cookie(
        cfg["SESSION_COOKIE_NAME"], path="/", httponly=True,
        secure=cfg["SESSION_COOKIE_SECURE"], samesite=cfg["SESSION_COOKIE_SAMESITE"].lower(),
    )


# --------------------------------------------------------------------------- dependencies
def get_db() -> Iterator[Session]:
    try:
        db = get_db_session()
    except DatabaseUnavailable:
        raise fail(503, UNAVAILABLE)
    try:
        yield db
    finally:
        db.close()


def trusted_origin(request: Request) -> None:
    cfg = _cfg(request)
    if not cfg["REQUIRE_ORIGIN_CHECK"]:
        return
    origin = (request.headers.get("origin") or "").rstrip("/")
    if not origin or origin not in cfg["CORS_ORIGINS"]:
        raise fail(403, "Request origin is not allowed.")


TOUCH_INTERVAL = timedelta(minutes=5)  # how often last_seen_at is refreshed (avoids a write per request)


def _resolve_session(db: Session, request: Request) -> tuple[AuthSession | None, User | None]:
    cfg = _cfg(request)
    raw_token = request.cookies.get(cfg["SESSION_COOKIE_NAME"])
    if not raw_token or len(raw_token) > 256:
        return None, None
    record = db.get(AuthSession, token_hash(raw_token, cfg))
    if not record:
        return None, None
    now = datetime.now(timezone.utc)
    idle_minutes = int(cfg.get("SESSION_IDLE_MINUTES", 0) or 0)  # 0 = no idle timeout
    idle_too_long = (
        idle_minutes > 0 and record.last_seen_at is not None
        and now - _aware(record.last_seen_at) > timedelta(minutes=idle_minutes)
    )
    user = None if (_expired(record) or idle_too_long) else db.get(User, record.user_id)
    if user is None or not user.is_active:
        db.delete(record)  # expired, idle, orphaned, or the account was disabled
        db.commit()
        return None, None
    if record.last_seen_at is None or now - _aware(record.last_seen_at) > TOUCH_INTERVAL:
        record.last_seen_at = utcnow()
        db.commit()
    return record, user


def current_auth(request: Request, db: Session = Depends(get_db)) -> tuple[AuthSession | None, User | None]:
    """Resolves the session cookie. Returns (None, None) when absent/invalid/expired/idle."""
    return _resolve_session(db, request)


def optional_user(request: Request) -> User | None:
    """For routes that stay public but behave better when someone is logged in (e.g. /upload).
    Never raises: if the database is down the visitor is simply treated as logged out."""
    try:
        db = get_db_session()
    except DatabaseUnavailable:
        return None
    try:
        return _resolve_session(db, request)[1]
    except SQLAlchemyError:
        return None
    finally:
        db.close()


def require_auth(auth: tuple = Depends(current_auth)) -> tuple[AuthSession, User]:
    """Use this on any route that needs a logged-in user:  record, user = Depends(require_auth)"""
    if not auth[1]:
        raise fail(401, "Authentication required.")
    return auth


def require_csrf(request: Request, auth: tuple = Depends(require_auth)) -> tuple[AuthSession, User]:
    submitted = request.headers.get("x-csrf-token", "")
    if not hmac.compare_digest(auth[0].csrf_token.encode(), submitted.encode()):
        raise fail(403, "Invalid CSRF token.")
    return auth


def read_payload(payload: Any = Body(default=None)) -> dict:
    if not isinstance(payload, dict):
        raise fail(400, "A JSON request body is required.")
    return payload


# --------------------------------------------------------------------------- routes
@auth_router.post("/register", status_code=201, dependencies=[Depends(trusted_origin)])
def register(request: Request, response: Response, payload: dict = Depends(read_payload), db: Session = Depends(get_db)):
    cfg, ip = _cfg(request), client_ip(request)
    _enforce(register_by_ip, ip, "Too many sign-up attempts. Try again later.")
    register_by_ip.hit(ip)
    try:
        email = normalize_email(payload.get("email"))
        password = validate_password(payload.get("password"), email)
        name = normalize_name(payload.get("name"))
    except ValueError as error:
        raise fail(400, str(error))
    try:
        user = User(email=email, name=name, password_hash=password_hasher.hash(password), password_changed_at=utcnow())
        db.add(user)
        db.flush()
        raw_token, csrf_token = create_session(db, user, cfg, request)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise fail(409, "An account with this email already exists.")
    set_session_cookie(response, raw_token, cfg)
    return {**user.public_dict(), "csrf_token": csrf_token}


@auth_router.post("/login", dependencies=[Depends(trusted_origin)])
def login(request: Request, response: Response, payload: dict = Depends(read_payload), db: Session = Depends(get_db)):
    cfg, ip = _cfg(request), client_ip(request)
    try:
        email = normalize_email(payload.get("email"))
    except ValueError as error:
        raise fail(400, str(error))
    password = payload.get("password")
    if not isinstance(password, str) or not password or len(password) > 1024:
        raise fail(400, "Invalid email or password.")

    account_key = f"{ip}|{email}"
    message = "Too many failed attempts. Try again later."
    for limiter, key in ((login_by_account, account_key), (login_by_ip, ip), (login_by_email, email)):
        _enforce(limiter, key, message)  # checked before hashing, so a lockout also blocks the right password

    user = db.scalar(select(User).where(User.email == email))
    stored_hash = user.password_hash if user else DUMMY_PASSWORD_HASH  # same work whether or not the user exists
    try:
        valid = password_hasher.verify(stored_hash, password)
    except (VerifyMismatchError, InvalidHashError):
        valid = False
    if not user or not valid or not user.is_active:  # disabled accounts get the same vague error
        for limiter, key in ((login_by_account, account_key), (login_by_ip, ip), (login_by_email, email)):
            limiter.hit(key)
        raise fail(401, "Invalid email or password.")

    login_by_account.clear(account_key)
    if password_hasher.check_needs_rehash(user.password_hash):
        user.password_hash = password_hasher.hash(password)
    user.last_login_at = utcnow()

    # Rotate: revoke any session the browser already held, then issue a fresh one.
    old_token = request.cookies.get(cfg["SESSION_COOKIE_NAME"])
    if old_token and len(old_token) <= 256:
        old = db.get(AuthSession, token_hash(old_token, cfg))
        if old:
            db.delete(old)
    raw_token, csrf_token = create_session(db, user, cfg, request)
    db.commit()
    set_session_cookie(response, raw_token, cfg)
    return {**user.public_dict(), "csrf_token": csrf_token}


@auth_router.get("/me")
def me(auth: tuple = Depends(require_auth)):
    record, user = auth
    # Returning the CSRF token here lets the SPA recover it after a refresh (CORS keeps other sites from reading it).
    return {**user.public_dict(), "csrf_token": record.csrf_token}


@auth_router.get("/sessions")
def list_sessions(auth: tuple = Depends(require_auth), db: Session = Depends(get_db)):
    """The user's active logins (devices). Ids are a short prefix; the real token hash is never exposed."""
    current, user = auth
    rows = db.scalars(select(AuthSession).where(AuthSession.user_id == user.id).order_by(AuthSession.created_at.desc())).all()
    return {"sessions": [
        {
            "id": row.token_hash[:12],
            "created_at": row.created_at.isoformat(),
            "last_seen_at": row.last_seen_at.isoformat() if row.last_seen_at else None,
            "ip_address": row.ip_address,
            "user_agent": row.user_agent,
            "current": row.token_hash == current.token_hash,
        }
        for row in rows if not _expired(row)
    ]}


@auth_router.post("/logout", dependencies=[Depends(trusted_origin)])
def logout(request: Request, response: Response, auth: tuple = Depends(current_auth), db: Session = Depends(get_db)):
    record, _ = auth
    if record:
        submitted = request.headers.get("x-csrf-token", "")
        if not hmac.compare_digest(record.csrf_token.encode(), submitted.encode()):
            raise fail(403, "Invalid CSRF token.")
        db.delete(record)
        db.commit()
    clear_session_cookie(response, _cfg(request))
    return {"success": True}


@auth_router.post("/logout-all", dependencies=[Depends(trusted_origin)])
def logout_all(request: Request, response: Response, auth: tuple = Depends(require_csrf), db: Session = Depends(get_db)):
    _, user = auth
    revoke_user_sessions(db, user.id)
    db.commit()
    clear_session_cookie(response, _cfg(request))
    return {"success": True}


@auth_router.post("/change-password", dependencies=[Depends(trusted_origin)])
def change_password(request: Request, response: Response, payload: dict = Depends(read_payload),
                    auth: tuple = Depends(require_csrf), db: Session = Depends(get_db)):
    cfg = _cfg(request)
    record, user = auth
    key = str(user.id)
    _enforce(password_change_by_user, key, "Too many attempts. Try again later.")
    current, new = payload.get("current_password"), payload.get("new_password")
    try:
        ok = isinstance(current, str) and password_hasher.verify(user.password_hash, current)
    except (VerifyMismatchError, InvalidHashError):
        ok = False
    if not ok:
        password_change_by_user.hit(key)
        raise fail(401, "Current password is incorrect.")
    try:
        new = validate_password(new, user.email)
    except ValueError as error:
        raise fail(400, str(error))
    if new == current:
        raise fail(400, "Choose a password you have not used before.")

    user.password_hash = password_hasher.hash(new)
    user.password_changed_at = utcnow()
    revoke_user_sessions(db, user.id)               # signs out every device, including this one...
    raw_token, csrf_token = create_session(db, user, cfg, request)  # ...then keeps this browser logged in
    db.commit()
    password_change_by_user.clear(key)
    set_session_cookie(response, raw_token, cfg)
    return {**user.public_dict(), "csrf_token": csrf_token}


# --------------------------------------------------------------------------- app wiring
def register_auth_error_handlers(app: FastAPI) -> None:
    """Database trouble becomes a clean 503 instead of a stack trace."""

    @app.exception_handler(DatabaseUnavailable)
    async def _db_unavailable(_: Request, __: DatabaseUnavailable):
        return JSONResponse({"error": UNAVAILABLE}, status_code=503)

    @app.exception_handler(SQLAlchemyError)
    async def _db_error(_: Request, exc: SQLAlchemyError):
        log.exception("Database failure", exc_info=exc)
        return JSONResponse({"error": UNAVAILABLE}, status_code=503)