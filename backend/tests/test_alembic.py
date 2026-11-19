"""Migraciones reales y equivalencia estructural con los modelos SQLAlchemy."""
import os
from pathlib import Path
import re
import subprocess
import sys
import uuid

import pytest
from alembic import command
from alembic.util import CommandError
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import make_url

from app.database import Base
import app.models.init  # noqa: F401
from app.migrations import migration_config, upgrade_schema
from scripts.auditar_esquema import diagnosticar


def huella_esquema(engine):
    """Compara estructura física: incluye CHECK/FK/defaults que autogenerate omite."""
    inspector = inspect(engine)
    schema = inspector.default_schema_name
    def normalizar(valor):
        if isinstance(valor, dict):
            return {k: normalizar(v) for k, v in sorted(valor.items())}
        if isinstance(valor, (list, tuple)):
            return [normalizar(v) for v in valor]
        if isinstance(valor, str):
            valor = valor.replace(f'"{schema}".', '').replace(f'{schema}.', '')
            return re.sub(r'\s+', ' ', valor).strip()
        return valor
    tablas = {}
    for tabla in sorted(set(inspector.get_table_names()) - {'alembic_version'}):
        columnas = []
        for c in inspector.get_columns(tabla):
            columnas.append({
                'nombre': c['name'], 'tipo': str(c['type'].compile(dialect=engine.dialect)),
                'nullable': c['nullable'], 'default': c.get('default'),
                'autoincrement': c.get('autoincrement'),
            })
        tablas[tabla] = {
            'columnas': columnas,
            'pk': inspector.get_pk_constraint(tabla),
            'fk': sorted(inspector.get_foreign_keys(tabla), key=lambda v: str(v['constrained_columns'])),
            'checks': sorted(inspector.get_check_constraints(tabla), key=lambda v: v['name'] or ''),
            'unicas': sorted(inspector.get_unique_constraints(tabla), key=lambda v: str(v['column_names'])),
            'indices': sorted(inspector.get_indexes(tabla), key=lambda v: v['name']),
        }
    return normalizar(tablas)


def test_upgrade_y_downgrade_sqlite_sin_seed():
    engine = create_engine('sqlite://')
    upgrade_schema(engine)
    upgrade_schema(engine)
    assert set(inspect(engine).get_table_names()) == set(Base.metadata.tables) | {'alembic_version'}
    with engine.begin() as connection:
        command.downgrade(migration_config(connection), 'base')
    assert set(inspect(engine).get_table_names()) == {'alembic_version'}
    with engine.connect() as connection:
        assert connection.execute(text('SELECT count(*) FROM alembic_version')).scalar_one() == 0
    upgrade_schema(engine)
    engine.dispose()


def test_no_adopta_base_historica_sin_version():
    engine = create_engine('sqlite://')
    Base.metadata.create_all(engine)
    anterior = huella_esquema(engine)
    with pytest.raises(CommandError, match='sin revisión Alembic'):
        upgrade_schema(engine)
    assert huella_esquema(engine) == anterior
    assert 'alembic_version' not in inspect(engine).get_table_names()
    engine.dispose()


@pytest.fixture()
def motores_postgres():
    url = os.getenv('TEST_POSTGRES_URL')
    if not url:
        pytest.skip('Requiere TEST_POSTGRES_URL; se crean solo esquemas temporales aislados')
    admin = create_engine(url)
    creados = []
    def crear():
        schema = 'test_alembic_' + uuid.uuid4().hex
        with admin.begin() as connection:
            connection.execute(text(f'CREATE SCHEMA "{schema}"'))
        destino = make_url(url).update_query_dict({'options': f'-csearch_path={schema}'})
        engine = create_engine(destino)
        creados.append((schema, engine))
        return engine
    try:
        yield crear
    finally:
        for schema, engine in reversed(creados):
            engine.dispose()
            with admin.begin() as connection:
                connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
        admin.dispose()


def ejecutar_cli(engine, *args):
    env = dict(os.environ, DATABASE_URL=engine.url.render_as_string(hide_password=False), SEED_DEMO_DATA='false')
    result = subprocess.run([sys.executable, '-m', 'alembic', *args],
                            cwd=Path(__file__).resolve().parents[1], env=env,
                            capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=60)
    assert result.returncode == 0, result.stdout + result.stderr


@pytest.mark.postgres
def test_postgres_upgrade_equivale_modelos_e_init_y_downgrade(motores_postgres, monkeypatch):
    modelos, alembic, inicializador = (motores_postgres() for _ in range(3))
    # Referencia independiente del esquema previo: solo para demostrar equivalencia.
    Base.metadata.create_all(modelos)
    ejecutar_cli(alembic, 'upgrade', 'head')
    monkeypatch.setattr('app.init_db.engine', inicializador)
    monkeypatch.setenv('SEED_DEMO_DATA', 'false')
    from app.init_db import init_db
    init_db()
    init_db()
    referencia = huella_esquema(modelos)
    assert huella_esquema(alembic) == referencia
    assert huella_esquema(inicializador) == referencia
    assert set(referencia) == set(Base.metadata.tables)
    assert all(not diferencias for diferencias in diagnosticar(alembic).values())
    with alembic.begin() as connection:
        command.check(migration_config(connection))
        assert connection.execute(text('SELECT count(*) FROM usuario')).scalar_one() == 0
    ejecutar_cli(alembic, 'downgrade', 'base')
    assert set(inspect(alembic).get_table_names()) == {'alembic_version'}
    with alembic.connect() as connection:
        assert connection.execute(text('SELECT count(*) FROM alembic_version')).scalar_one() == 0
    ejecutar_cli(alembic, 'upgrade', 'head')
    assert huella_esquema(alembic) == referencia


def test_revision_seguridad_preserva_datos_y_permite_revertir_solo_sus_tablas():
    from sqlalchemy.orm import Session
    from app.models.usuario import Usuario

    engine = create_engine("sqlite://")
    with engine.begin() as connection:
        command.upgrade(migration_config(connection), "253cae9c234a")
    with Session(engine) as db:
        db.add(Usuario(id=901, nombre="Usuario de prueba de migración",
                       correo="migracion@utem.cl", password="hash-no-utilizable",
                       rol="estudiante", activo=True))
        db.commit()

    upgrade_schema(engine)
    assert {"intento_login", "restablecimiento_password"} <= set(inspect(engine).get_table_names())
    with Session(engine) as db:
        assert db.get(Usuario, 901).correo == "migracion@utem.cl"

    with engine.begin() as connection:
        command.downgrade(migration_config(connection), "253cae9c234a")
    assert not {"intento_login", "restablecimiento_password"} & set(inspect(engine).get_table_names())
    with Session(engine) as db:
        assert db.get(Usuario, 901).activo is True
    engine.dispose()
