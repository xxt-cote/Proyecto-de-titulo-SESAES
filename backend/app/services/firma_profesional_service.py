# -*- coding: utf-8 -*-
"""
SESAES — Firma manuscrita digitalizada del profesional: validación, guardado,
copia dentro de cada documento emitido y dibujo en el PDF.

Este módulo NO importa documento_clinico_service (el servicio de documentos es
el que lo importa a él).
"""

from __future__ import annotations

import base64
import binascii
import io
import struct
from typing import Optional

from sqlalchemy.orm import Session

from app.models.firma_profesional import FirmaProfesional

METODOS_VALIDOS = ("dibujada", "escrita", "subida")
TIPO_FIRMA = "imagen_manuscrita_digitalizada"

_PREFIJO = "data:image/png;base64,"
_FIRMA_PNG = b"\x89PNG\r\n\x1a\n"
MAX_BYTES = 300_000
MAX_ANCHO, MAX_ALTO = 1200, 600
MIN_ANCHO, MIN_ALTO = 40, 15


class FirmaInvalida(ValueError):
    """La imagen recibida no cumple el formato o los límites."""


def decodificar_png(data_url: str) -> tuple[bytes, int, int]:
    """Valida el data URL y devuelve (bytes, ancho, alto). Solo se acepta PNG."""
    if not isinstance(data_url, str) or not data_url.startswith(_PREFIJO):
        raise FirmaInvalida("La firma debe ser una imagen PNG.")
    try:
        crudo = base64.b64decode(data_url[len(_PREFIJO):], validate=True)
    except (binascii.Error, ValueError):
        raise FirmaInvalida("La imagen de la firma está dañada.")
    if len(crudo) > MAX_BYTES:
        raise FirmaInvalida("La firma es demasiado pesada (máximo ~300 KB).")
    if len(crudo) < 33 or not crudo.startswith(_FIRMA_PNG) or crudo[12:16] != b"IHDR":
        raise FirmaInvalida("La firma debe ser una imagen PNG válida.")
    ancho, alto = struct.unpack(">II", crudo[16:24])
    if ancho > MAX_ANCHO or alto > MAX_ALTO:
        raise FirmaInvalida(f"La firma es demasiado grande (máximo {MAX_ANCHO}x{MAX_ALTO} px).")
    if ancho < MIN_ANCHO or alto < MIN_ALTO:
        raise FirmaInvalida("La firma es demasiado pequeña.")
    return crudo, ancho, alto


def obtener(db: Session, profesional_id: int) -> Optional[FirmaProfesional]:
    return db.query(FirmaProfesional).filter(FirmaProfesional.profesional_id == profesional_id).first()


def guardar(db: Session, profesional_id: int, data_url: str, metodo: str) -> FirmaProfesional:
    """Valida y deja UNA sola firma por profesional (reemplaza la anterior). Sin commit."""
    if metodo not in METODOS_VALIDOS:
        raise FirmaInvalida("Método de firma no válido.")
    decodificar_png(data_url)
    fila = obtener(db, profesional_id)
    if fila is None:
        fila = FirmaProfesional(profesional_id=profesional_id, imagen=data_url, metodo=metodo)
        db.add(fila)
    else:
        fila.imagen = data_url
        fila.metodo = metodo
    db.flush()
    return fila


def eliminar(db: Session, profesional_id: int) -> bool:
    fila = obtener(db, profesional_id)
    if fila is None:
        return False
    db.delete(fila)
    db.flush()
    return True


def agregar_firma(db: Session, prof, contenido: dict) -> dict:
    """
    Devuelve el contenido del documento con una COPIA de la firma vigente del
    profesional (si la tiene). Como `contenido` entra en la huella SHA-256, la
    firma queda protegida contra alteraciones, igual que el resto del documento.
    """
    fila = obtener(db, prof.id)
    if fila is None:
        return contenido
    return {**contenido, "firma": {"tipo": TIPO_FIRMA, "metodo": fila.metodo, "imagen": fila.imagen}}


def dibujar_imagen(pdf, data_url: str, centro_x: float, y_base: float,
                   ancho_max: float = 60.0, alto_max: float = 17.0) -> bool:
    """Dibuja la firma centrada, apoyada sobre `y_base`. Devuelve False si no se pudo."""
    try:
        crudo, ancho_px, alto_px = decodificar_png(data_url)
    except FirmaInvalida:
        return False
    escala = min(ancho_max / ancho_px, alto_max / alto_px)
    w, h = ancho_px * escala, alto_px * escala
    pdf.image(io.BytesIO(crudo), x=centro_x - w / 2, y=y_base - h, w=w, h=h)
    return True
