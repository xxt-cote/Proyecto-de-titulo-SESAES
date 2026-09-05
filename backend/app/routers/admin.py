import re
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from datetime import datetime, date, timedelta
import io

from app.database import get_db
from app.security import hash_password
from app.models.cita import Cita
from app.models.profesional import Profesional
from app.models.usuario import Usuario
from app.models.notificacion import Notificacion
from app.models.configuracion import ConfiguracionSistema
from app.models.auditoria import Auditoria
from app.models.historial_estado_profesional import HistorialEstadoProfesional
from app.models.correo_log import CorreoLog
from app.models.dia_cerrado import DiaCerrado
from app.routers.correos import simular_envio_correo
from app.schemas import (
    ProfesionalCreate, ProfesionalUpdate, ProfesionalOut,
    ConfiguracionOut, ConfiguracionUpdate, CitaCreate,
    color_identificador_es_valido
)
from app.rbac.dependencies import require_permission
from app.rbac.permissions import Permission



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
def get_estadisticas(db: Session = Depends(get_db), current_user: dict = Depends(require_permission(Permission.REPORTES_VER))):
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
def get_resumen_dia(db: Session = Depends(get_db), current_user: dict = Depends(require_permission(Permission.AGENDA_GESTIONAR))):
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
            "tratamiento": p.tratamiento,
            "especialidad": p.especialidad,
            "color_identificador": p.color_identificador,
            "estado": p.estado or "activo",
            "citas_hoy": citas_hoy
        })
    return result


# ══════════════════════════════════════
# PRÓXIMAS CITAS — con fecha
# ══════════════════════════════════════

@router.get("/proximas-citas")
def get_proximas_citas(db: Session = Depends(get_db), current_user: dict = Depends(require_permission(Permission.AGENDA_GESTIONAR))):
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
def buscar_estudiantes(q: str = "", db: Session = Depends(get_db), current_user: dict = Depends(require_permission(Permission.USUARIOS_GESTIONAR))):
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


@router.get("/estudiantes/listado")
def listar_estudiantes(
    q: str = "", carrera: str = "", pagina: int = 1, por_pagina: int = 20,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission(Permission.USUARIOS_GESTIONAR))
):
    """
    Listado completo de estudiantes (con paginación), a diferencia de
    /estudiantes que solo sirve para autocompletar una búsqueda puntual.
    Incluye el conteo de citas totales y atendidas de cada estudiante,
    calculado con una sola consulta agregada para no golpear la base
    de datos una vez por estudiante.
    """
    query = db.query(Usuario).filter(Usuario.rol == "estudiante")
    if q:
        query = query.filter(
            (Usuario.nombre.ilike(f"%{q}%")) | (Usuario.rut.ilike(f"%{q}%"))
        )
    if carrera:
        query = query.filter(Usuario.carrera.ilike(f"%{carrera}%"))

    total = query.count()
    estudiantes = (
        query.order_by(Usuario.nombre)
        .offset((pagina - 1) * por_pagina)
        .limit(por_pagina)
        .all()
    )

    ids = [e.id for e in estudiantes]
    conteos = dict(
        db.query(Cita.estudiante_id, func.count(Cita.id))
        .filter(Cita.estudiante_id.in_(ids))
        .group_by(Cita.estudiante_id)
        .all()
    ) if ids else {}
    atendidas = dict(
        db.query(Cita.estudiante_id, func.count(Cita.id))
        .filter(Cita.estudiante_id.in_(ids), Cita.estado == "completada")
        .group_by(Cita.estudiante_id)
        .all()
    ) if ids else {}

    return {
        "total": total,
        "pagina": pagina,
        "por_pagina": por_pagina,
        "estudiantes": [
            {
                "id": e.id, "nombre": e.nombre or "—", "rut": e.rut or "—",
                "carrera": e.carrera or "—", "correo": e.correo,
                "citas_totales": conteos.get(e.id, 0),
                "citas_atendidas": atendidas.get(e.id, 0),
            }
            for e in estudiantes
        ],
    }


