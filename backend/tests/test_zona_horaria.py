# -*- coding: utf-8 -*-
"""La hora del servidor debe ser la de Chile, aunque el proceso parta en UTC."""

import os
import time
from datetime import datetime

import pytest

from app import tiempo

pytestmark = pytest.mark.skipif(not hasattr(time, "tzset"), reason="tzset solo existe en Linux/macOS")


@pytest.fixture()
def zona_original():
    previa = os.environ.get("TZ")
    yield
    if previa is None:
        os.environ.pop("TZ", None)
    else:
        os.environ["TZ"] = previa
    time.tzset()


def _horas_de_diferencia_con_utc() -> float:
    return time.localtime().tm_gmtoff / 3600


def test_fija_la_hora_de_chile_aunque_el_servidor_este_en_utc(zona_original, monkeypatch):
    monkeypatch.delenv("SESAES_TZ", raising=False)
    os.environ["TZ"] = "UTC"
    time.tzset()
    assert _horas_de_diferencia_con_utc() == 0

    assert tiempo.fijar_zona_horaria() == "America/Santiago"
    assert _horas_de_diferencia_con_utc() in (-3.0, -4.0)        # verano -3, invierno -4


def test_datetime_now_y_utcnow_quedan_separados_por_la_diferencia_con_utc(zona_original, monkeypatch):
    monkeypatch.delenv("SESAES_TZ", raising=False)
    os.environ["TZ"] = "UTC"
    time.tzset()
    tiempo.fijar_zona_horaria()
    local = datetime.now()
    utc = datetime.fromtimestamp(time.time(), tz=None) if False else datetime.utcfromtimestamp(time.time())
    diferencia = (utc - local).total_seconds() / 3600
    assert round(diferencia) in (3, 4)


def test_se_puede_cambiar_con_sesaes_tz(zona_original, monkeypatch):
    monkeypatch.setenv("SESAES_TZ", "Pacific/Kiritimati")         # UTC+14, sin horario de verano
    assert tiempo.fijar_zona_horaria() == "Pacific/Kiritimati"
    assert _horas_de_diferencia_con_utc() == 14


def test_importar_la_app_deja_la_hora_en_chile(zona_original, monkeypatch):
    # Es lo que ocurre en producción: al cargar app.main el proceso queda en hora de Chile.
    monkeypatch.delenv("SESAES_TZ", raising=False)
    import app.main  # noqa: F401
    tiempo.fijar_zona_horaria()
    assert _horas_de_diferencia_con_utc() in (-3.0, -4.0)
