from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.usuario import Usuario
from app.schemas import EstudianteOut, EstudianteUpdate
from app.auth_dependencies import get_current_user, verificar_acceso

router = APIRouter(prefix="/estudiante", tags=["Estudiante"])


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