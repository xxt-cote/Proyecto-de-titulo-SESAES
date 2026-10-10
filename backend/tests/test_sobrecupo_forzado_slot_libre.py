# -*- coding: utf-8 -*-
"""
SESAES — sobrecupo pedido de forma EXPLÍCITA sobre una hora libre.

El botón «Solicitar sobrecupo» de la agenda administrativa manda
`sobrecupo=True` + `sobrecupo_forzado=True`: la cita debe quedar registrada
como sobrecupo aunque la hora esté libre. Sin `sobrecupo_forzado`, un
`sobrecupo=True` sobre una hora libre sigue creando una cita NORMAL (A.4.1:
nunca un sobrecupo "fantasma" por accidente) — eso ya lo cubre
test_a4_3_politica_sobrecupo.py y aquí solo se comprueba que no cambió.

Dos niveles: unitarios de la política y una pasada por crear_cita() con
SQLite en memoria.
"""

from __future__ import annotations

from datetime import date, timedelta

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import app.models.init  # noqa: F401 — registra TODOS los modelos productivos
import app.models.solicitud_horario  # noqa: F401

from app.database import Base
from app.models.auditoria import Auditoria
from app.models.cita import Cita
from app.models.cita_sobrecupo import CitaSobrecupo, CitaSobrecupoConflicto
from app.models.profesional import Profesional
from app.models.usuario import Usuario
from app.rbac.admin_authorization import AlcanceAdministrativoEfectivo
from app.rbac.permissions import Permission
from app.routers import citas
from app.schemas import CitaCreate
import app.services.sobrecupo_policy_service as sobrecupo_policy_service
from app.services.agenda_disponibilidad_service import ResultadoDisponibilidad
from app.services.sobrecupo_policy_service import (
    CODIGO_AUTORIZADO_SOBRE_SLOT_LIBRE,
    CODIGO_DENEGADO_SIN_MOTIVO,
    CODIGO_DENEGADO_SIN_PERMISO,
    CODIGO_FLAG_SOBRANTE_SIN_CONFLICTO,
    evaluar_politica_sobrecupo,
)


# ══════════════════════════════════════════════════════════
# Parte 1 — unitarios de la política
# ══════════════════════════════════════════════════════════

def _libre():
    return ResultadoDisponibilidad(
        disponible=True, motivo=None, mensaje=None,
        overridable_con_sobrecupo=False, profesional=None, conflictos=(),
    )


def _permisos(monkeypatch, *, gestionar: bool, sobrecupo: bool):
    def _resolver(db, current_user, permiso):
        if permiso == Permission.AGENDA_GESTIONAR:
            return gestionar
        if permiso == Permission.AGENDA_SOBRECUPO:
            return sobrecupo
        raise AssertionError(f"permiso no contemplado: {permiso!r}")

    monkeypatch.setattr(sobrecupo_policy_service, "tiene_permiso_efectivo", _resolver)


def _evaluar(monkeypatch, *, gestionar=True, sobrecupo=True, **kwargs):
    _permisos(monkeypatch, gestionar=gestionar, sobrecupo=sobrecupo)
    kwargs.setdefault("sobrecupo_solicitado", True)
    kwargs.setdefault("sobrecupo_forzado", True)
    kwargs.setdefault("sobrecupo_motivo", "Estudiante con urgencia académica")
    return evaluar_politica_sobrecupo(
        db=None, current_user={"id": 1, "rol": "admin"},
        resultado_disponibilidad=_libre(), **kwargs,
    )


def test_forzado_sobre_hora_libre_con_permisos_y_motivo_es_sobrecupo_efectivo(monkeypatch):
    d = _evaluar(monkeypatch)
    assert d.permitido is True
    assert d.es_sobrecupo_efectivo is True
    assert d.codigo == CODIGO_AUTORIZADO_SOBRE_SLOT_LIBRE
    assert d.conflictos == ()
    assert d.motivo_normalizado == "Estudiante con urgencia académica"


def test_forzado_normaliza_el_motivo(monkeypatch):
    d = _evaluar(monkeypatch, sobrecupo_motivo="  con espacios  ")
    assert d.motivo_normalizado == "con espacios"


@pytest.mark.parametrize("motivo", [None, "", "   "])
def test_forzado_sin_motivo_es_denegado(monkeypatch, motivo):
    d = _evaluar(monkeypatch, sobrecupo_motivo=motivo)
    assert d.permitido is False
    assert d.codigo == CODIGO_DENEGADO_SIN_MOTIVO


def test_forzado_con_gestionar_pero_sin_permiso_de_sobrecupo_es_denegado(monkeypatch):
    d = _evaluar(monkeypatch, sobrecupo=False)
    assert d.permitido is False
    assert d.codigo == CODIGO_DENEGADO_SIN_PERMISO


