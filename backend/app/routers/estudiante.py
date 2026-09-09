from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.database import get_db
from app.models.usuario import Usuario
from app.schemas import EstudianteOut, EstudianteUpdate
from app.security import hash_password, verify_password, errores_password
from app.auth_dependencies import get_current_user, verificar_acceso

router = APIRouter(prefix="/estudiante", tags=["Estudiante"])


class PrimerAccesoIn(BaseModel):
    nueva_password: Optional[str] = None   # None o vacío = "mantener la actual"


class CambiarPasswordIn(BaseModel):
    contrasena_actual: str
    contrasena_nueva: str


@router.get("/{estudiante_id}", response_model=EstudianteOut)
def obtener_estudiante(
    estudiante_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    verificar_acceso(current_user, id_esperado=estudiante_id, roles_permitidos=["estudiante", "admin"])
    usuario = db.query(Usuario).filter(
        Usuario.id == estudiante_id,
        Usuario.rol == "estudiante"
    ).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Estudiante no encontrado")
    return usuario


@router.patch("/{estudiante_id}", response_model=EstudianteOut)
def actualizar_estudiante(
    estudiante_id: int,
    datos: EstudianteUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    verificar_acceso(current_user, id_esperado=estudiante_id, roles_permitidos=["estudiante", "admin"])
    usuario = db.query(Usuario).filter(
        Usuario.id == estudiante_id,
        Usuario.rol == "estudiante"
    ).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Estudiante no encontrado")

    if datos.nombre is not None:
        usuario.nombre = datos.nombre
    if datos.telefono is not None:
        usuario.telefono = datos.telefono
    if datos.correo_secundario is not None:
        usuario.correo_secundario = datos.correo_secundario or None
    if datos.foto_url is not None:
        usuario.foto_url = datos.foto_url
    if datos.tema_oscuro is not None:
        usuario.tema_oscuro = datos.tema_oscuro

    db.commit()
    db.refresh(usuario)
    return usuario


@router.patch("/{estudiante_id}/primer-acceso")
def resolver_primer_acceso(
    estudiante_id: int,
    datos: PrimerAccesoIn,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Se llama justo después del primer login de una cuenta creada con
    contraseña temporal (ej. carga masiva por CSV). El estudiante puede
    elegir una contraseña nueva (nueva_password con algo escrito) o
    simplemente mantener la temporal (nueva_password vacío/None) — en
    ambos casos, deja de pedírsele esto en logins futuros.
    """
    verificar_acceso(current_user, id_esperado=estudiante_id, roles_permitidos=["estudiante", "admin"])
    usuario = db.query(Usuario).filter(Usuario.id == estudiante_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if datos.nueva_password and datos.nueva_password.strip():
        if len(datos.nueva_password.strip()) < 6:
            raise HTTPException(status_code=400, detail="La nueva contraseña debe tener al menos 6 caracteres.")
        usuario.password = hash_password(datos.nueva_password.strip())

    usuario.debe_cambiar_password = False
    db.commit()
    return {"message": "Listo, ya puedes usar el sistema con normalidad."}


@router.patch("/{estudiante_id}/cambiar-password")
def cambiar_password_estudiante(
    estudiante_id: int,
    datos: CambiarPasswordIn,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Cambio de contraseña de autoservicio, desde Perfil/Seguridad — distinto
    del flujo de primer-acceso (que existe solo para la migración inicial de
    cuentas con clave temporal). Requiere la contraseña actual y aplica la
    misma política de complejidad que Profesional (ver security.errores_password).
    """
    verificar_acceso(current_user, id_esperado=estudiante_id, roles_permitidos=["estudiante", "admin"])
    usuario = db.query(Usuario).filter(Usuario.id == estudiante_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if not verify_password(datos.contrasena_actual, usuario.password):
        raise HTTPException(status_code=400, detail="La contraseña actual es incorrecta")

    errores = errores_password(datos.contrasena_nueva)
    if errores:
        raise HTTPException(status_code=400, detail="; ".join(errores))

    usuario.password = hash_password(datos.contrasena_nueva)
    usuario.debe_cambiar_password = False
    db.commit()
    return {"message": "Contraseña actualizada correctamente."}