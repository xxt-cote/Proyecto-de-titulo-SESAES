# -*- coding: utf-8 -*-
"""
SESAES — Firma manuscrita digitalizada del profesional.

Una fila por profesional: la imagen (PNG con fondo transparente, en data URL)
que se incorpora a las recetas y justificativos que emite. Es una imagen de su
firma, NO una firma electrónica avanzada (no usa certificado digital).

Cada documento emitido guarda una COPIA de la imagen vigente en ese momento
(ver firma_profesional_service.agregar_firma): si el profesional cambia o
elimina su firma después, los documentos ya emitidos no cambian.
"""

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func

from app.database import Base


class FirmaProfesional(Base):
    __tablename__ = "firma_profesional"

    id             = Column(Integer, primary_key=True, index=True)
    profesional_id = Column(Integer, ForeignKey("profesional.id"), nullable=False, unique=True, index=True)
    imagen         = Column(Text, nullable=False)        # data:image/png;base64,...
    metodo         = Column(String, nullable=False)      # dibujada | escrita | subida
    actualizada_en = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
