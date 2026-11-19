"""Punto único de entrada al historial Alembic, sin URLs en configuración."""
from pathlib import Path

from alembic import command
from alembic.config import Config
from alembic.util import CommandError
from sqlalchemy import inspect, text


def require_versioned_or_empty(connection, metadata) -> None:
    """No adopta ni altera por accidente una base histórica sin versión."""
    inspector = inspect(connection)
    presentes = set(inspector.get_table_names())
    if not presentes.intersection(metadata.tables):
        return
    if "alembic_version" in presentes:
        if connection.execute(text("SELECT version_num FROM alembic_version")).first():
            return
    raise CommandError(
        "La base contiene tablas SESAES sin revisión Alembic. "
        "No se modificó el esquema. Usa una base nueva o un procedimiento "
        "de adopción revisado sobre una copia; no ejecutes stamp a ciegas."
    )


def migration_config(connection=None) -> Config:
    backend = Path(__file__).resolve().parents[1]
    config = Config(str(backend / "alembic.ini"))
    # Se pasan conexiones en memoria, no contraseñas por set_main_option.
    # Así también funcionan URLs que contienen % y tests con SQLite en memoria.
    if connection is not None:
        config.attributes["connection"] = connection
    return config


def upgrade_schema(bind) -> None:
    """Ejecuta upgrade head sobre la conexión del motor recibido."""
    with bind.begin() as connection:
        command.upgrade(migration_config(connection), "head")
