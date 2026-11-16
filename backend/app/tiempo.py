# -*- coding: utf-8 -*-
"""
SESAES — Zona horaria del proceso.

Las citas, los horarios y las reglas ("no cancelar con menos de 5 horas",
"citas de hoy", "hora ya pasada") están en HORA DE CHILE, pero un servidor en la
nube suele correr en UTC. Con UTC, `datetime.now()` y `date.today()` se desfasan
3 o 4 horas respecto de la hora de la cita:

  * la regla de las 5 horas para cancelar se calculaba mal (se podía cancelar
    una cita con menos de 5 horas de anticipación);
  * pasadas las 21:00 de Chile, el servidor creía que ya era "mañana".

En vez de cambiar los ~37 puntos del código que leen la hora local, se fija la zona
horaria del PROCESO al arrancar: así `datetime.now()` y `date.today()` devuelven la
hora de Chile en cualquier servidor. No afecta a `datetime.utcnow()` ni a las
fechas con zona explícita (`datetime.now(timezone.utc)`).

Solo se aplica en sistemas POSIX (Linux, macOS), que es donde corre el servidor.
En Windows (desarrollo local) se usa la zona del propio equipo.
Se puede cambiar con la variable SESAES_TZ.
"""

from __future__ import annotations

import os
import time

ZONA_POR_DEFECTO = "America/Santiago"


def fijar_zona_horaria() -> str | None:
    """Fija la zona horaria del proceso. Devuelve la zona aplicada, o None si no se pudo."""
    if not hasattr(time, "tzset"):          # Windows: no existe tzset, no se toca nada
        return None
    zona = (os.getenv("SESAES_TZ") or ZONA_POR_DEFECTO).strip()
    os.environ["TZ"] = zona
    time.tzset()
    return zona
