"""
Reglas de horario institucional (UTEM - SESAES).

Único lugar donde vive el rango de horario permitido por día de semana,
para que horarios.py (disponibilidad), solicitudes_horario.py (validación
de solicitudes del profesional) y citas.py (validación de agendamiento)
usen siempre la misma regla y no queden desincronizados.

Rango institucional:
  - Lunes a Jueves: 09:00 - 17:30
  - Viernes:        09:00 - 16:30
  - Sábado y Domingo: sin atención (no se puede solicitar ni agendar).

dia_semana usa convención Python (Monday=0 ... Sunday=6), igual que
datetime.date.weekday().
"""

from datetime import date, datetime, time


# {dia_semana: (hora_inicio, hora_fin)} — solo Lunes(0) a Viernes(4)
RANGO_INSTITUCIONAL = {
    0: (time(9, 0), time(17, 30)),   # Lunes
    1: (time(9, 0), time(17, 30)),   # Martes
    2: (time(9, 0), time(17, 30)),   # Miércoles
    3: (time(9, 0), time(17, 30)),   # Jueves
    4: (time(9, 0), time(16, 30)),   # Viernes
}

NOMBRES_DIA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]


def es_fin_de_semana(dia_semana: int) -> bool:
    """dia_semana en convención Python: Sábado=5, Domingo=6."""
    return dia_semana >= 5


def rango_institucional_dia(dia_semana: int):
    """
    Devuelve (hora_inicio, hora_fin) permitido para ese día de semana,
    o None si es un día sin atención (fin de semana).
    """
    return RANGO_INSTITUCIONAL.get(dia_semana)


def parsear_hora_24h(hora_str) -> time | None:
    """Convierte 'HH:MM' (24h) a time. Acepta también un objeto time directamente."""
    if hora_str is None or hora_str == "":
        return None
    if isinstance(hora_str, time):
        return hora_str
    try:
        return datetime.strptime(str(hora_str), "%H:%M").time()
    except ValueError:
        return None


def validar_bloque_institucional(dia_semana: int, hora_inicio, hora_fin) -> str | None:
    """
    Valida que [hora_inicio, hora_fin) quepa dentro del rango institucional
    del día indicado. Devuelve un mensaje de error (str) si es inválido,
    o None si el bloque es válido.
    """
    if es_fin_de_semana(dia_semana):
        return "No se puede solicitar horario en sábado ni domingo."

    rango = rango_institucional_dia(dia_semana)
    if rango is None:
        return "Día fuera del rango institucional."

    ini = parsear_hora_24h(hora_inicio)
    fin = parsear_hora_24h(hora_fin)
    if ini is None or fin is None:
        return "Formato de hora inválido. Usa HH:MM."
    if ini >= fin:
        return "La hora de inicio debe ser anterior a la hora de término."

    rango_ini, rango_fin = rango
    if ini < rango_ini or fin > rango_fin:
        return (
            f"El bloque debe estar dentro del horario institucional de "
            f"{NOMBRES_DIA[dia_semana]} ({rango_ini.strftime('%H:%M')} - {rango_fin.strftime('%H:%M')})."
        )
    return None


def validar_fecha_agendable(fecha_str: str) -> str | None:
    """
    Valida que una fecha (YYYY-MM-DD) sea agendable: no fin de semana,
    no en el pasado. Devuelve mensaje de error o None si es válida.
    Nota: NO valida feriados/día cerrado (eso se revisa aparte contra DiaCerrado).
    """
    try:
        fecha_obj = datetime.strptime(fecha_str, "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return "Fecha inválida."

    if fecha_obj < date.today():
        return "No se puede agendar en una fecha que ya pasó."
    if es_fin_de_semana(fecha_obj.weekday()):
        return "No se atiende sábado ni domingo."
    return None


def calcular_dias_disponibles(dias_con_bloque_disponible, tiene_jornada_simple: bool):
    """
    Calcula en qué días de semana (0=Lunes...4=Viernes) el profesional
    ofrece horas, para que el frontend pueda deshabilitar el resto en
    calendarios/selectores de fecha. Se usa tanto para el mini-calendario
    del estudiante (Image 1) como para la grilla del admin (Image 3).

    - dias_con_bloque_disponible: set/iterable de dia_semana que tienen al
      menos un BloqueHorarioSemanal tipo "disponible" (agenda por bloques).
    - tiene_jornada_simple: True si el profesional tiene horario_inicio/
      horario_fin configurados (jornada simple, legado — aplica Lun-Vie por igual).

    Devuelve:
      - una lista de días (puede ser cualquier subconjunto de 0-4) si el
        profesional ya migró a agenda por bloques,
      - [0,1,2,3,4] si usa jornada simple,
      - None si el profesional no tiene NINGÚN horario configurado todavía
        (para no bloquear de más algo que simplemente no se ha cargado).
    """
    dias = sorted(set(dias_con_bloque_disponible))
    if dias:
        return dias
    if tiene_jornada_simple:
        return [0, 1, 2, 3, 4]
    return None
