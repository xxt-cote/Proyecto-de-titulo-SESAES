"""Alta real de alumnos: permisos, datos válidos, privacidad y auditoría."""
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.models.usuario import Usuario
from app.models.auditoria import Auditoria
from app.models.acceso_administrativo import AccesoAdministrativo, AccesoAdminEspecialidad, AccesoAdminPermiso
from app.routers import admin
from app.security import create_access_token, verify_password


@pytest.fixture()
def contexto():
    engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine)()
    actores = {}
    for rol in ("superadmin", "admin", "estudiante", "profesional"):
        actor = Usuario(correo=f"{rol}@utem.cl", nombre=rol, password="hash", rol=rol, activo=True)
        db.add(actor)
        db.flush()
        actores[rol] = actor.id
    db.commit()
    app = FastAPI()
    app.include_router(admin.router)
    def sesion():
        yield db
    app.dependency_overrides[get_db] = sesion
    with TestClient(app) as client:
        yield db, client, actores
    db.close()
    engine.dispose()


def headers(ctx, rol):
    return {"Authorization": "Bearer " + create_access_token({"id": ctx[2][rol], "rol": rol})}


def payload(**cambios):
    return {"nombre": "Alumno ficticio", "correo": "alumno.nuevo@utem.cl",
            "password": "SoloPrueba123!", "carrera": "Carrera de prueba", **cambios}


def test_alta_y_login_sin_devolver_secretos(contexto):
    db, client, _ = contexto
    response = client.post("/admin/estudiantes", headers=headers(contexto, "superadmin"), json=payload())
    assert response.status_code == 201
    assert "password" not in response.json()
    nuevo = db.get(Usuario, response.json()["id"])
    assert verify_password("SoloPrueba123!", nuevo.password)
    assert nuevo.rol == "estudiante" and nuevo.activo
    evento = db.query(Auditoria).one()
    assert evento.usuario_id == contexto[2]["superadmin"]
    assert evento.entidad_id == nuevo.id
    assert "SoloPrueba" not in evento.detalle


@pytest.mark.parametrize("rol", ["admin", "estudiante", "profesional"])
def test_rol_sin_permiso_no_puede_crear(contexto, rol):
    assert contexto[1].post("/admin/estudiantes", headers=headers(contexto, rol), json=payload()).status_code == 403


@pytest.mark.parametrize("institucional", [True, False])
def test_admin_requiere_permiso_y_alcance_institucional(contexto, institucional):
    db, client, actores = contexto
    acceso = AccesoAdministrativo(usuario_id=actores["admin"],
                                  perfil="administrador_general" if institucional else "administrador_especialidad",
                                  tipo_alcance="institucional" if institucional else "especialidades")
    db.add(acceso)
    db.flush()
    if not institucional:
        db.add(AccesoAdminEspecialidad(acceso_admin_id=acceso.id, especialidad="Nutrición", especialidad_normalizada="nutricion"))
    db.add(AccesoAdminPermiso(acceso_admin_id=acceso.id, permiso="usuarios.gestionar"))
    db.commit()
    assert client.post("/admin/estudiantes", headers=headers(contexto, "admin"), json=payload()).status_code == (201 if institucional else 403)


@pytest.mark.parametrize("cambios,status", [
    ({"password": "debil"}, 422), ({"password": " SoloPrueba123!"}, 422),
    ({"correo": "externo@example.com"}, 422), ({"nombre": "   "}, 422),
    ({"rut": "invalido"}, 400), ({"rol": "superadmin"}, 422),
])
def test_datos_invalidos_no_crean_cuentas(contexto, cambios, status):
    db, client, _ = contexto
    assert client.post("/admin/estudiantes", headers=headers(contexto, "superadmin"), json=payload(**cambios)).status_code == status
    assert db.query(Usuario).count() == 4


def test_correo_duplicado_normalizado_y_sin_autenticacion(contexto):
    _, client, _ = contexto
    assert client.post("/admin/estudiantes", json=payload()).status_code == 401
    auth = headers(contexto, "superadmin")
    assert client.post("/admin/estudiantes", headers=auth, json=payload()).status_code == 201
    assert client.post("/admin/estudiantes", headers=auth, json=payload(correo="ALUMNO.NUEVO@UTEM.CL")).status_code == 409
