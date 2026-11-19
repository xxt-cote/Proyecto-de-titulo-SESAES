"""Zona de negocio del centro; los instantes técnicos se conservan en UTC."""
import os
import time

from datetime import datetime, timezone
from zoneinfo import ZoneInfo

NOMBRE_ZONA_CENTRO = "America/Santiago"
ZONA_CENTRO = ZoneInfo(NOMBRE_ZONA_CENTRO)


def ahora_local():
    """Hora civil del centro para columnas históricas sin zona horaria."""
    return datetime.now(ZONA_CENTRO).replace(tzinfo=None)


def instante_utc(valor: datetime) -> datetime:
    """Un valor legacy sin offset representa hora civil de Santiago, no del host."""
    if valor.tzinfo is None:
        valor = valor.replace(tzinfo=ZONA_CENTRO)
    return valor.astimezone(timezone.utc)


# Compatibilidad con el arranque POSIX incorporado por el equipo.
# Las reglas de negocio usan ZONA_CENTRO explícitamente, incluso en Windows.
ZONA_POR_DEFECTO = NOMBRE_ZONA_CENTRO


def fijar_zona_horaria() -> str | None:
    """Fija la zona horaria del proceso. Devuelve la zona aplicada, o None si no se pudo."""
    if not hasattr(time, "tzset"):          # Windows: no existe tzset, no se toca nada
        return None
    zona = (os.getenv("SESAES_TZ") or ZONA_POR_DEFECTO).strip()
    os.environ["TZ"] = zona
    time.tzset()
    return zona
