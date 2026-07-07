from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

# Import engine + Base, and all models so their tables are registered on Base.metadata.
from db.session import Base, engine  # noqa: E402
import models.models  # noqa: F401

# Create all tables that don't yet exist (local dev convenience).
# Alembic handles schema migrations in production.
Base.metadata.create_all(bind=engine)

from routers import documents, action_items, graph  # noqa: E402

app = FastAPI(
    title="Knowledge Graph API",
    description="Backend for the Knowledge Graph Application",
    version="0.1.0",
)

# Allow the Vite dev server to call the API during local development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(documents.router)
app.include_router(action_items.router)
app.include_router(graph.router)


@app.get("/health", tags=["health"])
async def health_check() -> dict:
    """Basic liveness probe."""
    return {"status": "ok"}
