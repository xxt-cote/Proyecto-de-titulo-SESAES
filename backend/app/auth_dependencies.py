"""
Dependencias de autenticación/autorización reutilizables en todos los routers.

Uso típico en un endpoint:

    @router.get("/citas/estudiante/{estudiante_id}")
    def get_citas_estudiante(
        estudiante_id: int,
        db: Session = Depends(get_db),
        current_user: dict = Depends(get_current_user),
    ):
        verificar_acceso(current_user, id_esperado=estudiante_id, roles_permitidos=["estudiante"])
        ...

Esto asegura dos cosas para cada request:
  1. Que el token JWT enviado sea válido y no haya expirado (get_current_user).
  2. Que el usuario autenticado tenga permiso para ver/modificar ESE recurso
     específico: o es dueño del recurso (su propio id) o es admin
     (verificar_acceso / verificar_rol).
"""

from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError

from app.security import decode_access_token

_bearer_scheme = HTTPBearer(
    description="Token JWT obtenido en POST /login (campo access_token).",
    auto_error=False,
)


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme)) -> dict:
    """
    Extrae y valida el JWT del header 'Authorization: Bearer <token>'.
    Devuelve el payload (id, rol, correo, nombre) si es válido.

    Usa fastapi.security.HTTPBearer en vez de leer el header a mano para que
    Swagger (/docs) muestre el candado de autenticación y permita probar los
    endpoints protegidos directamente desde ahí.
    """
    if credentials is None:
        raise HTTPException(status_code=401, detail="No autenticado. Inicia sesión nuevamente.")

    try:
        payload = decode_access_token(credentials.credentials)
    except JWTError:
        raise HTTPException(status_code=401, detail="Sesión inválida o expirada. Inicia sesión nuevamente.")

    if "id" not in payload or "rol" not in payload:
        raise HTTPException(status_code=401, detail="Token inválido.")

    return payload


def verificar_rol(current_user: dict, roles_permitidos: list[str]) -> None:
    """Exige que el usuario autenticado tenga uno de los roles indicados."""
    if current_user["rol"] not in roles_permitidos:
        raise HTTPException(status_code=403, detail="No tienes permiso para acceder a este recurso.")


def verificar_acceso(current_user: dict, id_esperado: int, roles_permitidos: list[str]) -> None:
    """
    Exige que el usuario autenticado:
      - tenga uno de los roles permitidos para este endpoint, Y
      - sea dueño del recurso (current_user['id'] == id_esperado) A MENOS
        que su rol sea 'admin', en cuyo caso puede ver cualquier recurso.

    Ejemplo: un estudiante solo puede pedir SU historial (id coincide).
    Un admin puede pedir el de cualquiera.
    Un profesional nunca puede pedir /historial/estudiante/{id} por esta vía
    (tiene sus propios endpoints en historial_clinico.py).

    OJO: esta función compara directo contra current_user['id'], que es
    Usuario.id (el id que viaja en el JWT). Válida para endpoints cuyo
    parámetro de ruta también es un Usuario.id (ej. estudiante_id).
    Para endpoints cuyo parámetro de ruta es Profesional.id (una PK
    DISTINTA), usar verificar_acceso_profesional en su lugar.
    """
    verificar_rol(current_user, roles_permitidos)

    if current_user["rol"] == "admin":
        return

    if current_user["id"] != id_esperado:
        raise HTTPException(status_code=403, detail="No tienes permiso para acceder a este recurso.")


def verificar_acceso_profesional(current_user: dict, profesional_id: int, db, roles_permitidos: list[str] = None) -> None:
    """
    Igual que verificar_acceso, pero para endpoints cuyo parámetro de ruta
    es Profesional.id (tabla 'profesional'), NO Usuario.id. Resuelve el
    Profesional y compara su usuario_id contra el id del JWT.
    """
    from app.models.profesional import Profesional

    verificar_rol(current_user, roles_permitidos or ["profesional", "admin"])

    if current_user["rol"] == "admin":
        return

    prof = db.query(Profesional).filter(Profesional.id == profesional_id).first()
    if not prof or prof.usuario_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="No tienes permiso para acceder a este recurso.")
