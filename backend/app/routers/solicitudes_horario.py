from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from app.database import get_db
from app.models.profesional import Profesional
from app.models.usuario import Usuario
from app.models.notificacion import Notificacion
from app.models.solicitud_horario import SolicitudHorario
from app.auth_dependencies import get_current_user, verificar_acceso_profesional
from app.rbac.dependencies import require_effective_permission
from app.rbac.admin_authorization import (
    obtener_alcance_administrativo_efectivo,
    especialidad_permitida_por_alcance,
    tiene_permiso_admin_en_especialidad,
)
from app.rbac.permissions import Permission, has_permission
from app.auditoria import registrar_evento_auditoria

router = APIRouter(tags=["solicitudes-horario"])

# SA-2: el helper local registrar_auditoria(...) se eliminó. Este router
# usa ahora app.auditoria.registrar_evento_auditoria, que deriva el actor
# (usuario_id, actor_rol) EXCLUSIVAMENTE de current_user y nunca hace
# commit/rollback por sí mismo — ver docstring de app/auditoria.py.


def _exigir_agenda_gestionar_propia_y_ownership(current_user: dict, prof_id: int, db) -> None:
    """
    RBAC + ownership para las 4 operaciones "propias" del profesional en
    este módulo (Fase 3.5F, mismo criterio que
    profesionales._exigir_permiso_y_ownership_propio):

      - que el usuario autenticado tenga Permission.AGENDA_GESTIONAR_PROPIA, Y
      - que sea el profesional dueño de `prof_id` (verificar_acceso_profesional,
        sin bypass admin/superadmin).

    Un profesional sin este permiso recibe 403 aunque sea dueño del recurso.
    Un profesional con el permiso pero sobre un prof_id ajeno también recibe
    403. Las rutas administrativas de este módulo siguen usando
    Permission.AGENDA_GESTIONAR vía require_permission, sin pasar por aquí.
    """
    if not has_permission(current_user, Permission.AGENDA_GESTIONAR_PROPIA):
        raise HTTPException(status_code=403, detail="No tienes permiso para acceder a este recurso.")
    verificar_acceso_profesional(current_user, prof_id, db, roles_permitidos=["profesional"])



def _ids_profesionales_en_alcance(
    db: Session,
    alcance,
) -> list[int]:
    """
    Devuelve los IDs de profesionales visibles para un alcance
    administrativo limitado.

    El alcance institucional no necesita filtro por IDs.
    """
    if alcance is None or alcance.institucional:
        return []

    return [
        profesional.id
        for profesional in db.query(Profesional).all()
        if especialidad_permitida_por_alcance(
            alcance,
            profesional.especialidad,
        )
    ]

def _hora_a_minutos(hora_str: str) -> int:
    """Convierte 'HH:MM AM/PM' o 'HH:MM' a minutos desde medianoche."""
    hora_str = (hora_str or "").strip()
    for fmt in ("%I:%M %p", "%H:%M"):
        try:
            t = datetime.strptime(hora_str, fmt)
            return t.hour * 60 + t.minute
        except ValueError:
            continue
    return -1


def _notificar_admin(
    db,
    especialidad: str,
    mensaje: str,
    tipo: str = "info",
):
    """
    Notifica a usuarios administrativos activos con capacidad real
    agenda.gestionar para la especialidad de la solicitud.

    ADMIN requiere configuracion valida, permiso persistido y alcance.
    SUPERADMIN conserva su permiso explicito definido por rol.
    """
    for u in db.query(Usuario).all():
        if not getattr(u, "activo", True):
            continue

        if u.rol == "admin":
            autorizado = tiene_permiso_admin_en_especialidad(
                db,
                u.id,
                Permission.AGENDA_GESTIONAR,
                especialidad,
            )
        else:
            autorizado = has_permission(
                u.rol,
                Permission.AGENDA_GESTIONAR,
            )

        if not autorizado:
            continue

        db.add(
            Notificacion(
                usuario_id=u.id,
                mensaje=mensaje,
                tipo=tipo,
            )
        )


