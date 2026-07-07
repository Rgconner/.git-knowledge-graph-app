# Knowledge Graph Application

A web application that ingests unstructured documents, extracts entities and relationships using an AI pipeline, and renders an interactive visual knowledge graph.

**Stack:** Python + FastAPI · React + Vite + TypeScript + D3.js · SQLite (local dev)

---

## Prerequisites

| Tool | Minimum version |
|------|----------------|
| Python | 3.11+ |
| Node.js | 20+ |
| npm | 10+ |

---

## Repository Layout

```
knowledge-graph-app/
├── backend/            # FastAPI application
│   ├── ai/             # AI provider abstraction layer
│   ├── db/             # Database session & connection helpers
│   ├── models/         # SQLAlchemy ORM models
│   ├── routers/        # FastAPI route handlers
│   ├── services/       # Business logic & pipeline services
│   └── main.py         # Application entry point
├── frontend/           # React + Vite application
│   └── src/
│       ├── api/        # Typed API client functions
│       ├── components/ # Shared React components
│       ├── graph/      # D3 graph canvas components
│       ├── hooks/      # Custom React hooks
│       └── pages/      # Top-level page components
├── docs/               # Architecture notes and API docs
└── .env.example        # Environment variable reference
```

---

## Local Development Setup

### 1 — Clone and configure environment

```bash
git clone <repo-url>
cd knowledge-graph-app
cp .env.example .env
# Edit .env — set AI_API_KEY and, if needed, change AI_PROVIDER
```

### 2 — Backend

```bash
cd backend

# Create and activate a virtual environment
python -m venv .venv
# macOS / Linux:
source .venv/bin/activate
# Windows PowerShell:
.\.venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Start the development server (auto-reload enabled)
uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`.  
Interactive docs: `http://localhost:8000/docs`

### 3 — Frontend

```bash
# In a second terminal, from the repo root:
cd frontend

npm install
npm run dev
```

The frontend will be available at `http://localhost:5173`.  
API requests to `/api/*` are proxied to `http://localhost:8000` via the Vite dev server.

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `AI_PROVIDER` | AI backend to use (`openai`, `anthropic`, `watsonx`) | `openai` |
| `AI_API_KEY` | API key for the selected AI provider | — |
| `DATABASE_URL` | SQLAlchemy database URL | `sqlite:///./knowledge_graph.db` |
| `SECRET_KEY` | Secret used to sign JWTs | — |

---

## Running Both Servers Together (optional)

If you have `concurrently` available globally:

```bash
# From knowledge-graph-app/
npx concurrently \
  "cd backend && uvicorn main:app --reload --port 8000" \
  "cd frontend && npm run dev"
```

---

## Health Check

```bash
curl http://localhost:8000/health
# {"status":"ok"}
```
