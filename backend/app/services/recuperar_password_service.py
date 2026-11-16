# -*- coding: utf-8 -*-
"""
SESAES — "Olvidé mi contraseña": enlace de un solo uso, con vencimiento.

Reglas de seguridad:
  * El token se genera con `secrets` (256 bits) y en la base solo se guarda su
    SHA-256. El enlace completo viaja únicamente por correo.
  * Vence a los 30 minutos y se puede usar UNA vez. Pedir uno nuevo anula los anteriores.
  * La respuesta del endpoint es SIEMPRE la misma exista o no el correo (no se
    revela qué correos están registrados).
  * Máximo 3 enlaces por cuenta por hora (evita llenar de correos a una persona).
  * El correo NO se guarda con su enlace en `correo_log` (el panel de administración
    muestra ese registro: un administrador podría tomar la cuenta de otra persona).
    Se registra el hecho del envío, sin el enlace.
  * Al restablecer: se aplica la política única de contraseñas, se anulan todos los
    enlaces, se desbloquea la cuenta y se avisa por correo (sin incluir contraseña).
"""

from __future__ import annotations

import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auditoria import registrar_evento_auditoria
from app.models.correo_log import CorreoLog
from app.models.seguridad_cuenta import RestablecimientoPassword
from app.models.usuario import Usuario
from app.security import PASSWORD_POLICY_MESSAGE, hash_password, password_cumple_politica
from app.services import bloqueo_login_service

VENCE_MIN = int(os.getenv("RESET_TOKEN_MINUTES", "30"))
MAX_POR_HORA = 3
MENSAJE_ENLACE_INVALIDO = "El enlace no es válido o ya venció. Solicita uno nuevo."


def _ahora() -> datetime:
    return datetime.now(timezone.utc)


def _utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _enlace(token: str) -> str:
    base = os.getenv("FRONTEND_BASE_URL", "http://localhost:4200").rstrip("/")
    return f"{base}/restablecer?token={token}"


def _enviar(destinatario: str, asunto: str, cuerpo: str) -> tuple[bool, Optional[str]]:
    # Import tardío: el módulo de correos es un router (evita un ciclo de imports).
    from app.routers.correos import _enviar_smtp
    return _enviar_smtp(destinatario, asunto, cuerpo)


def solicitar(db: Session, correo: str) -> None:
    """Genera y envía el enlace si la cuenta existe y está activa. No devuelve nada a propósito."""
    correo_norm = (correo or "").strip().lower()
    if not correo_norm:
        return
    usuario = db.query(Usuario).filter(func.lower(Usuario.correo) == correo_norm).first()
    if usuario is None or usuario.activo is False:
        return

    ahora = _ahora()
    recientes = db.query(RestablecimientoPassword).filter(
        RestablecimientoPassword.usuario_id == usuario.id,
        RestablecimientoPassword.creado_en > ahora - timedelta(hours=1),
    ).count()
    if recientes >= MAX_POR_HORA:
        return

    # Un enlace nuevo anula los anteriores sin usar.
    db.query(RestablecimientoPassword).filter(
        RestablecimientoPassword.usuario_id == usuario.id,
        RestablecimientoPassword.usado_en.is_(None),
    ).update({"usado_en": ahora}, synchronize_session=False)

    token = secrets.token_urlsafe(32)
    db.add(RestablecimientoPassword(
        usuario_id=usuario.id,
        token_hash=_hash(token),
        creado_en=ahora,
        expira_en=ahora + timedelta(minutes=VENCE_MIN),
    ))

    asunto = "SESAES - Restablecer tu contraseña"
    cuerpo = (
        f"Hola {usuario.nombre or ''},\n\n"
        "Recibimos una solicitud para restablecer la contraseña de tu cuenta SESAES.\n"
        f"Para elegir una nueva, abre este enlace. Vale {VENCE_MIN} minutos y solo se puede usar una vez:\n\n"
        f"{_enlace(token)}\n\n"
        "Si no fuiste tú, ignora este correo: tu contraseña no cambia.\n"
        "Por seguridad, SESAES nunca te pedirá tu contraseña por correo."
    )
    exito, error = _enviar(usuario.correo, asunto, cuerpo)

    # Registro del envío SIN el enlace.
    db.add(CorreoLog(
        destinatario=usuario.correo,
        asunto=asunto,
        cuerpo="[Enlace de restablecimiento omitido del registro por seguridad]",
        enviado=exito,
        error_envio=error,
        tipo="recuperacion_password",
        referencia_id=usuario.id,
    ))
    db.commit()


def restablecer(db: Session, token: str, nueva_password: str) -> Usuario:
    if not password_cumple_politica(nueva_password):
        raise HTTPException(status_code=400, detail=PASSWORD_POLICY_MESSAGE)

    fila = None
    if isinstance(token, str) and token:
        fila = db.query(RestablecimientoPassword).filter(
            RestablecimientoPassword.token_hash == _hash(token)
        ).first()
    ahora = _ahora()
    if fila is None or fila.usado_en is not None or (_utc(fila.expira_en) or ahora) <= ahora:
        raise HTTPException(status_code=400, detail=MENSAJE_ENLACE_INVALIDO)

    usuario = db.query(Usuario).filter(Usuario.id == fila.usuario_id).first()
    if usuario is None or usuario.activo is False:
        raise HTTPException(status_code=400, detail=MENSAJE_ENLACE_INVALIDO)

    usuario.password = hash_password(nueva_password)
    usuario.debe_cambiar_password = False
    # Se anulan este y cualquier otro enlace pendiente de la cuenta.
    db.query(RestablecimientoPassword).filter(
        RestablecimientoPassword.usuario_id == usuario.id,
        RestablecimientoPassword.usado_en.is_(None),
    ).update({"usado_en": ahora}, synchronize_session=False)
    bloqueo_login_service.limpiar(db, usuario.correo)

    registrar_evento_auditoria(
        db, {"id": usuario.id, "rol": usuario.rol, "correo": usuario.correo},
        "Restableció su contraseña con el enlace de recuperación",
        entidad="usuario", entidad_id=usuario.id,
    )
    aviso = "Te informamos que la contraseña de tu cuenta SESAES fue cambiada con el enlace de recuperación.\n\nSi no fuiste tú, comunícate de inmediato con SESAES."
    exito, error = _enviar(usuario.correo, "SESAES - Tu contraseña fue actualizada", f"Hola {usuario.nombre or ''},\n\n{aviso}\n\nPor seguridad, este correo nunca incluye tu contraseña.")
    db.add(CorreoLog(
        destinatario=usuario.correo, asunto="SESAES - Tu contraseña fue actualizada", cuerpo=aviso,
        enviado=exito, error_envio=error, tipo="cambio_password", referencia_id=usuario.id,
    ))
    db.commit()
    return usuario
