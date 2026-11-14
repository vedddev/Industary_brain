import asyncio
import logging
import os
import secrets
from contextlib import asynccontextmanager, suppress
from pathlib import Path

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from src.auth import auth_router, register_auth_error_handlers, require_auth
from src.documents import list_documents, record_uploads
from src.database import check_database, configure_database, dispose_database, purge_expired_sessions
from src.ingest import IngestError, load_and_split, max_files, max_upload_bytes, save_upload
from src.retriever import create_vectorstore, get_retriever
from src.rag_chain import LLMError, answer_question, describe_sources, supported_providers

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")
MAX_QUESTION_CHARS = 4000


def _origins(value: str | None) -> list[str]:
    return [origin.strip().rstrip("/") for origin in (value or "http://localhost:5173").split(",") if origin.strip()]


def _error(message: str, status: int = 400, headers: dict | None = None) -> JSONResponse:
    return JSONResponse({"error": message}, status_code=status, headers=headers)


def create_app(test_config: dict | None = None) -> FastAPI:
    # Interactive docs are handy in development but are switched off in production.
    production = os.environ.get("APP_ENV", "development").lower() == "production"
    # A fresh local checkout should be able to use authentication without requiring
    # a separately provisioned database. Production deliberately has no fallback.
    database_url = os.environ.get("DATABASE_URL")
    if not database_url and not production:
        database_url = f"sqlite:///{BASE_DIR / 'data' / 'auth.sqlite3'}"

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        # Startup: clear out expired login sessions now, then once an hour in the background.
        async def cleanup_loop():
            while True:
                try:
                    removed = await run_in_threadpool(purge_expired_sessions)
                    if removed:
                        logging.getLogger("app").info("Purged %d expired sessions", removed)
                except Exception:  # database may be down; try again next round
                    logging.getLogger("app").warning("Session cleanup skipped (database unavailable)")
                await asyncio.sleep(3600)

        task = asyncio.create_task(cleanup_loop())
        try:
            yield
        finally:  # Shutdown: stop the job and close pooled connections.
            task.cancel()
            with suppress(asyncio.CancelledError):
                await task
            await run_in_threadpool(dispose_database)

    app = FastAPI(
        title="Industrial Knowledge Intelligence API", lifespan=lifespan,
        docs_url=None if production else "/docs", redoc_url=None, openapi_url=None if production else "/openapi.json",
    )
    origins = _origins(os.environ.get("FRONTEND_ORIGIN"))
    config = {
        "DATABASE_URL": database_url,
        "DATABASE_INIT_RETRIES": int(os.environ.get("DATABASE_INIT_RETRIES", "3")),
        "CORS_ORIGINS": origins,
        "REQUIRE_ORIGIN_CHECK": production,
        "SESSION_COOKIE_NAME": os.environ.get("SESSION_COOKIE_NAME", "iki_session"),
        "SESSION_COOKIE_SECURE": production,
        "SESSION_COOKIE_SAMESITE": os.environ.get("SESSION_COOKIE_SAMESITE", "Lax"),
        "SESSION_DAYS": int(os.environ.get("SESSION_DAYS", "7")),
        "SESSION_MAX_PER_USER": int(os.environ.get("SESSION_MAX_PER_USER", "10")),
        "SESSION_IDLE_MINUTES": int(os.environ.get("SESSION_IDLE_MINUTES", "0")),  # 0 = off
        "SESSION_TOKEN_SECRET": os.environ.get("SESSION_TOKEN_SECRET"),
        "TRUST_PROXY": os.environ.get("TRUST_PROXY", "").lower() in ("1", "true", "yes"),
    }
    if test_config:
        config.update(test_config)
    if not config["SESSION_TOKEN_SECRET"] and not production:
        # Development convenience: a random secret (everyone is logged out on restart).
        config["SESSION_TOKEN_SECRET"] = secrets.token_urlsafe(48)
    app.state.config = config
    # Flask-style attributes, so an existing src/database.py that reads app.config / app.extensions keeps working.
    app.config, app.extensions, app.logger = config, {}, logging.getLogger("app")

    if config["SESSION_COOKIE_SAMESITE"].lower() == "none" and not config["SESSION_COOKIE_SECURE"]:
        raise ValueError("SESSION_COOKIE_SAMESITE=None requires SESSION_COOKIE_SECURE=true")
    if production and not os.environ.get("FRONTEND_ORIGIN") and not test_config:
        raise RuntimeError("FRONTEND_ORIGIN is required in production")
    if production and not os.environ.get("SESSION_TOKEN_SECRET") and not test_config:
        raise RuntimeError("SESSION_TOKEN_SECRET is required in production")
    if len(config["SESSION_TOKEN_SECRET"] or "") < 32:
        raise RuntimeError("SESSION_TOKEN_SECRET must be at least 32 characters (try: python -c \"import secrets;print(secrets.token_urlsafe(48))\")")

    app.add_middleware(
        CORSMiddleware, allow_origins=config["CORS_ORIGINS"], allow_credentials=True,
        allow_methods=["GET", "POST", "OPTIONS"], allow_headers=["Content-Type", "X-CSRF-Token"],
    )

    @app.middleware("http")
    async def security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        if production:
            response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        if request.url.path.startswith("/auth"):
            response.headers["Cache-Control"] = "no-store"  # never cache anything session-related
        return response

    configure_database(app)
    register_auth_error_handlers(app)
    app.include_router(auth_router)

    upload_dir = BASE_DIR / "uploads"
    upload_dir.mkdir(exist_ok=True)
    app.state.upload_dir = upload_dir
    app.config["UPLOAD_DIR"] = upload_dir

    # Keep the {"error": "..."} shape the frontend already expects.
    @app.exception_handler(StarletteHTTPException)
    async def http_error(_: Request, exc: StarletteHTTPException):
        return _error(str(exc.detail), exc.status_code, getattr(exc, "headers", None))

    @app.exception_handler(RequestValidationError)
    async def validation_error(_: Request, exc: RequestValidationError):
        if any(err.get("loc", [""])[0] == "body" for err in exc.errors()):
            return _error("A JSON request body is required.", 400)
        return _error("Invalid request.", 400)

    @app.get("/")
    def home():
        return {"message": "Industrial Knowledge Intelligence API"}

    @app.post("/upload")
    def upload_documents(files: list[UploadFile] | None = File(default=None), auth=Depends(require_auth)):
        _, user = auth
        if not files:
            return _error("No files uploaded", 400)
        if len(files) > max_files():
            return _error(f"Too many files. Upload at most {max_files()} at a time.", 400)

        all_chunks, accepted, skipped = [], [], []
        for file in files:
            shown_name = Path(file.filename or "").name or "(unnamed file)"
            saved = None
            try:
                user_upload_dir = app.state.upload_dir / str(user.id)
                user_upload_dir.mkdir(parents=True, exist_ok=True)
                saved, name = save_upload(file, user_upload_dir, max_upload_bytes())  # type/size checks, safe name
                chunks = load_and_split(str(saved), display_name=name)
                for chunk in chunks:
                    chunk.metadata["owner_id"] = str(user.id)
            except IngestError as problem:
                skipped.append({"file": shown_name, "error": str(problem)})
            except Exception:
                logging.getLogger("app").exception("Unexpected error while ingesting %s", shown_name)
                skipped.append({"file": shown_name, "error": "This file could not be processed."})
            else:
                all_chunks.extend(chunks)
                accepted.append({
                    "file": name, "chunks": len(chunks), "doc_id": chunks[0].metadata["doc_id"],
                    "file_type": chunks[0].metadata["file_type"], "size_bytes": saved.stat().st_size,
                })
                continue
            if saved is not None:  # do not keep files that failed to ingest
                saved.unlink(missing_ok=True)

        if not all_chunks:
            message = skipped[0]["error"] if len(skipped) == 1 else "None of the files could be processed."
            return JSONResponse({"error": message, "skipped": skipped}, status_code=422)
        try:
            create_vectorstore(all_chunks)
        except Exception:
            logging.getLogger("app").exception("Vector store update failed")
            return _error("The documents were read but could not be indexed. Please try again.", 500)
        record_uploads(accepted, user.id)  # best effort: never blocks or fails the upload
        # "status", "documents" and "chunks" are unchanged; "files" and "skipped" are new extras.
        return {"status": "success", "documents": len(accepted), "chunks": len(all_chunks), "files": accepted, "skipped": skipped}

    @app.get("/documents")
    def documents(auth=Depends(require_auth)):
        _, user = auth
        return {"documents": list_documents(user.id)}

    @app.post("/chat")
    async def chat(request: Request, auth=Depends(require_auth)):
        _, user = auth
        try:
            data = await request.json()
        except Exception:
            data = {}
        if not isinstance(data, dict):
            data = {}
        question, provider, api_key = data.get("question"), data.get("provider"), data.get("api_key")
        if not question:
            return _error("Question is required.", 400)
        if not provider:
            return _error("AI provider is required.", 400)
        if not api_key:
            return _error("API key is required.", 400)
        if not all(isinstance(value, str) for value in (question, provider, api_key)):
            return _error("Invalid request.", 400)
        question = question.strip()
        if not question:
            return _error("Question is required.", 400)
        if len(question) > MAX_QUESTION_CHARS:
            return _error(f"Question is too long. Keep it under {MAX_QUESTION_CHARS} characters.", 400)
        if provider.strip().lower() not in supported_providers():
            return _error(f"Unsupported AI provider. Choose one of: {', '.join(supported_providers())}.", 400)
        if len(api_key) > 512:
            return _error("The API key looks invalid.", 400)
        history = data.get("history")  # optional: [{"role": "user"|"assistant", "content": "..."}] for follow-up questions

        def work():
            try:
                docs = get_retriever(user.id).invoke(question)
            except Exception:
                logging.getLogger("app").exception("Document retrieval failed")
                return _error("The knowledge base is not ready. Upload documents first.", 503)
            try:
                result = answer_question(question, docs, provider, api_key, history)
            except LLMError as problem:  # safe, user-facing text; never contains the key
                return _error(problem.message, problem.status)
            # "question", "answer" and "sources" keep their shape; "grounded" and per-source "index"/"cited" are new.
            return {"question": question, "answer": result.answer, "grounded": result.grounded, "sources": describe_sources(result)}

        return await run_in_threadpool(work)

    @app.get("/health")
    def health():
        # A real round trip to the database, not just a flag set at startup.
        return {"status": "healthy", "authentication_database": "ready" if check_database() else "unavailable"}

    return app


app = create_app()

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app:app", host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