@router.get("/estudiantes/{estudiante_id}/perfil")
def perfil_estudiante_admin(estudiante_id: int, db: Session = Depends(get_db), current_user: dict = Depends(require_permission(Permission.USUARIOS_GESTIONAR))):
    """Ficha de un estudiante puntual: sus datos + sus últimas atenciones."""
    est = db.query(Usuario).filter(Usuario.id == estudiante_id, Usuario.rol == "estudiante").first()
    if not est:
        raise HTTPException(status_code=404, detail="Estudiante no encontrado")

    citas = (
        db.query(Cita)
        .filter(Cita.estudiante_id == estudiante_id)
        .order_by(Cita.fecha.desc())
        .limit(10)
        .all()
    )
    ultimas = []
    for c in citas:
        prof = db.query(Profesional).filter(Profesional.id == c.profesional_id).first()
        ultimas.append({
            "id": c.id, "fecha": c.fecha, "hora": c.hora, "estado": c.estado,
            "especialidad": prof.especialidad if prof else "—",
            "profesional": prof.nombre if prof else "—",
        })

    total = db.query(func.count(Cita.id)).filter(Cita.estudiante_id == estudiante_id).scalar()
    atendidas = db.query(func.count(Cita.id)).filter(
        Cita.estudiante_id == estudiante_id, Cita.estado == "completada"
    ).scalar()

    return {
        "id": est.id, "nombre": est.nombre or "—", "rut": est.rut or "—",
        "carrera": est.carrera or "—", "correo": est.correo,
        "citas_totales": total, "citas_atendidas": atendidas,
        "ultimas_atenciones": ultimas,
    }


# ══════════════════════════════════════
# GRÁFICOS
# ══════════════════════════════════════

@router.get("/graficos/especialidad")
def get_grafico_especialidad(
    mes: int = None, anio: int = None,
    profesional_id: int = None, especialidad: str = None, carrera: str = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission(Permission.REPORTES_VER))
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
def get_grafico_semana(db: Session = Depends(get_db), current_user: dict = Depends(require_permission(Permission.REPORTES_VER))):
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
def get_profesionales_admin(db: Session = Depends(get_db), current_user: dict = Depends(require_permission(Permission.PROFESIONALES_GESTIONAR))):
    return [
        {
            "id": p.id, "nombre": p.nombre, "tratamiento": p.tratamiento,
            "especialidad": p.especialidad,
            "iniciales": p.iniciales, "descripcion": p.descripcion,
            "duracion_min": p.duracion_min, "estado": p.estado or "activo",
            "correo": p.correo, "rut": p.rut, "usuario_id": p.usuario_id,
            "foto_url": p.foto_url, "color_identificador": p.color_identificador
        }
        for p in db.query(Profesional).all()
    ]


@router.post("/profesionales")
def crear_profesional(datos: ProfesionalCreate, db: Session = Depends(get_db), current_user: dict = Depends(require_permission(Permission.PROFESIONALES_GESTIONAR))):
    if datos.rut and not validar_rut(datos.rut):
        raise HTTPException(status_code=400, detail="El RUT ingresado no es válido")
    if not color_identificador_es_valido(datos.color_identificador):
        raise HTTPException(status_code=400, detail="Color identificador no permitido")
    iniciales = datos.iniciales
    if not iniciales and datos.nombre:
        partes = datos.nombre.split()
        iniciales = (partes[0][0] + partes[1][0]).upper() if len(partes) >= 2 else datos.nombre[:2].upper()
    nuevo_usuario = Usuario(correo=datos.correo, password=hash_password(datos.password or "prof123"),
                            rol="profesional", nombre=datos.nombre, activo=True)
    db.add(nuevo_usuario)
    db.commit()
    db.refresh(nuevo_usuario)
    nuevo_prof = Profesional(
        nombre=datos.nombre, tratamiento=datos.tratamiento, especialidad=datos.especialidad, iniciales=iniciales,
        descripcion=datos.descripcion or "", duracion_min=datos.duracion_min or 45,
        correo=datos.correo, rut=datos.rut, estado="activo", usuario_id=nuevo_usuario.id,
        color_identificador=datos.color_identificador
    )
    db.add(nuevo_prof)
    db.commit()
    db.refresh(nuevo_prof)
    registrar_auditoria(db, "Agregó profesional", f"{datos.nombre} — {datos.especialidad}", "profesional", nuevo_prof.id)
    db.commit()
    return nuevo_prof


