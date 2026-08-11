from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.database import get_db
from app.models.profesional import Profesional
from app.models.usuario import Usuario
from app.models.historial_plantilla_pregunta import HistorialPlantillaPregunta
from app.models.historial_paciente import HistorialPaciente

router = APIRouter(prefix="/historial-clinico", tags=["historial-clinico"])


# ══════════════════════════════════════
# Preguntas por defecto para especialidades nuevas
# (se crean solo la primera vez que una especialidad pide su plantilla)
# ══════════════════════════════════════
PREGUNTAS_BASE = [
    {"etiqueta": "Edad",                                              "tipo": "numero"},
    {"etiqueta": "¿Es alérgico a algún medicamento o sustancia?",     "tipo": "si_no"},
    {"etiqueta": "Detalle de la alergia (si aplica)",                 "tipo": "texto"},
    {"etiqueta": "¿Algún padre o familiar directo tiene una enfermedad genética o crónica?", "tipo": "textarea"},
    {"etiqueta": "¿Fuma?",                                            "tipo": "si_no"},
    {"etiqueta": "¿Consume alcohol?",                                 "tipo": "si_no"},
    {"etiqueta": "Observaciones adicionales",                         "tipo": "textarea"},
]


# ══════════════════════════════════════
# Schemas
# ══════════════════════════════════════
class PreguntaIn(BaseModel):
    id: Optional[int] = None   # None = pregunta nueva
    etiqueta: str
    tipo: str = "texto"        # texto | numero | si_no | textarea
    orden: int = 0


class PlantillaUpdateIn(BaseModel):
    preguntas: list[PreguntaIn]


class HistorialGuardarIn(BaseModel):
    respuestas: dict


# ══════════════════════════════════════
# Helpers
# ══════════════════════════════════════
def _get_profesional_o_404(profesional_id: int, db: Session) -> Profesional:
    prof = db.query(Profesional).filter(Profesional.id == profesional_id).first()
    if not prof:
        raise HTTPException(status_code=404, detail="Profesional no encontrado")
    return prof


def _asegurar_plantilla_base(especialidad: str, db: Session) -> None:
    existe = db.query(HistorialPlantillaPregunta).filter(
        HistorialPlantillaPregunta.especialidad == especialidad
    ).first()
    if existe:
        return
    for i, p in enumerate(PREGUNTAS_BASE):
        db.add(HistorialPlantillaPregunta(
            especialidad=especialidad, etiqueta=p["etiqueta"], tipo=p["tipo"], orden=i, activa=True
        ))
    db.commit()


# ══════════════════════════════════════
# Plantilla de preguntas (por especialidad)
# ══════════════════════════════════════
@router.get("/plantilla/{profesional_id}")
def obtener_plantilla(profesional_id: int, db: Session = Depends(get_db)):
    prof = _get_profesional_o_404(profesional_id, db)
    _asegurar_plantilla_base(prof.especialidad, db)

    preguntas = db.query(HistorialPlantillaPregunta).filter(
        HistorialPlantillaPregunta.especialidad == prof.especialidad,
        HistorialPlantillaPregunta.activa == True  # noqa: E712
    ).order_by(HistorialPlantillaPregunta.orden).all()

    return {
        "especialidad": prof.especialidad,
        "preguntas": [
            {"id": p.id, "etiqueta": p.etiqueta, "tipo": p.tipo, "orden": p.orden}
            for p in preguntas
        ]
    }


@router.put("/plantilla/{profesional_id}")
def actualizar_plantilla(profesional_id: int, datos: PlantillaUpdateIn, db: Session = Depends(get_db)):
    """
    Reemplaza el set de preguntas activas de la especialidad de este profesional.
    Las preguntas que ya no vienen en la lista se desactivan (no se borran, para no
    perder las respuestas ya guardadas por pacientes anteriores con esa pregunta).
    """
    prof = _get_profesional_o_404(profesional_id, db)

    existentes = db.query(HistorialPlantillaPregunta).filter(
        HistorialPlantillaPregunta.especialidad == prof.especialidad
    ).all()
    ids_recibidos = {p.id for p in datos.preguntas if p.id is not None}

    # Desactiva las que ya no vienen
    for e in existentes:
        e.activa = e.id in ids_recibidos

    # Actualiza o crea
    for i, p in enumerate(datos.preguntas):
        if p.id is not None:
            existente = next((e for e in existentes if e.id == p.id), None)
            if existente:
                existente.etiqueta = p.etiqueta
                existente.tipo     = p.tipo
                existente.orden    = i
                existente.activa   = True
                continue
        db.add(HistorialPlantillaPregunta(
            especialidad=prof.especialidad, etiqueta=p.etiqueta, tipo=p.tipo, orden=i, activa=True
        ))

    db.commit()
    return {"message": "Plantilla actualizada correctamente"}


