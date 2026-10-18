"""PostgreSQL/pgvector ingestion and similarity retrieval."""

import os

from langchain_core.documents import Document
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from sqlalchemy import func, select

from src.config import EMBEDDING_DIMENSIONS
from src.database import KnowledgeSession
from src.models import ChatTurn, DocumentChunk


def get_embeddings() -> GoogleGenerativeAIEmbeddings:
    api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GOOGLE_API_KEY is required to create document embeddings.")
    return GoogleGenerativeAIEmbeddings(
        model="models/gemini-embedding-001",
        google_api_key=api_key,
        output_dimensionality=EMBEDDING_DIMENSIONS,
    )


def store_chunks(chunks: list[Document]) -> int:
    """Embed and persist chunks in the knowledge database."""
    vectors = get_embeddings().embed_documents([chunk.page_content for chunk in chunks])
    if len(vectors) != len(chunks):
        raise RuntimeError("Embedding provider returned an unexpected number of vectors.")

    with KnowledgeSession.begin() as session:
        for position, (chunk, vector) in enumerate(zip(chunks, vectors)):
            metadata = dict(chunk.metadata)
            page = metadata.get("page")
            session.add(DocumentChunk(
                document_id=metadata["document_id"],
                chunk_index=position,
                content=chunk.page_content,
                page_number=page + 1 if isinstance(page, int) else None,
                metadata_=metadata,
                embedding=vector,
            ))
    return len(chunks)


def retrieve_documents(question: str, limit: int = 5) -> list[Document]:
    """Find nearest chunks using pgvector cosine distance."""
    vector = get_embeddings().embed_query(question)
    distance = DocumentChunk.embedding.cosine_distance(vector).label("distance")
    statement = select(DocumentChunk).order_by(distance).limit(limit)
    with KnowledgeSession() as session:
        chunks = session.scalars(statement).all()
    return [Document(page_content=chunk.content, metadata=chunk.metadata_) for chunk in chunks]


def index_exists() -> bool:
    with KnowledgeSession() as session:
        return bool(session.scalar(select(func.count()).select_from(DocumentChunk)))


def get_conversation_memory(conversation_id: str, limit: int = 6) -> list[dict[str, str]]:
    """Return recent persisted turns for context-aware follow-up questions."""
    statement = (
        select(ChatTurn)
        .where(ChatTurn.conversation_id == conversation_id)
        .order_by(ChatTurn.created_at.desc())
        .limit(limit)
    )
    with KnowledgeSession() as session:
        turns = list(reversed(session.scalars(statement).all()))
    return [{"question": turn.question, "response": turn.response} for turn in turns]