@router.patch("/profesionales/{prof_id}")
def actualizar_profesional(prof_id: int, datos: ProfesionalUpdate, db: Session = Depends(get_db), current_user: dict = Depends(require_permission(Permission.PROFESIONALES_GESTIONAR))):
    prof = db.query(Profesional).filter(Profesional.id == prof_id).first()
    if not prof:
        raise HTTPException(status_code=404, detail="Profesional no encontrado")
    if datos.rut and not validar_rut(datos.rut):
        raise HTTPException(status_code=400, detail="El RUT ingresado no es válido")
    if "color_identificador" in datos.model_fields_set and not color_identificador_es_valido(datos.color_identificador):
        raise HTTPException(status_code=400, detail="Color identificador no permitido")
    if datos.nombre       is not None: prof.nombre       = datos.nombre
    # tratamiento y color_identificador son los campos de este endpoint que
    # distinguen "no enviado" (conservar) de "enviado como null" (limpiar),
    # porque son los únicos casos reales de "quitar un valor existente" que
    # pide el negocio. El resto de los campos mantiene exactamente su
    # semántica anterior (solo se tocan si vienen no-None).
    if "tratamiento" in datos.model_fields_set: prof.tratamiento = datos.tratamiento
    if "color_identificador" in datos.model_fields_set: prof.color_identificador = datos.color_identificador
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
def eliminar_profesional(prof_id: int, db: Session = Depends(get_db), current_user: dict = Depends(require_permission(Permission.PROFESIONALES_GESTIONAR))):
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
    if prof.usuario_id:
        usuario = db.query(Usuario).filter(Usuario.id == prof.usuario_id).first()
        if usuario: usuario.activo = False
    nombre_prof = prof.nombre
    db.delete(prof)
    registrar_auditoria(db, "Eliminó profesional", f"{nombre_prof} — {len(citas)} citas canceladas", "profesional", prof_id)
    db.commit()
    return {"message": "Profesional eliminado correctamente"}


@router.patch("/profesionales/{prof_id}/estado")
def cambiar_estado_profesional(prof_id: int, body: dict, db: Session = Depends(get_db), current_user: dict = Depends(require_permission(Permission.PROFESIONALES_GESTIONAR))):
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
def get_historial_estados(prof_id: int, db: Session = Depends(get_db), current_user: dict = Depends(require_permission(Permission.PROFESIONALES_GESTIONAR))):
    registros = db.query(HistorialEstadoProfesional).filter(
        HistorialEstadoProfesional.profesional_id == prof_id
    ).order_by(HistorialEstadoProfesional.fecha.desc()).all()
    return [{"id": r.id, "estado_anterior": r.estado_anterior, "estado_nuevo": r.estado_nuevo,
             "motivo": r.motivo, "fecha": r.fecha.isoformat() if r.fecha else None} for r in registros]


# ══════════════════════════════════════
# CITAS URGENTES
# ══════════════════════════════════════

@router.post("/citas/urgente")
def crear_cita_urgente(cita: CitaCreate, db: Session = Depends(get_db), current_user: dict = Depends(require_permission(Permission.AGENDA_GESTIONAR))):
    if db.query(DiaCerrado).filter(DiaCerrado.fecha == cita.fecha).first():
        raise HTTPException(status_code=400, detail="El centro permanece cerrado ese día. Elige otra fecha.")

    prof = db.query(Profesional).filter(Profesional.id == cita.profesional_id).first()
    if not prof: raise HTTPException(status_code=404, detail="Profesional no encontrado")
    est = db.query(Usuario).filter(Usuario.id == cita.estudiante_id).first()
    if not est or est.rol != "estudiante":
        raise HTTPException(
            status_code=400,
            detail="El paciente seleccionado no corresponde a una cuenta de estudiante."
        )
    nueva = Cita(estudiante_id=cita.estudiante_id, profesional_id=cita.profesional_id,
                 fecha=cita.fecha, hora=cita.hora, observaciones=cita.observaciones,
                 estado="pendiente", urgente=True)
    db.add(nueva)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Esa hora acaba de ser reservada por otra persona. Por favor elige otra."
        )
    db.refresh(nueva)
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
def cancelar_cita_admin(cita_id: int, body: dict, db: Session = Depends(get_db), current_user: dict = Depends(require_permission(Permission.AGENDA_GESTIONAR))):
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


