from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.notificacion import Notificacion
from app.auth_dependencies import get_current_user, verificar_acceso

router = APIRouter(prefix="/notificaciones", tags=["notificaciones"])


def _verificar_dueno_notificacion(notif: Notificacion, current_user: dict) -> None:
    if current_user["rol"] == "admin":
        return
    if notif.usuario_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="No tienes permiso para modificar esta notificación.")


@router.get("/{usuario_id}")
def get_notificaciones(
    usuario_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    verificar_acceso(current_user, id_esperado=usuario_id, roles_permitidos=["estudiante", "profesional", "admin"])
    notifs = db.query(Notificacion).filter(
        Notificacion.usuario_id == usuario_id
    ).order_by(Notificacion.fecha_creacion.desc()).all()
    return [
        {
            "id":             n.id,
            "mensaje":        n.mensaje,
            "tipo":           n.tipo,
            "leida":          n.leida,
            "fecha_creacion": n.fecha_creacion.isoformat() if n.fecha_creacion else None
        }
        for n in notifs
    ]


@router.patch("/{notif_id}/leer")
def marcar_leida(
    notif_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    notif = db.query(Notificacion).filter(Notificacion.id == notif_id).first()
    if notif:
        _verificar_dueno_notificacion(notif, current_user)
        notif.leida = True
        db.commit()
    return {"message": "Notificación marcada como leída"}


@router.patch("/leer-todas/{usuario_id}")
def marcar_todas_leidas(
    usuario_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    verificar_acceso(current_user, id_esperado=usuario_id, roles_permitidos=["estudiante", "profesional", "admin"])
    db.query(Notificacion).filter(
        Notificacion.usuario_id == usuario_id,
        Notificacion.leida == False
    ).update({"leida": True})
    db.commit()
    return {"message": "Todas las notificaciones marcadas como leídas"}


@router.delete("/{notif_id}")
def eliminar_notificacion(
    notif_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    notif = db.query(Notificacion).filter(Notificacion.id == notif_id).first()
    if notif:
        _verificar_dueno_notificacion(notif, current_user)
        db.delete(notif)
        db.commit()
    return {"message": "Notificación eliminada"}


@router.delete("/eliminar-todas/{usuario_id}")
def eliminar_todas_notificaciones(
    usuario_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    verificar_acceso(current_user, id_esperado=usuario_id, roles_permitidos=["estudiante", "profesional", "admin"])
    db.query(Notificacion).filter(
        Notificacion.usuario_id == usuario_id
    ).delete()
    db.commit()
    return {"message": "Todas las notificaciones eliminadas"}