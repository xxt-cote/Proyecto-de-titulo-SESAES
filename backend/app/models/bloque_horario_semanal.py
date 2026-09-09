from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class BloqueHorarioSemanal(Base):
    """
    Un bloque recurrente de la agenda semanal APROBADA de un profesional.
    Se genera cuando el admin aprueba una SolicitudHorario de tipo "bloques".

    dia_semana usa convención Python: Lunes=0 ... Viernes=4 (nunca 5/6,
    se valida en el backend antes de insertar — ver reglas_horario.py).

    tipo:
      - "disponible": bloque en que el profesional ofrece horas para citas.
      - "colacion":   bloque bloqueado explícitamente como colación.

    Reemplaza (para el profesional que las tenga) la pareja simple
    horario_inicio/horario_fin + hora_almuerzo_inicio/hora_almuerzo_fin de
    Profesional, permitiendo horario distinto por día (ej. Viernes más corto).
    Los profesionales que aún no migran a bloques siguen usando esos campos
    simples como respaldo (ver horarios.py: get_disponibilidad).
    """
    __tablename__ = "bloque_horario_semanal"

    id             = Column(Integer, primary_key=True, index=True)
    profesional_id = Column(Integer, ForeignKey("profesional.id"), nullable=False, index=True)
    dia_semana     = Column(Integer, nullable=False)   # 0=Lunes ... 4=Viernes
    hora_inicio    = Column(String, nullable=False)    # "HH:MM" 24h
    hora_fin       = Column(String, nullable=False)    # "HH:MM" 24h
    tipo           = Column(String, default="disponible")  # "disponible" | "colacion"

    profesional = relationship("Profesional", back_populates="bloques_semanales")
