from sqlalchemy import Column, Integer, String, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base

class Cita(Base):
    __tablename__ = "cita"

    id                    = Column(Integer, primary_key=True, index=True)
    estudiante_id         = Column(Integer, ForeignKey("usuario.id"))
    profesional_id        = Column(Integer, ForeignKey("profesional.id"))
    fecha                 = Column(String)
    hora                  = Column(String)
    estado                = Column(String, default="pendiente")
    observaciones         = Column(String, nullable=True)
    urgente               = Column(Boolean, default=False)
    cancelada_por_admin   = Column(Boolean, default=False)
    # El profesional puede rechazar una cita pendiente indicando un motivo
    # (ej. no corresponde a su especialidad, horario mal agendado, etc.).
    # Reutiliza el estado "cancelada" (no se inventa un 5° estado clínico:
    # ver Documento Maestro sección 4) + este flag para diferenciarla en
    # trazabilidad de una cancelación hecha por el estudiante o el admin.
    rechazada_por_profesional = Column(Boolean, default=False)
    motivo_cancelacion    = Column(String, nullable=True)
    medicamento           = Column(String, nullable=True)
    observaciones_atencion = Column(String, nullable=True)

    # Cita creada por el admin fuera del horario habitual del profesional
    # (fuera de horario declarado, o incluso en su hora de colación),
    # forzada manualmente como excepción. Se usa para diferenciarla
    # visualmente y en reportes de las citas normales.
    sobrecupo             = Column(Boolean, default=False)

    profesional = relationship("Profesional", back_populates="citas")
    estudiante  = relationship("Usuario", foreign_keys=[estudiante_id])