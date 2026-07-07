"""Database engine, session factory, declarative base, and FastAPI dependency."""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

# Allow DATABASE_URL to be overridden via environment (e.g., postgresql://… in prod).
DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./knowledge_graph.db")

# connect_args only needed for SQLite (disables the same-thread check so FastAPI
# background tasks can share a connection without errors).
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    """Shared declarative base for all ORM models."""
    pass


def get_db():
    """FastAPI dependency that yields a database session and closes it on exit."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
