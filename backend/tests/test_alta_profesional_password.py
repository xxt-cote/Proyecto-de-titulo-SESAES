import pytest
from tests.test_alta_estudiantes import contexto, headers  # noqa: F401 — fixture compartido
from app.models.usuario import Usuario
from app.models.auditoria import Auditoria
from app.security import verify_password


@pytest.mark.parametrize('password', [None, '', 'prof123', 'sinmayuscula123!', 'SinNumero!', 'Con espacios123!', 'Segura123!' + 'á' * 40])
def test_alta_profesional_rechaza_password_ausente_o_invalida(contexto, password):
    db, client, _ = contexto
    datos = {'nombre': 'Profesional ficticio', 'especialidad': 'Nutrición', 'correo': 'nuevo.pro@utem.cl'}
    if password is not None:
        datos['password'] = password
    respuesta = client.post('/admin/profesionales', headers=headers(contexto, 'superadmin'), json=datos)
    assert respuesta.status_code == 422
    assert db.query(Usuario).count() == 4
    assert db.query(Auditoria).count() == 0


def test_alta_profesional_usa_password_explicita_y_no_la_audita(contexto):
    db, client, _ = contexto
    respuesta = client.post('/admin/profesionales', headers=headers(contexto, 'superadmin'), json={
        'nombre': 'Profesional ficticio', 'especialidad': 'Nutrición', 'correo': 'nuevo.pro@utem.cl', 'password': 'PropiaSegura123!'
    })
    assert respuesta.status_code == 200
    cuenta = db.get(Usuario, respuesta.json()['usuario_id'])
    assert verify_password('PropiaSegura123!', cuenta.password)
    assert 'PropiaSegura123!' not in respuesta.text
    assert 'PropiaSegura123!' not in db.query(Auditoria).one().detalle
