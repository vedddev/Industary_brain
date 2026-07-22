from flask import Flask, request, jsonify
from flask_cors import CORS
from pathlib import Path
import os

from src.ingest import load_and_split
from src.retriever import create_vectorstore, get_retriever
from src.rag_chain import get_answer

app = Flask(__name__)
CORS(app)

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

# Home

@app.route("/")
def home():
    return jsonify({
        "message": "Industrial Knowledge Intelligence API"
    })


# Upload PDFs

@app.route("/upload", methods=["POST"])
def upload_documents():

    print("Upload endpoint called")

    if "files" not in request.files:
        print("No files found in request")
        return jsonify({"error": "No files uploaded"}), 400

    uploaded_files = request.files.getlist("files")

    print(f"Number of uploaded files: {len(uploaded_files)}")

    all_chunks = []

    for file in uploaded_files:

        print("File:", file.filename)

        filepath = UPLOAD_DIR / file.filename

        file.save(filepath)

        print("Saved to:", filepath)

        chunks = load_and_split(str(filepath))

        print("Chunks:", len(chunks))

        all_chunks.extend(chunks)

    print("Total chunks:", len(all_chunks))

    create_vectorstore(all_chunks)

    return jsonify({
        "status": "success",
        "documents": len(uploaded_files),
        "chunks": len(all_chunks)
    })


# Chat

@app.route("/chat", methods=["POST"])
def chat():

    data = request.get_json()

    question = data.get("question")
    provider = data.get("provider")
    api_key = data.get("api_key")

    if not question:
        return jsonify({
            "error": "Question is required."
        }), 400

    if not provider:
        return jsonify({
            "error": "AI provider is required."
        }), 400

    if not api_key:
        return jsonify({
            "error": "API key is required."
        }), 400

    retriever = get_retriever()

    docs = retriever.invoke(question)

    answer = get_answer(
        question=question,
        docs=docs,
        provider=provider,
        api_key=api_key
    )

    sources = []

    for doc in docs:
        sources.append({
            "file": doc.metadata.get("source", ""),
            "page": doc.metadata.get("page", 0) + 1,
            "content": doc.page_content[:300]
        })

    return jsonify({
        "question": question,
        "answer": answer,
        "sources": sources
    })
# Health

@app.route("/health")
def health():

    return jsonify({
        "status": "healthy"
    })


if __name__ == "__main__":
    app.run(debug=True)