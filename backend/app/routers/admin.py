import re
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, date, timedelta
import io

from app.database import get_db
from app.models.cita import Cita
from app.models.profesional import Profesional
from app.models.usuario import Usuario
from app.models.notificacion import Notificacion
from app.models.configuracion import ConfiguracionSistema
from app.models.auditoria import Auditoria
from app.models.historial_estado_profesional import HistorialEstadoProfesional
from app.models.correo_log import CorreoLog
from app.routers.correos import simular_envio_correo
from app.schemas import (
    ProfesionalCreate, ProfesionalUpdate, ProfesionalOut,
    ConfiguracionOut, ConfiguracionUpdate, CitaCreate
)

router = APIRouter(prefix="/admin", tags=["administrador"])

RUTS_EXCLUIDOS_CGR = {"16.458.880-7", "19.741.131-7"}


def validar_rut(rut: str) -> bool:
    if not rut: return False
    rut_limpio = rut.replace(".", "").replace("-", "")
    if len(rut_limpio) < 2: return False
    cuerpo = rut_limpio[:-1]
    dv = rut_limpio[-1].upper()
    if not cuerpo.isdigit(): return False
    suma = 0; multi = 2
    for c in reversed(cuerpo):
        suma += int(c) * multi
        multi = 2 if multi == 7 else multi + 1
    dv_esperado = 11 - (suma % 11)
    dv_calc = "0" if dv_esperado == 11 else "K" if dv_esperado == 10 else str(dv_esperado)
    return dv == dv_calc


def registrar_auditoria(db, accion, detalle=None, entidad=None, entidad_id=None, usuario_id=None):
    db.add(Auditoria(usuario_id=usuario_id, accion=accion, detalle=detalle, entidad=entidad, entidad_id=entidad_id))


# ══════════════════════════════════════
# ESTADÍSTICAS
# ══════════════════════════════════════

@router.get("/estadisticas")
def get_estadisticas(db: Session = Depends(get_db)):
    hoy = date.today().isoformat()
    reservas_hoy = db.query(Cita).filter(Cita.fecha == hoy, Cita.estado == "pendiente").count()
    profesionales_activos = db.query(Profesional).filter(Profesional.estado == "activo").count()
    citas_hoy = db.query(Cita).filter(Cita.fecha == hoy, Cita.estado.in_(["pendiente","completada"])).count()
    horas_disponibles = max(0, (profesionales_activos * 10) - citas_hoy)
    urgentes = db.query(Cita).filter(Cita.urgente == True, Cita.estado == "pendiente").count()
    return {
        "reservas_hoy": reservas_hoy,
        "profesionales_activos": profesionales_activos,
        "horas_disponibles": horas_disponibles,
        "urgentes": urgentes
    }


# ══════════════════════════════════════
# RESUMEN DEL DÍA
# ══════════════════════════════════════

@router.get("/resumen-dia")
def get_resumen_dia(db: Session = Depends(get_db)):
    hoy = date.today().isoformat()
    profs = db.query(Profesional).all()
    result = []
    for p in profs:
        citas_hoy = db.query(Cita).filter(
            Cita.profesional_id == p.id,
            Cita.fecha == hoy,
            Cita.estado.in_(["pendiente","completada"])
        ).count()
        result.append({
            "profesional_id": p.id,
            "nombre": p.nombre,
            "especialidad": p.especialidad,
            "estado": p.estado or "activo",
            "citas_hoy": citas_hoy
        })
    return result


# ══════════════════════════════════════
# PRÓXIMAS CITAS — con fecha
# ══════════════════════════════════════

@router.get("/proximas-citas")
def get_proximas_citas(db: Session = Depends(get_db)):
    hoy = date.today().isoformat()
    citas = db.query(Cita).filter(
        Cita.fecha >= hoy, Cita.estado == "pendiente"
    ).order_by(Cita.fecha, Cita.hora).limit(20).all()
    result = []
    for c in citas:
        prof = db.query(Profesional).filter(Profesional.id == c.profesional_id).first()
        est  = db.query(Usuario).filter(Usuario.id == c.estudiante_id).first()
        result.append({
            "id":             c.id,
            "estudiante":     est.nombre        if est  else "—",
            "rut":            est.rut           if est  else "—",
            "especialidad":   prof.especialidad if prof else "—",
            "profesional":    prof.nombre       if prof else "—",
            "profesional_id": c.profesional_id,
            "fecha":          c.fecha,
            "hora":           c.hora,
            "urgente":        c.urgente or False,
            "estado":         c.estado
        })
    return result


