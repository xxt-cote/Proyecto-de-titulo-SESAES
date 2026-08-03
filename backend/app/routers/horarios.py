from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime, date, timedelta, time

from app.database import get_db
from app.models.profesional import Profesional
from app.models.cita import Cita

router = APIRouter(tags=["horarios"])

# ... (todo el resto igual, sin la clase Profesional al final)

HORA_INICIO = time(8, 0)
HORA_FIN    = time(18, 0)


def _generar_bloques(duracion_min: int) -> list:
    """Genera la lista de horas posibles entre 08:00 y 18:00, según duración del bloque."""
    bloques = []
    actual = datetime.combine(date.today(), HORA_INICIO)
    fin    = datetime.combine(date.today(), HORA_FIN)
    while actual < fin:
        bloques.append(actual.time())
        actual += timedelta(minutes=duracion_min)
    return bloques


def _parsear_hora_24h(hora_str: str):
    """Convierte 'HH:MM' (24h) a objeto time. Devuelve None si es inválido o vacío."""
    if not hora_str:
        return None
    try:
        return datetime.strptime(hora_str, "%H:%M").time()
    except ValueError:
        return None


@router.get("/disponibilidad/{profesional_id}")
def get_disponibilidad(profesional_id: int, fecha: str, db: Session = Depends(get_db)):
    """
    Devuelve las horas disponibles para un profesional en una fecha específica.
    fecha: string en formato YYYY-MM-DD
    """
    try:
        fecha_obj = datetime.strptime(fecha, "%Y-%m-%d").date()
    except ValueError:
        return {"horas": [], "mensaje": "Fecha inválida"}

    hoy = date.today()
    ventana_maxima = hoy + timedelta(days=7)

    # Fuera de la ventana válida (pasado, muy futuro, o fin de semana)
    if fecha_obj < hoy or fecha_obj > ventana_maxima or fecha_obj.weekday() >= 5:
        return {"horas": [], "mensaje": "Sin horas disponibles"}

    prof = db.query(Profesional).filter(Profesional.id == profesional_id).first()
    if not prof:
        return {"horas": [], "mensaje": "Profesional no encontrado"}

    duracion = prof.duracion_min or 45
    bloques = _generar_bloques(duracion)

    # Si la fecha es hoy, descartar horas ya pasadas
    if fecha_obj == hoy:
        ahora = datetime.now().time()
        bloques = [b for b in bloques if b > ahora]

    # Descartar el bloque de almuerzo del profesional, si lo tiene definido
    almuerzo_inicio = _parsear_hora_24h(prof.hora_almuerzo_inicio)
    almuerzo_fin    = _parsear_hora_24h(prof.hora_almuerzo_fin)
    if almuerzo_inicio and almuerzo_fin:
        bloques = [b for b in bloques if not (almuerzo_inicio <= b < almuerzo_fin)]

    # Descartar horas fuera de la jornada laboral del profesional, si la tiene definida
    jornada_inicio = _parsear_hora_24h(prof.horario_inicio)
    jornada_fin    = _parsear_hora_24h(prof.horario_fin)
    if jornada_inicio and jornada_fin:
        bloques = [b for b in bloques if jornada_inicio <= b < jornada_fin]

    # Descartar bloques ya ocupados por una cita activa (pendiente o completada)
    ocupadas_raw = db.query(Cita.hora).filter(
        Cita.profesional_id == profesional_id,
        Cita.fecha == fecha,
        Cita.estado.in_(["pendiente", "completada"])
    ).all()
    ocupadas = {h for (h,) in ocupadas_raw}

    horas_disponibles = []
    for b in bloques:
        hora_str = b.strftime("%H:%M")
        if hora_str not in ocupadas:
            horas_disponibles.append(hora_str)

    if not horas_disponibles:
        return {"horas": [], "mensaje": "Sin horas disponibles por esta semana"}

    return {"horas": horas_disponibles, "mensaje": None}
