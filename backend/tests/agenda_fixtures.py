"""Datos aprobados explícitos para pruebas de citas estudiantiles existentes."""
from app.models.bloque_horario_semanal import BloqueHorarioSemanal


def aprobar_jornada(db, profesional):
    for dia in range(5):
        db.add(BloqueHorarioSemanal(
            profesional_id=profesional.id, dia_semana=dia, tipo="disponible",
            hora_inicio=profesional.horario_inicio or "09:00",
            hora_fin=profesional.horario_fin or "17:00",
        ))
        if profesional.hora_almuerzo_inicio and profesional.hora_almuerzo_fin:
            db.add(BloqueHorarioSemanal(
                profesional_id=profesional.id, dia_semana=dia, tipo="colacion",
                hora_inicio=profesional.hora_almuerzo_inicio,
                hora_fin=profesional.hora_almuerzo_fin,
            ))
    db.flush()
