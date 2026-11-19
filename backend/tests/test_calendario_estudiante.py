"""Contrato HTTP del calendario y rechazo de reservas forzadas por API."""
from datetime import date, timedelta

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.auth_dependencies import get_current_user
from app.database import Base, get_db
from app.models.auditoria import Auditoria
from app.models.bloque_horario_semanal import BloqueHorarioSemanal
from app.models.cita import Cita
from app.models.dia_cerrado import DiaCerrado
from app.models.profesional import Profesional
from app.models.solicitud_horario import SolicitudHorario
from app.models.usuario import Usuario
from app.routers import citas, horarios


@pytest.fixture()
def contexto():
    engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine)()
    est = Usuario(correo="calendario@utem.cl", password="hash", rol="estudiante", activo=True)
    prof = Profesional(nombre="Profesional", especialidad="Nutrición", iniciales="PR", estado="activo", duracion_min=30)
    db.add_all([est, prof])
    db.commit()
    app = FastAPI()
    app.include_router(citas.router)
    app.include_router(horarios.router)
    def sesion():
        yield db
    app.dependency_overrides[get_db] = sesion
    app.dependency_overrides[get_current_user] = lambda: {"id": est.id, "rol": "estudiante"}
    fecha = date.today() + timedelta(days=1)
    while fecha.weekday() >= 5:
        fecha += timedelta(days=1)
    with TestClient(app) as client:
        yield db, client, est, prof, fecha
    db.close()
    engine.dispose()


def bloque(db, prof, fecha, tipo="disponible"):
    db.add(BloqueHorarioSemanal(profesional_id=prof.id, dia_semana=fecha.weekday(),
                                hora_inicio="09:00", hora_fin="12:00", tipo=tipo))
    db.commit()


def reservar(ctx, fecha=None, **extra):
    _, client, est, prof, dia = ctx
    return client.post("/citas", json={"estudiante_id": est.id, "profesional_id": prof.id,
                                     "fecha": (fecha or dia).isoformat(), "hora": "09:00", **extra})


@pytest.mark.parametrize("estado", [None, "pendiente", "rechazado", "aprobado"])
def test_sin_bloques_no_habilita_jornada_generica_ni_solicitud(contexto, estado):
    db, client, _, prof, fecha = contexto
    prof.horario_inicio, prof.horario_fin = "09:00", "17:00"
    if estado:
        db.add(SolicitudHorario(profesional_id=prof.id, tipo="jornada", estado=estado,
                                hora_inicio="09:00", hora_fin="17:00"))
    db.commit()
    assert client.get(f"/disponibilidad/{prof.id}/calendario").json() == {"fechas": []}
    assert client.get(f"/disponibilidad/{prof.id}", params={"fecha": fecha.isoformat()}).json()["horas"] == []
    assert reservar(contexto, sobrecupo=True).status_code == 400
    assert db.query(Cita).count() == db.query(Auditoria).count() == 0


def test_bloque_aprobado_habilita_solo_su_dia_y_reserva_auditada(contexto):
    db, client, est, prof, fecha = contexto
    bloque(db, prof, fecha)
    fechas = client.get(f"/disponibilidad/{prof.id}/calendario").json()["fechas"]
    assert fecha.isoformat() in fechas
    assert all(date.fromisoformat(f).weekday() == fecha.weekday() for f in fechas)
    assert reservar(contexto).status_code == 200
    assert db.query(Cita).one().creado_por_usuario_id == est.id
    assert db.query(Auditoria).one().usuario_id == est.id


@pytest.mark.parametrize("caso", ["otro_dia", "colacion", "cerrado", "inactivo", "fin_semana"])
def test_dias_no_disponibles_se_excluyen_y_rechazan_api(contexto, caso):
    db, client, _, prof, fecha = contexto
    if caso == "otro_dia":
        bloque(db, prof, fecha + timedelta(days=1))
    elif caso == "colacion":
        bloque(db, prof, fecha, "colacion")
    else:
        bloque(db, prof, fecha)
    if caso == "cerrado":
        db.add(DiaCerrado(fecha=fecha.isoformat(), motivo="Cierre institucional"))
    elif caso == "inactivo":
        prof.estado = "licencia"
    elif caso == "fin_semana":
        while fecha.weekday() < 5:
            fecha += timedelta(days=1)
        bloque(db, prof, fecha)  # incluso un dato inválido persistido no habilita fin de semana
    db.commit()
    assert fecha.isoformat() not in client.get(f"/disponibilidad/{prof.id}/calendario").json()["fechas"]
    assert reservar(contexto, fecha).status_code == 400
    assert db.query(Cita).count() == 0


def test_cambio_de_agenda_invalida_fecha_previamente_publicada(contexto):
    db, client, _, prof, fecha = contexto
    bloque(db, prof, fecha)
    assert fecha.isoformat() in client.get(f"/disponibilidad/{prof.id}/calendario").json()["fechas"]
    db.query(BloqueHorarioSemanal).delete()
    db.commit()
    assert reservar(contexto).status_code == 400


def test_dia_aprobado_sin_cupos_no_se_publica_y_reserva_devuelve_409(contexto):
    db, client, est, prof, fecha = contexto
    bloque(db, prof, fecha)
    for hora in ("09:00", "09:30", "10:00", "10:30", "11:00", "11:30"):
        db.add(Cita(estudiante_id=est.id, profesional_id=prof.id,
                    fecha=fecha.isoformat(), hora=hora, estado="pendiente"))
    db.commit()
    assert fecha.isoformat() not in client.get(f"/disponibilidad/{prof.id}/calendario").json()["fechas"]
    assert reservar(contexto).status_code == 409
