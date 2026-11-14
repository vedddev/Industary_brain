from fastapi.testclient import TestClient
from langchain_core.documents import Document

import app as app_module
from app import create_app
from src.database import dispose_database
from src.rag_chain import AnswerResult

PASSWORD = "StrongPassword123!"


class FakeRetriever:
    def invoke(self, question):
        assert question == "What is tensile strength?"
        return [Document(page_content="Tensile strength is the maximum tensile stress.", metadata={"source": "manual.pdf", "page": 2})]


def make_client(tmp_path):
    application = create_app({
        "TESTING": True,
        "DATABASE_URL": f"sqlite:///{tmp_path / 'rag-test.sqlite3'}",
        "DATABASE_INIT_RETRIES": 1,
        "SESSION_TOKEN_SECRET": "test-session-secret-that-is-long-enough-for-validation",
        "SESSION_COOKIE_SECURE": False,
        "REQUIRE_ORIGIN_CHECK": False,
    })
    application.state.upload_dir = tmp_path / "uploads"
    application.state.upload_dir.mkdir()
    return application


def register(client, email):
    response = client.post("/auth/register", json={"email": email, "password": PASSWORD})
    assert response.status_code == 201
    return response.json()


def test_chat_requires_auth_and_retrieves_for_the_session_owner(tmp_path, monkeypatch):
    seen_owners = []
    monkeypatch.setattr(app_module, "get_retriever", lambda user_id: seen_owners.append(str(user_id)) or FakeRetriever())
    monkeypatch.setattr(
        app_module,
        "answer_question",
        lambda *_, **__: AnswerResult("Grounded answer [1]", grounded=True, cited=[1], used_docs=[Document(page_content="Tensile strength is the maximum tensile stress.", metadata={"source": "manual.pdf", "page": 2})]),
    )
    with TestClient(make_client(tmp_path)) as client:
        assert client.post("/chat", json={"question": "What is tensile strength?", "provider": "groq", "api_key": "test-key"}).status_code == 401
        user = register(client, "owner@example.com")
        response = client.post("/chat", json={"question": "What is tensile strength?", "provider": "groq", "api_key": "test-key"})
    dispose_database()
    assert response.status_code == 200
    assert response.json()["answer"] == "Grounded answer [1]"
    assert seen_owners == [user["id"]]


def test_upload_and_document_list_are_isolated_by_authenticated_owner(tmp_path, monkeypatch):
    indexed = []
    monkeypatch.setattr(app_module, "create_vectorstore", lambda chunks: indexed.extend(chunks))
    with TestClient(make_client(tmp_path)) as client:
        assert client.get("/documents").status_code == 401
        user_a = register(client, "owner-a@example.com")
        upload = client.post("/upload", files={"files": ("notes.txt", b"Tensile strength is measured during a tensile test. " * 4, "text/plain")})
        a_documents = client.get("/documents")
        csrf = client.get("/auth/me").json()["csrf_token"]
        assert client.post("/auth/logout", headers={"X-CSRF-Token": csrf}).status_code == 200
        user_b = register(client, "owner-b@example.com")
        b_documents = client.get("/documents")
    dispose_database()
    assert upload.status_code == 200
    assert len(a_documents.json()["documents"]) == 1
    assert b_documents.json() == {"documents": []}
    assert indexed and {chunk.metadata["owner_id"] for chunk in indexed} == {user_a["id"]}
    assert user_a["id"] != user_b["id"]
