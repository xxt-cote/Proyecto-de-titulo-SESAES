from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.usuario import Usuario
from app.schemas import UsuarioMeOut, UsuarioMeUpdate
from app.auth_dependencies import get_current_user, verificar_rol

router = APIRouter(
    prefix="/usuarios",
    tags=["usuarios"],
)


def _obtener_usuario_actual(db: Session, current_user: dict) -> Usuario:
    """
    Carga el registro completo de Usuario correspondiente a
    current_user["id"].

    Mi Perfil nunca acepta un usuario_id del cliente: la identidad
    siempre sale del token verificado (current_user), nunca del body
    o de la URL. Esto garantiza que un ADMIN/SUPERADMIN solo pueda
    leer/editar su propio registro (aislamiento entre usuarios).

    Si el id del token no corresponde a ningún Usuario existente
    (cuenta eliminada, inconsistencia de datos, etc.), falla seguro
    con 404 en vez de devolver un perfil vacío o de otro usuario.
    """
    usuario = db.query(Usuario).filter(Usuario.id == current_user["id"]).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return usuario


@router.get("/me", response_model=UsuarioMeOut)
def obtener_mi_perfil(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Perfil propio del Usuario autenticado (SA-1.2).

    Reemplaza a ConfiguracionCentro como fuente de identidad para
    "Mi Perfil": ADMIN y SUPERADMIN obtienen aquí su propio
    nombre/correo/telefono/foto_url/rol/activo, nunca datos de otro
    usuario ni del centro. `UsuarioMeOut` no declara `password`, así
    que nunca se expone el hash en la respuesta.
    """
    verificar_rol(current_user, roles_permitidos=["admin", "superadmin"])
    return _obtener_usuario_actual(db, current_user)


@router.patch("/me", response_model=UsuarioMeOut)
def actualizar_mi_perfil(
    datos: UsuarioMeUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Actualiza el perfil propio del Usuario autenticado (SA-1.2).

    Único endpoint de Mi Perfil para nombre/foto_url/telefono. Opera
    exclusivamente sobre current_user["id"]. `UsuarioMeUpdate` tiene
    extra="forbid": rol, activo, permisos, password,
    debe_cambiar_password, usuario_id y correo no son campos válidos
    del schema, así que enviarlos hace que la petición completa sea
    rechazada con 422 antes de llegar a este cuerpo — nunca se aceptan
    y se ignoran en silencio.
    """
    verificar_rol(current_user, roles_permitidos=["admin", "superadmin"])
    usuario = _obtener_usuario_actual(db, current_user)

    if datos.nombre is not None:
        usuario.nombre = datos.nombre

    if datos.foto_url is not None:
        usuario.foto_url = datos.foto_url

    if datos.telefono is not None:
        usuario.telefono = datos.telefono

    db.commit()
    db.refresh(usuario)

    return usuario
