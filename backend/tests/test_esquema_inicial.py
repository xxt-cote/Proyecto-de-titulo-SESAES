"""Verifica el esquema definitivo sin importar routers ni aplicar parches."""
import json
import os
from pathlib import Path
import subprocess
import sys
import uuid

import pytest
from sqlalchemy import create_engine, inspect, text, event
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.init_db import init_db
from app.models.usuario import Usuario
from app.models.profesional import Profesional


def verificar_esquema(engine):
    insp = inspect(engine)
    assert set(insp.get_table_names()) == set(Base.metadata.tables) | {"alembic_version"}
    for tabla, campos in {
        "cita": {"creado_por_usuario_id", "creado_por_rol", "creado_por_perfil", "fecha_creacion", "sobrecupo"},
        "usuario": {"fecha_creacion"},
        "auditoria": {"actor_rol", "resultado", "entidad", "entidad_id"},
    }.items():
        assert campos <= {c["name"] for c in insp.get_columns(tabla)}
    assert {"cita_sobrecupo", "cita_sobrecupo_conflicto", "acceso_admin_permiso",
            "solicitud_horario_bloques", "historial_paciente", "firma_profesional"} <= set(insp.get_table_names())
    indices = {i["name"]: i for i in insp.get_indexes("cita")}
    assert not indices["ix_cita_profesional_fecha_estado"]["unique"]
    assert not any(i["unique"] and {"profesional_id", "fecha", "hora"} <= set(i["column_names"]) for i in indices.values())
    assert "ix_auditoria_entidad_entidad_id_fecha" in {i["name"] for i in insp.get_indexes("auditoria")}
    assert "agenda.sobrecupo" in " ".join(c["sqltext"] for c in insp.get_check_constraints("acceso_admin_permiso"))
    for tabla, nombre in (("historial_paciente", "uq_historial_paciente_par"),
                          ("acceso_administrativo", "uq_acceso_administrativo_usuario"),
                          ("acceso_admin_permiso", "uq_acceso_admin_permiso")):
        assert nombre in {c["name"] for c in insp.get_unique_constraints(tabla)}


def test_init_aislado_registra_todo_sin_routers():
    env = dict(os.environ, DATABASE_URL="sqlite://", SEED_DEMO_DATA="false")
    codigo = '''
import json
from sqlalchemy import inspect
from app.init_db import init_db
from app.database import engine
init_db()
init_db()
print(json.dumps(inspect(engine).get_table_names()))
'''
    result = subprocess.run([sys.executable, "-c", codigo], cwd=Path(__file__).resolve().parents[1],
                            env=env, capture_output=True, text=True, check=True)
    assert set(json.loads(result.stdout)) == set(Base.metadata.tables) | {"alembic_version"}


def test_esquema_sqlite(monkeypatch):
    engine = create_engine("sqlite://")
    monkeypatch.setattr("app.init_db.engine", engine)
    monkeypatch.setenv("SEED_DEMO_DATA", "false")
    init_db()
    init_db()
    verificar_esquema(engine)
    engine.dispose()


def test_seed_revierte_usuarios_si_falla_la_creacion_de_profesionales(monkeypatch):
    engine = create_engine("sqlite://")
    Session = sessionmaker(bind=engine)
    def fallar_profesional(session, _context, _instances):
        if any(isinstance(obj, Profesional) for obj in session.new):
            raise RuntimeError("Fallo de persistencia simulado")
    event.listen(Session, "before_flush", fallar_profesional)
    monkeypatch.setattr("app.init_db.engine", engine)
    monkeypatch.setattr("app.init_db.SessionLocal", Session)
    monkeypatch.setattr("app.init_db.hash_password", lambda _: "hash-solo-test")
    monkeypatch.setenv("SEED_DEMO_DATA", "true")
    monkeypatch.setenv("SEED_DEMO_PASSWORD", "password-solo-test")
    with pytest.raises(RuntimeError, match="Fallo de persistencia"):
        init_db()
    with Session() as db:
        assert db.query(Usuario).count() == 0
        assert db.query(Profesional).count() == 0
    engine.dispose()


@pytest.mark.postgres
def test_esquema_postgres_vacio(monkeypatch):
    url = os.getenv("TEST_POSTGRES_URL")
    if not url:
        pytest.skip("Requiere TEST_POSTGRES_URL; se usa un schema temporal aislado")
    schema = "test_esquema_" + uuid.uuid4().hex
    base = create_engine(url)
    with base.begin() as conn:
        conn.execute(text(f'CREATE SCHEMA "{schema}"'))
    engine = create_engine(url, connect_args={"options": f"-csearch_path={schema}"})
    try:
        monkeypatch.setattr("app.init_db.engine", engine)
        monkeypatch.setenv("SEED_DEMO_DATA", "false")
        init_db()
        init_db()
        verificar_esquema(engine)
    finally:
        engine.dispose()
        with base.begin() as conn:
            conn.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
        base.dispose()
