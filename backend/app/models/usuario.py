from sqlalchemy import Column, Integer, String, Boolean
from app.database import Base


class Usuario(Base):
    __tablename__ = "usuario"

    id          = Column(Integer, primary_key=True, index=True)
    correo      = Column(String, unique=True, index=True)
    correo_secundario = Column(String, nullable=True)  # solo aplica a estudiantes
    password    = Column(String)
    rol         = Column(String)
    nombre      = Column(String, nullable=True)
    telefono    = Column(String, nullable=True)
    foto_url    = Column(String, nullable=True)
    tema_oscuro = Column(Boolean, default=False)
    carrera     = Column(String, nullable=True)
    rut         = Column(String, nullable=True)
    activo      = Column(Boolean, default=True)
    # True para cuentas creadas con contraseña temporal (ej. carga masiva
    # por CSV) — al iniciar sesión por primera vez, se le pide cambiarla
    # o mantenerla explícitamente, antes de dejarlo usar el resto del sistema.
    debe_cambiar_password = Column(Boolean, default=False)