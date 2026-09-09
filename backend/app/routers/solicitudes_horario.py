from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
import json

from app.database import get_db
from app.models.profesional import Profesional
from app.models.usuario import Usuario
from app.models.notificacion import Notificacion
from app.models.solicitud_horario import SolicitudHorario
from app.models.bloque_horario_semanal import BloqueHorarioSemanal
from app.models.auditoria import Auditoria
from app.auth_dependencies import get_current_user, verificar_acceso_profesional, verificar_rol
from app.reglas_horario import validar_bloque_institucional, NOMBRES_DIA, RANGO_INSTITUCIONAL

router = APIRouter(tags=["solicitudes-horario"])


def registrar_auditoria(db, accion, detalle=None, entidad=None, entidad_id=None):
    db.add(Auditoria(accion=accion, detalle=detalle, entidad=entidad, entidad_id=entidad_id))


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


def _notificar_admin(db, mensaje: str, tipo: str = "info"):
    admin = db.query(Usuario).filter(Usuario.rol == "admin").first()
    if admin:
        db.add(Notificacion(usuario_id=admin.id, mensaje=mensaje, tipo=tipo))


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
    verificar_acceso_profesional(current_user, prof_id, db)
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

    # Esta jornada/colación "simple" aplica de Lunes a Viernes por igual, así
    # que se valida contra el rango institucional más corto en común entre
    # todos los días (el de Viernes: 09:00-16:30). Si el profesional necesita
    # un horario más largo un día y más corto otro (ej. Viernes distinto),
    # debe usar la solicitud por bloques semanales en su lugar.
    error = validar_bloque_institucional(4, hora_inicio, hora_fin)  # 4 = Viernes
    if error:
        raise HTTPException(status_code=400, detail=error)

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

    _notificar_admin(db, f"{prof.nombre} solicitó horario de colación: {hora_inicio} - {hora_fin}.")
    registrar_auditoria(db, "Profesional solicitó horario de colación",
                        f"{prof.nombre}: {hora_inicio} - {hora_fin}", "profesional", prof_id)
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
    verificar_acceso_profesional(current_user, prof_id, db)
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

    # Igual que en colación: la jornada simple es de Lunes a Viernes, así que
    # se valida contra el rango institucional más corto en común (Viernes).
    error = validar_bloque_institucional(4, hora_inicio, hora_fin)  # 4 = Viernes
    if error:
        raise HTTPException(status_code=400, detail=error)

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

    _notificar_admin(db, f"{prof.nombre} solicitó horario de jornada: {hora_inicio} - {hora_fin}.")
    registrar_auditoria(db, "Profesional solicitó horario de jornada",
                        f"{prof.nombre}: {hora_inicio} - {hora_fin}", "profesional", prof_id)
    db.commit()
    return {"message": "Solicitud de jornada enviada. Queda pendiente de aprobación del administrador.",
            "hora_inicio": hora_inicio, "hora_fin": hora_fin}


