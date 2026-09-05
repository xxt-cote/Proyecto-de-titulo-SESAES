"""
Tests del campo `tratamiento` en Profesional.

NOTA IMPORTANTE SOBRE ESTOS TESTS:
No tuve acceso a `app/main.py`, `app/database.py`, `app/rbac/dependencies.py`
ni a ningún `conftest.py`/carpeta `tests/` existente del proyecto, así que no
pude "seguir el patrón actual del repositorio" como se pidió — no sé qué
patrón usan. Para no fabricar un test que aparente pasar sin probar nada
real, estos tests:

  1. Llaman directamente a las funciones del router (`crear_profesional`,
     `actualizar_profesional`, `get_profesionales_admin`, `get_resumen_dia`)
     como funciones Python normales, con una sesión SQLAlchemy real sobre
     SQLite en memoria. Esto ejercita la lógica real de negocio (incluida
     la distinción model_fields_set) sin necesitar saber cómo el proyecto
     resuelve `require_permission` vía HTTP.
  2. Por eso NO cubren "las restricciones de permisos existentes no
     cambian" vía HTTP real (ver test marcado como `skip` al final, con la
     razón exacta de qué archivos necesito para escribirlo de verdad).

Si el proyecto ya tiene un `conftest.py` con un fixture de TestClient
autenticado (ej. `client_admin`), lo ideal es adaptar estos tests para usar
ese fixture y probar los endpoints vía HTTP end-to-end. Compárteme ese
conftest y te entrego la versión ajustada.
"""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Registra todos los modelos/relaciones SQLAlchemy antes de create_all().
# Mismo patrón usado por los tests RBAC existentes de SESAES.
import app.models.init  # noqa: F401
import app.models.solicitud_horario  # noqa: F401

from app.database import Base
from app.models.profesional import Profesional
from app.schemas import ProfesionalCreate, ProfesionalUpdate
from app.routers.admin import (
    crear_profesional,
    actualizar_profesional,
    get_profesionales_admin,
    get_resumen_dia,
)

FAKE_ADMIN = {"id": 1, "rol": "admin"}


@pytest.fixture()
def db_session():
    """Sesión real sobre SQLite en memoria, con todas las tablas del
    proyecto creadas a partir del mismo Base declarativo que usa la app."""
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


# ══════════════════════════════════════
# 1. Creación de profesional CON tratamiento
# ══════════════════════════════════════

def test_crear_profesional_con_tratamiento(db_session):
    datos = ProfesionalCreate(
        nombre="Eduardo Carvajal",
        tratamiento="Dr.",
        especialidad="Medicina General",
        correo="eduardo.carvajal@utem.cl",
    )
    creado = crear_profesional(datos, db_session, FAKE_ADMIN)

    assert creado.tratamiento == "Dr."
    guardado = db_session.query(Profesional).filter(Profesional.id == creado.id).first()
    assert guardado.tratamiento == "Dr."


# ══════════════════════════════════════
# 2. Creación de profesional SIN tratamiento sigue funcionando
# ══════════════════════════════════════

def test_crear_profesional_sin_tratamiento(db_session):
    datos = ProfesionalCreate(
        nombre="Carlos Muñoz",
        especialidad="Nutrición",
        correo="carlos.munoz@utem.cl",
    )
    creado = crear_profesional(datos, db_session, FAKE_ADMIN)

    assert creado.tratamiento is None
    assert creado.nombre == "Carlos Muñoz"
    guardado = db_session.query(Profesional).filter(Profesional.id == creado.id).first()
    assert guardado.tratamiento is None


# ══════════════════════════════════════
# 3. Actualización del tratamiento (profesional ya existente, dato NULL)
# ══════════════════════════════════════

