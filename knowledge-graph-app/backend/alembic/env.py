"""Alembic environment configuration.

Reads DATABASE_URL from the environment (falls back to the value in alembic.ini)
and imports all ORM models so Alembic can detect schema changes automatically.
"""

import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool

from alembic import context

# ---------------------------------------------------------------------------
# Make sure the backend package root is on sys.path so the models import works
# whether Alembic is run from the backend/ directory or the repo root.
# ---------------------------------------------------------------------------
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

# Import Base and all models so Alembic can see every table in metadata.
from db.session import Base  # noqa: E402  (must come after sys.path manipulation)
import models.models  # noqa: F401  (registers all mappers on Base.metadata)

# ---------------------------------------------------------------------------
# Alembic Config object — gives access to values from alembic.ini.
# ---------------------------------------------------------------------------
config = context.config

# Override sqlalchemy.url with DATABASE_URL env variable when present.
database_url = os.getenv("DATABASE_URL")
if database_url:
    config.set_main_option("sqlalchemy.url", database_url)

# Interpret the config file for Python logging.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# The MetaData object for autogenerate support.
target_metadata = Base.metadata


# ---------------------------------------------------------------------------
# Run migrations
# ---------------------------------------------------------------------------


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode (no DB connection required)."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode (live DB connection)."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
