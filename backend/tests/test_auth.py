from pathlib import Path
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app import create_app
from src.auth import reset_rate_limits
from src.database import dispose_database, get_db_session
from src.models import Document, User

PASSWORD = "StrongPassword123!"
EMAIL = "Engineer@Example.com"
TEST_SECRET = "test-session-secret-that-is-long-enough-for-validation"


@pytest.fixture
def app(tmp_path: Path):
    reset_rate_limits()
    application = create_app({
        "TESTING": True,
        "DATABASE_URL": f"sqlite:///{tmp_path / 'auth-test.sqlite3'}",
        "DATABASE_INIT_RETRIES": 1,
        "SESSION_COOKIE_SECURE": False,
        "SESSION_COOKIE_SAMESITE": "Lax",
        "SESSION_TOKEN_SECRET": TEST_SECRET,
        "REQUIRE_ORIGIN_CHECK": False,
        "CORS_ORIGINS": ["http://localhost:5173"],
    })
    yield application
    dispose_database()


@pytest.fixture
def client(app):
    with TestClient(app) as test_client:
        yield test_client


def register(client, email=EMAIL, password=PASSWORD):
    return client.post("/auth/register", json={"email": email, "password": password})


def test_registration_creates_normalized_persistent_user_and_session(client):
    response = register(client)
    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "engineer@example.com"
    assert body["id"] and body["created_at"] and body["csrf_token"]
    assert "iki_session=" in response.headers["set-cookie"]
    db = get_db_session()
    user = db.scalar(select(User).where(User.email == "engineer@example.com"))
    assert user.password_hash != PASSWORD and user.password_hash.startswith("$argon2id$")
    db.close()


def test_duplicate_and_invalid_registration_are_rejected(client):
    assert register(client).status_code == 201
    assert register(client, "engineer@example.com").status_code == 409
    assert register(client, "not-an-email").status_code == 400
    assert register(client, EMAIL, "short").status_code == 400


def test_login_me_logout_and_invalid_credentials(client):
    assert register(client).status_code == 201
    with TestClient(client.app) as anonymous:
        success = anonymous.post("/auth/login", json={"email": EMAIL, "password": PASSWORD})
        assert success.status_code == 200
        assert anonymous.get("/auth/me").json()["email"] == "engineer@example.com"
        csrf = success.json()["csrf_token"]
        assert anonymous.post("/auth/logout", headers={"X-CSRF-Token": csrf}).status_code == 200
        assert anonymous.get("/auth/me").status_code == 401
        assert anonymous.post("/auth/login", json={"email": EMAIL, "password": "WrongPassword123!"}).status_code == 401


def test_documents_use_the_login_session_and_enforce_ownership(client):
    first = register(client)
    assert first.status_code == 201
    first_user_id = first.json()["id"]
    db = get_db_session()
    try:
        db.add(Document(
            user_id=UUID(first_user_id),
            doc_id="first-user-document",
            filename="first-user.pdf",
            file_type="pdf",
            size_bytes=42,
            chunk_count=1,
        ))
        db.commit()
    finally:
        db.close()

    # The cookie jar retains the opaque session created by registration/login.
    documents = client.get("/documents")
    assert documents.status_code == 200
    assert [item["name"] for item in documents.json()["documents"]] == ["first-user.pdf"]

    # A separate authenticated user cannot list the first user's records.
    assert register(client, "other@example.com").status_code == 201
    assert client.get("/documents").json() == {"documents": []}

    client.cookies.clear()
    assert client.get("/documents").status_code == 401


def test_fastapi_public_route_validation(client):
    assert client.get("/").json() == {"message": "Industrial Knowledge Intelligence API"}
    assert client.get("/health").status_code == 200
    assert client.post("/upload").status_code == 401
    assert client.post("/chat", json={}).status_code == 401
