# -*- coding: utf-8 -*-
"""
Recuperar contraseña (enlace de un solo uso) y bloqueo temporal de login por cuenta.
Pruebas por HTTP (TestClient) sobre SQLite en memoria; el envío de correo se simula.
"""

from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models.init  # noqa: F401
import app.models.solicitud_horario  # noqa: F401
import app.models.firma_profesional  # noqa: F401
import app.models.seguridad_cuenta  # noqa: F401

from app.database import Base, get_db
from app.main import app
from app.models.auditoria import Auditoria
from app.models.correo_log import CorreoLog
from app.models.seguridad_cuenta import IntentoLogin, RestablecimientoPassword
from app.models.usuario import Usuario
from app.rate_limiter import limiter
from app.security import hash_password, verify_password
from app.services import bloqueo_login_service as bloqueo
from app.services import recuperar_password_service as recuperar

CLAVE = "Clave#Segura1"
CLAVE_NUEVA = "Nueva#Clave2"


@pytest.fixture()
def ctx(monkeypatch):
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    Sesion = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = Sesion()
    db.add(Usuario(id=1, correo="ana@utem.cl", password=hash_password(CLAVE), rol="profesional", nombre="Ana", activo=True))
    db.add(Usuario(id=2, correo="baja@utem.cl", password=hash_password(CLAVE), rol="estudiante", nombre="Baja", activo=False))
    db.commit()

    enviados: list[tuple[str, str, str]] = []
    monkeypatch.setattr(recuperar, "_enviar", lambda d, a, c: (enviados.append((d, a, c)) or (True, None)))

    def _get_db():
        s = Sesion()
        try:
            yield s
        finally:
            s.close()

    app.dependency_overrides[get_db] = _get_db
    previo = limiter.enabled
    limiter.enabled = False            # los límites por IP se prueban aparte
    try:
        yield {"client": TestClient(app), "db": db, "enviados": enviados}
    finally:
        limiter.enabled = previo
        app.dependency_overrides.clear()
        db.close()
        engine.dispose()


def _login(c, correo="ana@utem.cl", password=CLAVE):
    return c["client"].post("/login", json={"correo": correo, "password": password})


def _token_del_correo(c) -> str:
    cuerpo = c["enviados"][-1][2]
    return re.search(r"token=([\w\-]+)", cuerpo).group(1)


# ═════════════════════ Bloqueo de login por cuenta ═════════════════════
def test_login_correcto_funciona(ctx):
    r = _login(ctx)
    assert r.status_code == 200 and r.json()["access_token"]


def test_cinco_fallos_bloquean_la_cuenta_incluso_con_la_clave_correcta(ctx):
    for _ in range(bloqueo.MAX_FALLIDOS):
        assert _login(ctx, password="mala").status_code == 401
    r = _login(ctx)                                    # ahora con la clave correcta
    assert r.status_code == 429
    assert "minuto" in r.json()["detail"] and "Olvidaste" in r.json()["detail"]


def test_un_correo_inexistente_se_bloquea_igual_y_no_revela_si_existe(ctx):
    for _ in range(bloqueo.MAX_FALLIDOS):
        assert _login(ctx, correo="fantasma@utem.cl", password="x").status_code == 401
    bloqueado_inexistente = _login(ctx, correo="fantasma@utem.cl", password="x")
    for _ in range(bloqueo.MAX_FALLIDOS):
        _login(ctx, password="mala")
    bloqueado_real = _login(ctx, password="mala")
    assert bloqueado_inexistente.status_code == bloqueado_real.status_code == 429
    assert bloqueado_inexistente.json() == bloqueado_real.json()


def test_un_login_correcto_borra_el_contador(ctx):
    for _ in range(bloqueo.MAX_FALLIDOS - 1):
        _login(ctx, password="mala")
    assert _login(ctx).status_code == 200
    for _ in range(bloqueo.MAX_FALLIDOS - 1):
        assert _login(ctx, password="mala").status_code == 401
    assert _login(ctx).status_code == 200              # nunca llegó a 5 seguidos


def test_el_bloqueo_termina_solo(ctx):
    for _ in range(bloqueo.MAX_FALLIDOS):
        _login(ctx, password="mala")
    fila = ctx["db"].query(IntentoLogin).one()
    fila.bloqueado_hasta = datetime.now(timezone.utc) - timedelta(minutes=1)
    ctx["db"].commit()
    assert _login(ctx).status_code == 200