# ══════════════════════════════════════
# BUSCAR ESTUDIANTE
# ══════════════════════════════════════

@router.get("/estudiantes")
def buscar_estudiantes(q: str = "", db: Session = Depends(get_db)):
    if len(q) < 2: return []
    estudiantes = db.query(Usuario).filter(
        Usuario.rol == "estudiante",
        (Usuario.nombre.ilike(f"%{q}%")) | (Usuario.rut.ilike(f"%{q}%"))
    ).limit(10).all()
    return [
        {"id": e.id, "nombre": e.nombre or "—", "rut": e.rut or "—",
         "carrera": e.carrera or "—", "correo": e.correo}
        for e in estudiantes
    ]


# ══════════════════════════════════════
# GRÁFICOS
# ══════════════════════════════════════

@router.get("/graficos/especialidad")
def get_grafico_especialidad(
    mes: int = None, anio: int = None,
    profesional_id: int = None, especialidad: str = None, carrera: str = None,
    db: Session = Depends(get_db)
):
    query = db.query(Profesional.especialidad, func.count(Cita.id))\
        .join(Cita, Cita.profesional_id == Profesional.id)\
        .join(Usuario, Cita.estudiante_id == Usuario.id)\
        .filter(Cita.estado.in_(["pendiente","completada"]))
    if mes and anio:
        query = query.filter(Cita.fecha.like(f"{anio}-{str(mes).zfill(2)}%"))
    elif anio:
        query = query.filter(Cita.fecha.like(f"{anio}%"))
    if profesional_id: query = query.filter(Cita.profesional_id == profesional_id)
    if especialidad:   query = query.filter(Profesional.especialidad == especialidad)
    if carrera:        query = query.filter(Usuario.carrera.ilike(f"%{carrera}%"))
    resultados = query.group_by(Profesional.especialidad).all()
    total = sum(r[1] for r in resultados) or 1
    return [{"especialidad": r[0], "cantidad": r[1], "porcentaje": round((r[1]/total)*100)} for r in resultados]


@router.get("/graficos/semana")
def get_grafico_semana(db: Session = Depends(get_db)):
    hoy = date.today()
    lunes = hoy - timedelta(days=hoy.weekday())
    dias = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"]
    result = []
    for i in range(7):
        dia = lunes + timedelta(days=i)
        count = db.query(Cita).filter(
            Cita.fecha == dia.isoformat(), Cita.estado.in_(["pendiente","completada"])
        ).count()
        result.append({"dia": dias[i], "fecha": dia.isoformat(), "cantidad": count})
    return result


# ══════════════════════════════════════
# GESTIÓN DE PROFESIONALES
# ══════════════════════════════════════

@router.get("/profesionales")
def get_profesionales_admin(db: Session = Depends(get_db)):
    return [
        {
            "id": p.id, "nombre": p.nombre, "especialidad": p.especialidad,
            "iniciales": p.iniciales, "descripcion": p.descripcion,
            "duracion_min": p.duracion_min, "estado": p.estado or "activo",
            "correo": p.correo, "rut": p.rut, "usuario_id": p.usuario_id,
            "foto_url": p.foto_url
        }
        for p in db.query(Profesional).all()
    ]


@router.post("/profesionales")
def crear_profesional(datos: ProfesionalCreate, db: Session = Depends(get_db)):
    if datos.rut and not validar_rut(datos.rut):
        raise HTTPException(status_code=400, detail="El RUT ingresado no es válido")
    iniciales = datos.iniciales
    if not iniciales and datos.nombre:
        partes = datos.nombre.split()
        iniciales = (partes[0][0] + partes[1][0]).upper() if len(partes) >= 2 else datos.nombre[:2].upper()
    nuevo_usuario = Usuario(correo=datos.correo, password=datos.password or "prof123",
                            rol="profesional", nombre=datos.nombre, activo=True)
    db.add(nuevo_usuario)
    db.commit()
    db.refresh(nuevo_usuario)
    nuevo_prof = Profesional(
        nombre=datos.nombre, especialidad=datos.especialidad, iniciales=iniciales,
        descripcion=datos.descripcion or "", duracion_min=datos.duracion_min or 45,
        correo=datos.correo, rut=datos.rut, estado="activo", usuario_id=nuevo_usuario.id
    )
    db.add(nuevo_prof)
    db.commit()
    db.refresh(nuevo_prof)
    registrar_auditoria(db, "Agregó profesional", f"{datos.nombre} — {datos.especialidad}", "profesional", nuevo_prof.id)
    db.commit()
    return nuevo_prof


