from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import date, datetime

from app.database import get_db
from app.security import verify_password, hash_password
from app.models.cita import Cita
from app.models.profesional import Profesional
from app.models.usuario import Usuario
from app.models.notificacion import Notificacion
from app.models.historial_estado_profesional import HistorialEstadoProfesional
from app.routers.correos import simular_envio_correo
from app.auth_dependencies import get_current_user, verificar_acceso_profesional
from app.rbac.permissions import Permission, has_permission
from app.auditoria import registrar_evento_auditoria

router = APIRouter(tags=["profesionales"])

# SA-2: el helper local registrar_auditoria(...) se eliminó. Este router
# usa ahora app.auditoria.registrar_evento_auditoria, que deriva el actor
# (usuario_id, actor_rol) EXCLUSIVAMENTE de current_user y nunca hace
# commit/rollback por sí mismo — ver docstring de app/auditoria.py.


def _exigir_permiso_y_ownership_propio(
    current_user: dict, prof_id: int, db, permission: Permission
) -> None:
    """
    RBAC + ownership para endpoints "propios" del profesional (Fase 3.5F).

    Exige explícitamente:
      - que el usuario autenticado tenga `permission` (has_permission), Y
      - que sea el profesional dueño de `prof_id` (verificar_acceso_profesional,
        sin bypass admin/superadmin — ver auth_dependencies.py).

    Un profesional sin `permission` recibe 403 aunque sea dueño del recurso.
    Un profesional con `permission` pero sobre un prof_id ajeno también
    recibe 403. Ningún rol tiene atajo aquí: ROLE + PERMISSION + OWNERSHIP.
    """
    if not has_permission(current_user, permission):
        raise HTTPException(status_code=403, detail="No tienes permiso para acceder a este recurso.")
    verificar_acceso_profesional(current_user, prof_id, db, roles_permitidos=["profesional"])


def _notificar_con_agenda_gestionar(
    db, mensaje: str, tipo: str = "info",
    email_asunto: str = None, email_cuerpo: str = None, email_referencia_id: int = None,
) -> None:
    """
    Notifica a TODOS los usuarios cuyo rol tenga Permission.AGENDA_GESTIONAR
    (Fase 3.5F), en vez de al primer Usuario con rol == "admin" a secas.
    El destinatario administrativo se deriva del permiso RBAC, no de un
    string de rol hardcodeado — sin atajo especial para superadmin (si
    superadmin no tiene AGENDA_GESTIONAR en ROLE_DEFAULT_PERMISSIONS, no
    recibe estas notificaciones).
    """
    for u in db.query(Usuario).all():
        if not has_permission(u.rol, Permission.AGENDA_GESTIONAR):
            continue
        db.add(Notificacion(usuario_id=u.id, mensaje=mensaje, tipo=tipo))
        if email_asunto:
            simular_envio_correo(
                db, destinatario=u.correo or "", asunto=email_asunto,
                cuerpo=email_cuerpo or mensaje, tipo=tipo, referencia_id=email_referencia_id,
            )


# ══════════════════════════════════════
# ENDPOINT PÚBLICO — lista para estudiantes
# ══════════════════════════════════════