def _notificar_profesional(db, prof: Profesional, mensaje: str, tipo: str = "info"):
    if prof.usuario_id:
        db.add(Notificacion(usuario_id=prof.usuario_id, mensaje=mensaje, tipo=tipo))


# ══════════════════════════════════════
# PROFESIONAL — crear solicitudes
# ══════════════════════════════════════

@router.post("/profesional/{prof_id}/solicitar-colacion")
def solicitar_colacion(
    prof_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    _exigir_agenda_gestionar_propia_y_ownership(current_user, prof_id, db)
    prof = db.query(Profesional).filter(Profesional.id == prof_id).first()
    if not prof:
        raise HTTPException(status_code=404, detail="Profesional no encontrado")

    hora_inicio = body.get("hora_almuerzo_inicio")
    if not hora_inicio:
        raise HTTPException(status_code=400, detail="Debes indicar la hora de inicio del almuerzo")

    inicio_min = _hora_a_minutos(hora_inicio)
    if inicio_min < 0:
        raise HTTPException(status_code=400, detail="Formato de hora inválido")

    fin_min = inicio_min + 60
    hora_fin = f"{(fin_min // 60) % 24:02d}:{fin_min % 60:02d}"

    # Si ya hay una solicitud pendiente del mismo tipo, la reemplazamos por la nueva
    pendiente = db.query(SolicitudHorario).filter(
        SolicitudHorario.profesional_id == prof_id,
        SolicitudHorario.tipo == "colacion",
        SolicitudHorario.estado == "pendiente"
    ).first()
    if pendiente:
        db.delete(pendiente)

    solicitud = SolicitudHorario(
        profesional_id=prof_id, tipo="colacion",
        hora_inicio=hora_inicio, hora_fin=hora_fin, estado="pendiente"
    )
    db.add(solicitud)

    _notificar_admin(db, prof.especialidad, f"{prof.nombre} solicitó horario de colación: {hora_inicio} - {hora_fin}.")
    registrar_evento_auditoria(db, current_user, "Profesional solicitó horario de colación",
                                entidad="profesional", entidad_id=prof_id,
                                detalle=f"{prof.nombre}: {hora_inicio} - {hora_fin}")
    db.commit()
    return {"message": "Solicitud de colación enviada. Queda pendiente de aprobación del administrador.",
            "hora_inicio": hora_inicio, "hora_fin": hora_fin}


@router.post("/profesional/{prof_id}/solicitar-jornada")
def solicitar_jornada(
    prof_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    _exigir_agenda_gestionar_propia_y_ownership(current_user, prof_id, db)
    prof = db.query(Profesional).filter(Profesional.id == prof_id).first()
    if not prof:
        raise HTTPException(status_code=404, detail="Profesional no encontrado")

    hora_inicio = body.get("horario_inicio")
    hora_fin    = body.get("horario_fin")
    if not hora_inicio or not hora_fin:
        raise HTTPException(status_code=400, detail="Debes indicar hora de inicio y término de jornada")

    ini_min = _hora_a_minutos(hora_inicio)
    fin_min = _hora_a_minutos(hora_fin)
    if ini_min < 0 or fin_min < 0 or ini_min >= fin_min:
        raise HTTPException(status_code=400, detail="Rango de horas inválido")

    pendiente = db.query(SolicitudHorario).filter(
        SolicitudHorario.profesional_id == prof_id,
        SolicitudHorario.tipo == "jornada",
        SolicitudHorario.estado == "pendiente"
    ).first()
    if pendiente:
        db.delete(pendiente)

    solicitud = SolicitudHorario(
        profesional_id=prof_id, tipo="jornada",
        hora_inicio=hora_inicio, hora_fin=hora_fin, estado="pendiente"
    )
    db.add(solicitud)

    _notificar_admin(db, prof.especialidad, f"{prof.nombre} solicitó horario de jornada: {hora_inicio} - {hora_fin}.")
    registrar_evento_auditoria(db, current_user, "Profesional solicitó horario de jornada",
                                entidad="profesional", entidad_id=prof_id,
                                detalle=f"{prof.nombre}: {hora_inicio} - {hora_fin}")
    db.commit()
    return {"message": "Solicitud de jornada enviada. Queda pendiente de aprobación del administrador.",
            "hora_inicio": hora_inicio, "hora_fin": hora_fin}


@router.get("/profesional/{prof_id}/solicitudes-horario")
def get_mis_solicitudes(
    prof_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    _exigir_agenda_gestionar_propia_y_ownership(current_user, prof_id, db)
    solicitudes = db.query(SolicitudHorario).filter(
        SolicitudHorario.profesional_id == prof_id
    ).order_by(SolicitudHorario.fecha_solicitud.desc()).all()
    return [
        {
            "id": s.id, "tipo": s.tipo, "hora_inicio": s.hora_inicio, "hora_fin": s.hora_fin,
            "estado": s.estado, "motivo_rechazo": s.motivo_rechazo,
            "fecha_solicitud": s.fecha_solicitud.isoformat() if s.fecha_solicitud else None
        }
        for s in solicitudes
    ]


@router.delete("/solicitudes-horario/{solicitud_id}")
def eliminar_solicitud(
    solicitud_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    solicitud = db.query(SolicitudHorario).filter(SolicitudHorario.id == solicitud_id).first()
    if not solicitud:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")

    _exigir_agenda_gestionar_propia_y_ownership(current_user, solicitud.profesional_id, db)

    db.delete(solicitud)
    db.commit()
    return {"message": "Solicitud eliminada correctamente"}


# ══════════════════════════════════════
# ADMIN — revisar solicitudes
# ══════════════════════════════════════

@router.get("/admin/solicitudes-horario")
def get_solicitudes_admin(
    estado: str = "pendiente",
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_effective_permission(
            Permission.AGENDA_GESTIONAR
        )
    ),
):
    alcance = obtener_alcance_administrativo_efectivo(
        db,
        current_user,
    )

    if alcance is None:
        raise HTTPException(
            status_code=403,
            detail="No tienes acceso al alcance solicitado.",
        )

    query = db.query(SolicitudHorario)

    if not alcance.institucional:
        ids_profesionales = _ids_profesionales_en_alcance(
            db,
            alcance,
        )

        if not ids_profesionales:
            return []

        query = query.filter(
            SolicitudHorario.profesional_id.in_(
                ids_profesionales
            )
        )

    if estado and estado != "todas":
        query = query.filter(
            SolicitudHorario.estado == estado
        )

    solicitudes = (
        query
        .order_by(
            SolicitudHorario.fecha_solicitud.desc()
        )
        .all()
    )

    result = []

    for s in solicitudes:
        prof = (
            db.query(Profesional)
            .filter(
                Profesional.id == s.profesional_id
            )
            .first()
        )

        result.append({
            "id": s.id,
            "profesional_id": s.profesional_id,
            "profesional_nombre": (
                prof.nombre
                if prof
                else "?"
            ),
            "especialidad": (
                prof.especialidad
                if prof
                else "?"
            ),
            "tipo": s.tipo,
            "hora_inicio": s.hora_inicio,
            "hora_fin": s.hora_fin,
            "estado": s.estado,
            "motivo_rechazo": s.motivo_rechazo,
            "fecha_solicitud": (
                s.fecha_solicitud.isoformat()
                if s.fecha_solicitud
                else None
            ),
        })

    return result


@router.patch("/admin/solicitudes-horario/{solicitud_id}/aprobar")
def aprobar_solicitud(
    solicitud_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_effective_permission(
            Permission.AGENDA_GESTIONAR
        )
    ),
):
    alcance = obtener_alcance_administrativo_efectivo(
        db,
        current_user,
    )

    if alcance is None:
        raise HTTPException(
            status_code=403,
            detail="No tienes acceso al alcance solicitado.",
        )

    solicitud = (
        db.query(SolicitudHorario)
        .filter(
            SolicitudHorario.id == solicitud_id
        )
        .first()
    )

    if not solicitud:
        raise HTTPException(
            status_code=404,
            detail="Solicitud no encontrada",
        )

    prof = (
        db.query(Profesional)
        .filter(
            Profesional.id == solicitud.profesional_id
        )
        .first()
    )

    if (
        not prof
        or not especialidad_permitida_por_alcance(
            alcance,
            prof.especialidad,
        )
    ):
        # La misma respuesta para una solicitud inexistente
        # y para una existente fuera del alcance.
        raise HTTPException(
            status_code=404,
            detail="Solicitud no encontrada",
        )

    if solicitud.estado != "pendiente":
        raise HTTPException(
            status_code=400,
            detail="Esta solicitud ya fue resuelta",
        )

    if solicitud.tipo == "colacion":
        prof.hora_almuerzo_inicio = solicitud.hora_inicio
        prof.hora_almuerzo_fin = solicitud.hora_fin

        mensaje_prof = (
            f"Tu solicitud de colaci?n "
            f"({solicitud.hora_inicio} - "
            f"{solicitud.hora_fin}) fue aprobada."
        )
    else:
        prof.horario_inicio = solicitud.hora_inicio
        prof.horario_fin = solicitud.hora_fin

        mensaje_prof = (
            f"Tu solicitud de horario de jornada "
            f"({solicitud.hora_inicio} - "
            f"{solicitud.hora_fin}) fue aprobada."
        )

    solicitud.estado = "aprobado"
    solicitud.fecha_resolucion = datetime.utcnow()

    _notificar_profesional(
        db,
        prof,
        mensaje_prof,
        tipo="info",
    )

    registrar_evento_auditoria(
        db,
        current_user,
        "Admin aprob? solicitud de horario",
        entidad="solicitud_horario",
        entidad_id=solicitud_id,
        detalle=(
            f"{prof.nombre} ? "
            f"{solicitud.tipo}: "
            f"{solicitud.hora_inicio} - "
            f"{solicitud.hora_fin}"
        ),
    )

    db.commit()

    return {
        "message": "Solicitud aprobada correctamente"
    }


@router.patch("/admin/solicitudes-horario/{solicitud_id}/rechazar")
def rechazar_solicitud(
    solicitud_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_effective_permission(
            Permission.AGENDA_GESTIONAR
        )
    ),
):
    alcance = obtener_alcance_administrativo_efectivo(
        db,
        current_user,
    )

    if alcance is None:
        raise HTTPException(
            status_code=403,
            detail="No tienes acceso al alcance solicitado.",
        )

    solicitud = (
        db.query(SolicitudHorario)
        .filter(
            SolicitudHorario.id == solicitud_id
        )
        .first()
    )

    if not solicitud:
        raise HTTPException(
            status_code=404,
            detail="Solicitud no encontrada",
        )

    prof = (
        db.query(Profesional)
        .filter(
            Profesional.id == solicitud.profesional_id
        )
        .first()
    )

    if (
        not prof
        or not especialidad_permitida_por_alcance(
            alcance,
            prof.especialidad,
        )
    ):
        # No revelar estado ni existencia de solicitudes
        # pertenecientes a otra especialidad.
        raise HTTPException(
            status_code=404,
            detail="Solicitud no encontrada",
        )

    if solicitud.estado != "pendiente":
        raise HTTPException(
            status_code=400,
            detail="Esta solicitud ya fue resuelta",
        )

    motivo = (
        body.get("motivo")
        or "Sin motivo especificado"
    )

    solicitud.estado = "rechazado"
    solicitud.motivo_rechazo = motivo
    solicitud.fecha_resolucion = datetime.utcnow()

    tipo_desc = (
        "colaci?n"
        if solicitud.tipo == "colacion"
        else "jornada"
    )

    _notificar_profesional(
        db,
        prof,
        (
            f"Tu solicitud de horario de {tipo_desc} "
            f"({solicitud.hora_inicio} - "
            f"{solicitud.hora_fin}) fue rechazada. "
            f"Motivo: {motivo}"
        ),
        tipo="advertencia",
    )

    registrar_evento_auditoria(
        db,
        current_user,
        "Admin rechaz? solicitud de horario",
        entidad="solicitud_horario",
        entidad_id=solicitud_id,
        detalle=(
            f"{prof.nombre} ? "
            f"{solicitud.tipo}: {motivo}"
        ),
    )

    db.commit()

    return {
        "message": "Solicitud rechazada"
    }
