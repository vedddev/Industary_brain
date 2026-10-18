from pathlib import Path

from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter


def load_and_split(pdf_path: str, source_name: str | None = None, document_id: str | None = None):
    """Extract and split one PDF, retaining a user-friendly source citation."""
    loader = PyPDFLoader(pdf_path)
    docs = loader.load()

    source_name = source_name or Path(pdf_path).name
    for document in docs:
        document.metadata["source"] = source_name
        if document_id:
            document.metadata["document_id"] = document_id

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
    )
    return splitter.split_documents(docs)
