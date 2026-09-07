from __future__ import annotations

import inspect

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Registrar modelos/relaciones antes de create_all.
import app.models.init  # noqa: F401
import app.models.solicitud_horario  # noqa: F401

from app.database import Base
from app.models.cita import Cita
from app.models.profesional import Profesional
from app.models.usuario import Usuario
from app.rbac.admin_authorization import (
    AlcanceAdministrativoEfectivo,
)
from app.rbac.permissions import Permission
from app.routers import admin
from app.routers import agenda


@pytest.fixture()
def db_session():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={
            "check_same_thread": False,
        },
    )

    Base.metadata.create_all(bind=engine)

    SessionLocal = sessionmaker(
        bind=engine,
        autoflush=False,
        autocommit=False,
    )

    session = SessionLocal()

    try:
        yield session
    finally:
        session.close()
        engine.dispose()


def _dependencia_de(endpoint):
    parametro = inspect.signature(
        endpoint
    ).parameters["current_user"]

    return parametro.default.dependency


def _permiso_de(endpoint):
    dependencia = _dependencia_de(
        endpoint
    )

    closure = inspect.getclosurevars(
        dependencia
    )

    return closure.nonlocals.get(
        "permission"
    )


def _usuario(
    db,
    *,
    correo,
    nombre,
    rut,
):
    usuario = Usuario(
        correo=correo,
        password="hash-sa10-2",
        rol="estudiante",
        nombre=nombre,
        rut=rut,
        activo=True,
    )

    db.add(usuario)
    db.flush()

    return usuario


def _profesional(
    db,
    *,
    nombre,
    especialidad,
    iniciales,
):
    profesional = Profesional(
        nombre=nombre,
        especialidad=especialidad,
        iniciales=iniciales,
        estado="activo",
    )

    db.add(profesional)
    db.flush()

    return profesional


def _cita(
    db,
    *,
    estudiante_id,
    profesional_id,
    fecha,
    hora,
    estado="pendiente",
    urgente=False,
    sobrecupo=False,
):
    cita = Cita(
        estudiante_id=estudiante_id,
        profesional_id=profesional_id,
        fecha=fecha,
        hora=hora,
        estado=estado,
        urgente=urgente,
        sobrecupo=sobrecupo,
        medicamento="SECRETO",
        observaciones="NO EXPONER",
        observaciones_atencion="CLINICO",
    )

    db.add(cita)
    db.flush()

    return cita


def _alcance_institucional():
    return AlcanceAdministrativoEfectivo(
        institucional=True,
        especialidades_normalizadas=frozenset(),
    )


def _alcance_nutricion():
    return AlcanceAdministrativoEfectivo(
        institucional=False,
        especialidades_normalizadas=frozenset({
            "nutricion",
        }),
    )


def test_listar_citas_admin_exige_exactamente_agenda_ver():
    assert (
        _permiso_de(
            agenda.listar_citas_admin
        )
        is Permission.AGENDA_VER
    )


def test_listar_citas_admin_no_exige_reportes_ver(
    monkeypatch,
):
    dependencia = _dependencia_de(
        agenda.listar_citas_admin
    )

    permisos_consultados = []

    def resolver(
        db,
        current_user,
        permission,
    ):
        permisos_consultados.append(
            permission
        )

        return (
            permission
            is Permission.AGENDA_VER
        )

    monkeypatch.setattr(
        "app.rbac.dependencies.tiene_permiso_efectivo",
        resolver,
    )

    current_user = {
        "id": 50,
        "rol": "admin",
    }

    resultado = dependencia(
        current_user=current_user,
        db=object(),
    )

    assert resultado == current_user

    assert permisos_consultados == [
        Permission.AGENDA_VER,
    ]

    assert (
        Permission.REPORTES_VER
        not in permisos_consultados
    )


def test_sin_agenda_ver_dependencia_responde_403(
    monkeypatch,
):
    dependencia = _dependencia_de(
        agenda.listar_citas_admin
    )

    monkeypatch.setattr(
        "app.rbac.dependencies.tiene_permiso_efectivo",
        lambda db, current_user, permission: False,
    )

    with pytest.raises(
        HTTPException
    ) as exc:
        dependencia(
            current_user={
                "id": 50,
                "rol": "admin",
            },
            db=object(),
        )

    assert exc.value.status_code == 403


def test_historial_sigue_exigiendo_reportes_ver():
    assert (
        _permiso_de(
            admin.get_historial_admin
        )
        is Permission.REPORTES_VER
    )