@router.patch("/citas/{cita_id}/prioridad")
def cambiar_prioridad_cita(cita_id: int, body: dict, db: Session = Depends(get_db), current_user: dict = Depends(require_permission(Permission.AGENDA_GESTIONAR))):
    """
    A diferencia de POST /citas/urgente (que crea una cita NUEVA ya marcada
    urgente), este endpoint toma una cita EXISTENTE — pendiente o confirmada —
    y le cambia la prioridad. Solo el administrador puede hacerlo; el
    estudiante no puede autoasignarse prioridad urgente.
    body: {"urgente": true} o {"urgente": false}
    """
    cita = db.query(Cita).filter(Cita.id == cita_id).first()
    if not cita:
        raise HTTPException(status_code=404, detail="Cita no encontrada")
    if cita.estado in ("cancelada", "completada"):
        raise HTTPException(
            status_code=400,
            detail="No se puede cambiar la prioridad de una cita cancelada o ya completada."
        )

    nuevo_valor = bool(body.get("urgente", False))
    cita.urgente = nuevo_valor

    est  = db.query(Usuario).filter(Usuario.id == cita.estudiante_id).first()
    prof = db.query(Profesional).filter(Profesional.id == cita.profesional_id).first()

    if nuevo_valor:
        db.add(Notificacion(usuario_id=cita.estudiante_id,
            mensaje=f"Tu cita del {cita.fecha} a las {cita.hora} fue marcada como urgente por administración.",
            tipo="urgente"))

    registrar_auditoria(
        db,
        "Marcó cita como urgente" if nuevo_valor else "Quitó prioridad urgente a cita",
        f"Estudiante: {est.nombre if est else '—'} — {prof.nombre if prof else '—'} — {cita.fecha} {cita.hora}",
        "cita", cita_id
    )
    db.commit()
    return {"id": cita.id, "urgente": cita.urgente, "estado": cita.estado}


# ══════════════════════════════════════
# DÍAS CERRADOS — el centro completo no atiende ese día
# ══════════════════════════════════════
# A diferencia de un feriado "normal" (que solo se marca visualmente, sin
# bloquear el agendamiento), un día cerrado SÍ bloquea por completo el
# agendamiento para cualquier profesional, y cancela + notifica
# automáticamente cualquier cita que ya existiera para esa fecha.

@router.get("/dias-cerrados")
def listar_dias_cerrados(db: Session = Depends(get_db), current_user: dict = Depends(require_permission(Permission.AGENDA_GESTIONAR))):
    dias = db.query(DiaCerrado).order_by(DiaCerrado.fecha).all()
    return [
        {"id": d.id, "fecha": d.fecha, "motivo": d.motivo, "fecha_creacion": d.fecha_creacion}
        for d in dias
    ]


