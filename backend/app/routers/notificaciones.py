from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.notificacion import Notificacion

router = APIRouter(prefix="/notificaciones", tags=["notificaciones"])


@router.get("/{usuario_id}")
def get_notificaciones(usuario_id: int, db: Session = Depends(get_db)):
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
def marcar_leida(notif_id: int, db: Session = Depends(get_db)):
    notif = db.query(Notificacion).filter(Notificacion.id == notif_id).first()
    if notif:
        notif.leida = True
        db.commit()
    return {"message": "Notificación marcada como leída"}


@router.patch("/leer-todas/{usuario_id}")
def marcar_todas_leidas(usuario_id: int, db: Session = Depends(get_db)):
    db.query(Notificacion).filter(
        Notificacion.usuario_id == usuario_id,
        Notificacion.leida == False
    ).update({"leida": True})
    db.commit()
    return {"message": "Todas las notificaciones marcadas como leídas"}


@router.delete("/{notif_id}")
def eliminar_notificacion(notif_id: int, db: Session = Depends(get_db)):
    notif = db.query(Notificacion).filter(Notificacion.id == notif_id).first()
    if notif:
        db.delete(notif)
        db.commit()
    return {"message": "Notificación eliminada"}


@router.delete("/eliminar-todas/{usuario_id}")
def eliminar_todas_notificaciones(usuario_id: int, db: Session = Depends(get_db)):
    db.query(Notificacion).filter(
        Notificacion.usuario_id == usuario_id
    ).delete()
    db.commit()
    return {"message": "Todas las notificaciones eliminadas"}