@router.patch("/profesionales/{prof_id}")
def actualizar_profesional(prof_id: int, datos: ProfesionalUpdate, db: Session = Depends(get_db)):
    prof = db.query(Profesional).filter(Profesional.id == prof_id).first()
    if not prof:
        raise HTTPException(status_code=404, detail="Profesional no encontrado")
    if datos.rut and not validar_rut(datos.rut):
        raise HTTPException(status_code=400, detail="El RUT ingresado no es válido")
    if datos.nombre       is not None: prof.nombre       = datos.nombre
    if datos.especialidad is not None: prof.especialidad = datos.especialidad
    if datos.iniciales    is not None: prof.iniciales    = datos.iniciales
    if datos.descripcion  is not None: prof.descripcion  = datos.descripcion
    if datos.duracion_min is not None: prof.duracion_min = datos.duracion_min
    if datos.correo       is not None: prof.correo       = datos.correo
    if datos.rut          is not None: prof.rut          = datos.rut
    if datos.estado       is not None: prof.estado       = datos.estado
    if datos.nombre and prof.usuario_id:
        usuario = db.query(Usuario).filter(Usuario.id == prof.usuario_id).first()
        if usuario: usuario.nombre = datos.nombre
    registrar_auditoria(db, "Editó profesional", prof.nombre, "profesional", prof_id)
    db.commit()
    db.refresh(prof)
    return prof


@router.delete("/profesionales/{prof_id}")
def eliminar_profesional(prof_id: int, db: Session = Depends(get_db)):
    prof = db.query(Profesional).filter(Profesional.id == prof_id).first()
    if not prof:
        raise HTTPException(status_code=404, detail="Profesional no encontrado")
    citas = db.query(Cita).filter(Cita.profesional_id == prof_id, Cita.estado == "pendiente").all()
    for cita in citas:
        est = db.query(Usuario).filter(Usuario.id == cita.estudiante_id).first()
        cita.estado = "cancelada"; cita.cancelada_por_admin = True
        cita.motivo_cancelacion = "Profesional eliminado del sistema"
        db.add(Notificacion(usuario_id=cita.estudiante_id,
            mensaje=f"Tu cita del {cita.fecha} a las {cita.hora} fue cancelada porque el profesional ya no está disponible en SESAES.",
            tipo="cancelacion"))
        simular_envio_correo(db, destinatario=est.correo if est else "—",
            asunto="SESAES — Cancelación de cita",
            cuerpo=f"Tu cita del {cita.fecha} a las {cita.hora} fue cancelada.",
            tipo="cancelacion", referencia_id=cita.id)
    # Desactivar usuario en vez de eliminar (conserva historial)
    if prof.usuario_id:
        usuario = db.query(Usuario).filter(Usuario.id == prof.usuario_id).first()
        if usuario: usuario.activo = False
    nombre_prof = prof.nombre
    db.delete(prof)
    registrar_auditoria(db, "Eliminó profesional", f"{nombre_prof} — {len(citas)} citas canceladas", "profesional", prof_id)
    db.commit()
    return {"message": "Profesional eliminado correctamente"}


