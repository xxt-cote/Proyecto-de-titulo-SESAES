# -*- coding: utf-8 -*-
"""
SESAES — Tablas de seguridad de cuenta.

  restablecimiento_password : enlaces de "olvidé mi contraseña". Se guarda solo el
                              HASH (SHA-256) del token: quien lea la base de datos
                              no puede usar los enlaces pendientes.
  intento_login             : intentos fallidos de inicio de sesión por correo, para
                              bloquear temporalmente la cuenta (no solo por IP).
"""

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.sql import func

from app.database import Base


class RestablecimientoPassword(Base):
    __tablename__ = "restablecimiento_password"

    id          = Column(Integer, primary_key=True, index=True)
    usuario_id  = Column(Integer, ForeignKey("usuario.id"), nullable=False, index=True)
    token_hash  = Column(String(64), nullable=False, unique=True, index=True)   # sha256 hex
    creado_en   = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    expira_en   = Column(DateTime(timezone=True), nullable=False)
    usado_en    = Column(DateTime(timezone=True), nullable=True)


class IntentoLogin(Base):
    __tablename__ = "intento_login"

    id               = Column(Integer, primary_key=True, index=True)
    correo           = Column(String, nullable=False, unique=True, index=True)  # normalizado (minúsculas)
    fallidos         = Column(Integer, nullable=False, default=0)
    bloqueado_hasta  = Column(DateTime(timezone=True), nullable=True)
    actualizado_en   = Column(DateTime(timezone=True), nullable=False)