@router.get("/profesionales")
def get_profesionales(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    return [
        {
            "id":           p.id,
            "nombre":       p.nombre,
            "especialidad": p.especialidad,
            "iniciales":    p.iniciales,
            "descripcion":  p.descripcion,
            "foto_url":     p.foto_url,
            "duracion_min": p.duracion_min,
            "estado":       p.estado or "activo",
            # Fase 3.5F: correo y usuario_id ya no se exponen en este catálogo
            # autenticado. El login resuelve el profesional vía
            # /profesional/buscar-por-usuario/{usuario_id} (ownership estricto).
        }
        for p in db.query(Profesional).filter(Profesional.estado == "activo").all()
    ]


# ══════════════════════════════════════
# BUSCAR PROFESIONAL POR USUARIO_ID (para login)
# ══════════════════════════════════════

@router.get("/profesional/buscar-por-usuario/{usuario_id}")
def buscar_profesional_por_usuario(
    usuario_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    # Fase 3.5F: ownership estricto, sin bypass administrativo inline.
    if current_user["id"] != usuario_id:
        raise HTTPException(status_code=403, detail="No tienes permiso para acceder a este recurso.")
    prof = db.query(Profesional).filter(Profesional.usuario_id == usuario_id).first()
    if not prof:
        raise HTTPException(status_code=404, detail="Profesional no encontrado")
    return {
        "id":           prof.id,
        "nombre":       prof.nombre,
        "especialidad": prof.especialidad,
        "estado":       prof.estado or "activo",
        "correo":       prof.correo,
        "usuario_id":   prof.usuario_id
    }
# ══════════════════════════════════════
# PERFIL DEL PROFESIONAL
# ══════════════════════════════════════
@router.get("/profesional/{prof_id}/perfil")
def get_perfil(
    prof_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    verificar_acceso_profesional(current_user, prof_id, db)
    prof = db.query(Profesional).filter(Profesional.id == prof_id).first()
    if not prof:
        raise HTTPException(status_code=404, detail="Profesional no encontrado")
    usuario = db.query(Usuario).filter(Usuario.id == prof.usuario_id).first()
    return {
        "id":           prof.id,
        "nombre":       prof.nombre,
        "especialidad": prof.especialidad,
        "iniciales":    prof.iniciales,
        "descripcion":  prof.descripcion,
        "correo":       prof.correo,
        "rut":          prof.rut,
        "estado":       prof.estado or "activo",
        "foto_url":     prof.foto_url,
        "duracion_min": prof.duracion_min,
        "tema_oscuro":  usuario.tema_oscuro if usuario else False,
        "usuario_id":   prof.usuario_id,
        "hora_almuerzo_inicio": prof.hora_almuerzo_inicio,
        "hora_almuerzo_fin":    prof.hora_almuerzo_fin,
        "horario_inicio": prof.horario_inicio,
        "horario_fin":    prof.horario_fin
    }

@router.patch("/profesional/{prof_id}/perfil")
def actualizar_perfil(
    prof_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    verificar_acceso_profesional(current_user, prof_id, db)
    prof = db.query(Profesional).filter(Profesional.id == prof_id).first()
    if not prof:
        raise HTTPException(status_code=404, detail="Profesional no encontrado")

    if "nombre" in body:
        prof.nombre = body["nombre"]
    if "descripcion" in body:
        prof.descripcion = body["descripcion"]
    if "foto_url" in body:
        prof.foto_url = body["foto_url"]
    if "tema_oscuro" in body:
        usuario = db.query(Usuario).filter(Usuario.id == prof.usuario_id).first()
        if usuario:
            usuario.tema_oscuro = body["tema_oscuro"]

    registrar_evento_auditoria(db, current_user, "Profesional actualizó su perfil",
                                entidad="profesional", entidad_id=prof_id)
    db.commit()
    return {"message": "Perfil actualizado correctamente"}

@router.patch("/profesional/{prof_id}/cambiar-password")
def cambiar_password(
    prof_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    verificar_acceso_profesional(current_user, prof_id, db)
    prof = db.query(Profesional).filter(Profesional.id == prof_id).first()
    if not prof:
        raise HTTPException(status_code=404, detail="Profesional no encontrado")
    usuario = db.query(Usuario).filter(Usuario.id == prof.usuario_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if not verify_password(body.get("contrasena_actual"), usuario.password):
        raise HTTPException(status_code=400, detail="La contraseña actual es incorrecta")
    usuario.password = hash_password(body.get("contrasena_nueva"))
    db.commit()
    return {"message": "Contraseña actualizada correctamente"}


# ══════════════════════════════════════
# ESTADÍSTICAS DEL DÍA
# ══════════════════════════════════════

@router.get("/profesional/{prof_id}/estadisticas-dia")
def get_estadisticas_dia(
    prof_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    _exigir_permiso_y_ownership_propio(current_user, prof_id, db, Permission.AGENDA_VER_PROFESIONAL)
    hoy = date.today().isoformat()
    citas_hoy = db.query(Cita).filter(Cita.profesional_id == prof_id, Cita.fecha == hoy).all()
    return {
        "total_hoy":     len(citas_hoy),
        "completadas":   len([c for c in citas_hoy if c.estado == "completada"]),
        "pendientes":    len([c for c in citas_hoy if c.estado == "pendiente"]),
        "inasistencias": len([c for c in citas_hoy if c.estado == "inasistencia"])
    }


# ══════════════════════════════════════
# CITAS SIN CERRAR (fecha ya pasó y siguen "pendiente" — nadie las marcó
# como completada ni como inasistencia). El profesional ve un aviso al
# entrar para que las cierre, en vez de quedar colgadas para siempre.
# ══════════════════════════════════════

@router.get("/profesional/{prof_id}/citas-sin-cerrar")
def get_citas_sin_cerrar(
    prof_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    _exigir_permiso_y_ownership_propio(current_user, prof_id, db, Permission.AGENDA_VER_PROFESIONAL)
    hoy = date.today().isoformat()
    citas = db.query(Cita).filter(
        Cita.profesional_id == prof_id,
        Cita.estado == "pendiente",
        Cita.fecha < hoy
    ).order_by(Cita.fecha.desc()).all()

    resultado = []
    for c in citas:
        est = db.query(Usuario).filter(Usuario.id == c.estudiante_id).first()
        resultado.append({
            "id":          c.id,
            "estudiante":  est.nombre if est else "—",
            "rut":         est.rut if est else "—",
            "fecha":       c.fecha,
            "hora":        c.hora,
        })
    return resultado


# ══════════════════════════════════════
# CITAS DEL PROFESIONAL
# ══════════════════════════════════════

@router.get("/profesional/{prof_id}/citas")
def get_citas_profesional(
    prof_id: int,
    fecha: str = None,
    estado: str = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    _exigir_permiso_y_ownership_propio(current_user, prof_id, db, Permission.ATENCIONES_VER_ASIGNADAS)
    query = db.query(Cita).filter(Cita.profesional_id == prof_id)
    if fecha:  query = query.filter(Cita.fecha == fecha)
    if estado: query = query.filter(Cita.estado == estado)
    citas = query.order_by(Cita.fecha, Cita.hora).all()
    result = []
    for c in citas:
        est = db.query(Usuario).filter(Usuario.id == c.estudiante_id).first()
        result.append({
            "id":                     c.id,
            "estudiante":             est.nombre  if est else "—",
            "estudiante_id":          c.estudiante_id,
            "rut":                    est.rut     if est else "—",
            "carrera":                est.carrera if est else "—",
            "correo_est":             est.correo  if est else "—",
            "foto_url":               est.foto_url if est else None,
            "fecha":                  c.fecha,
            "hora":                   c.hora,
            "estado":                 c.estado,
            "urgente":                c.urgente or False,
            "sobrecupo":              c.sobrecupo or False,
            "observaciones":          c.observaciones,
            "medicamento":            c.medicamento,
            "observaciones_atencion": c.observaciones_atencion
        })
    return result


# ══════════════════════════════════════
# COMPLETAR CITA
# ══════════════════════════════════════

@router.patch("/profesional/{prof_id}/citas/{cita_id}/completar")
def completar_cita(
    prof_id: int,
    cita_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    _exigir_permiso_y_ownership_propio(current_user, prof_id, db, Permission.ATENCIONES_REGISTRAR)
    cita = db.query(Cita).filter(Cita.id == cita_id, Cita.profesional_id == prof_id).first()
    if not cita:
        raise HTTPException(status_code=404, detail="Cita no encontrada")
    if cita.fecha > date.today().isoformat():
        raise HTTPException(status_code=400, detail="No puedes completar una cita que todavía no ocurre")
    cita.estado                 = "completada"
    cita.medicamento            = body.get("medicamento") or None
    cita.observaciones_atencion = body.get("observaciones_atencion") or None
    est = db.query(Usuario).filter(Usuario.id == cita.estudiante_id).first()
    registrar_evento_auditoria(db, current_user, "Profesional completó cita",
                                entidad="cita", entidad_id=cita_id,
                                detalle=f"Estudiante: {est.nombre if est else '—'} — {cita.fecha} {cita.hora}")
    db.commit()
    return {"message": "Cita marcada como completada"}


# ══════════════════════════════════════
# INASISTENCIA
# ══════════════════════════════════════

@router.patch("/profesional/{prof_id}/citas/{cita_id}/inasistencia")
def marcar_inasistencia(
    prof_id: int,
    cita_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    _exigir_permiso_y_ownership_propio(current_user, prof_id, db, Permission.AGENDA_GESTIONAR_PROPIA)
    cita = db.query(Cita).filter(Cita.id == cita_id, Cita.profesional_id == prof_id).first()
    if not cita:
        raise HTTPException(status_code=404, detail="Cita no encontrada")
    if cita.fecha > date.today().isoformat():
        raise HTTPException(status_code=400, detail="No puedes marcar inasistencia de una cita que todavía no ocurre")
    est = db.query(Usuario).filter(Usuario.id == cita.estudiante_id).first()
    cita.estado = "inasistencia"
    _notificar_con_agenda_gestionar(
        db,
        mensaje=f"Inasistencia: {est.nombre if est else '—'} no asistió a su cita del {cita.fecha} a las {cita.hora}.",
        tipo="info",
    )
    registrar_evento_auditoria(db, current_user, "Profesional marcó inasistencia",
                                entidad="cita", entidad_id=cita_id,
                                detalle=f"Estudiante: {est.nombre if est else '—'} — {cita.fecha} {cita.hora}")
    db.commit()
    return {"message": "Inasistencia registrada"}


# ══════════════════════════════════════
# REPORTAR AUSENCIA
# ══════════════════════════════════════
# Tres modos, según "tipo":
#   - "temporal":     mismo día, cancela solo las citas dentro de [hora_inicio, hora_fin]
#   - "dia_completo":  cancela todas las citas pendientes del día indicado
#   - "licencia":      cancela todas las citas pendientes entre fecha_inicio y fecha_fin
#
# En los tres casos: se cancelan las citas afectadas, se notifica a cada estudiante
# y al admin, y se registra en el historial de estado. La reactivación del profesional
# (volver a "activo") queda a criterio manual del admin — no hay reactivación automática.

def _hora_a_minutos(hora_str: str) -> int:
    """Convierte 'HH:MM AM/PM' o 'HH:MM' a minutos desde medianoche, para poder comparar rangos."""
    hora_str = (hora_str or "").strip()
    for fmt in ("%I:%M %p", "%H:%M"):
        try:
            t = datetime.strptime(hora_str, fmt)
            return t.hour * 60 + t.minute
        except ValueError:
            continue
    return -1


@router.post("/profesional/{prof_id}/reportar-ausencia")
def reportar_ausencia(
    prof_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    _exigir_permiso_y_ownership_propio(current_user, prof_id, db, Permission.AGENDA_GESTIONAR_PROPIA)
    prof = db.query(Profesional).filter(Profesional.id == prof_id).first()
    if not prof:
        raise HTTPException(status_code=404, detail="Profesional no encontrado")

    tipo   = body.get("tipo", "dia_completo")
    motivo = body.get("motivo") or "Sin motivo especificado"
    estado_anterior = prof.estado or "activo"

    if tipo == "temporal":
        fecha       = body.get("fecha", date.today().isoformat())
        hora_inicio = _hora_a_minutos(body.get("hora_inicio"))
        hora_fin    = _hora_a_minutos(body.get("hora_fin"))
        if hora_inicio < 0 or hora_fin < 0 or hora_inicio >= hora_fin:
            raise HTTPException(status_code=400, detail="Rango de horas inválido")
        citas_afectadas = [
            c for c in db.query(Cita).filter(
                Cita.profesional_id == prof_id, Cita.fecha == fecha, Cita.estado == "pendiente"
            ).all()
            if hora_inicio <= _hora_a_minutos(c.hora) < hora_fin
        ]
        estado_nuevo = estado_anterior  # una salida temporal no cambia el estado general del profesional
        rango_desc = f"el {fecha} entre {body.get('hora_inicio')} y {body.get('hora_fin')}"

    elif tipo == "licencia":
        fecha_inicio = body.get("fecha_inicio", date.today().isoformat())
        fecha_fin    = body.get("fecha_fin", fecha_inicio)
        citas_afectadas = db.query(Cita).filter(
            Cita.profesional_id == prof_id, Cita.estado == "pendiente",
            Cita.fecha >= fecha_inicio, Cita.fecha <= fecha_fin
        ).all()
        estado_nuevo = "licencia"
        rango_desc = f"del {fecha_inicio} al {fecha_fin}"

    else:  # dia_completo
        fecha = body.get("fecha", date.today().isoformat())
        citas_afectadas = db.query(Cita).filter(
            Cita.profesional_id == prof_id, Cita.fecha == fecha, Cita.estado == "pendiente"
        ).all()
        estado_nuevo = "inasistencia"
        rango_desc = f"el {fecha}"

    prof.estado = estado_nuevo

    for cita in citas_afectadas:
        cita.estado = "cancelada"
        est = db.query(Usuario).filter(Usuario.id == cita.estudiante_id).first()
        if est:
            db.add(Notificacion(
                usuario_id=est.id,
                mensaje=f"Tu cita del {cita.fecha} a las {cita.hora} fue cancelada por fuerza mayor. "
                        f"Puedes reagendar tu hora cuando lo desees desde tu dashboard.",
                tipo="cancelacion"
            ))
            simular_envio_correo(db,
                destinatario=est.correo or "",
                asunto="SESAES — Tu cita fue cancelada",
                cuerpo=f"Tu cita del {cita.fecha} a las {cita.hora} con {prof.nombre} fue cancelada por fuerza mayor.",
                tipo="cancelacion", referencia_id=cita.id
            )

    db.add(HistorialEstadoProfesional(
        profesional_id=prof_id, estado_anterior=estado_anterior,
        estado_nuevo=estado_nuevo, motivo=motivo, registrado_por=current_user["id"]
    ))

    _notificar_con_agenda_gestionar(
        db,
        mensaje=f"{prof.nombre} reportó ausencia {rango_desc}. Motivo: {motivo}. "
                f"Se cancelaron {len(citas_afectadas)} cita(s) automáticamente.",
        tipo="advertencia",
        email_asunto=f"SESAES — {prof.nombre} reportó ausencia",
        email_cuerpo=f"{prof.nombre} ({prof.especialidad}) reportó ausencia {rango_desc}. Motivo: {motivo}.",
        email_referencia_id=prof_id,
    )

    registrar_evento_auditoria(db, current_user, "Profesional reportó ausencia",
                                entidad="profesional", entidad_id=prof_id,
                                detalle=f"{prof.nombre} — {tipo} — {rango_desc}: {motivo} ({len(citas_afectadas)} citas canceladas)")
    db.commit()
    return {"message": f"Ausencia reportada. {len(citas_afectadas)} cita(s) cancelada(s) y notificadas."}


# ══════════════════════════════════════
# NOTIFICACIONES DEL PROFESIONAL
# ══════════════════════════════════════

@router.get("/profesional/{prof_id}/notificaciones")
def get_notificaciones_profesional(
    prof_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    verificar_acceso_profesional(current_user, prof_id, db)
    prof = db.query(Profesional).filter(Profesional.id == prof_id).first()
    if not prof or not prof.usuario_id:
        return []
    notifs = db.query(Notificacion).filter(
        Notificacion.usuario_id == prof.usuario_id
    ).order_by(Notificacion.fecha_creacion.desc()).limit(50).all()
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