@router.patch("/profesionales/{prof_id}/estado")
def cambiar_estado_profesional(prof_id: int, body: dict, db: Session = Depends(get_db)):
    prof = db.query(Profesional).filter(Profesional.id == prof_id).first()
    if not prof:
        raise HTTPException(status_code=404, detail="Profesional no encontrado")
    estado_anterior = prof.estado or "activo"
    estado_nuevo    = body.get("estado", "activo")
    cancelar_citas  = body.get("cancelar_citas", False)
    fecha_afectada  = body.get("fecha", date.today().isoformat())
    motivo          = body.get("motivo")
    prof.estado = estado_nuevo
    db.add(HistorialEstadoProfesional(
        profesional_id=prof_id, estado_anterior=estado_anterior,
        estado_nuevo=estado_nuevo, motivo=motivo, registrado_por=None
    ))
    registrar_auditoria(db, "Cambió estado de profesional",
                        f"{prof.nombre}: {estado_anterior} → {estado_nuevo}", "profesional", prof_id)
    db.commit()
    if cancelar_citas:
        citas = db.query(Cita).filter(
            Cita.profesional_id == prof_id, Cita.fecha == fecha_afectada, Cita.estado == "pendiente"
        ).all()
        for cita in citas:
            est = db.query(Usuario).filter(Usuario.id == cita.estudiante_id).first()
            cita.estado = "cancelada"; cita.cancelada_por_admin = True
            cita.motivo_cancelacion = f"Profesional: {estado_nuevo}"
            db.add(Notificacion(usuario_id=cita.estudiante_id,
                mensaje="Tu cita fue cancelada por fuerza mayor. Puedes reagendar tu hora cuando lo desees desde tu dashboard.",
                tipo="cancelacion"))
            simular_envio_correo(db, destinatario=est.correo if est else "—",
                asunto="SESAES — Tu cita fue cancelada",
                cuerpo=f"Tu cita del {cita.fecha} a las {cita.hora} fue cancelada por fuerza mayor.",
                tipo="cancelacion", referencia_id=cita.id)
        registrar_auditoria(db, "Canceló citas masivas",
                            f"{prof.nombre} — {len(citas)} citas el {fecha_afectada}", "profesional", prof_id)
        db.commit()
        return {"message": f"Estado '{estado_nuevo}'. {len(citas)} citas canceladas.", "citas_canceladas": len(citas)}
    return {"message": f"Estado actualizado a '{estado_nuevo}'"}


@router.get("/profesionales/{prof_id}/historial-estados")
def get_historial_estados(prof_id: int, db: Session = Depends(get_db)):
    registros = db.query(HistorialEstadoProfesional).filter(
        HistorialEstadoProfesional.profesional_id == prof_id
    ).order_by(HistorialEstadoProfesional.fecha.desc()).all()
    return [{"id": r.id, "estado_anterior": r.estado_anterior, "estado_nuevo": r.estado_nuevo,
             "motivo": r.motivo, "fecha": r.fecha.isoformat() if r.fecha else None} for r in registros]


# ══════════════════════════════════════
# CITAS URGENTES
# ══════════════════════════════════════

@router.post("/citas/urgente")
def crear_cita_urgente(cita: CitaCreate, db: Session = Depends(get_db)):
    prof = db.query(Profesional).filter(Profesional.id == cita.profesional_id).first()
    if not prof: raise HTTPException(status_code=404, detail="Profesional no encontrado")
    est = db.query(Usuario).filter(Usuario.id == cita.estudiante_id).first()
    nueva = Cita(estudiante_id=cita.estudiante_id, profesional_id=cita.profesional_id,
                 fecha=cita.fecha, hora=cita.hora, observaciones=cita.observaciones,
                 estado="pendiente", urgente=True)
    db.add(nueva); db.commit(); db.refresh(nueva)
    simular_envio_correo(db, destinatario=est.correo if est else "—",
        asunto="SESAES — Cita urgente agendada",
        cuerpo=f"Se agendó una cita URGENTE para el {cita.fecha} a las {cita.hora} con {prof.nombre}.",
        tipo="urgente", referencia_id=nueva.id)
    registrar_auditoria(db, "Creó cita urgente",
                        f"Estudiante: {est.nombre if est else cita.estudiante_id} — {prof.nombre} ({cita.fecha} {cita.hora})",
                        "cita", nueva.id)
    db.commit()
    return {"id": nueva.id, "profesional": prof.nombre, "especialidad": prof.especialidad,
            "fecha": nueva.fecha, "hora": nueva.hora, "urgente": True, "estado": nueva.estado}


@router.patch("/citas/{cita_id}/cancelar")
def cancelar_cita_admin(cita_id: int, body: dict, db: Session = Depends(get_db)):
    cita = db.query(Cita).filter(Cita.id == cita_id).first()
    if not cita: raise HTTPException(status_code=404, detail="Cita no encontrada")
    est  = db.query(Usuario).filter(Usuario.id == cita.estudiante_id).first()
    prof = db.query(Profesional).filter(Profesional.id == cita.profesional_id).first()
    motivo = body.get("motivo", "Cancelada por administrador")
    cita.estado = "cancelada"; cita.cancelada_por_admin = True; cita.motivo_cancelacion = motivo
    db.add(Notificacion(usuario_id=cita.estudiante_id,
        mensaje="Tu cita fue cancelada por fuerza mayor. Puedes reagendar tu hora cuando lo desees desde tu dashboard.",
        tipo="cancelacion"))
    simular_envio_correo(db, destinatario=est.correo if est else "—",
        asunto="SESAES — Tu cita fue cancelada",
        cuerpo=f"Tu cita del {cita.fecha} a las {cita.hora} con {prof.nombre if prof else ''} fue cancelada.",
        tipo="cancelacion", referencia_id=cita_id)
    registrar_auditoria(db, "Canceló cita",
                        f"Estudiante: {est.nombre if est else '—'} — {prof.nombre if prof else '—'} — {cita.fecha} {cita.hora}",
                        "cita", cita_id)
    db.commit()
    return {"message": "Cita cancelada y estudiante notificado"}


