from sqlalchemy import Column, Integer, String, ForeignKey
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
    foto_url = Column(String, nullable=True)   # ← NUEVO

    horarios = relationship("HorarioDisponible", back_populates="profesional")
    citas = relationship("Cita", back_populates="profesional")
