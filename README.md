# Industrial Knowledge Intelligence Assistant
An AI-powered Retrieval-Augmented Generation (RAG) application that allows users to upload PDF documents and ask questions based on their contents. The application retrieves relevant document chunks using vector embeddings and generates accurate responses using Large Language Models.

---
# Features
- Upload one or multiple PDF documents
- Automatic document chunking and embedding
- Vector database for semantic retrieval
- AI-powered question answering using Groq LLM
- Multiple AI provider support (Groq, Gemini, OpenAI, Anthropic)
- Modern React frontend
- Beautiful chat interface
- Markdown rendering with syntax highlighting
- Chat history
- Export chat as PDF
- Dark UI
- Responsive design
- Local storage for conversations
- Document source retrieval

---

# Tech Stack

## Frontend

- React
- Vite
- Tailwind CSS
- Axios
- Framer Motion
- React Markdown
- Hero Icons
- React Hot Toast

## Backend

- FastAPI
- Uvicorn
- LangChain
- LangChain Groq
- PostgreSQL + pgvector
- Sentence Transformers
- PyPDF Loader

---

# Project Structure

```
ET2/
│
├── backend/
│   ├── app.py
│   ├── requirements.txt
│   ├── uploads/
│   ├── vectorstore/
│   ├── src/
│   │
│   ├── ingest.py
│   ├── rag_chain.py
│   ├── retriever.py
│   └── ...
│
├── frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── vite.config.js
│
└── README.md
```

---

# System Architecture

```
          User
            │
            ▼
      React Frontend
            │
            ▼
      Flask REST API
            │
    ┌───────┴────────┐
    ▼                ▼
PDF Upload      Chat Request
    │                │
    ▼                ▼
Chunk Documents   Retrieve Context
    │                │
    ▼                ▼
Vector Store ---> Groq LLM
            │
            ▼
       AI Response
            │
            ▼
        React UI
```

---

# Installation

## Docker (recommended)

Install Docker Desktop, then create a root `.env` file from `.env.example` and
set `GOOGLE_API_KEY`. Start the full application with:

```bash
docker compose up --build
```

Open http://localhost:8080. The frontend forwards `/api` requests to the
FastAPI service, which connects to the internal pgvector PostgreSQL service.
Uploads and PostgreSQL data are kept in Docker volumes. Stop the stack with
`docker compose down`; add `-v` only if you deliberately want to remove all
database and uploaded-file data.

To run only the database while developing the frontend and API outside Docker:

```bash
docker compose up -d postgres
```

## Clone Repository

```bash
git clone https://https://github.com/vedddev/Industary_brain.git

```

---

# Backend Setup

Create virtual environment

```bash
python -m venv brain
```

Activate environment

Windows

```bash
brain\Scripts\activate
```

Linux/Mac

```bash
source brain/bin/activate
```

Install dependencies

```bash
pip install -r requirements.txt
```

Create `.env`

```env
# Required for PDF ingestion and semantic search
GOOGLE_API_KEY=your_google_ai_studio_key

# Optional: browser origins allowed to call the API
CORS_ORIGINS=http://localhost:5173,https://industary-brain.vercel.app
```

## PostgreSQL databases

The backend uses two PostgreSQL databases on the same server:

- `industrial_documents` stores PDF binaries, metadata, and file lifecycle.
- `industrial_knowledge` stores chunks, pgvector embeddings, retrieval-context snapshots, conversations, and responses.

For local development, start the database service first:

```bash
docker compose up -d postgres
```

Then copy `backend/.env.example` to `backend/.env`. Initialize the tables and
the `vector` extension once before starting local API workers:

```bash
python -m src.init_db
```

Docker Compose runs this same command automatically in the `database-init`
service before the API starts.

Copy `backend/.env.example` to `backend/.env` to see all supported limits.
The LLM API key is supplied with each chat request, so a user can choose Groq,
Gemini, OpenAI, or Anthropic without storing that key on the server.

Run backend

```bash
python app.py
```

Backend runs on

```
https://industary-brain.onrender.com
```

---

# Frontend Setup

Navigate to frontend

```bash
cd frontend
```

Install dependencies

```bash
npm install
```

Run

```bash
npm run dev
```

Frontend runs on

```
https://industary-brain.vercel.app/
```

---

# API Endpoints

## Home

```
GET /
```

Response

```json
{
  "message":"Industrial Knowledge Intelligence API"
}
```

---

## Upload PDFs

```
POST /upload
```

Form Data

```
files
```

Response

```json
{
  "status":"success",
  "documents":2,
  "chunks":164
}
```

---

## Chat

```
POST /chat
```

Body

```json
{
    "question":"Explain tensile strength",
    "provider":"groq",
    "api_key":"YOUR_API_KEY"
}
```

Response

```json
{
    "question":"Explain tensile strength",
    "answer":"...",
    "sources":[]
}
```

---

## Health

```
GET /health
```

Response

```json
{
    "status":"healthy"
}
```

---

# Workflow

1. Upload PDF documents.
2. Backend extracts text.
3. Documents are split into chunks.
4. Chunks are converted into embeddings.
5. Embeddings are stored in PostgreSQL with pgvector.
6. User asks a question.
7. Relevant chunks are retrieved.
8. Retrieved context is sent to the LLM.
9. AI generates an answer.
10. Response is displayed in the chat interface.

---

# AI Providers

The application is designed to support multiple providers.

- Groq
- Google Gemini
- OpenAI
- Anthropic

Currently implemented:

- ✅ Groq

Future support:

- Gemini
- OpenAI
- Anthropic

---

# Frontend Features

- Responsive sidebar
- Chat history
- Markdown rendering
- Code syntax highlighting
- Copy response
- Like/Dislike responses
- Regenerate answer
- Upload PDFs
- Voice input placeholder
- Export chat to PDF
- Animated interface
- Mobile responsive

---

# Backend Features

- REST API
- PDF ingestion
- Vector embeddings
- PostgreSQL and pgvector integration
- LangChain retriever
- Retrieval-Augmented Generation (RAG)
- Source references
- Multi-file upload

---

# Environment Variables

```
GOOGLE_API_KEY=xxxxxxxxxxxxxxxx
```

---

# Dependencies

Backend

- Flask
- FastAPI CORS middleware
- LangChain
- LangChain-Groq
- PostgreSQL + pgvector
- Sentence Transformers
- PyPDF

Frontend

- React
- Vite
- Tailwind CSS
- Axios
- Framer Motion
- React Markdown
- Hero Icons

---

# Screenshots

Add screenshots here.

Example

```
screenshots/

home.png

chat.png

upload.png
```

---

# Future Improvements

- Authentication
- Database support
- Conversation memory
- Streaming responses
- OCR for scanned PDFs
- Image understanding
- Audio transcription
- Citation highlighting
- Multi-user support
- Cloud deployment
- Admin dashboard

---

# Deployment

Frontend

- Vercel
- Netlify

Backend

- Render
- Railway
- Azure
- AWS

---

# Security

- API keys stored locally
- Environment variables ignored using `.gitignore`
- CORS enabled
- Sensitive files excluded from Git

---

# License

This project is licensed under the MIT License.

---

# Author

**Your Name**

Industrial Knowledge Intelligence Assistant

Built with ❤️ using React, FastAPI, LangChain, PostgreSQL/pgvector, and Groq.
