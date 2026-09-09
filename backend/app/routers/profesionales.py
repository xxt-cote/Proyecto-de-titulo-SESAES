from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import date, datetime

from app.database import get_db
from app.security import verify_password, hash_password, errores_password
from app.models.cita import Cita
from app.models.profesional import Profesional
from app.models.usuario import Usuario
from app.models.notificacion import Notificacion
from app.models.auditoria import Auditoria
from app.models.historial_estado_profesional import HistorialEstadoProfesional
from app.models.ausencia_profesional import AusenciaProfesional
from app.models.bloque_horario_semanal import BloqueHorarioSemanal
from app.routers.correos import simular_envio_correo
from app.auth_dependencies import get_current_user, verificar_acceso_profesional
from app.reglas_horario import calcular_dias_disponibles

router = APIRouter(tags=["profesionales"])


def registrar_auditoria(db, accion, detalle=None, entidad=None, entidad_id=None):
    db.add(Auditoria(accion=accion, detalle=detalle, entidad=entidad, entidad_id=entidad_id))


# ══════════════════════════════════════
# ENDPOINT PÚBLICO — lista para estudiantes
# ══════════════════════════════════════

@router.get("/profesionales")
def get_profesionales(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    resultado = []
    for p in db.query(Profesional).filter(Profesional.estado == "activo").all():
        dias_bloque = {b.dia_semana for b in p.bloques_semanales if b.tipo == "disponible"}
        resultado.append({
            "id":           p.id,
            "nombre":       p.nombre,
            "especialidad": p.especialidad,
            "iniciales":    p.iniciales,
            "descripcion":  p.descripcion,
            "foto_url":     p.foto_url,
            "duracion_min": p.duracion_min,
            "estado":       p.estado or "activo",
            "correo":       p.correo,   # ← necesario para login del profesional
            "usuario_id":   p.usuario_id,
            # Para que el estudiante no pueda ni siquiera seleccionar, en el
            # mini-calendario, un día de semana en que este profesional no
            # atiende (ver dias_disponibles en calcular_dias_disponibles).
            "dias_disponibles": calcular_dias_disponibles(
                dias_bloque, bool(p.horario_inicio and p.horario_fin)
            ),
        })
    return resultado


# ══════════════════════════════════════
# BUSCAR PROFESIONAL POR USUARIO_ID (para login)
# ══════════════════════════════════════

@router.get("/profesional/buscar-por-usuario/{usuario_id}")
def buscar_profesional_por_usuario(
    usuario_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if current_user["rol"] != "admin" and current_user["id"] != usuario_id:
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
        "horario_fin":    prof.horario_fin,
        "bloques_semanales": [
            {"dia_semana": b.dia_semana, "hora_inicio": b.hora_inicio, "hora_fin": b.hora_fin, "tipo": b.tipo}
            for b in prof.bloques_semanales
        ]
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

    registrar_auditoria(db, "Profesional actualizó su perfil", None, "profesional", prof_id)
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
    errores = errores_password(body.get("contrasena_nueva") or "")
    if errores:
        raise HTTPException(status_code=400, detail="; ".join(errores))
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
    verificar_acceso_profesional(current_user, prof_id, db)
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
    verificar_acceso_profesional(current_user, prof_id, db)
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
    verificar_acceso_profesional(current_user, prof_id, db)
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
            "observaciones_atencion": c.observaciones_atencion,
            "motivo_cancelacion":     c.motivo_cancelacion,
            "rechazada_por_profesional": c.rechazada_por_profesional or False
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
    verificar_acceso_profesional(current_user, prof_id, db)
    cita = db.query(Cita).filter(Cita.id == cita_id, Cita.profesional_id == prof_id).first()
    if not cita:
        raise HTTPException(status_code=404, detail="Cita no encontrada")
    if cita.fecha > date.today().isoformat():
        raise HTTPException(status_code=400, detail="No puedes completar una cita que todavía no ocurre")
    cita.estado                 = "completada"
    cita.medicamento            = body.get("medicamento") or None
    cita.observaciones_atencion = body.get("observaciones_atencion") or None
    est = db.query(Usuario).filter(Usuario.id == cita.estudiante_id).first()
    registrar_auditoria(db, "Profesional completó cita",
                        f"Estudiante: {est.nombre if est else '—'} — {cita.fecha} {cita.hora}",
                        "cita", cita_id)
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
    verificar_acceso_profesional(current_user, prof_id, db)
    cita = db.query(Cita).filter(Cita.id == cita_id, Cita.profesional_id == prof_id).first()
    if not cita:
        raise HTTPException(status_code=404, detail="Cita no encontrada")
    if cita.fecha > date.today().isoformat():
        raise HTTPException(status_code=400, detail="No puedes marcar inasistencia de una cita que todavía no ocurre")
    est = db.query(Usuario).filter(Usuario.id == cita.estudiante_id).first()
    cita.estado = "inasistencia"
    admin = db.query(Usuario).filter(Usuario.rol == "admin").first()
    if admin:
        db.add(Notificacion(
            usuario_id=admin.id,
            mensaje=f"Inasistencia: {est.nombre if est else '—'} no asistió a su cita del {cita.fecha} a las {cita.hora}.",
            tipo="info"
        ))
    registrar_auditoria(db, "Profesional marcó inasistencia",
                        f"Estudiante: {est.nombre if est else '—'} — {cita.fecha} {cita.hora}",
                        "cita", cita_id)
    db.commit()
    return {"message": "Inasistencia registrada"}


# ══════════════════════════════════════
# ACEPTAR / RECHAZAR CITA PENDIENTE
# ══════════════════════════════════════
# El profesional revisa cada cita "pendiente" solicitada por un estudiante:
#   - Aceptar: confirma la hora. NO cambia Cita.estado (sigue "pendiente"
#     hasta el día de la atención — ver regla de negocio "Cita ≠ Atención"
#     en el Documento Maestro sección 4: solo "completada" cuenta como
#     atención real). Solo deja registro/notificación de que fue revisada.
#   - Rechazar: requiere motivo. Reutiliza el estado "cancelada" (mismo
#     color/semántica que cualquier otra cancelación) + el flag
#     rechazada_por_profesional para que quede trazable en el panel Admin
#     que fue el profesional quien la rechazó, y por qué.

@router.patch("/profesional/{prof_id}/citas/{cita_id}/aceptar")
def aceptar_cita(
    prof_id: int,
    cita_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    verificar_acceso_profesional(current_user, prof_id, db)
    cita = db.query(Cita).filter(Cita.id == cita_id, Cita.profesional_id == prof_id).first()
    if not cita:
        raise HTTPException(status_code=404, detail="Cita no encontrada")
    if cita.estado != "pendiente":
        raise HTTPException(status_code=400, detail="Solo se puede aceptar una cita pendiente")

    est = db.query(Usuario).filter(Usuario.id == cita.estudiante_id).first()
    if est:
        db.add(Notificacion(
            usuario_id=est.id,
            mensaje=f"Tu cita del {cita.fecha} a las {cita.hora} fue confirmada por el profesional.",
            tipo="info"
        ))
    registrar_auditoria(db, "Profesional aceptó cita",
                        f"Estudiante: {est.nombre if est else '—'} — {cita.fecha} {cita.hora}",
                        "cita", cita_id)
    db.commit()
    return {"message": "Cita aceptada y confirmada"}


@router.patch("/profesional/{prof_id}/citas/{cita_id}/rechazar")
def rechazar_cita(
    prof_id: int,
    cita_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    verificar_acceso_profesional(current_user, prof_id, db)
    cita = db.query(Cita).filter(Cita.id == cita_id, Cita.profesional_id == prof_id).first()
    if not cita:
        raise HTTPException(status_code=404, detail="Cita no encontrada")
    if cita.estado != "pendiente":
        raise HTTPException(status_code=400, detail="Solo se puede rechazar una cita pendiente")

    motivo = (body or {}).get("motivo")
    if not motivo:
        raise HTTPException(status_code=400, detail="Debes indicar un motivo de rechazo")

    cita.estado = "cancelada"
    cita.rechazada_por_profesional = True
    cita.motivo_cancelacion = motivo

    est = db.query(Usuario).filter(Usuario.id == cita.estudiante_id).first()
    if est:
        db.add(Notificacion(
            usuario_id=est.id,
            mensaje=f"Tu cita del {cita.fecha} a las {cita.hora} fue rechazada por el profesional. Motivo: {motivo}",
            tipo="advertencia"
        ))
    admin = db.query(Usuario).filter(Usuario.rol == "admin").first()
    if admin:
        db.add(Notificacion(
            usuario_id=admin.id,
            mensaje=f"{est.nombre if est else '—'}: cita del {cita.fecha} {cita.hora} fue rechazada por el profesional. Motivo: {motivo}",
            tipo="info"
        ))
    registrar_auditoria(db, "Profesional rechazó cita",
                        f"Estudiante: {est.nombre if est else '—'} — {cita.fecha} {cita.hora} — Motivo: {motivo}",
                        "cita", cita_id)
    db.commit()
    return {"message": "Cita rechazada"}



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
    verificar_acceso_profesional(current_user, prof_id, db)
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
        # Si la ausencia es para HOY, refleja de inmediato que el profesional
        # no está disponible. Si es para una fecha futura, NO se debe tocar
        # el estado general del profesional todavía (seguiría trabajando
        # normalmente hasta ese día) — solo se cancelan las citas pendientes
        # de esa fecha puntual y se deja registro en el historial de estados.
        estado_nuevo = "inasistencia" if fecha == date.today().isoformat() else estado_anterior
        rango_desc = f"el {fecha}"
        # Bloquea nuevos agendamientos en esa fecha exacta (no solo cancela
        # las citas que ya existían). Si ya había una ausencia registrada
        # para el mismo día, se reemplaza (evita duplicados si el profesional
        # reporta dos veces la misma fecha).
        db.query(AusenciaProfesional).filter(
            AusenciaProfesional.profesional_id == prof_id,
            AusenciaProfesional.fecha == fecha
        ).delete()
        db.add(AusenciaProfesional(profesional_id=prof_id, fecha=fecha, motivo=motivo))

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
        estado_nuevo=estado_nuevo, motivo=motivo, registrado_por=None
    ))

    admin = db.query(Usuario).filter(Usuario.rol == "admin").first()
    if admin:
        db.add(Notificacion(
            usuario_id=admin.id,
            mensaje=f"{prof.nombre} reportó ausencia {rango_desc}. Motivo: {motivo}. "
                    f"Se cancelaron {len(citas_afectadas)} cita(s) automáticamente.",
            tipo="advertencia"
        ))
        simular_envio_correo(db,
            destinatario=admin.correo or "admin@utem.cl",
            asunto=f"SESAES — {prof.nombre} reportó ausencia",
            cuerpo=f"{prof.nombre} ({prof.especialidad}) reportó ausencia {rango_desc}. Motivo: {motivo}.",
            tipo="advertencia", referencia_id=prof_id
        )

    registrar_auditoria(db, "Profesional reportó ausencia",
                        f"{prof.nombre} — {tipo} — {rango_desc}: {motivo} ({len(citas_afectadas)} citas canceladas)",
                        "profesional", prof_id)
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
