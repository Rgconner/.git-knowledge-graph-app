#!/usr/bin/env python3
"""
migrate.py — Safe schema migration for PostgreSQL.

Adds columns/tables that were added to the ORM models after the initial
schema was created.  Every operation is idempotent — safe to run multiple
times.

Usage:
    cd knowledge-graph-app/backend
    python migrate.py

The DATABASE_URL is read from the environment (or .env file).
"""
from __future__ import annotations

import os
import sys
import logging

from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
log = logging.getLogger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL", "")

if not DATABASE_URL:
    log.error("DATABASE_URL is not set. Add it to your .env file and retry.")
    sys.exit(1)

if DATABASE_URL.startswith("sqlite"):
    log.warning(
        "SQLite detected — SQLite applies schema changes automatically via "
        "create_all(). Run the server once; no manual migration needed."
    )
    sys.exit(0)

try:
    import psycopg2
except ImportError:
    log.error("psycopg2 is not installed. Run: pip install psycopg2-binary")
    sys.exit(1)

conn = psycopg2.connect(DATABASE_URL)
conn.autocommit = True
cur = conn.cursor()

log.info("Connected to: %s", DATABASE_URL.split("@")[-1])  # hide credentials


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def column_exists(table: str, column: str) -> bool:
    cur.execute(
        """
        SELECT 1 FROM information_schema.columns
        WHERE table_name = %s AND column_name = %s
        """,
        (table, column),
    )
    return cur.fetchone() is not None


def table_exists(table: str) -> bool:
    cur.execute(
        """
        SELECT 1 FROM information_schema.tables
        WHERE table_name = %s
        """,
        (table,),
    )
    return cur.fetchone() is not None


def type_exists(typename: str) -> bool:
    cur.execute(
        "SELECT 1 FROM pg_type WHERE typname = %s",
        (typename,),
    )
    return cur.fetchone() is not None


def add_column(table: str, column: str, definition: str) -> None:
    if column_exists(table, column):
        log.info("  SKIP  %s.%s — already exists", table, column)
    else:
        cur.execute(f'ALTER TABLE {table} ADD COLUMN {column} {definition}')
        log.info("  ADD   %s.%s", table, column)


# ---------------------------------------------------------------------------
# Migration steps
# ---------------------------------------------------------------------------

log.info("=== Knowledge Graph schema migration ===")

# ── 1. users.is_admin ────────────────────────────────────────────────────────
log.info("Step 1: users.is_admin")
add_column("users", "is_admin", "INTEGER NOT NULL DEFAULT 0")

# ── 2. documents.fingerprint ─────────────────────────────────────────────────
log.info("Step 2: documents.fingerprint")
add_column("documents", "fingerprint", "TEXT")

# ── 3. documents.original_filename ───────────────────────────────────────────
log.info("Step 3: documents.original_filename")
add_column("documents", "original_filename", "VARCHAR(512)")

# ── 3b. entities graveyard + override columns ─────────────────────────────────
log.info("Step 3b: entities — graveyard and override columns")
add_column("entities", "archived",          "INTEGER NOT NULL DEFAULT 0")
add_column("entities", "archived_at",       "TIMESTAMP")
add_column("entities", "archive_note",      "TEXT")
add_column("entities", "label_override",    "VARCHAR(512)")
add_column("entities", "sentiment_override","DOUBLE PRECISION")

# ── 4. Enum types for watch tables ───────────────────────────────────────────
log.info("Step 4: enum types")

if not type_exists("watchsourcetype"):
    cur.execute("CREATE TYPE watchsourcetype AS ENUM ('filesystem', 'github')")
    log.info("  ADD   type watchsourcetype")
else:
    log.info("  SKIP  type watchsourcetype — already exists")

if not type_exists("watchedfilestatus"):
    cur.execute(
        "CREATE TYPE watchedfilestatus AS ENUM "
        "('pending', 'approved', 'rejected', 'ingesting', 'failed')"
    )
    log.info("  ADD   type watchedfilestatus")
else:
    log.info("  SKIP  type watchedfilestatus — already exists")

# ── 5. watch_sources table ───────────────────────────────────────────────────
log.info("Step 5: watch_sources table")

if not table_exists("watch_sources"):
    cur.execute("""
        CREATE TABLE watch_sources (
            id              SERIAL PRIMARY KEY,
            owner_user_id   INTEGER NOT NULL REFERENCES users(id),
            name            VARCHAR(255) NOT NULL,
            source_type     watchsourcetype NOT NULL,
            fs_path         VARCHAR(1024),
            file_glob       VARCHAR(255) DEFAULT '**/*',
            github_repo     VARCHAR(512),
            github_branch   VARCHAR(255) DEFAULT 'main',
            github_path     VARCHAR(512) DEFAULT '',
            github_token    VARCHAR(512),
            enabled         INTEGER NOT NULL DEFAULT 1,
            last_scanned_at TIMESTAMP,
            created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
        )
    """)
    cur.execute("CREATE INDEX ix_watch_sources_owner ON watch_sources(owner_user_id)")
    log.info("  ADD   table watch_sources")
else:
    log.info("  SKIP  table watch_sources — already exists")

# ── 6. watched_files table ────────────────────────────────────────────────────
log.info("Step 6: watched_files table")

if not table_exists("watched_files"):
    cur.execute("""
        CREATE TABLE watched_files (
            id                SERIAL PRIMARY KEY,
            source_id         INTEGER NOT NULL REFERENCES watch_sources(id) ON DELETE CASCADE,
            file_key          VARCHAR(1024) NOT NULL,
            filename          VARCHAR(512) NOT NULL,
            relative_path     VARCHAR(1024),
            file_size_bytes   INTEGER,
            status            watchedfilestatus NOT NULL DEFAULT 'pending',
            document_id       INTEGER REFERENCES documents(id),
            review_note       TEXT,
            discovered_at     TIMESTAMP NOT NULL DEFAULT NOW(),
            reviewed_at       TIMESTAMP
        )
    """)
    cur.execute("CREATE INDEX ix_watched_files_source ON watched_files(source_id)")
    cur.execute("CREATE INDEX ix_watched_files_status ON watched_files(status)")
    log.info("  ADD   table watched_files")
else:
    log.info("  SKIP  table watched_files — already exists")

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------

cur.close()
conn.close()

log.info("")
log.info("=== Migration complete — restart the backend server ===")