@router.post("/dias-cerrados")
def crear_dia_cerrado(body: dict, db: Session = Depends(get_db), current_user: dict = Depends(require_permission(Permission.AGENDA_GESTIONAR))):
    fecha  = body.get("fecha")
    motivo = body.get("motivo") or "El centro permanecerá cerrado este día."
    if not fecha:
        raise HTTPException(status_code=400, detail="Debes indicar la fecha a cerrar.")

    ya_existe = db.query(DiaCerrado).filter(DiaCerrado.fecha == fecha).first()
    if ya_existe:
        raise HTTPException(status_code=400, detail="Ese día ya está marcado como cerrado.")

    dia = DiaCerrado(fecha=fecha, motivo=motivo, creado_por=current_user["id"])
    db.add(dia)

    # Cancelar y notificar TODAS las citas pendientes de ese día,
    # sin importar el profesional.
    citas_afectadas = db.query(Cita).filter(Cita.fecha == fecha, Cita.estado == "pendiente").all()
    detalle_citas_canceladas = []
    for cita in citas_afectadas:
        cita.estado = "cancelada"
        cita.cancelada_por_admin = True
        cita.motivo_cancelacion = f"El centro permanecerá cerrado el {fecha}. {motivo}"

        est = db.query(Usuario).filter(Usuario.id == cita.estudiante_id).first()
        prof = db.query(Profesional).filter(Profesional.id == cita.profesional_id).first()

        detalle_citas_canceladas.append({
            "cita_id": cita.id,
            "estudiante": est.nombre if est else "—",
            "rut": est.rut if est else "—",
            "correo": est.correo if est else "—",
            "profesional": prof.nombre if prof else "—",
            "especialidad": prof.especialidad if prof else "—",
            "hora": cita.hora,
        })

        db.add(Notificacion(
            usuario_id=cita.estudiante_id,
            mensaje=f"Tu cita del {fecha} fue cancelada: el centro permanecerá cerrado ese día. "
                    f"Puedes reagendar cuando quieras desde tu dashboard.",
            tipo="cancelacion"
        ))
        simular_envio_correo(db,
            destinatario=est.correo if est else "—",
            asunto="SESAES — Tu cita fue cancelada (centro cerrado)",
            cuerpo=f"Tu cita del {fecha} a las {cita.hora} con {prof.nombre if prof else ''} fue cancelada "
                   f"porque el centro permanecerá cerrado ese día. Motivo: {motivo}. "
                   f"Puedes reagendar cuando quieras desde tu dashboard.",
            tipo="cancelacion", referencia_id=cita.id
        )

    registrar_auditoria(db, "Cerró el centro un día completo",
                        f"{fecha} — {motivo} ({len(citas_afectadas)} citas canceladas y notificadas)",
                        "dia_cerrado", None)
    db.commit()
    db.refresh(dia)
    return {
        "message": f"Día {fecha} cerrado correctamente.",
        "id": dia.id,
        "citas_canceladas": len(citas_afectadas),
        "detalle_citas_canceladas": detalle_citas_canceladas
    }


@router.get("/dias-cerrados/{dia_id}/citas")
def citas_canceladas_por_dia_cerrado(dia_id: int, db: Session = Depends(get_db), current_user: dict = Depends(require_permission(Permission.AGENDA_GESTIONAR))):
    """
    Detalle de las citas que se cancelaron cuando se cerró este día —
    para que el admin lo tenga a mano si el estudiante llama a preguntar
    o pedir que le reagenden.
    """
    dia = db.query(DiaCerrado).filter(DiaCerrado.id == dia_id).first()
    if not dia:
        raise HTTPException(status_code=404, detail="Día cerrado no encontrado")

    citas = db.query(Cita).filter(
        Cita.fecha == dia.fecha,
        Cita.cancelada_por_admin == True  # noqa: E712
    ).all()

    resultado = []
    for cita in citas:
        est = db.query(Usuario).filter(Usuario.id == cita.estudiante_id).first()
        prof = db.query(Profesional).filter(Profesional.id == cita.profesional_id).first()
        resultado.append({
            "cita_id": cita.id,
            "estudiante": est.nombre if est else "—",
            "rut": est.rut if est else "—",
            "correo": est.correo if est else "—",
            "profesional": prof.nombre if prof else "—",
            "especialidad": prof.especialidad if prof else "—",
            "hora": cita.hora,
        })
    return resultado


@router.delete("/dias-cerrados/{dia_id}")
def eliminar_dia_cerrado(dia_id: int, db: Session = Depends(get_db), current_user: dict = Depends(require_permission(Permission.AGENDA_GESTIONAR))):
    dia = db.query(DiaCerrado).filter(DiaCerrado.id == dia_id).first()
    if not dia:
        raise HTTPException(status_code=404, detail="Día cerrado no encontrado")
    registrar_auditoria(db, "Reabrió un día previamente cerrado", dia.fecha, "dia_cerrado", dia_id)
    db.delete(dia)
    db.commit()
    return {"message": "Día reabierto correctamente. Las citas ya canceladas no se restauran automáticamente."}


# ══════════════════════════════════════
# HISTORIAL CON FILTROS — fix búsqueda
# ══════════════════════════════════════

@router.get("/historial")
def get_historial_admin(
    estudiante: str = None, fecha_inicio: str = None, fecha_fin: str = None,
    especialidad: str = None, estado: str = None, profesional_id: int = None,
    carrera: str = None, db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission(Permission.REPORTES_VER))
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
            "urgente": c.urgente or False, "tiene_pdf": c.estado == "completada"
        })
    return result


# ══════════════════════════════════════
# NOTIFICACIONES DEL ADMIN
# ══════════════════════════════════════

