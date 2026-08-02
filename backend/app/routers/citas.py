from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from datetime import datetime
import io
import os

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

    LOGO_PATH = os.path.join(os.path.dirname(__file__), "..", "static", "temporal.jpg")

    pdf = FPDF()
    pdf.add_page()

    # ── Encabezado con logo institucional ──
    if os.path.exists(LOGO_PATH):
        pdf.image(LOGO_PATH, x=10, y=8, w=20)
        pdf.set_xy(35, 10)
    else:
        pdf.set_xy(10, 10)

    pdf.set_font("Helvetica", "B", 16)
    pdf.cell(0, 8, "SESAES - Resumen de Atención", ln=True)
    pdf.set_x(35 if os.path.exists(LOGO_PATH) else 10)
    pdf.set_font("Helvetica", "", 9)
    pdf.cell(0, 6, "Universidad Tecnológica Metropolitana - Salud Estudiantil", ln=True)

    pdf.ln(10)
    pdf.set_draw_color(200, 200, 200)
    pdf.line(10, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(6)

    # ── Datos de la atención (etiqueta en negrita + valor normal) ──
    def campo(pdf, etiqueta, valor):
        pdf.set_font("Helvetica", "B", 12)
        ancho_etiqueta = pdf.get_string_width(etiqueta) + 2
        pdf.cell(ancho_etiqueta, 8, etiqueta)
        pdf.set_font("Helvetica", "", 12)
        pdf.cell(0, 8, valor, ln=True)

    campo(pdf, "Profesional:", f" {prof.nombre if prof else '-'}")
    campo(pdf, "Especialidad:", f" {prof.especialidad if prof else '-'}")
    campo(pdf, "Fecha:", f" {cita.fecha}")
    campo(pdf, "Hora:", f" {cita.hora}")
    campo(pdf, "Motivo de consulta:", f" {cita.observaciones or 'No especificado'}")

    # ── Indicaciones médicas / receta ──
    pdf.ln(6)
    pdf.set_font("Helvetica", "B", 13)
    pdf.cell(0, 8, "Indicaciones Médicas", ln=True)
    pdf.set_draw_color(230, 230, 230)
    pdf.line(10, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(4)

    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(0, 7, "Medicamento suministrado:", ln=True)
    pdf.set_font("Helvetica", "", 11)
    pdf.multi_cell(0, 7, cita.medicamento or "No se suministró medicamento.")

    pdf.ln(2)
    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(0, 7, "Observaciones e indicaciones:", ln=True)
    pdf.set_font("Helvetica", "", 11)
    pdf.multi_cell(0, 7, cita.observaciones_atencion or "Sin observaciones adicionales.")

    # ── Firma / sello del profesional ──
    pdf.ln(20)
    y_firma = pdf.get_y()
    pdf.set_draw_color(0, 0, 0)
    pdf.line(120, y_firma, 195, y_firma)
    pdf.set_xy(120, y_firma + 2)
    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(75, 6, prof.nombre if prof else "-", ln=True, align="C")
    pdf.set_x(120)
    pdf.set_font("Helvetica", "", 9)
    pdf.cell(75, 5, prof.especialidad if prof else "-", ln=True, align="C")
    pdf.set_x(120)
    pdf.cell(75, 5, "SESAES - UTEM", ln=True, align="C")

    buffer = io.BytesIO(pdf.output())
    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=resumen_cita_{cita_id}.pdf"}
    )