def test_tras_vencer_el_bloqueo_se_vuelve_a_contar_desde_cero(ctx):
    for _ in range(bloqueo.MAX_FALLIDOS):
        _login(ctx, password="mala")
    fila = ctx["db"].query(IntentoLogin).one()
    fila.bloqueado_hasta = datetime.now(timezone.utc) - timedelta(minutes=1)
    ctx["db"].commit()
    assert _login(ctx, password="mala").status_code == 401     # un solo fallo, no bloquea
    assert _login(ctx).status_code == 200


def test_las_mayusculas_del_correo_no_evaden_el_contador(ctx):
    for i in range(bloqueo.MAX_FALLIDOS):
        _login(ctx, correo="ANA@utem.cl" if i % 2 else "ana@UTEM.cl", password="mala")
    assert ctx["db"].query(IntentoLogin).count() == 1
    assert _login(ctx).status_code == 429


def test_se_limpian_los_registros_viejos(ctx):
    db = ctx["db"]
    db.add(IntentoLogin(correo="viejo@utem.cl", fallidos=2, actualizado_en=datetime.now(timezone.utc) - timedelta(days=3)))
    db.commit()
    _login(ctx, password="mala")
    assert db.query(IntentoLogin).filter(IntentoLogin.correo == "viejo@utem.cl").count() == 0


# ═════════════════════ Recuperar contraseña: solicitar ═════════════════════
def test_solicitar_envia_un_enlace_y_en_la_base_solo_queda_el_hash(ctx):
    r = ctx["client"].post("/recuperar-password", json={"correo": "ana@utem.cl"})
    assert r.status_code == 200
    assert len(ctx["enviados"]) == 1 and ctx["enviados"][0][0] == "ana@utem.cl"
    token = _token_del_correo(ctx)
    fila = ctx["db"].query(RestablecimientoPassword).one()
    assert fila.token_hash == recuperar._hash(token) and token not in fila.token_hash
    assert "/restablecer?token=" in ctx["enviados"][0][2]


def test_la_respuesta_es_identica_exista_o_no_el_correo(ctx):
    a = ctx["client"].post("/recuperar-password", json={"correo": "ana@utem.cl"})
    b = ctx["client"].post("/recuperar-password", json={"correo": "nadie@utem.cl"})
    assert a.status_code == b.status_code == 200 and a.json() == b.json()
    assert len(ctx["enviados"]) == 1                        # solo el real recibió correo


def test_una_cuenta_desactivada_no_recibe_enlace(ctx):
    ctx["client"].post("/recuperar-password", json={"correo": "baja@utem.cl"})
    assert ctx["enviados"] == [] and ctx["db"].query(RestablecimientoPassword).count() == 0


def test_el_enlace_nunca_queda_en_el_registro_de_correos(ctx):
    ctx["client"].post("/recuperar-password", json={"correo": "ana@utem.cl"})
    token = _token_del_correo(ctx)
    log = ctx["db"].query(CorreoLog).filter(CorreoLog.tipo == "recuperacion_password").one()
    assert token not in log.cuerpo and "restablecer" not in log.cuerpo.lower().replace("restablecimiento", "")
    assert all(token not in (a.detalle or "") for a in ctx["db"].query(Auditoria).all())


def test_maximo_tres_enlaces_por_hora(ctx):
    for _ in range(5):
        ctx["client"].post("/recuperar-password", json={"correo": "ana@utem.cl"})
    assert len(ctx["enviados"]) == recuperar.MAX_POR_HORA


def test_pedir_un_enlace_nuevo_anula_el_anterior(ctx):
    ctx["client"].post("/recuperar-password", json={"correo": "ana@utem.cl"})
    viejo = _token_del_correo(ctx)
    ctx["client"].post("/recuperar-password", json={"correo": "ana@utem.cl"})
    nuevo = _token_del_correo(ctx)
    assert viejo != nuevo
    r = ctx["client"].post("/restablecer-password", json={"token": viejo, "nueva_password": CLAVE_NUEVA})
    assert r.status_code == 400
    assert ctx["client"].post("/restablecer-password", json={"token": nuevo, "nueva_password": CLAVE_NUEVA}).status_code == 200


def test_el_correo_se_reconoce_sin_importar_mayusculas_ni_espacios(ctx):
    ctx["client"].post("/recuperar-password", json={"correo": "  ANA@UTEM.CL "})
    assert len(ctx["enviados"]) == 1


# ═════════════════════ Recuperar contraseña: restablecer ═════════════════════
def _pedir_token(ctx) -> str:
    ctx["client"].post("/recuperar-password", json={"correo": "ana@utem.cl"})
    return _token_del_correo(ctx)


