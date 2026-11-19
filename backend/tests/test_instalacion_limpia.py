"""Recorrido de entrega en un esquema PostgreSQL vacío, sin datos locales.

TEST_POSTGRES_URL debe apuntar a una BD de pruebas. Los comandos CLI y la
API se ejecutan en procesos nuevos con un search_path temporal exclusivo.
"""
import os
from pathlib import Path
import secrets
import subprocess
import sys
import uuid

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url


RECORRIDO = r'''
from datetime import date, timedelta
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.usuario import Usuario
from app.models.auditoria import Auditoria
import os

def pedir(client, method, ruta, status=200, **kwargs):
    response = client.request(method, ruta, **kwargs)
    assert response.status_code == status, (method, ruta, response.status_code, response.text)
    return response.json()

def login(client, correo, password):
    data = pedir(client, 'POST', '/login', json={'correo': correo, 'password': password})
    return data, {'Authorization': 'Bearer ' + data['access_token']}

with TestClient(app) as client:
    assert pedir(client, 'GET', '/health') == {'status': 'ok'}
    sa, auth_sa = login(client, os.environ['SUPERADMIN_BOOTSTRAP_EMAIL'], os.environ['SUPERADMIN_BOOTSTRAP_PASSWORD'])
    prof = pedir(client, 'POST', '/admin/profesionales', headers=auth_sa, json={
        'nombre': 'Profesional ficticio instalación', 'correo': 'instalacion.pro@utem.cl',
        'password': os.environ['PASSWORD_PRUEBA'], 'especialidad': 'Nutrición', 'duracion_min': 30})
    alumno = pedir(client, 'POST', '/admin/estudiantes', status=201, headers=auth_sa, json={
        'nombre': 'Alumno ficticio instalación', 'correo': 'instalacion.alumno@utem.cl',
        'password': os.environ['PASSWORD_PRUEBA'], 'carrera': 'Carrera de prueba'})
    pro, auth_pro = login(client, 'instalacion.pro@utem.cl', os.environ['PASSWORD_PRUEBA'])
    est, auth_est = login(client, 'instalacion.alumno@utem.cl', os.environ['PASSWORD_PRUEBA'])
    assert pro['rol'] == 'profesional' and est['rol'] == 'estudiante'
    id_pro = pedir(client, 'GET', f"/profesional/buscar-por-usuario/{pro['id']}", headers=auth_pro)['id']
    assert id_pro == prof['id']
    ruta_cal = f"/disponibilidad/{id_pro}/calendario"
    assert pedir(client, 'GET', ruta_cal, headers=auth_est)['fechas'] == []
    dia = date.today() + timedelta(days=1)
    while dia.weekday() >= 5:
        dia += timedelta(days=1)
    pedir(client, 'POST', f'/profesional/{id_pro}/solicitar-bloques-horario', headers=auth_pro,
          json={'bloques': [{'dia_semana': dia.weekday(), 'hora_inicio': '09:00', 'hora_fin': '13:00', 'tipo': 'disponible'}]})
    assert pedir(client, 'GET', ruta_cal, headers=auth_est)['fechas'] == []
    solicitudes = pedir(client, 'GET', f'/profesional/{id_pro}/solicitudes-horario', headers=auth_pro)
    pedir(client, 'PATCH', f"/admin/solicitudes-horario/{solicitudes[0]['id']}/aprobar", headers=auth_sa)
    fechas = pedir(client, 'GET', ruta_cal, headers=auth_est)['fechas']
    assert dia.isoformat() in fechas
    assert all(date.fromisoformat(f).weekday() == dia.weekday() for f in fechas)
    hora = pedir(client, 'GET', f'/disponibilidad/{id_pro}', headers=auth_est, params={'fecha': dia.isoformat()})['horas'][0]
    cita = pedir(client, 'POST', '/citas', headers=auth_est, json={
        'estudiante_id': alumno['id'], 'profesional_id': id_pro, 'fecha': dia.isoformat(), 'hora': hora})
    assert cita['estado'] == 'pendiente'
    sin_bloques = dia + timedelta(days=1)
    while sin_bloques.weekday() >= 5:
        sin_bloques += timedelta(days=1)
    assert sin_bloques.isoformat() not in fechas
    pedir(client, 'POST', '/citas', status=400, headers=auth_est, json={
        'estudiante_id': alumno['id'], 'profesional_id': id_pro, 'fecha': sin_bloques.isoformat(), 'hora': '09:00'})
    with SessionLocal() as db:
        assert db.query(Usuario).count() == 3  # superadmin, profesional, alumno: ningún seed demo
        assert db.query(Auditoria).filter(Auditoria.entidad == 'cita', Auditoria.entidad_id == cita['id']).count() == 1
print('Instalación limpia verificada: esquema, superadmin, altas, tres logins, aprobación y cita auditada.')
'''


@pytest.mark.postgres
def test_recorrido_instalacion_desde_cero():
    url = os.getenv("TEST_POSTGRES_URL")
    if not url:
        pytest.skip("Requiere TEST_POSTGRES_URL de una BD de pruebas")
    schema = "test_instalacion_" + uuid.uuid4().hex
    engine = create_engine(url)
    with engine.begin() as conn:
        conn.execute(text(f'CREATE SCHEMA "{schema}"'))
    destino = make_url(url).update_query_dict({"options": f"-csearch_path={schema}"})
    env = dict(os.environ, DATABASE_URL=destino.render_as_string(hide_password=False),
               JWT_SECRET_KEY=secrets.token_hex(32), SEED_DEMO_DATA="false", SESAES_ENV="development",
               SUPERADMIN_BOOTSTRAP_EMAIL="instalacion.sa@utem.cl",
               SUPERADMIN_BOOTSTRAP_PASSWORD="Instalacion1!" + secrets.token_hex(8),
               PASSWORD_PRUEBA="Prueba1!" + secrets.token_hex(8), SMTP_EMAIL="", SMTP_APP_PASSWORD="")
    cwd = Path(__file__).resolve().parents[1]
    try:
        for args in (["-m", "app.init_db"], ["-m", "app.init_db", "--superadmin"], ["-c", RECORRIDO]):
            result = subprocess.run([sys.executable, *args], cwd=cwd, env=env,
                                    capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=60)
            assert result.returncode == 0, result.stdout + result.stderr
    finally:
        with engine.begin() as conn:
            conn.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
        engine.dispose()
