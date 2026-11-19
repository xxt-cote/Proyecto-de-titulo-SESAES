"""Alembic comparte conexión, modelos y configuración con SESAES."""
import os
from pathlib import Path

from alembic import context
from dotenv import load_dotenv
from sqlalchemy import create_engine, pool

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from app.database import Base  # noqa: E402
import app.models.init  # noqa: E402,F401 — registra todos los modelos
from app.migrations import require_versioned_or_empty  # noqa: E402

config = context.config
target_metadata = Base.metadata


def migrar_con_conexion(connection):
    require_versioned_or_empty(connection, target_metadata)
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_offline():
    context.configure(
        url=os.environ["DATABASE_URL"],
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    connection = config.attributes.get("connection")
    if connection is not None:
        migrar_con_conexion(connection)
        return
    engine = create_engine(os.environ["DATABASE_URL"], poolclass=pool.NullPool)
    try:
        with engine.begin() as connection:
            migrar_con_conexion(connection)
    finally:
        engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