def test_forzado_sin_agenda_gestionar_sigue_siendo_cita_normal(monkeypatch):
    # Un estudiante que mande el campo a mano no obtiene un sobrecupo ni se
    # entera de que existe esa capacidad: se comporta como siempre.
    d = _evaluar(monkeypatch, gestionar=False, sobrecupo=False)
    assert d.permitido is True
    assert d.es_sobrecupo_efectivo is False
    assert d.codigo == CODIGO_FLAG_SOBRANTE_SIN_CONFLICTO


def test_sin_forzado_hora_libre_sigue_siendo_cita_normal(monkeypatch):
    d = _evaluar(monkeypatch, sobrecupo_forzado=False)
    assert d.permitido is True
    assert d.es_sobrecupo_efectivo is False
    assert d.codigo == CODIGO_FLAG_SOBRANTE_SIN_CONFLICTO


def test_forzado_sin_sobrecupo_true_no_hace_nada(monkeypatch):
    d = _evaluar(monkeypatch, sobrecupo_solicitado=False)
    assert d.es_sobrecupo_efectivo is False


# ══════════════════════════════════════════════════════════
# Parte 2 — integración por crear_cita()
# ══════════════════════════════════════════════════════════

@pytest.fixture()
def db_session():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine, autoflush=False, autocommit=False)()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


def _dia_habil_futuro() -> str:
    fecha = date.today() + timedelta(days=1)
    while fecha.weekday() >= 5:
        fecha += timedelta(days=1)
    return fecha.isoformat()


def _profesional(db):
    prof = Profesional(
        nombre="Profesional Test Forzado", especialidad="Nutrición", iniciales="PF",
        estado="activo", horario_inicio="09:00", horario_fin="17:00", duracion_min=30,
    )
    db.add(prof)
    db.flush()
    return prof


def _usuario(db, *, correo, rol, rut):
    u = Usuario(correo=correo, password="hash", rol=rol, nombre="Usuario Test", rut=rut, activo=True)
    db.add(u)
    db.flush()
    return u


def _cu(u):
    return {"id": u.id, "rol": u.rol}


def _permisos_router(monkeypatch, *, gestionar: bool, sobrecupo: bool):
    def _resolver(db, current_user, permiso):
        if permiso == Permission.AGENDA_GESTIONAR:
            return gestionar
        if permiso == Permission.AGENDA_SOBRECUPO:
            return sobrecupo
        raise AssertionError(f"permiso no contemplado: {permiso!r}")

    for modulo in (citas, sobrecupo_policy_service):
        monkeypatch.setattr(modulo, "tiene_permiso_efectivo", _resolver)
    monkeypatch.setattr(
        citas, "obtener_alcance_administrativo_efectivo",
        lambda db, u: AlcanceAdministrativoEfectivo(
            institucional=True, especialidades_normalizadas=frozenset(),
        ),
    )


def _escenario(db):
    return (
        _dia_habil_futuro(), _profesional(db),
        _usuario(db, correo="est-forzado@sesaes.cl", rol="estudiante", rut="forz-1"),
        _usuario(db, correo="adm-forzado@sesaes.cl", rol="admin", rut="forz-2"),
    )


def test_hora_libre_con_sobrecupo_forzado_queda_registrada_como_sobrecupo(db_session, monkeypatch):
    fecha, prof, est, adm = _escenario(db_session)
    db_session.commit()
    _permisos_router(monkeypatch, gestionar=True, sobrecupo=True)

    citas.crear_cita(
        cita=CitaCreate(
            estudiante_id=est.id, profesional_id=prof.id, fecha=fecha, hora="10:00",
            sobrecupo=True, sobrecupo_forzado=True, sobrecupo_motivo="  Caso especial  ",
        ),
        db=db_session, current_user=_cu(adm),
    )

    creada = db_session.query(Cita).one()
    assert creada.sobrecupo is True
    detalle = db_session.query(CitaSobrecupo).filter(CitaSobrecupo.cita_id == creada.id).one()
    assert detalle.motivo == "Caso especial"
    # No había nada que superar: no se inventa ningún conflicto.
    assert db_session.query(CitaSobrecupoConflicto).count() == 0
    assert db_session.query(Auditoria).filter(Auditoria.accion == "Creó cita con sobrecupo").count() == 1


def test_sin_forzado_la_hora_libre_sigue_creando_cita_normal(db_session, monkeypatch):
    fecha, prof, est, adm = _escenario(db_session)
    db_session.commit()
    _permisos_router(monkeypatch, gestionar=True, sobrecupo=True)

    citas.crear_cita(
        cita=CitaCreate(
            estudiante_id=est.id, profesional_id=prof.id, fecha=fecha, hora="10:00",
            sobrecupo=True, sobrecupo_motivo="x",
        ),
        db=db_session, current_user=_cu(adm),
    )

    assert db_session.query(Cita).one().sobrecupo is False
    assert db_session.query(CitaSobrecupo).count() == 0


