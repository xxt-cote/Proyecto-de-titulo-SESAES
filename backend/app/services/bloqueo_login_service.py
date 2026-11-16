# -*- coding: utf-8 -*-
"""
SESAES — Bloqueo temporal de cuenta por intentos fallidos de login.

El límite por IP (slowapi) no basta: detrás de un proxy todos pueden compartir
IP, y un atacante puede rotarlas. Aquí se cuentan los fallos POR CORREO.

  * MAX_FALLIDOS fallos seguidos  ->  la cuenta queda bloqueada VENTANA_MIN minutos.
  * Un inicio de sesión correcto, o restablecer la contraseña, borra el contador.
  * Se cuenta también para correos que NO existen: así el sistema responde igual y
    no revela qué correos están registrados.
  * Los registros viejos se limpian solos (no crece la tabla).

Sin commit: lo hace quien llama.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.models.seguridad_cuenta import IntentoLogin

MAX_FALLIDOS = 5
VENTANA_MIN = 15
_LIMPIAR_DESPUES = timedelta(days=1)


def _ahora() -> datetime:
    return datetime.now(timezone.utc)


def _utc(dt: Optional[datetime]) -> Optional[datetime]:
    """SQLite devuelve fechas sin zona: se interpretan como UTC."""
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def normalizar(correo: str) -> str:
    return (correo or "").strip().lower()


def _fila(db: Session, correo: str) -> Optional[IntentoLogin]:
    return db.query(IntentoLogin).filter(IntentoLogin.correo == correo).first()


def minutos_restantes(db: Session, correo: str) -> int:
    """Minutos que faltan para el desbloqueo (0 si no está bloqueada)."""
    fila = _fila(db, normalizar(correo))
    if fila is None:
        return 0
    hasta = _utc(fila.bloqueado_hasta)
    if hasta is None or hasta <= _ahora():
        return 0
    return max(1, int((hasta - _ahora()).total_seconds() // 60) + 1)


def esta_bloqueada(db: Session, correo: str) -> bool:
    return minutos_restantes(db, correo) > 0


def registrar_fallo(db: Session, correo: str) -> IntentoLogin:
    correo = normalizar(correo)
    ahora = _ahora()
    fila = _fila(db, correo)
    if fila is None:
        fila = IntentoLogin(correo=correo, fallidos=0, actualizado_en=ahora)
        db.add(fila)
    else:
        hasta = _utc(fila.bloqueado_hasta)
        ultimo = _utc(fila.actualizado_en) or ahora
        # Terminó el bloqueo, o pasó mucho tiempo desde el último fallo: se parte de cero.
        if (hasta is not None and hasta <= ahora) or (ahora - ultimo) > timedelta(minutes=VENTANA_MIN):
            fila.fallidos = 0
            fila.bloqueado_hasta = None
    fila.fallidos = (fila.fallidos or 0) + 1
    fila.actualizado_en = ahora
    if fila.fallidos >= MAX_FALLIDOS:
        fila.bloqueado_hasta = ahora + timedelta(minutes=VENTANA_MIN)
    # Limpieza oportunista de filas viejas (nadie las necesita).
    db.query(IntentoLogin).filter(
        IntentoLogin.actualizado_en < ahora - _LIMPIAR_DESPUES,
        IntentoLogin.id != fila.id,
    ).delete(synchronize_session=False)
    db.flush()
    return fila


def limpiar(db: Session, correo: str) -> None:
    """Borra el contador (inicio de sesión correcto o contraseña restablecida)."""
    db.query(IntentoLogin).filter(IntentoLogin.correo == normalizar(correo)).delete(synchronize_session=False)