def test_actualizar_tratamiento_de_profesional_existente(db_session):
    creado = crear_profesional(
        ProfesionalCreate(nombre="Rodrigo Céspedes", especialidad="Kinesiología", correo="rodrigo@utem.cl"),
        db_session, FAKE_ADMIN
    )
    assert creado.tratamiento is None  # estado inicial: sin tratamiento, como los datos reales hoy

    actualizado = actualizar_profesional(
        creado.id, ProfesionalUpdate(tratamiento="Klgo."), db_session, FAKE_ADMIN
    )

    assert actualizado.tratamiento == "Klgo."


# ══════════════════════════════════════
# 4. Limpieza explícita del tratamiento (PATCH con tratamiento: null)
# ══════════════════════════════════════

def test_limpiar_tratamiento_explicitamente(db_session):
    creado = crear_profesional(
        ProfesionalCreate(nombre="Ana Martínez", tratamiento="Dra.", especialidad="Psicología", correo="ana@utem.cl"),
        db_session, FAKE_ADMIN
    )
    assert creado.tratamiento == "Dra."

    # tratamiento=None enviado EXPLÍCITAMENTE (queda en model_fields_set)
    limpiado = actualizar_profesional(
        creado.id, ProfesionalUpdate(tratamiento=None), db_session, FAKE_ADMIN
    )
    assert limpiado.tratamiento is None


def test_no_tocar_tratamiento_si_no_se_envia(db_session):
    """Si `tratamiento` no viene en el payload, debe conservar su valor
    actual (regresión del bug 'is not None' que impedía limpiar, pero
    aplicada al revés: tampoco debe borrar sin querer)."""
    creado = crear_profesional(
        ProfesionalCreate(nombre="Diego Soto", tratamiento="Klgo.", especialidad="Kinesiología", correo="diego@utem.cl"),
        db_session, FAKE_ADMIN
    )
    assert creado.tratamiento == "Klgo."

    # Solo se envía duracion_min; tratamiento NO se toca.
    actualizado = actualizar_profesional(
        creado.id, ProfesionalUpdate(duracion_min=30), db_session, FAKE_ADMIN
    )
    assert actualizado.tratamiento == "Klgo."


# ══════════════════════════════════════
# 5. /admin/resumen-dia devuelve tratamiento
# ══════════════════════════════════════

def test_resumen_dia_incluye_tratamiento(db_session):
    crear_profesional(
        ProfesionalCreate(nombre="Eduardo Carvajal", tratamiento="Dr.", especialidad="Medicina General", correo="eduardo2@utem.cl"),
        db_session, FAKE_ADMIN
    )
    crear_profesional(
        ProfesionalCreate(nombre="Carlos Muñoz", especialidad="Nutrición", correo="carlos2@utem.cl"),
        db_session, FAKE_ADMIN
    )

    resumen = get_resumen_dia(db_session, FAKE_ADMIN)

    por_nombre = {r["nombre"]: r for r in resumen}
    assert por_nombre["Eduardo Carvajal"]["tratamiento"] == "Dr."
    assert por_nombre["Carlos Muñoz"]["tratamiento"] is None


def test_listado_profesionales_incluye_tratamiento(db_session):
    crear_profesional(
        ProfesionalCreate(nombre="Ana Martínez", tratamiento="Dra.", especialidad="Psicología", correo="ana2@utem.cl"),
        db_session, FAKE_ADMIN
    )

    listado = get_profesionales_admin(db_session, FAKE_ADMIN)

    assert listado[0]["tratamiento"] == "Dra."


# ══════════════════════════════════════
# 6. Permisos — PENDIENTE, requiere archivos que no tengo
# ══════════════════════════════════════

@pytest.mark.skip(
    reason=(
        "No tengo acceso a app/rbac/dependencies.py (implementación real de "
        "require_permission) ni a app/main.py, así que no puedo construir un "
        "TestClient con override de autenticación fiel al mecanismo real del "
        "proyecto. Comparte esos dos archivos (y el conftest.py si existe) "
        "para escribir un test end-to-end que confirme que un usuario sin "
        "PROFESIONALES_GESTIONAR sigue recibiendo 403 en estos endpoints."
    )
)
def test_permisos_profesionales_gestionar_sin_cambios():
    pass
