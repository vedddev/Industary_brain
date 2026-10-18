from pathlib import Path
import os
import logging
from threading import Lock
from uuid import uuid4

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError
from pydantic import BaseModel, Field, field_validator

from src.config import (
    MAX_FILES_PER_UPLOAD,
    MAX_QUESTION_LENGTH,
    MAX_UPLOAD_SIZE_BYTES,
    UPLOAD_DIR,
    allowed_origins,
)
from src.database import DocumentsSession, KnowledgeSession, databases_available
from src.ingest import load_and_split
from src.models import ChatTurn, Conversation, StoredDocument
from src.retriever import get_conversation_memory, index_exists, retrieve_documents, store_chunks
from src.rag_chain import get_answer

app = FastAPI(
    title="Industrial Knowledge Intelligence API",
    description="API for industrial document ingestion and AI-powered question answering.",
    version="1.0.0",
)

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
logger = logging.getLogger(__name__)
index_lock = Lock()
SUPPORTED_PROVIDERS = {"groq", "gemini", "openai", "anthropic"}

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins(),
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


# Request schema
class ChatRequest(BaseModel):
    question: str = Field(min_length=1, max_length=MAX_QUESTION_LENGTH)
    provider: str = Field(min_length=1, max_length=30)
    api_key: str = Field(min_length=1, max_length=500)
    conversation_id: str | None = Field(default=None, max_length=36)

    @field_validator("question", "provider", "api_key")
    @classmethod
    def strip_required_values(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("This field cannot be blank.")
        return value


# Home
@app.get("/")
def home():
    return {
        "message": "Industrial Knowledge Intelligence API"
    }


# Upload PDFs
@app.post("/upload")
def upload_documents(files: list[UploadFile] = File(...)):
    if not files:
        raise HTTPException(
            status_code=400,
            detail="No files uploaded."
        )

    if len(files) > MAX_FILES_PER_UPLOAD:
        raise HTTPException(
            status_code=400,
            detail=f"Upload at most {MAX_FILES_PER_UPLOAD} PDF files at a time.",
        )

    all_chunks = []
    stored_documents: list[StoredDocument] = []
    uploaded_count = 0
    saved_paths: list[Path] = []
    upload_completed = False

    try:
        for file in files:
            if not file.filename:
                raise HTTPException(
                    status_code=400,
                    detail="A file has no filename."
                )

            if Path(file.filename).suffix.lower() != ".pdf":
                raise HTTPException(
                    status_code=400,
                    detail=f"Only PDF files are supported: {file.filename}"
                )

            # Do not permit path traversal or overwrite a previous upload.
            safe_name = Path(file.filename).name
            filepath = UPLOAD_DIR / f"{uuid4().hex}_{safe_name}"
            saved_paths.append(filepath)

            with filepath.open("wb") as destination:
                bytes_written = 0
                while chunk := file.file.read(1024 * 1024):
                    bytes_written += len(chunk)
                    if bytes_written > MAX_UPLOAD_SIZE_BYTES:
                        raise HTTPException(
                            status_code=413,
                            detail=(
                                f"{safe_name} exceeds the {MAX_UPLOAD_SIZE_BYTES // 1024 // 1024} MB limit."
                            ),
                        )
                    destination.write(chunk)

            stored_document = StoredDocument(
                id=str(uuid4()),
                original_filename=safe_name,
                storage_path=str(filepath),
                file_data=filepath.read_bytes(),
                content_type=file.content_type,
                size_bytes=bytes_written,
            )
            stored_documents.append(stored_document)
            chunks = load_and_split(
                str(filepath),
                source_name=safe_name,
                document_id=stored_document.id,
            )
            stored_document.page_count = len({chunk.metadata.get("page") for chunk in chunks})
            stored_document.chunk_count = len(chunks)
            all_chunks.extend(chunks)
            uploaded_count += 1

        if not all_chunks:
            raise HTTPException(
                status_code=400,
                detail="No readable text was found in the uploaded PDFs."
            )

        # Document metadata and vector chunks live in separate databases.
        # Processing status makes cross-database partial work visible and recoverable.
        with DocumentsSession.begin() as session:
            session.add_all(stored_documents)
        with index_lock:
            store_chunks(all_chunks)
        with DocumentsSession.begin() as session:
            for document in stored_documents:
                persisted = session.get(StoredDocument, document.id)
                persisted.status = "ready"
        upload_completed = True

        return {
            "status": "success",
            "documents": uploaded_count,
            "chunks": len(all_chunks),
        }

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Document upload failed")
        raise HTTPException(
            status_code=500,
            detail="Document processing failed. Check the backend logs."
        ) from exc
    finally:
        for file in files:
            file.file.close()
        if not upload_completed:
            for filepath in saved_paths:
                filepath.unlink(missing_ok=True)


# Chat
@app.post("/chat")
def chat(payload: ChatRequest):
    question = payload.question
    provider = payload.provider.lower()
    api_key = payload.api_key

    if provider not in SUPPORTED_PROVIDERS:
        raise HTTPException(
            status_code=400,
            detail="Unsupported AI provider. Choose groq, gemini, openai, or anthropic.",
        )

    try:
        with KnowledgeSession.begin() as session:
            conversation = (
                session.get(Conversation, payload.conversation_id)
                if payload.conversation_id
                else None
            )
            if conversation is None:
                conversation = Conversation()
                session.add(conversation)
                session.flush()
            conversation_id = conversation.id

        with index_lock:
            docs = retrieve_documents(question)

        if not docs:
            raise HTTPException(
                status_code=404,
                detail="No relevant document content found. Upload PDFs first."
            )

        answer = get_answer(
            question=question,
            docs=docs,
            provider=provider,
            api_key=api_key,
            memory=get_conversation_memory(conversation_id),
        )

        sources = [
            {
                "file": doc.metadata.get("source", ""),
                "page": doc.metadata.get("page", 0) + 1,
                "content": doc.page_content[:300],
            }
            for doc in docs
        ]

        context_snapshot = [
            {
                "document_id": doc.metadata.get("document_id"),
                "file": doc.metadata.get("source", ""),
                "page": doc.metadata.get("page", 0) + 1,
                "content": doc.page_content,
            }
            for doc in docs
        ]
        with KnowledgeSession.begin() as session:
            session.add(ChatTurn(
                conversation_id=conversation_id,
                question=question,
                response=answer,
                provider=provider,
                retrieved_context=context_snapshot,
            ))

        return {
            "question": question,
            "answer": answer,
            "sources": sources,
            "conversation_id": conversation_id,
        }

    except HTTPException:
        raise
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Chat request failed")
        raise HTTPException(
            status_code=500,
            detail="Failed to generate an answer. Check the backend logs."
        ) from exc


# Health
@app.get("/health")
def health():
    embedding_configured = bool(os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY"))

    if not databases_available():
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "document_index_ready": False,
                "embedding_configured": embedding_configured,
                "database": "unavailable",
            },
        )

    try:
        index_ready = index_exists()
    except SQLAlchemyError:
        logger.exception("Health check could not query the document index")
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "document_index_ready": False,
                "embedding_configured": embedding_configured,
                "database": "unavailable",
            },
        )

    return {
        "status": "healthy",
        "document_index_ready": index_ready,
        "embedding_configured": embedding_configured,
    }


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=port,
        reload=False,
    )
