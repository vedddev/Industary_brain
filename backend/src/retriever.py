
"""Persistent Chroma access with metadata-filtered per-user retrieval."""

from __future__ import annotations

import hashlib
import os
import threading
from pathlib import Path

from dotenv import load_dotenv
from langchain_chroma import Chroma
from langchain_google_genai import GoogleGenerativeAIEmbeddings

# Load environment variables from the backend .env file.
BASE_DIR = Path(__file__).resolve().parents[1]
ENV_FILE = BASE_DIR / ".env"

load_dotenv(dotenv_path=ENV_FILE, override=True)

api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")

print("Looking for .env at:", ENV_FILE)
print("Does .env exist?", ENV_FILE.is_file())
print("Gemini API key loaded?", bool(api_key))

PERSIST_DIR = Path(
    os.environ.get("VECTORSTORE_DIR", BASE_DIR / "vectorstore")
).resolve()

COLLECTION_NAME = os.environ.get(
    "VECTORSTORE_COLLECTION", "industrial_docs"
)

_lock = threading.RLock()
_vectorstore: Chroma | None = None


class KnowledgeBaseEmptyError(RuntimeError):
    """Raised when chat is requested before any readable document is indexed."""


class VectorStoreError(RuntimeError):
    """Raised for unavailable or damaged Chroma/embedding resources."""


def get_embeddings():
    """Initialize Gemini embeddings using the server-side API key."""
    api_key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")

    if not api_key:
        raise VectorStoreError(
            "Gemini API key is missing. Set GOOGLE_API_KEY or GEMINI_API_KEY "
            "in the backend .env file."
        )

    return GoogleGenerativeAIEmbeddings(
        model="models/gemini-embedding-001",
        google_api_key=api_key,
    )


def _open_vectorstore() -> Chroma:
    PERSIST_DIR.mkdir(parents=True, exist_ok=True)

    try:
        return Chroma(
            persist_directory=str(PERSIST_DIR),
            embedding_function=get_embeddings(),
            collection_name=COLLECTION_NAME,
        )
    except VectorStoreError:
        raise
    except Exception as error:
        raise VectorStoreError(
            "The knowledge base could not be opened. "
            "Check its storage and embedding configuration."
        ) from error


def _store() -> Chroma:
    global _vectorstore

    with _lock:
        if _vectorstore is None:
            _vectorstore = _open_vectorstore()

        return _vectorstore


def _chunk_ids(chunks) -> list[str]:
    """Deterministic IDs make re-uploading identical content idempotent."""
    ids = []

    for chunk in chunks:
        metadata = chunk.metadata

        basis = "|".join(
            (
                str(metadata.get("owner_id", "")),
                str(metadata.get("doc_id", "")),
                str(metadata.get("page", "")),
                str(metadata.get("chunk_index", "")),
                chunk.page_content,
            )
        )

        ids.append(hashlib.sha256(basis.encode("utf-8")).hexdigest())

    return ids


def create_vectorstore(chunks):
    """Add chunks without deleting previously uploaded documents."""
    if not chunks:
        raise VectorStoreError(
            "No document chunks were supplied for indexing."
        )

    with _lock:
        store = _store()

        try:
            store.add_documents(
                documents=chunks,
                ids=_chunk_ids(chunks),
            )
            return store
        except Exception as error:
            raise VectorStoreError(
                "The documents could not be indexed. "
                "Check the embedding provider and vector-store data."
            ) from error


def get_retriever(user_id):
    store = _store()
    owner_filter = {"owner_id": str(user_id)}

    try:
        # `get` supports metadata filtering across Chroma versions; using it here
        # avoids treating another account's collection entries as this user's data.
        if not store.get(where=owner_filter, limit=1, include=["metadatas"]).get("ids"):
            raise KnowledgeBaseEmptyError(
                "Your knowledge base is empty. "
                "Upload a supported document before asking a question."
            )

        return store.as_retriever(search_kwargs={"k": 5, "filter": owner_filter})

    except KnowledgeBaseEmptyError:
        raise
    except Exception as error:
        raise VectorStoreError(
            "The knowledge base could not be read. "
            "Check its storage and embedding configuration."
        ) from error