# ══════════════════════════════════════
# Ficha del paciente (por profesional + estudiante)
# ══════════════════════════════════════
@router.get("/{profesional_id}/{estudiante_id}")
def obtener_historial(profesional_id: int, estudiante_id: int, db: Session = Depends(get_db)):
    prof = _get_profesional_o_404(profesional_id, db)
    estudiante = db.query(Usuario).filter(Usuario.id == estudiante_id).first()
    if not estudiante:
        raise HTTPException(status_code=404, detail="Estudiante no encontrado")

    _asegurar_plantilla_base(prof.especialidad, db)
    preguntas = db.query(HistorialPlantillaPregunta).filter(
        HistorialPlantillaPregunta.especialidad == prof.especialidad,
        HistorialPlantillaPregunta.activa == True  # noqa: E712
    ).order_by(HistorialPlantillaPregunta.orden).all()

    historial = db.query(HistorialPaciente).filter(
        HistorialPaciente.profesional_id == profesional_id,
        HistorialPaciente.estudiante_id  == estudiante_id
    ).first()

    return {
        "existe": historial is not None,
        "estudiante_nombre": estudiante.nombre,
        "preguntas": [
            {"id": p.id, "etiqueta": p.etiqueta, "tipo": p.tipo, "orden": p.orden}
            for p in preguntas
        ],
        "respuestas": historial.respuestas if historial else {},
        "fecha_creacion":     historial.fecha_creacion if historial else None,
        "fecha_modificacion": historial.fecha_modificacion if historial else None,
    }


@router.put("/{profesional_id}/{estudiante_id}")
def guardar_historial(profesional_id: int, estudiante_id: int, datos: HistorialGuardarIn, db: Session = Depends(get_db)):
    prof = _get_profesional_o_404(profesional_id, db)
    estudiante = db.query(Usuario).filter(Usuario.id == estudiante_id).first()
    if not estudiante:
        raise HTTPException(status_code=404, detail="Estudiante no encontrado")

    historial = db.query(HistorialPaciente).filter(
        HistorialPaciente.profesional_id == profesional_id,
        HistorialPaciente.estudiante_id  == estudiante_id
    ).first()

    if historial:
        historial.respuestas = datos.respuestas
    else:
        historial = HistorialPaciente(
            profesional_id=profesional_id, estudiante_id=estudiante_id, respuestas=datos.respuestas
        )
        db.add(historial)

    db.commit()
    return {"message": "Ficha guardada correctamente"}


@router.get("/{profesional_id}/pacientes")
def listar_pacientes_atendidos(profesional_id: int, db: Session = Depends(get_db)):
    """
    Lista los estudiantes que este profesional ha atendido (según sus citas),
    junto con si ya tienen ficha de antecedentes creada o no.
    """
    from app.models.cita import Cita

    estudiantes_ids = db.query(Cita.estudiante_id).filter(
        Cita.profesional_id == profesional_id
    ).distinct().all()
    estudiantes_ids = [e[0] for e in estudiantes_ids]

    if not estudiantes_ids:
        return []

    estudiantes = db.query(Usuario).filter(Usuario.id.in_(estudiantes_ids)).all()
    fichas = db.query(HistorialPaciente).filter(
        HistorialPaciente.profesional_id == profesional_id,
        HistorialPaciente.estudiante_id.in_(estudiantes_ids)
    ).all()
    ids_con_ficha = {f.estudiante_id for f in fichas}

    return [
        {
            "estudiante_id": e.id,
            "nombre": e.nombre,
            "correo": e.correo,
            "carrera": e.carrera,
            "tiene_ficha": e.id in ids_con_ficha
        }
        for e in estudiantes
    ]
