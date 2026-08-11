from sqlalchemy import Column, Integer, String, Boolean
from app.database import Base


class HistorialPlantillaPregunta(Base):
    """
    Preguntas del cuestionario de antecedentes, definidas por especialidad.
    Cada profesional ve y administra solo las preguntas de su propia especialidad
    (ej. Odontología tiene sus propias preguntas, distintas a Psicología).
    """
    __tablename__ = "historial_plantilla_pregunta"

    id           = Column(Integer, primary_key=True, index=True)
    especialidad = Column(String, index=True, nullable=False)
    etiqueta     = Column(String, nullable=False)          # ej. "¿Es alérgico a algún medicamento?"
    tipo         = Column(String, default="texto")         # texto | numero | si_no | textarea
    orden        = Column(Integer, default=0)
    activa       = Column(Boolean, default=True)           # soft-delete: no se borra, se desactiva
