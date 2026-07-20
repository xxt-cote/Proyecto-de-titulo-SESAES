from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.sql import func
from app.database import Base


class Auditoria(Base):
    __tablename__ = "auditoria"

    id          = Column(Integer, primary_key=True, index=True)
    usuario_id  = Column(Integer, ForeignKey("usuario.id"))
    accion      = Column(String)
    detalle     = Column(String)
    entidad     = Column(String)    # 'cita', 'profesional', 'configuracion', etc.
    entidad_id  = Column(Integer)   # id del registro afectado
    fecha       = Column(DateTime, server_default=func.now())