def test_forzado_sin_motivo_responde_400_y_no_crea_nada(db_session, monkeypatch):
    fecha, prof, est, adm = _escenario(db_session)
    db_session.commit()
    _permisos_router(monkeypatch, gestionar=True, sobrecupo=True)

    with pytest.raises(HTTPException) as exc:
        citas.crear_cita(
            cita=CitaCreate(
                estudiante_id=est.id, profesional_id=prof.id, fecha=fecha, hora="10:00",
                sobrecupo=True, sobrecupo_forzado=True,
            ),
            db=db_session, current_user=_cu(adm),
        )
    assert exc.value.status_code == 400
    assert db_session.query(Cita).count() == 0


def test_forzado_sin_permiso_de_sobrecupo_responde_403(db_session, monkeypatch):
    fecha, prof, est, adm = _escenario(db_session)
    db_session.commit()
    _permisos_router(monkeypatch, gestionar=True, sobrecupo=False)

    with pytest.raises(HTTPException) as exc:
        citas.crear_cita(
            cita=CitaCreate(
                estudiante_id=est.id, profesional_id=prof.id, fecha=fecha, hora="10:00",
                sobrecupo=True, sobrecupo_forzado=True, sobrecupo_motivo="x",
            ),
            db=db_session, current_user=_cu(adm),
        )
    assert exc.value.status_code == 403
    assert db_session.query(Cita).count() == 0


def test_estudiante_que_manda_sobrecupo_forzado_obtiene_una_cita_normal(db_session, monkeypatch):
    fecha, prof, est, _adm = _escenario(db_session)
    db_session.commit()
    _permisos_router(monkeypatch, gestionar=False, sobrecupo=False)

    citas.crear_cita(
        cita=CitaCreate(
            estudiante_id=est.id, profesional_id=prof.id, fecha=fecha, hora="10:00",
            sobrecupo=True, sobrecupo_forzado=True, sobrecupo_motivo="x",
        ),
        db=db_session, current_user=_cu(est),
    )

    assert db_session.query(Cita).one().sobrecupo is False
    assert db_session.query(CitaSobrecupo).count() == 0


def test_cancelado_el_sobrecupo_la_hora_se_puede_volver_a_pedir(db_session, monkeypatch):
    """El caso que no funcionaba: pedir sobrecupo, cancelarlo y pedirlo de nuevo."""
    fecha, prof, est, adm = _escenario(db_session)
    est2 = _usuario(db_session, correo="est2-forzado@sesaes.cl", rol="estudiante", rut="forz-3")
    est3 = _usuario(db_session, correo="est3-forzado@sesaes.cl", rol="estudiante", rut="forz-4")
    db_session.commit()
    _permisos_router(monkeypatch, gestionar=True, sobrecupo=True)

    # 1 cita normal + 1 sobrecupo = capacidad completa
    citas.crear_cita(
        cita=CitaCreate(estudiante_id=est.id, profesional_id=prof.id, fecha=fecha, hora="10:00"),
        db=db_session, current_user=_cu(adm),
    )
    citas.crear_cita(
        cita=CitaCreate(
            estudiante_id=est2.id, profesional_id=prof.id, fecha=fecha, hora="10:00",
            sobrecupo=True, sobrecupo_motivo="primer sobrecupo",
        ),
        db=db_session, current_user=_cu(adm),
    )
    with pytest.raises(HTTPException) as exc:
        citas.crear_cita(
            cita=CitaCreate(
                estudiante_id=est3.id, profesional_id=prof.id, fecha=fecha, hora="10:00",
                sobrecupo=True, sobrecupo_motivo="tercera cita",
            ),
            db=db_session, current_user=_cu(adm),
        )
    assert exc.value.status_code == 409

    # se cancela el sobrecupo...
    sobre = db_session.query(Cita).filter(Cita.sobrecupo.is_(True)).one()
    sobre.estado = "cancelada"
    db_session.commit()

    # ...y la misma hora admite otro sobrecupo
    citas.crear_cita(
        cita=CitaCreate(
            estudiante_id=est3.id, profesional_id=prof.id, fecha=fecha, hora="10:00",
            sobrecupo=True, sobrecupo_motivo="segundo sobrecupo",
        ),
        db=db_session, current_user=_cu(adm),
    )
    activas = db_session.query(Cita).filter(Cita.estado == "pendiente").count()
    assert activas == 2
