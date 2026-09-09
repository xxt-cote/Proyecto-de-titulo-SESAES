from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime, date, timedelta, time

from app.database import get_db
from app.models.profesional import Profesional
from app.models.cita import Cita
from app.models.dia_cerrado import DiaCerrado
from app.models.bloque_horario_semanal import BloqueHorarioSemanal
from app.models.ausencia_profesional import AusenciaProfesional
from app.auth_dependencies import get_current_user
from app.reglas_horario import rango_institucional_dia, es_fin_de_semana, parsear_hora_24h

router = APIRouter(tags=["horarios"])

# Rango histórico usado como fallback amplio cuando no aplica el rango
# institucional (no debería alcanzarse en la práctica porque get_disponibilidad
# ya descarta fines de semana antes de llegar a generar bloques).
HORA_INICIO = time(8, 0)
HORA_FIN    = time(18, 0)


@router.get("/dias-cerrados")
def listar_dias_cerrados_publico(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """
    Versión de solo-lectura, accesible para cualquier usuario logueado
    (no solo admin) — la usan estudiante y profesional para bloquear/marcar
    esas fechas en sus propios calendarios.
    """
    dias = db.query(DiaCerrado).filter(DiaCerrado.fecha >= date.today().isoformat()).order_by(DiaCerrado.fecha).all()
    return [{"fecha": d.fecha, "motivo": d.motivo} for d in dias]


def _generar_bloques(duracion_min: int, hora_inicio: time = HORA_INICIO, hora_fin: time = HORA_FIN) -> list:
    """Genera la lista de horas posibles entre hora_inicio y hora_fin, según duración del bloque."""
    bloques = []
    actual = datetime.combine(date.today(), hora_inicio)
    fin    = datetime.combine(date.today(), hora_fin)
    while actual < fin:
        bloques.append(actual.time())
        actual += timedelta(minutes=duracion_min)
    return bloques


@router.get("/disponibilidad/{profesional_id}")
def get_disponibilidad(
    profesional_id: int,
    fecha: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Devuelve las horas disponibles para un profesional en una fecha específica.
    fecha: string en formato YYYY-MM-DD

    No es un endpoint "sensible" (no expone datos de ningún paciente puntual,
    solo qué horas están libres), así que cualquier usuario autenticado
    (estudiante, profesional o admin) puede consultarlo — es lo que necesita
    el estudiante para agendar.
    """
    try:
        fecha_obj = datetime.strptime(fecha, "%Y-%m-%d").date()
    except ValueError:
        return {"horas": [], "mensaje": "Fecha inválida"}

    hoy = date.today()
    ventana_maxima = hoy + timedelta(days=7)

    # Fuera de la ventana válida (pasado o muy futuro)
    if fecha_obj < hoy or fecha_obj > ventana_maxima:
        return {"horas": [], "mensaje": "Sin horas disponibles"}

    # Fin de semana: el centro nunca atiende sábado ni domingo (regla institucional).
    dia_semana = fecha_obj.weekday()
    if es_fin_de_semana(dia_semana):
        return {"horas": [], "mensaje": "No se atiende sábado ni domingo."}

    dia_cerrado = db.query(DiaCerrado).filter(DiaCerrado.fecha == fecha).first()
    if dia_cerrado:
        return {"horas": [], "mensaje": f"El centro permanece cerrado este día. {dia_cerrado.motivo or ''}".strip()}

    prof = db.query(Profesional).filter(Profesional.id == profesional_id).first()
    if not prof:
        return {"horas": [], "mensaje": "Profesional no encontrado"}

    ausencia = db.query(AusenciaProfesional).filter(
        AusenciaProfesional.profesional_id == profesional_id,
        AusenciaProfesional.fecha == fecha
    ).first()
    if ausencia:
        return {"horas": [], "mensaje": f"El profesional no atiende este día. {ausencia.motivo or ''}".strip()}

    # Rango institucional del día (Lun-Jue 09:00-17:30, Vie 09:00-16:30).
    rango_institucional = rango_institucional_dia(dia_semana)
    inst_inicio, inst_fin = rango_institucional

    duracion = prof.duracion_min or 45

    # El profesional usa UNO de los dos sistemas, decidido una sola vez (no
    # por día): si tiene AL MENOS UN bloque semanal cargado (en cualquier
    # día), está en modo "agenda por bloques" y ya no se usa el horario
    # simple como respaldo — aunque no tenga bloques para ESTE día en
    # particular (eso solo significa que no trabaja ese día).
    #
    # Antes esto se decidía por día (bloques_semana filtrado a dia_semana),
    # lo que mezclaba ambos sistemas: un profesional que migró a bloques
    # pero no trabaja los martes caía al horario simple de respaldo para el
    # martes, y como horario_inicio/horario_fin suelen quedar vacíos tras
    # migrar a bloques, a veces ofrecía todo el rango institucional donde no
    # debía, y otras veces (según los datos) terminaba sin nada.
    usa_bloques = any(b.dia_semana is not None for b in prof.bloques_semanales)

    if usa_bloques:
        bloques_semana = [b for b in prof.bloques_semanales if b.dia_semana == dia_semana]
        # El profesional está en modo bloques pero no tiene ninguno para
        # este día de la semana en particular → simplemente no atiende ese
        # día (no se cae al horario simple).
        if not bloques_semana:
            return {"horas": [], "mensaje": "El profesional no atiende este día de la semana."}

        bloques = []
        for b in bloques_semana:
            if b.tipo != "disponible":
                continue
            b_inicio = parsear_hora_24h(b.hora_inicio)
            b_fin    = parsear_hora_24h(b.hora_fin)
            if not b_inicio or not b_fin:
                continue
            efectivo_inicio = max(b_inicio, inst_inicio)
            efectivo_fin    = min(b_fin, inst_fin)
            if efectivo_inicio >= efectivo_fin:
                continue
            bloques.extend(_generar_bloques(duracion, efectivo_inicio, efectivo_fin))
        bloques = sorted(set(bloques))

        # Excluir explícitamente cualquier bloque "colacion" definido para ese día
        # (por si se solapa con un bloque "disponible" cargado en otro momento).
        colaciones = [b for b in bloques_semana if b.tipo == "colacion"]
        for c in colaciones:
            c_inicio = parsear_hora_24h(c.hora_inicio)
            c_fin    = parsear_hora_24h(c.hora_fin)
            if c_inicio and c_fin:
                bloques = [b for b in bloques if not (c_inicio <= b < c_fin)]
    else:
        # Profesional que aún no migró a agenda por bloques: usa el rango
        # simple horario_inicio/horario_fin + colación (comportamiento
        # previo), siempre acotado al rango institucional del día.
        jornada_inicio = parsear_hora_24h(prof.horario_inicio) or inst_inicio
        jornada_fin    = parsear_hora_24h(prof.horario_fin)    or inst_fin
        efectivo_inicio = max(jornada_inicio, inst_inicio)
        efectivo_fin    = min(jornada_fin, inst_fin)
        if efectivo_inicio >= efectivo_fin:
            return {"horas": [], "mensaje": "Sin horas disponibles por esta semana"}

        bloques = _generar_bloques(duracion, efectivo_inicio, efectivo_fin)

        almuerzo_inicio = parsear_hora_24h(prof.hora_almuerzo_inicio)
        almuerzo_fin    = parsear_hora_24h(prof.hora_almuerzo_fin)
        if almuerzo_inicio and almuerzo_fin:
            bloques = [b for b in bloques if not (almuerzo_inicio <= b < almuerzo_fin)]

    # Si la fecha es hoy, descartar horas ya pasadas
    if fecha_obj == hoy:
        ahora = datetime.now().time()
        bloques = [b for b in bloques if b > ahora]

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
