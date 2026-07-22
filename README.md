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

- Flask
- Flask-CORS
- LangChain
- LangChain Groq
- ChromaDB
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

## Clone Repository

```bash
git clone https://github.com/yourusername/industrial-knowledge-intelligence.git

cd industrial-knowledge-intelligence
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
GROQ_API_KEY=your_api_key
```

Run backend

```bash
python app.py
```

Backend runs on

```
http://127.0.0.1:5000
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
http://localhost:5173
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
5. Embeddings are stored in Chroma Vector Database.
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
- ChromaDB integration
- LangChain retriever
- Retrieval-Augmented Generation (RAG)
- Source references
- Multi-file upload

---

# Environment Variables

```
GROQ_API_KEY=xxxxxxxxxxxxxxxx
```

---

# Dependencies

Backend

- Flask
- Flask-CORS
- LangChain
- LangChain-Groq
- ChromaDB
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

Built with ❤️ using React, Flask, LangChain, ChromaDB, and Groq.