@router.post("/profesional/{prof_id}/solicitar-bloques-horario")
def solicitar_bloques_horario(
    prof_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Solicitud de agenda semanal interactiva: el profesional envía la lista
    completa de bloques que quiere tener disponibles (y cuáles son colación),
    día por día. Reemplaza en un solo paquete cualquier solicitud de bloques
    pendiente anterior. El admin aprueba/rechaza el paquete completo — ver
    aprobar_solicitud más abajo.

    body = {
      "bloques": [
        {"dia_semana": 0, "hora_inicio": "09:00", "hora_fin": "13:00", "tipo": "disponible"},
        {"dia_semana": 0, "hora_inicio": "13:00", "hora_fin": "14:00", "tipo": "colacion"},
        ...
      ]
    }
    dia_semana: 0=Lunes ... 4=Viernes (nunca 5/6 — sábado/domingo se rechazan).
    """
    verificar_acceso_profesional(current_user, prof_id, db)
    prof = db.query(Profesional).filter(Profesional.id == prof_id).first()
    if not prof:
        raise HTTPException(status_code=404, detail="Profesional no encontrado")

    bloques = body.get("bloques") or []
    if not isinstance(bloques, list) or not bloques:
        raise HTTPException(status_code=400, detail="Debes incluir al menos un bloque de horario.")

    normalizados = []
    for b in bloques:
        dia_semana = b.get("dia_semana")
        hora_inicio = b.get("hora_inicio")
        hora_fin = b.get("hora_fin")
        tipo = b.get("tipo") or "disponible"
        if tipo not in ("disponible", "colacion"):
            raise HTTPException(status_code=400, detail="Tipo de bloque inválido (usa 'disponible' o 'colacion').")
        if not isinstance(dia_semana, int) or dia_semana < 0 or dia_semana > 4:
            raise HTTPException(
                status_code=400,
                detail="Solo se pueden solicitar bloques de Lunes a Viernes."
            )
        error = validar_bloque_institucional(dia_semana, hora_inicio, hora_fin)
        if error:
            raise HTTPException(status_code=400, detail=f"{NOMBRES_DIA[dia_semana]}: {error}")
        normalizados.append({
            "dia_semana": dia_semana, "hora_inicio": hora_inicio, "hora_fin": hora_fin, "tipo": tipo
        })

    if not any(b["tipo"] == "disponible" for b in normalizados):
        raise HTTPException(status_code=400, detail="Debes incluir al menos un bloque disponible.")

    # Si ya hay un paquete de bloques pendiente, se reemplaza por el nuevo
    # (mismo criterio que colación/jornada: la última solicitud manda).
    pendiente = db.query(SolicitudHorario).filter(
        SolicitudHorario.profesional_id == prof_id,
        SolicitudHorario.tipo == "bloques",
        SolicitudHorario.estado == "pendiente"
    ).first()
    if pendiente:
        db.delete(pendiente)

    primero = normalizados[0]
    solicitud = SolicitudHorario(
        profesional_id=prof_id, tipo="bloques",
        hora_inicio=primero["hora_inicio"], hora_fin=primero["hora_fin"],
        bloques_json=json.dumps(normalizados), estado="pendiente"
    )
    db.add(solicitud)

    _notificar_admin(db, f"{prof.nombre} solicitó una nueva agenda semanal por bloques ({len(normalizados)} bloques).")
    registrar_auditoria(db, "Profesional solicitó agenda semanal por bloques",
                        f"{prof.nombre}: {len(normalizados)} bloques", "profesional", prof_id)
    db.commit()
    return {"message": "Solicitud de agenda semanal enviada. Queda pendiente de aprobación del administrador.",
            "bloques": normalizados}



def get_mis_solicitudes(
    prof_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    verificar_acceso_profesional(current_user, prof_id, db)
    solicitudes = db.query(SolicitudHorario).filter(
        SolicitudHorario.profesional_id == prof_id
    ).order_by(SolicitudHorario.fecha_solicitud.desc()).all()
    return [
        {
            "id": s.id, "tipo": s.tipo, "hora_inicio": s.hora_inicio, "hora_fin": s.hora_fin,
            "bloques": json.loads(s.bloques_json) if s.bloques_json else None,
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

    verificar_acceso_profesional(current_user, solicitud.profesional_id, db)

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
    current_user: dict = Depends(get_current_user),
):
    verificar_rol(current_user, roles_permitidos=["admin"])
    query = db.query(SolicitudHorario)
    if estado and estado != "todas":
        query = query.filter(SolicitudHorario.estado == estado)
    solicitudes = query.order_by(SolicitudHorario.fecha_solicitud.desc()).all()
    result = []
    for s in solicitudes:
        prof = db.query(Profesional).filter(Profesional.id == s.profesional_id).first()
        result.append({
            "id": s.id, "profesional_id": s.profesional_id,
            "profesional_nombre": prof.nombre if prof else "—",
            "especialidad": prof.especialidad if prof else "—",
            "tipo": s.tipo, "hora_inicio": s.hora_inicio, "hora_fin": s.hora_fin,
            "bloques": json.loads(s.bloques_json) if s.bloques_json else None,
            "estado": s.estado, "motivo_rechazo": s.motivo_rechazo,
            "fecha_solicitud": s.fecha_solicitud.isoformat() if s.fecha_solicitud else None
        })
    return result


@router.patch("/admin/solicitudes-horario/{solicitud_id}/aprobar")
def aprobar_solicitud(
    solicitud_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    verificar_rol(current_user, roles_permitidos=["admin"])
    solicitud = db.query(SolicitudHorario).filter(SolicitudHorario.id == solicitud_id).first()
    if not solicitud:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    if solicitud.estado != "pendiente":
        raise HTTPException(status_code=400, detail="Esta solicitud ya fue resuelta")

    prof = db.query(Profesional).filter(Profesional.id == solicitud.profesional_id).first()
    if not prof:
        raise HTTPException(status_code=404, detail="Profesional no encontrado")

    if solicitud.tipo == "colacion":
        prof.hora_almuerzo_inicio = solicitud.hora_inicio
        prof.hora_almuerzo_fin    = solicitud.hora_fin
        mensaje_prof = f"Tu solicitud de colación ({solicitud.hora_inicio} - {solicitud.hora_fin}) fue aprobada."
    elif solicitud.tipo == "bloques":
        bloques = json.loads(solicitud.bloques_json) if solicitud.bloques_json else []
        # Reemplaza TODA la agenda semanal por bloques previamente aprobada
        # de este profesional por el paquete nuevo (es una foto completa de
        # la semana, no un incremental).
        db.query(BloqueHorarioSemanal).filter(
            BloqueHorarioSemanal.profesional_id == prof.id
        ).delete()
        for b in bloques:
            db.add(BloqueHorarioSemanal(
                profesional_id=prof.id, dia_semana=b["dia_semana"],
                hora_inicio=b["hora_inicio"], hora_fin=b["hora_fin"], tipo=b.get("tipo", "disponible")
            ))
        mensaje_prof = f"Tu nueva agenda semanal por bloques ({len(bloques)} bloques) fue aprobada."
    else:  # jornada
        prof.horario_inicio = solicitud.hora_inicio
        prof.horario_fin    = solicitud.hora_fin
        mensaje_prof = f"Tu solicitud de horario de jornada ({solicitud.hora_inicio} - {solicitud.hora_fin}) fue aprobada."

    solicitud.estado = "aprobado"
    solicitud.fecha_resolucion = datetime.utcnow()

    _notificar_profesional(db, prof, mensaje_prof, tipo="info")
    registrar_auditoria(db, "Admin aprobó solicitud de horario",
                        f"{prof.nombre} — {solicitud.tipo}: {solicitud.hora_inicio} - {solicitud.hora_fin}",
                        "solicitud_horario", solicitud_id)
    db.commit()
    return {"message": "Solicitud aprobada correctamente"}


@router.patch("/admin/solicitudes-horario/{solicitud_id}/rechazar")
def rechazar_solicitud(
    solicitud_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    verificar_rol(current_user, roles_permitidos=["admin"])
    solicitud = db.query(SolicitudHorario).filter(SolicitudHorario.id == solicitud_id).first()
    if not solicitud:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    if solicitud.estado != "pendiente":
        raise HTTPException(status_code=400, detail="Esta solicitud ya fue resuelta")

    prof = db.query(Profesional).filter(Profesional.id == solicitud.profesional_id).first()
    motivo = body.get("motivo") or "Sin motivo especificado"

    solicitud.estado = "rechazado"
    solicitud.motivo_rechazo = motivo
    solicitud.fecha_resolucion = datetime.utcnow()

    if prof:
        tipo_desc = {"colacion": "colación", "jornada": "jornada", "bloques": "agenda semanal por bloques"}.get(solicitud.tipo, solicitud.tipo)
        detalle_horario = "" if solicitud.tipo == "bloques" else f" ({solicitud.hora_inicio} - {solicitud.hora_fin})"
        _notificar_profesional(
            db, prof,
            f"Tu solicitud de {tipo_desc}{detalle_horario} fue rechazada. Motivo: {motivo}",
            tipo="advertencia"
        )
        registrar_auditoria(db, "Admin rechazó solicitud de horario",
                            f"{prof.nombre} — {solicitud.tipo}: {motivo}", "solicitud_horario", solicitud_id)
    db.commit()
    return {"message": "Solicitud rechazada"}