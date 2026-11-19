from collections import Counter
from app.services.reportes_resumen_service import _ranking


def test_ranking_agrupa_especialidades_sin_cambiar_la_grafia_original():
    filas = _ranking(Counter({'Nutrición': 2, 'nutricion': 3, ' NUTRICIÓN ': 1}), 'especialidad')
    assert filas == [{'especialidad': 'Nutrición', 'cantidad': 6}]