# ══════════════════════════════════════
# HISTORIAL CON FILTROS — fix búsqueda
# ══════════════════════════════════════

@router.get("/historial")
def get_historial_admin(
    estudiante: str = None, fecha_inicio: str = None, fecha_fin: str = None,
    especialidad: str = None, estado: str = None, profesional_id: int = None,
    carrera: str = None, db: Session = Depends(get_db)
):
    query = db.query(Cita)\
        .join(Profesional, Cita.profesional_id == Profesional.id)\
        .join(Usuario, Cita.estudiante_id == Usuario.id)
    if estudiante:
        q = f"%{estudiante}%"
        query = query.filter((Usuario.nombre.ilike(q)) | (Usuario.rut.ilike(q)))
    if fecha_inicio:   query = query.filter(Cita.fecha >= fecha_inicio)
    if fecha_fin:      query = query.filter(Cita.fecha <= fecha_fin)
    if especialidad:   query = query.filter(Profesional.especialidad == especialidad)
    if estado:         query = query.filter(Cita.estado == estado)
    if profesional_id: query = query.filter(Cita.profesional_id == profesional_id)
    if carrera:        query = query.filter(Usuario.carrera.ilike(f"%{carrera}%"))
    citas = query.order_by(Cita.fecha.desc()).all()
    result = []
    for c in citas:
        prof = db.query(Profesional).filter(Profesional.id == c.profesional_id).first()
        est  = db.query(Usuario).filter(Usuario.id == c.estudiante_id).first()
        result.append({
            "id": c.id, "estudiante": est.nombre if est else "—",
            "rut": est.rut if est else "—", "carrera": est.carrera if est else "—",
            "especialidad": prof.especialidad if prof else "—",
            "profesional": prof.nombre if prof else "—",
            "iniciales": prof.iniciales if prof else "??",
            "fecha": c.fecha, "hora": c.hora, "estado": c.estado,
            "urgente": c.urgente or False, "tiene_pdf": c.estado == "completada",
            "medicamento": c.medicamento, "observaciones_atencion": c.observaciones_atencion
        })
    return result


# ══════════════════════════════════════
# NOTIFICACIONES DEL ADMIN
# ══════════════════════════════════════

@router.get("/notificaciones")
def get_notificaciones_admin(db: Session = Depends(get_db)):
    admin = db.query(Usuario).filter(Usuario.rol == "admin").first()
    if not admin: return []
    notifs = db.query(Notificacion).filter(
        Notificacion.usuario_id == admin.id
    ).order_by(Notificacion.fecha_creacion.desc()).limit(100).all()
    return [
        {"id": n.id, "mensaje": n.mensaje, "tipo": n.tipo, "leida": n.leida,
         "fecha_creacion": n.fecha_creacion.isoformat() if n.fecha_creacion else None}
        for n in notifs
    ]


# ══════════════════════════════════════
# EXPORTACIÓN CGR
# ══════════════════════════════════════

@router.get("/exportar/cgr")
def exportar_cgr(anio: int, fecha_fin: str = None, db: Session = Depends(get_db)):
    query = db.query(Cita)\
        .join(Profesional, Cita.profesional_id == Profesional.id)\
        .join(Usuario, Cita.estudiante_id == Usuario.id)\
        .filter(Cita.fecha.like(f"{anio}%"), Cita.estado.in_(["completada","pendiente"]))
    if fecha_fin: query = query.filter(Cita.fecha <= fecha_fin)
    citas = query.order_by(Cita.fecha).all()
    headers = ["Nombre Completo","RUT","Tipo de Atención","Fecha","Hora","Medicamento Suministrado","Profesional que Atendió"]
    filas = ["\t".join(headers)]
    for c in citas:
        est  = db.query(Usuario).filter(Usuario.id == c.estudiante_id).first()
        prof = db.query(Profesional).filter(Profesional.id == c.profesional_id).first()
        rut_est = est.rut if est else ""
        if rut_est in RUTS_EXCLUIDOS_CGR: continue
        filas.append("\t".join([
            est.nombre if est else "—", rut_est or "—",
            prof.especialidad if prof else "—", c.fecha, c.hora,
            c.medicamento or "No aplica", prof.nombre if prof else "—"
        ]))
    contenido = "\n".join(filas)
    nombre_archivo = f"cgr_atenciones_{anio}" + (f"_hasta_{fecha_fin}" if fecha_fin else "") + ".xls"
    return StreamingResponse(io.BytesIO(contenido.encode("utf-8-sig")),
        media_type="text/tab-separated-values",
        headers={"Content-Disposition": f"attachment; filename={nombre_archivo}"})


