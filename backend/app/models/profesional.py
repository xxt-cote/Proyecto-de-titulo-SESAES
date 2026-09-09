from sqlalchemy import Column, Integer, String, ForeignKey, Time
from sqlalchemy.orm import relationship
from app.database import Base


class Profesional(Base):
    __tablename__ = "profesional"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String)
    especialidad = Column(String)
    iniciales = Column(String(5))
    descripcion = Column(String, nullable=True)
    usuario_id = Column(Integer, ForeignKey("usuario.id"), nullable=True)
    duracion_min = Column(Integer, default=45)
    estado = Column(String, default="activo")
    correo = Column(String, nullable=True)
    rut = Column(String, nullable=True)
    foto_url = Column(String, nullable=True)
    hora_almuerzo_inicio = Column(Time, nullable=True)
    hora_almuerzo_fin = Column(Time, nullable=True)
    horario_inicio = Column(Time, nullable=True)
    horario_fin = Column(Time, nullable=True)

    horarios = relationship("HorarioDisponible", back_populates="profesional")
    citas = relationship("Cita", back_populates="profesional")
    solicitudes_horario = relationship("SolicitudHorario", back_populates="profesional")
    bloques_semanales = relationship("BloqueHorarioSemanal", back_populates="profesional")