"""Document ingestion: validate -> load -> clean -> split -> chunks with useful metadata.

Backward compatible: load_and_split(path) still returns a list of LangChain Documents.

Supported: PDF, TXT, MD, CSV, and DOCX (DOCX needs `pip install docx2txt`).

Tunable through environment variables:
  CHUNK_SIZE (1000)   CHUNK_OVERLAP (200)   MIN_CHUNK_CHARS (30)
  MAX_UPLOAD_MB (25)  MAX_FILES (10)
"""
from __future__ import annotations

import hashlib
import importlib.util
import logging
import os
import re
import uuid
from pathlib import Path

from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter

log = logging.getLogger("ingest")

_BASE_EXTENSIONS = {".pdf", ".txt", ".md", ".csv"}


class IngestError(Exception):
    """A problem with one file, worded so it is safe to show to the user."""


# --------------------------------------------------------------------------- settings
def _int_env(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except ValueError:
        return default


def max_upload_bytes() -> int:
    return _int_env("MAX_UPLOAD_MB", 25) * 1024 * 1024


def max_files() -> int:
    return _int_env("MAX_FILES", 10)


def supported_extensions() -> set[str]:
    extensions = set(_BASE_EXTENSIONS)
    if importlib.util.find_spec("docx2txt"):
        extensions.add(".docx")
    return extensions


# --------------------------------------------------------------------------- saving uploads
def safe_filename(name: str | None) -> str:
    """Strips any directory part and unusual characters; keeps the extension."""
    base = Path(name or "").name.strip().lstrip(".")
    stem, ext = os.path.splitext(base)
    stem = re.sub(r"[^\w\-. ()]", "_", stem, flags=re.UNICODE).strip()[:120]
    ext = re.sub(r"[^\w.]", "", ext).lower()[:10]
    if not stem:
        raise IngestError("This file has no usable name.")
    return stem + ext


def save_upload(upload, dest_dir: Path, max_bytes: int | None = None) -> tuple[Path, str]:
    """Streams a FastAPI UploadFile to disk with type and size checks.
    Returns (saved_path, clean_name). Nothing is left behind if a check fails."""
    max_bytes = max_bytes or max_upload_bytes()
    name = safe_filename(upload.filename)
    extension = os.path.splitext(name)[1]
    if extension not in supported_extensions():
        allowed = ", ".join(sorted(e.lstrip(".").upper() for e in supported_extensions()))
        raise IngestError(f"“{name}” is not a supported file type. Allowed: {allowed}.")

    partial = dest_dir / f".{uuid.uuid4().hex}.part"  # written aside, then renamed into place
    written = 0
    try:
        with open(partial, "wb") as out:
            while True:
                block = upload.file.read(1024 * 1024)
                if not block:
                    break
                written += len(block)
                if written > max_bytes:
                    raise IngestError(f"“{name}” is larger than the {max_bytes // (1024 * 1024)} MB limit.")
                out.write(block)
        if written == 0:
            raise IngestError(f"“{name}” is empty.")
        final = dest_dir / name
        os.replace(partial, final)
        return final, name
    finally:
        partial.unlink(missing_ok=True)


# --------------------------------------------------------------------------- loading
def clean_text(text: str, *, rejoin_hyphens: bool = False) -> str:
    text = text.replace("\x00", "")
    if rejoin_hyphens:
        text = re.sub(r"(\w)-\n(\w)", r"\1\2", text)  # "inter-\nnational" -> "international"
    text = re.sub(r"[ \t ]+", " ", text)
    text = re.sub(r" ?\n ?", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _read_text(path: Path) -> str:
    raw = path.read_bytes()
    for encoding in ("utf-8-sig", "cp1252"):
        try:
            return raw.decode(encoding)
        except UnicodeDecodeError:
            continue
    return raw.decode("latin-1")  # never fails


def _load_pdf(path: Path) -> list[Document]:
    with open(path, "rb") as handle:
        if b"%PDF-" not in handle.read(1024):
            raise IngestError("This file is not a valid PDF.")
    from langchain_community.document_loaders import PyPDFLoader

    try:
        pages = PyPDFLoader(str(path)).load()
    except Exception as error:
        log.warning("PDF load failed for %s: %s", path.name, type(error).__name__)
        raise IngestError("This PDF could not be read. It may be corrupt or password-protected.") from error
    return [Document(page_content=clean_text(p.page_content, rejoin_hyphens=True), metadata={"page": p.metadata.get("page", 0)}) for p in pages]


def _load_csv(path: Path) -> list[Document]:
    import csv
    import io

    rows = list(csv.reader(io.StringIO(_read_text(path))))
    if len(rows) < 2:
        return []
    header, body = rows[0], rows[1:]
    lines = []
    for row in body:
        pairs = [f"{h.strip()}: {v.strip()}" for h, v in zip(header, row) if v and v.strip()]
        if pairs:
            lines.append("; ".join(pairs))
    return [Document(page_content="\n\n".join(lines), metadata={})]


def _load_docx(path: Path) -> list[Document]:
    try:
        import docx2txt
    except ImportError as error:
        raise IngestError("DOCX files need the docx2txt package installed on the server.") from error
    try:
        text = docx2txt.process(str(path))
    except Exception as error:
        raise IngestError("This Word document could not be read.") from error
    return [Document(page_content=clean_text(text), metadata={})]


_LOADERS = {
    ".pdf": _load_pdf,
    ".txt": lambda p: [Document(page_content=clean_text(_read_text(p)), metadata={})],
    ".md": lambda p: [Document(page_content=clean_text(_read_text(p)), metadata={})],
    ".csv": _load_csv,
    ".docx": _load_docx,
}


def _fingerprint(path: Path) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()[:16]


# --------------------------------------------------------------------------- main entry point
def load_and_split(path: str | Path, display_name: str | None = None) -> list[Document]:
    """Loads one file and returns cleaned, de-duplicated chunks ready for the vector store.

    Every chunk's metadata contains:
      source       file name shown to users (not the server path)
      file_type    pdf / txt / ...
      doc_id       short hash of the file, to tell versions apart
      page         0-based page number (PDFs only; the /chat endpoint adds 1 for display)
      chunk_index  position of this chunk within the file
      total_chunks how many chunks the file produced
    Raises IngestError (with a user-friendly message) when the file cannot be used.
    """
    path = Path(path)
    extension = path.suffix.lower()
    if extension not in _LOADERS:
        raise IngestError(f"“{path.name}” is not a supported file type.")

    documents = _LOADERS[extension](path)
    documents = [d for d in documents if d.page_content.strip()]
    if not documents:
        raise IngestError("No readable text was found. Scanned or image-only documents need OCR first.")

    name, doc_id = display_name or path.name, _fingerprint(path)
    for document in documents:
        document.metadata.update(source=name, file_type=extension.lstrip("."), doc_id=doc_id)

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=_int_env("CHUNK_SIZE", 1000),
        chunk_overlap=_int_env("CHUNK_OVERLAP", 200),
        add_start_index=True,
    )
    minimum, seen, chunks = _int_env("MIN_CHUNK_CHARS", 30), set(), []
    for chunk in splitter.split_documents(documents):
        text = chunk.page_content.strip()
        if len(text) < minimum:  # page numbers, stray headers
            continue
        key = hashlib.md5(re.sub(r"\s+", " ", text.lower()).encode("utf-8")).hexdigest()
        if key in seen:  # repeated headers/footers and duplicated paragraphs
            continue
        seen.add(key)
        chunk.page_content = text
        chunks.append(chunk)

    if not chunks:
        raise IngestError("The document did not contain enough text to index.")
    for index, chunk in enumerate(chunks):
        chunk.metadata.update(chunk_index=index, total_chunks=len(chunks))
    return chunks