from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from datetime import datetime
import io

from app.database import get_db
from app.models.cita import Cita
from app.models.profesional import Profesional
from app.schemas import CitaCreate

router = APIRouter(tags=["citas"])


def _cita_a_datetime(cita: Cita) -> datetime:
    """Combina fecha (YYYY-MM-DD) y hora (HH:MM AM/PM) de la cita en un datetime."""
    return datetime.strptime(f"{cita.fecha} {cita.hora}", "%Y-%m-%d %I:%M %p")


@router.get("/citas/estudiante/{estudiante_id}")
def get_citas_estudiante(estudiante_id: int, db: Session = Depends(get_db)):
    citas = db.query(Cita).filter(
        Cita.estudiante_id == estudiante_id,
        Cita.estado == "pendiente"
    ).all()
    result = []
    for c in citas:
        prof = db.query(Profesional).filter(Profesional.id == c.profesional_id).first()
        result.append({
            "id":           c.id,
            "iniciales":    prof.iniciales    if prof else "??",
            "especialidad": prof.especialidad if prof else "",
            "profesional":  prof.nombre       if prof else "",
            "fecha":        c.fecha,
            "hora":         c.hora,
            "urgente":      False,
            "aviso":        "Cancelación hasta 5 horas antes",
            "estado":       c.estado
        })
    return result


@router.get("/historial/estudiante/{estudiante_id}")
def get_historial(estudiante_id: int, db: Session = Depends(get_db)):
    # Solo estados ya resueltos: completada, cancelada, inasistencia
    citas = db.query(Cita).filter(
        Cita.estudiante_id == estudiante_id,
        Cita.estado.in_(["completada", "cancelada", "inasistencia"])
    ).all()
    result = []
    for c in citas:
        prof = db.query(Profesional).filter(Profesional.id == c.profesional_id).first()
        result.append({
            "id":           c.id,
            "fechaRaw":     c.fecha,
            "fecha":        c.fecha,
            "hora":         c.hora,
            "profesional":  prof.nombre       if prof else "",
            "iniciales":    prof.iniciales    if prof else "??",
            "especialidad": prof.especialidad if prof else "",
            "estado":       c.estado,
            "tiene_pdf":    c.estado == "completada"
        })
    return result


@router.post("/citas")
def crear_cita(cita: CitaCreate, db: Session = Depends(get_db)):
    prof = db.query(Profesional).filter(Profesional.id == cita.profesional_id).first()

    if prof:
        duplicada = (
            db.query(Cita)
            .join(Profesional, Cita.profesional_id == Profesional.id)
            .filter(
                Cita.estudiante_id == cita.estudiante_id,
                Profesional.especialidad == prof.especialidad,
                Cita.estado == "pendiente"
            ).first()
        )
        if duplicada:
            raise HTTPException(status_code=400,
                detail="Ya tienes una cita pendiente en esta especialidad")

    nueva = Cita(
        estudiante_id  = cita.estudiante_id,
        profesional_id = cita.profesional_id,
        fecha          = cita.fecha,
        hora           = cita.hora,
        observaciones  = cita.observaciones,
        estado         = "pendiente"
    )
    db.add(nueva)
    db.commit()
    db.refresh(nueva)

    return {
        "id":           nueva.id,
        "iniciales":    prof.iniciales    if prof else "??",
        "especialidad": prof.especialidad if prof else "",
        "profesional":  prof.nombre       if prof else "",
        "fecha":        nueva.fecha,
        "hora":         nueva.hora,
        "urgente":      False,
        "aviso":        "Cancelación hasta 5 horas antes",
        "estado":       nueva.estado
    }


@router.delete("/citas/{cita_id}")
def cancelar_cita(cita_id: int, db: Session = Depends(get_db)):
    cita = db.query(Cita).filter(Cita.id == cita_id).first()
    if not cita:
        raise HTTPException(status_code=404, detail="Cita no encontrada")

    if cita.estado != "pendiente":
        raise HTTPException(status_code=400, detail="Esta cita no se puede cancelar")

    try:
        fecha_hora_cita = _cita_a_datetime(cita)
    except ValueError:
        fecha_hora_cita = None

    if fecha_hora_cita:
        horas_restantes = (fecha_hora_cita - datetime.now()).total_seconds() / 3600
        if horas_restantes < 5:
            raise HTTPException(
                status_code=400,
                detail="No se puede cancelar: faltan menos de 5 horas para la cita"
            )

    cita.estado = "cancelada"
    db.commit()
    return {"message": "Cita cancelada correctamente"}


@router.patch("/citas/{cita_id}/completar")
def completar_cita_prueba(cita_id: int, db: Session = Depends(get_db)):
    """
    Endpoint TEMPORAL de prueba — simula la acción del profesional
    de marcar una cita como atendida. Se debe reemplazar cuando
    exista el Dashboard de Profesional real.
    """
    cita = db.query(Cita).filter(Cita.id == cita_id).first()
    if not cita:
        raise HTTPException(status_code=404, detail="Cita no encontrada")
    if cita.estado != "pendiente":
        raise HTTPException(status_code=400, detail="Solo se puede completar una cita pendiente")

    cita.estado = "completada"
    db.commit()
    return {"message": "Cita marcada como completada (modo prueba)", "estado": cita.estado}


@router.get("/citas/{cita_id}/pdf")
def descargar_pdf_cita(cita_id: int, db: Session = Depends(get_db)):
    cita = db.query(Cita).filter(Cita.id == cita_id).first()
    if not cita:
        raise HTTPException(status_code=404, detail="Cita no encontrada")
    if cita.estado != "completada":
        raise HTTPException(status_code=400, detail="Solo se puede descargar el resumen de una cita completada")

    prof = db.query(Profesional).filter(Profesional.id == cita.profesional_id).first()

    from fpdf import FPDF
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 16)
    pdf.cell(0, 12, "SESAES - Resumen de Atención", ln=True)
    pdf.set_font("Helvetica", "", 12)
    pdf.ln(5)
    pdf.cell(0, 8, f"Profesional: {prof.nombre if prof else '-'}", ln=True)
    pdf.cell(0, 8, f"Especialidad: {prof.especialidad if prof else '-'}", ln=True)
    pdf.cell(0, 8, f"Fecha: {cita.fecha}", ln=True)
    pdf.cell(0, 8, f"Hora: {cita.hora}", ln=True)
    pdf.cell(0, 8, f"Motivo de consulta: {cita.observaciones or 'No especificado'}", ln=True)

    buffer = io.BytesIO(pdf.output())
    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=resumen_cita_{cita_id}.pdf"}
    )