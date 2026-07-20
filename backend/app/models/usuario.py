from sqlalchemy import Column, Integer, String, Boolean
from app.database import Base


class Usuario(Base):
    __tablename__ = "usuario"

    id          = Column(Integer, primary_key=True, index=True)
    correo      = Column(String, unique=True, index=True)
    password    = Column(String)
    rol         = Column(String)
    nombre      = Column(String, nullable=True)
    telefono    = Column(String, nullable=True)
    foto_url    = Column(String, nullable=True)
    tema_oscuro = Column(Boolean, default=False)
    carrera     = Column(String, nullable=True)
    rut         = Column(String, nullable=True)
    activo      = Column(Boolean, default=True)