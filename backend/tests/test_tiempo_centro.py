from datetime import datetime, timedelta, timezone

import pytest

from app.tiempo import ZONA_CENTRO, instante_utc
from app.services.documento_clinico_service import a_hora_local


@pytest.mark.parametrize("mes,offset", [(1, -3), (7, -4)])
def test_zona_centro_respeta_verano_e_invierno(mes, offset):
    civil = datetime(2025, mes, 15, 9, tzinfo=ZONA_CENTRO)
    assert civil.utcoffset() == timedelta(hours=offset)
    assert instante_utc(civil.replace(tzinfo=None)) == civil.astimezone(timezone.utc)


def test_instante_con_offset_no_se_interpreta_como_hora_del_host():
    original = datetime(2025, 7, 15, 13, tzinfo=timezone.utc)
    assert instante_utc(original) == original
    assert instante_utc(datetime(2025, 7, 15, 9)) == original


def test_documento_utc_se_muestra_en_dia_anterior_en_santiago():
    assert a_hora_local("2025-07-16T01:30:00+00:00").isoformat() == "2025-07-15T21:30:00-04:00"


def test_documento_legacy_sin_offset_de_columna_aware_es_utc():
    assert a_hora_local("2025-01-16T01:30:00").isoformat() == "2025-01-15T22:30:00-03:00"


def test_plazo_transcurrido_cruza_cambio_de_hora_sin_inventar_una_hora():
    # Fin del horario de verano 2025: retroceso de una hora.
    antes = datetime(2025, 4, 5, 21)
    despues = datetime(2025, 4, 6, 3)
    assert (instante_utc(despues) - instante_utc(antes)).total_seconds() / 3600 == 7
