# Knowledge Graph Application

A web application that ingests unstructured documents, extracts entities and relationships using an AI pipeline, and renders an interactive visual knowledge graph.

**Stack:** Python + FastAPI · React + Vite + TypeScript + D3.js · PostgreSQL · Docker

---

## Prerequisites

### Local development (without Docker)

| Tool | Minimum version |
|------|----------------|
| Python | 3.11+ |
| Node.js | 20+ |
| npm | 10+ |
| PostgreSQL | 14+ |

### Docker (recommended)

| Tool | Minimum version |
|------|----------------|
| Docker | 24+ |
| Docker Compose | v2 (`docker compose` plugin) |

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
# Edit .env — set AI_API_KEY, SECRET_KEY, and POSTGRES_PASSWORD
```

### 2 — Create the PostgreSQL database

You need a running PostgreSQL 14+ instance. Create the database and user:

```sql
CREATE USER kg_user WITH PASSWORD 'kg_password';
CREATE DATABASE knowledge_graph OWNER kg_user;
```

Then set `DATABASE_URL` in your `.env`:

```
DATABASE_URL=postgresql://kg_user:kg_password@localhost:5432/knowledge_graph
```

### 3 — Backend

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

# Run database migrations
alembic upgrade head

# Start the development server (auto-reload enabled)
uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`.  
Interactive docs: `http://localhost:8000/docs`

### 4 — Frontend

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
| `DATABASE_URL` | PostgreSQL connection URL | `postgresql://kg_user:kg_password@localhost:5432/knowledge_graph` |
| `POSTGRES_PASSWORD` | Password for the `kg_user` DB user (used by Docker Compose) | `kg_password` |
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

## Docker

Docker is the easiest way to run the full application. The Compose file starts three containers: **PostgreSQL**, the **FastAPI backend**, and the **React/Nginx frontend**.

### 1 — Configure environment

```bash
cd knowledge-graph-app
cp .env.example .env
# Edit .env — at minimum set AI_API_KEY, SECRET_KEY, and POSTGRES_PASSWORD
```

> **Note:** `DATABASE_URL` is automatically set by `docker-compose.yml` to point at the Postgres container. You do not need to set it in `.env` when using Docker.

### 2 — Build and start

```bash
# From knowledge-graph-app/
docker compose up --build
```

This will:
1. Pull the `postgres:16-alpine` image and start the database container
2. Build the backend image (`python:3.12-slim`, installs all Python deps)
3. Build the frontend image (Node 20 builds the React app, Nginx serves it)
4. The backend waits for Postgres to pass its health check before starting
5. The frontend waits for the backend health check to pass

### 3 — Open the application

| URL | What |
|-----|------|
| `http://localhost:3000` | The full application (React frontend via Nginx) |
| `http://localhost:3000/api/docs` | FastAPI interactive API docs (proxied) |

### Stopping

```bash
docker compose down          # stop containers (database volume is preserved)
docker compose down -v       # stop AND delete the database volume
```

### Rebuilding after code changes

```bash
docker compose up --build
```

### Data persistence

The PostgreSQL data directory is stored in a named Docker volume `db-data`. It survives `docker compose down` but is deleted by `docker compose down -v`.

### Individual image builds (without Compose)

```bash
# Backend only
docker build -t kg-backend ./backend

# Frontend only
docker build -t kg-frontend ./frontend
```

---

## Database Migrations

Migrations are managed with [Alembic](https://alembic.sqlalchemy.org/).

```bash
# Apply all pending migrations (run from backend/)
alembic upgrade head

# Generate a new migration after changing models
alembic revision --autogenerate -m "describe your change"

# Check current migration state
alembic current
```

When running via Docker, migrations are applied automatically at container startup via `main.py`'s `Base.metadata.create_all()` call. For production use, run `alembic upgrade head` explicitly before starting the backend.

---

## Health Check

```bash
# Local dev
curl http://localhost:8000/health

# Docker
curl http://localhost:3000/api/health

# Expected response
# {"status":"ok"}
```