@router.get("/notificaciones")
def get_notificaciones_admin(db: Session = Depends(get_db), current_user: dict = Depends(require_permission(Permission.USUARIOS_GESTIONAR))):
    usuario_id = current_user["id"]
    notifs = db.query(Notificacion).filter(
        Notificacion.usuario_id == usuario_id
    ).order_by(Notificacion.fecha_creacion.desc()).limit(100).all()
    return [
        {"id": n.id, "mensaje": n.mensaje, "tipo": n.tipo, "leida": n.leida,
         "fecha_creacion": n.fecha_creacion.isoformat() if n.fecha_creacion else None}
        for n in notifs
    ]


# ══════════════════════════════════════
# EXPORTACIÓN CGR
# ══════════════════════════════════════
# Solo se incluyen atenciones "completada" — un reporte de este tipo
# debe reflejar atenciones que realmente ocurrieron, no citas agendadas
# (pendiente) que todavía no se realizan.

@router.get("/exportar/cgr")
def exportar_cgr(anio: int, fecha_fin: str = None, db: Session = Depends(get_db), current_user: dict = Depends(require_permission(Permission.REPORTES_CGR_EXPORTAR))):
    query = db.query(Cita)\
        .join(Profesional, Cita.profesional_id == Profesional.id)\
        .join(Usuario, Cita.estudiante_id == Usuario.id)\
        .filter(Cita.fecha.like(f"{anio}%"), Cita.estado == "completada")
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
def exportar_listado_alumnos(db: Session = Depends(get_db), current_user: dict = Depends(require_permission(Permission.REPORTES_CGR_EXPORTAR))):
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
def get_auditoria(fecha_inicio: str = None, fecha_fin: str = None, db: Session = Depends(get_db), current_user: dict = Depends(require_permission(Permission.AUDITORIA_VER))):
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
def eliminar_auditoria(auditoria_id: int, db: Session = Depends(get_db), current_user: dict = Depends(require_permission(Permission.AUDITORIA_GESTIONAR))):
    registro = db.query(Auditoria).filter(Auditoria.id == auditoria_id).first()
    if registro:
        db.delete(registro)
        db.commit()
    return {"message": "Registro eliminado"}


@router.delete("/auditoria")
def eliminar_toda_auditoria(db: Session = Depends(get_db), current_user: dict = Depends(require_permission(Permission.AUDITORIA_GESTIONAR))):
    db.query(Auditoria).delete()
    db.commit()
    return {"message": "Toda la auditoría eliminada"}


# ══════════════════════════════════════
# CONFIGURACIÓN
# ══════════════════════════════════════

@router.get("/configuracion", response_model=ConfiguracionOut)
def get_configuracion(db: Session = Depends(get_db), current_user: dict = Depends(require_permission(Permission.CONFIGURACION_GESTIONAR))):
    config = db.query(ConfiguracionSistema).first()
    if not config:
        # La tabla nunca se siembra en init_db.py — se crea con los
        # valores por defecto del modelo la primera vez que se consulta,
        # en vez de forzar al admin a chocar con un 404 en su primera visita.
        config = ConfiguracionSistema()
        db.add(config); db.commit(); db.refresh(config)
    return config


@router.patch("/configuracion", response_model=ConfiguracionOut)
def actualizar_configuracion(datos: ConfiguracionUpdate, db: Session = Depends(get_db), current_user: dict = Depends(require_permission(Permission.CONFIGURACION_GESTIONAR))):
    config = db.query(ConfiguracionSistema).first()
    if not config:
        config = ConfiguracionSistema()
        db.add(config); db.commit(); db.refresh(config)
    if datos.duracion_turno_min         is not None: config.duracion_turno_min         = datos.duracion_turno_min
    if datos.agendamiento_por_pacientes is not None: config.agendamiento_por_pacientes = datos.agendamiento_por_pacientes
    if datos.cancelacion_instantanea    is not None: config.cancelacion_instantanea    = datos.cancelacion_instantanea
    if datos.sobreturnos_habilitados    is not None: config.sobreturnos_habilitados    = datos.sobreturnos_habilitados
    if datos.cupos_por_turno            is not None: config.cupos_por_turno            = datos.cupos_por_turno
    db.commit(); db.refresh(config)
    return config