def test_restablecer_cambia_la_clave_y_permite_entrar_con_la_nueva(ctx):
    token = _pedir_token(ctx)
    r = ctx["client"].post("/restablecer-password", json={"token": token, "nueva_password": CLAVE_NUEVA})
    assert r.status_code == 200
    ctx["db"].expire_all()
    usuario = ctx["db"].get(Usuario, 1)
    assert verify_password(CLAVE_NUEVA, usuario.password) and not verify_password(CLAVE, usuario.password)
    assert _login(ctx, password=CLAVE_NUEVA).status_code == 200
    assert _login(ctx, password=CLAVE).status_code == 401


def test_el_enlace_solo_sirve_una_vez(ctx):
    token = _pedir_token(ctx)
    assert ctx["client"].post("/restablecer-password", json={"token": token, "nueva_password": CLAVE_NUEVA}).status_code == 200
    r = ctx["client"].post("/restablecer-password", json={"token": token, "nueva_password": "Otra#Clave3"})
    assert r.status_code == 400 and r.json()["detail"] == recuperar.MENSAJE_ENLACE_INVALIDO


def test_una_clave_debil_se_rechaza_y_no_gasta_el_enlace(ctx):
    token = _pedir_token(ctx)
    r = ctx["client"].post("/restablecer-password", json={"token": token, "nueva_password": "abc"})
    assert r.status_code == 400 and "mayúscula" in r.json()["detail"]
    assert ctx["client"].post("/restablecer-password", json={"token": token, "nueva_password": CLAVE_NUEVA}).status_code == 200


def test_un_enlace_vencido_o_inventado_da_el_mismo_error(ctx):
    token = _pedir_token(ctx)
    fila = ctx["db"].query(RestablecimientoPassword).one()
    fila.expira_en = datetime.now(timezone.utc) - timedelta(minutes=1)
    ctx["db"].commit()
    vencido = ctx["client"].post("/restablecer-password", json={"token": token, "nueva_password": CLAVE_NUEVA})
    falso = ctx["client"].post("/restablecer-password", json={"token": "inventado", "nueva_password": CLAVE_NUEVA})
    vacio = ctx["client"].post("/restablecer-password", json={"token": "", "nueva_password": CLAVE_NUEVA})
    assert vencido.status_code == falso.status_code == vacio.status_code == 400
    assert vencido.json() == falso.json() == vacio.json()


def test_restablecer_desbloquea_la_cuenta_y_avisa_por_correo_sin_la_clave(ctx):
    for _ in range(bloqueo.MAX_FALLIDOS):
        _login(ctx, password="mala")
    assert _login(ctx).status_code == 429
    token = _pedir_token(ctx)
    ctx["client"].post("/restablecer-password", json={"token": token, "nueva_password": CLAVE_NUEVA})
    assert _login(ctx, password=CLAVE_NUEVA).status_code == 200
    aviso = ctx["enviados"][-1]
    assert "actualizada" in aviso[1] and CLAVE_NUEVA not in aviso[2]


def test_restablecer_deja_auditoria_sin_secretos(ctx):
    token = _pedir_token(ctx)
    ctx["client"].post("/restablecer-password", json={"token": token, "nueva_password": CLAVE_NUEVA})
    eventos = ctx["db"].query(Auditoria).all()
    assert len(eventos) == 1 and eventos[0].usuario_id == 1
    assert token not in (eventos[0].detalle or "") and CLAVE_NUEVA not in (eventos[0].detalle or "")


def test_restablecer_quita_la_obligacion_de_cambiar_clave_temporal(ctx):
    ctx["db"].get(Usuario, 1).debe_cambiar_password = True
    ctx["db"].commit()
    token = _pedir_token(ctx)
    ctx["client"].post("/restablecer-password", json={"token": token, "nueva_password": CLAVE_NUEVA})
    ctx["db"].expire_all()
    assert ctx["db"].get(Usuario, 1).debe_cambiar_password is False


# ═════════════════════ Límite por IP ═════════════════════
def test_el_limite_por_ip_frena_la_solicitud_de_enlaces(ctx):
    limiter.enabled = True
    limiter.reset()
    try:
        codigos = [ctx["client"].post("/recuperar-password", json={"correo": f"x{i}@utem.cl"}).status_code for i in range(7)]
    finally:
        limiter.enabled = False
        limiter.reset()
    assert codigos[:5] == [200] * 5 and 429 in codigos[5:]