def test_listado_institucional_devuelve_solo_campos_operacionales(
    db_session,
    monkeypatch,
):
    estudiante = _usuario(
        db_session,
        correo="ana-sa10-2@utem.cl",
        nombre="Ana Perez",
        rut="11.111.111-1",
    )

    profesional = _profesional(
        db_session,
        nombre="Profesional Nutricion",
        especialidad="Nutricion",
        iniciales="PN",
    )

    _cita(
        db_session,
        estudiante_id=estudiante.id,
        profesional_id=profesional.id,
        fecha="2026-09-10",
        hora="10:00",
        urgente=True,
        sobrecupo=True,
    )

    db_session.commit()

    monkeypatch.setattr(
        agenda,
        "obtener_alcance_administrativo_efectivo",
        lambda db, current_user: (
            _alcance_institucional()
        ),
    )

    resultado = agenda.listar_citas_admin(
        db=db_session,
        current_user={
            "id": 1,
            "rol": "superadmin",
        },
    )

    assert len(resultado) == 1

    fila = resultado[0]

    assert set(fila) == {
        "id",
        "estudiante",
        "estudiante_id",
        "rut",
        "iniciales",
        "especialidad",
        "profesional",
        "profesional_id",
        "fecha",
        "hora",
        "estado",
        "urgente",
        "sobrecupo",
    }

    assert fila["estudiante"] == "Ana Perez"
    assert fila["especialidad"] == "Nutricion"
    assert fila["profesional"] == "Profesional Nutricion"
    assert fila["urgente"] is True
    assert fila["sobrecupo"] is True

    for campo in {
        "medicamento",
        "observaciones",
        "observaciones_atencion",
        "anamnesis",
        "diagnostico",
        "ficha",
        "cuestionario",
    }:
        assert campo not in fila



def test_alcance_especialidad_sin_profesionales_devuelve_vacio(
    db_session,
    monkeypatch,
):
    monkeypatch.setattr(
        agenda,
        "obtener_alcance_administrativo_efectivo",
        lambda db, current_user: (
            _alcance_nutricion()
        ),
    )

    resultado = agenda.listar_citas_admin(
        db=db_session,
        current_user={
            "id": 50,
            "rol": "admin",
        },
    )

    assert resultado == []

def test_alcance_especialidad_no_filtra_citas_ajenas(
    db_session,
    monkeypatch,
):
    estudiante_1 = _usuario(
        db_session,
        correo="nutri-sa10-2@utem.cl",
        nombre="Estudiante Nutri",
        rut="22.222.222-2",
    )

    estudiante_2 = _usuario(
        db_session,
        correo="odonto-sa10-2@utem.cl",
        nombre="Estudiante Odonto",
        rut="33.333.333-3",
    )

    nutricion = _profesional(
        db_session,
        nombre="Nutricionista",
        especialidad="Nutricion",
        iniciales="NU",
    )

    odontologia = _profesional(
        db_session,
        nombre="Odontologo",
        especialidad="Odontologia",
        iniciales="OD",
    )

    _cita(
        db_session,
        estudiante_id=estudiante_1.id,
        profesional_id=nutricion.id,
        fecha="2026-09-11",
        hora="09:00",
    )

    _cita(
        db_session,
        estudiante_id=estudiante_2.id,
        profesional_id=odontologia.id,
        fecha="2026-09-11",
        hora="10:00",
    )

    db_session.commit()

    monkeypatch.setattr(
        agenda,
        "obtener_alcance_administrativo_efectivo",
        lambda db, current_user: (
            _alcance_nutricion()
        ),
    )

    resultado = agenda.listar_citas_admin(
        db=db_session,
        current_user={
            "id": 50,
            "rol": "admin",
        },
    )

    assert len(resultado) == 1

    assert (
        resultado[0]["profesional_id"]
        == nutricion.id
    )

    assert (
        resultado[0]["especialidad"]
        == "Nutricion"
    )


def test_filtros_operacionales_reducen_resultado(
    db_session,
    monkeypatch,
):
    ana = _usuario(
        db_session,
        correo="ana-filtro-sa10-2@utem.cl",
        nombre="Ana Perez",
        rut="44.444.444-4",
    )

    pedro = _usuario(
        db_session,
        correo="pedro-filtro-sa10-2@utem.cl",
        nombre="Pedro Soto",
        rut="55.555.555-5",
    )

    profesional = _profesional(
        db_session,
        nombre="Profesional General",
        especialidad="Medicina General",
        iniciales="MG",
    )

    cita_objetivo = _cita(
        db_session,
        estudiante_id=ana.id,
        profesional_id=profesional.id,
        fecha="2026-09-12",
        hora="11:00",
        estado="pendiente",
    )

    _cita(
        db_session,
        estudiante_id=pedro.id,
        profesional_id=profesional.id,
        fecha="2026-09-20",
        hora="12:00",
        estado="completada",
    )

    db_session.commit()

    monkeypatch.setattr(
        agenda,
        "obtener_alcance_administrativo_efectivo",
        lambda db, current_user: (
            _alcance_institucional()
        ),
    )

    resultado = agenda.listar_citas_admin(
        estudiante="Ana",
        fecha_inicio="2026-09-12",
        fecha_fin="2026-09-12",
        estado="pendiente",
        db=db_session,
        current_user={
            "id": 1,
            "rol": "superadmin",
        },
    )

    assert [
        fila["id"]
        for fila in resultado
    ] == [
        cita_objetivo.id,
    ]
