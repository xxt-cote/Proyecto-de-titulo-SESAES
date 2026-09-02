"""
Fase 3.5F — endpoint ADMINISTRATIVO/OPERACIONAL de agenda, separado del
endpoint CLÍNICO que usa el dashboard del profesional
(GET /profesional/{prof_id}/citas en profesionales.py).

Este módulo es exclusivamente para el rol administrativo: exige
Permission.AGENDA_GESTIONAR (no AGENDA_VER_PROFESIONAL ni ownership de
profesional) y devuelve solo los campos operacionales necesarios para
que Admin/Superadmin vean el horario de un profesional — nunca datos
clínicos (medicamento, observaciones_atencion, ficha, anamnesis,
cuestionario, diagnóstico, etc.).
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.cita import Cita
from app.models.profesional import Profesional
from app.models.usuario import Usuario
from app.rbac.dependencies import require_permission
from app.rbac.permissions import Permission

router = APIRouter(prefix="/agenda", tags=["agenda"])


@router.get("/profesional/{prof_id}/citas")
def get_citas_profesional_admin(
    prof_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission(Permission.AGENDA_GESTIONAR)),
):
    """
    Vista administrativa/operacional de la agenda de un profesional.

    Requiere Permission.AGENDA_GESTIONAR (no ownership del profesional:
    esto es para Admin/Superadmin que gestionan horarios, no para el
    profesional dueño — ese caso ya está cubierto por su propio endpoint
    clínico protegido en profesionales.py).

    Devuelve exclusivamente campos operacionales: id, estudiante,
    estudiante_id, especialidad, fecha, hora, estado, urgente, sobrecupo.
    NO expone campos clínicos.
    """
    prof = db.query(Profesional).filter(Profesional.id == prof_id).first()
    if not prof:
        raise HTTPException(status_code=404, detail="Profesional no encontrado")

    citas = db.query(Cita).filter(Cita.profesional_id == prof_id).order_by(Cita.fecha, Cita.hora).all()

    result = []
    for c in citas:
        est = db.query(Usuario).filter(Usuario.id == c.estudiante_id).first()
        result.append({
            "id":            c.id,
            "estudiante":    est.nombre if est else "—",
            "estudiante_id": c.estudiante_id,
            "especialidad":  prof.especialidad,
            "fecha":         c.fecha,
            "hora":          c.hora,
            "estado":        c.estado,
            "urgente":       c.urgente or False,
            "sobrecupo":     c.sobrecupo or False,
        })
    return result