@router.get("/exportar/alumnos")
def exportar_listado_alumnos(db: Session = Depends(get_db)):
    estudiantes = db.query(Usuario).filter(Usuario.rol == "estudiante").order_by(Usuario.nombre).all()
    filas = ["Nombre Completo\tRUT\tCarrera\tCorreo"]
    for e in estudiantes:
        if e.rut in RUTS_EXCLUIDOS_CGR: continue
        filas.append(f"{e.nombre or '—'}\t{e.rut or '—'}\t{e.carrera or '—'}\t{e.correo or '—'}")
    contenido = "\n".join(filas)
    return StreamingResponse(io.BytesIO(contenido.encode("utf-8-sig")),
        media_type="text/tab-separated-values",
        headers={"Content-Disposition": "attachment; filename=listado_alumnos.xls"})


# ══════════════════════════════════════
# AUDITORÍA — con fix de filtro por fecha
# ══════════════════════════════════════

@router.get("/auditoria")
def get_auditoria(fecha_inicio: str = None, fecha_fin: str = None, db: Session = Depends(get_db)):
    query = db.query(Auditoria).order_by(Auditoria.fecha.desc())
    if fecha_inicio:
        query = query.filter(Auditoria.fecha >= datetime.strptime(fecha_inicio, "%Y-%m-%d"))
    if fecha_fin:
        query = query.filter(Auditoria.fecha <= datetime.strptime(fecha_fin, "%Y-%m-%d").replace(hour=23, minute=59, second=59))
    registros = query.limit(200).all()
    return [
        {"id": r.id, "accion": r.accion, "detalle": r.detalle,
         "entidad": r.entidad, "entidad_id": r.entidad_id,
         "fecha": r.fecha.isoformat() if r.fecha else None}
        for r in registros
    ]


@router.delete("/auditoria/{auditoria_id}")
def eliminar_auditoria(auditoria_id: int, db: Session = Depends(get_db)):
    registro = db.query(Auditoria).filter(Auditoria.id == auditoria_id).first()
    if registro:
        db.delete(registro)
        db.commit()
    return {"message": "Registro eliminado"}


@router.delete("/auditoria")
def eliminar_toda_auditoria(db: Session = Depends(get_db)):
    db.query(Auditoria).delete()
    db.commit()
    return {"message": "Toda la auditoría eliminada"}


# ══════════════════════════════════════
# CONFIGURACIÓN
# ══════════════════════════════════════

@router.get("/configuracion", response_model=ConfiguracionOut)
def get_configuracion(db: Session = Depends(get_db)):
    config = db.query(ConfiguracionSistema).first()
    if not config: raise HTTPException(status_code=404, detail="Configuración no encontrada")
    return config


@router.patch("/configuracion", response_model=ConfiguracionOut)
def actualizar_configuracion(datos: ConfiguracionUpdate, db: Session = Depends(get_db)):
    config = db.query(ConfiguracionSistema).first()
    if not config: raise HTTPException(status_code=404, detail="Configuración no encontrada")
    if datos.duracion_turno_min         is not None: config.duracion_turno_min         = datos.duracion_turno_min
    if datos.agendamiento_por_pacientes is not None: config.agendamiento_por_pacientes = datos.agendamiento_por_pacientes
    if datos.cancelacion_instantanea    is not None: config.cancelacion_instantanea    = datos.cancelacion_instantanea
    if datos.sobreturnos_habilitados    is not None: config.sobreturnos_habilitados    = datos.sobreturnos_habilitados
    if datos.cupos_por_turno            is not None: config.cupos_por_turno            = datos.cupos_por_turno
    db.commit(); db.refresh(config)
    return config