from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.models.cita import Cita
from app.models.profesional import Profesional
from app.models.usuario import Usuario
from app.rbac.admin_authorization import (
    AlcanceAdministrativoEfectivo,
    normalizar_especialidad,
)
from app.routers import admin


class RecordingQuery:
    def __init__(
        self,
        *,
        rows=None,
        scalar_value=0,
    ):
        self.rows = list(rows or [])
        self.scalar_value = scalar_value
        self.events = []
        self.filter_calls = []

    def filter(self, *conditions):
        self.events.append("filter")
        self.filter_calls.append(conditions)
        return self

    def order_by(self, *args, **kwargs):
        self.events.append("order_by")
        return self

    def limit(self, value):
        self.events.append(("limit", value))
        return self

    def all(self):
        self.events.append("all")
        return list(self.rows)

    def first(self):
        self.events.append("first")
        return self.rows[0] if self.rows else None

    def scalar(self):
        self.events.append("scalar")
        return self.scalar_value


class FakeDB:
    def __init__(
        self,
        *,
        estudiante=None,
        citas=None,
        profesionales=None,
        scalar_values=None,
    ):
        self.estudiante = estudiante
        self.citas = list(citas or [])
        self.profesionales = list(
            profesionales or []
        )
        self.scalar_values = list(
            scalar_values or []
        )

        self.usuario_queries = []
        self.cita_queries = []
        self.profesional_queries = []
        self.scalar_queries = []
        self.query_calls = []

    def query(self, *entities):
        self.query_calls.append(entities)

        if len(entities) == 1 and entities[0] is Usuario:
            query = RecordingQuery(
                rows=(
                    [self.estudiante]
                    if self.estudiante is not None
                    else []
                )
            )
            self.usuario_queries.append(query)
            return query

        if len(entities) == 1 and entities[0] is Cita:
            query = RecordingQuery(
                rows=self.citas
            )
            self.cita_queries.append(query)
            return query

        if len(entities) == 1 and entities[0] is Profesional:
            query = RecordingQuery(
                rows=self.profesionales
            )
            self.profesional_queries.append(query)
            return query

        value = (
            self.scalar_values.pop(0)
            if self.scalar_values
            else 0
        )

        query = RecordingQuery(
            scalar_value=value
        )
        self.scalar_queries.append(query)

        return query


def _alcance_limitado(*especialidades):
    return AlcanceAdministrativoEfectivo(
        institucional=False,
        especialidades_normalizadas=frozenset(
            normalizar_especialidad(e).normalizada
            for e in especialidades
        ),
    )


def _alcance_institucional():
    return AlcanceAdministrativoEfectivo(
        institucional=True,
        especialidades_normalizadas=frozenset(),
    )


def _filtros_scope(query):
    encontrados = []

    for call in query.filter_calls:
        for condition in call:
            left = getattr(
                condition,
                "left",
                None,
            )

            if getattr(
                left,
                "name",
                None,
            ) != "profesional_id":
                continue

            right = getattr(
                condition,
                "right",
                None,
            )

            value = getattr(
                right,
                "value",
                None,
            )

            if isinstance(
                value,
                (list, tuple, set),
            ):
                encontrados.append(
                    list(value)
                )

    return encontrados


def _estudiante():
    return SimpleNamespace(
        id=20,
        nombre="Ana",
        rut="11.111.111-1",
        carrera="Gastronom?a",
        correo="ana@ejemplo.cl",
    )


def _cita():
    return SimpleNamespace(
        id=100,
        estudiante_id=20,
        profesional_id=10,
        fecha="2026-09-01",
        hora="09:00",
        estado="completada",
    )


def _profesional():
    return SimpleNamespace(
        id=10,
        nombre="Nutricionista Uno",
        especialidad="Nutrici?n",
    )


def test_perfil_limitado_scopea_citas_y_metricas(
    monkeypatch,
):
    db = FakeDB(
        estudiante=_estudiante(),
        citas=[_cita()],
        profesionales=[_profesional()],
        scalar_values=[
            3,
            2,
        ],
    )

    monkeypatch.setattr(
        admin,
        "obtener_alcance_administrativo_efectivo",
        lambda db, current_user: _alcance_limitado(
            "Nutrici?n"
        ),
    )

    monkeypatch.setattr(
        admin,
        "_ids_profesionales_en_alcance",
        lambda db, alcance: [10, 11],
    )

    resultado = admin.perfil_estudiante_admin(
        estudiante_id=20,
        db=db,
        current_user={
            "id": 50,
            "rol": "admin",
        },
    )

    assert resultado == {
        "id": 20,
        "nombre": "Ana",
        "rut": "11.111.111-1",
        "carrera": "Gastronom?a",
        "correo": "ana@ejemplo.cl",
        "telefono": None,
        "foto_url": None,
        # Un solo token: una sola letra (no "dos primeras letras
        # de la misma palabra").
        "iniciales": "A",
        "activo": True,
        "citas_totales": 3,
        "citas_atendidas": 2,
        # scalar_values solo trae 2 valores (total/atendidas); los
        # contadores agregados nuevos (pendientes/canceladas/
        # inasistencias) caen al valor por defecto del FakeDB (0)
        # al agotarse la cola.
        "citas_pendientes": 0,
        "citas_canceladas": 0,
        "citas_inasistencias": 0,
        "ultimas_atenciones": [
            {
                "id": 100,
                "fecha": "2026-09-01",
                "hora": "09:00",
                "estado": "completada",
                "tipo": "normal",
                "urgente": False,
                "especialidad": "Nutrici?n",
                "profesional": "Nutricionista Uno",
            }
        ],
        "historial": [
            {
                "id": 100,
                "fecha": "2026-09-01",
                "hora": "09:00",
                "estado": "completada",
                "tipo": "normal",
                "urgente": False,
                "especialidad": "Nutrici?n",
                "profesional": "Nutricionista Uno",
            }
        ],
        "historial_total": 1,
        "historial_pagina": 1,
        "historial_por_pagina": 5,
    }

    assert len(db.scalar_queries) == 5

    # Antes hab?a una consulta separada para "?ltimas atenciones"
    # (limit 10) y otra para el historial completo -- ambas se
    # unificaron en una sola consulta de Cita, reutilizada para
    # las dos secciones.
    assert len(db.cita_queries) == 1

    # El profesional ya no se consulta una vez por cada cita
    # (N+1): se trae en un solo batch con Profesional.id.in_(...).
    assert len(db.profesional_queries) == 1

    for query in db.scalar_queries:
        assert _filtros_scope(query) == [
            [10, 11],
        ]

    assert _filtros_scope(
        db.cita_queries[0]
    ) == [
        [10, 11],
    ]


def test_perfil_limitado_fuera_de_scope_da_404(
    monkeypatch,
):
    db = FakeDB(
        estudiante=_estudiante(),
        scalar_values=[0],
    )

    monkeypatch.setattr(
        admin,
        "obtener_alcance_administrativo_efectivo",
        lambda db, current_user: _alcance_limitado(
            "Nutrici?n"
        ),
    )

    monkeypatch.setattr(
        admin,
        "_ids_profesionales_en_alcance",
        lambda db, alcance: [10],
    )

    with pytest.raises(HTTPException) as exc:
        admin.perfil_estudiante_admin(
            estudiante_id=20,
            db=db,
            current_user={
                "id": 50,
                "rol": "admin",
            },
        )

    assert exc.value.status_code == 404

    # No debe consultar ni devolver atenciones fuera del scope.
    assert db.cita_queries == []
    assert db.profesional_queries == []


def test_perfil_limitado_sin_profesionales_da_404_sin_buscar_estudiante(
    monkeypatch,
):
    db = FakeDB(
        estudiante=_estudiante(),
    )

    monkeypatch.setattr(
        admin,
        "obtener_alcance_administrativo_efectivo",
        lambda db, current_user: _alcance_limitado(
            "Nutrici?n"
        ),
    )

    monkeypatch.setattr(
        admin,
        "_ids_profesionales_en_alcance",
        lambda db, alcance: [],
    )

    with pytest.raises(HTTPException) as exc:
        admin.perfil_estudiante_admin(
            estudiante_id=20,
            db=db,
            current_user={
                "id": 50,
                "rol": "admin",
            },
        )

    assert exc.value.status_code == 404
    assert db.query_calls == []


def test_perfil_institucional_conserva_acceso_global(
    monkeypatch,
):
    db = FakeDB(
        estudiante=_estudiante(),
        citas=[_cita()],
        profesionales=[_profesional()],
        scalar_values=[
            5,
            4,
        ],
    )

    monkeypatch.setattr(
        admin,
        "obtener_alcance_administrativo_efectivo",
        lambda db, current_user: _alcance_institucional(),
    )

    resultado = admin.perfil_estudiante_admin(
        estudiante_id=20,
        db=db,
        current_user={
            "id": 1,
            "rol": "superadmin",
        },
    )

    assert resultado["citas_totales"] == 5
    assert resultado["citas_atendidas"] == 4
    assert len(resultado["ultimas_atenciones"]) == 1

    for query in db.scalar_queries:
        assert _filtros_scope(query) == []

    assert _filtros_scope(
        db.cita_queries[0]
    ) == []


def test_perfil_institucional_sin_citas_sigue_visible(
    monkeypatch,
):
    db = FakeDB(
        estudiante=_estudiante(),
        citas=[],
        scalar_values=[
            0,
            0,
        ],
    )

    monkeypatch.setattr(
        admin,
        "obtener_alcance_administrativo_efectivo",
        lambda db, current_user: _alcance_institucional(),
    )

    resultado = admin.perfil_estudiante_admin(
        estudiante_id=20,
        db=db,
        current_user={
            "id": 1,
            "rol": "superadmin",
        },
    )

    assert resultado["id"] == 20
    assert resultado["citas_totales"] == 0
    assert resultado["citas_atendidas"] == 0
    assert resultado["ultimas_atenciones"] == []


def test_perfil_sin_alcance_da_403(
    monkeypatch,
):
    db = FakeDB(
        estudiante=_estudiante(),
    )

    monkeypatch.setattr(
        admin,
        "obtener_alcance_administrativo_efectivo",
        lambda db, current_user: None,
    )

    with pytest.raises(HTTPException) as exc:
        admin.perfil_estudiante_admin(
            estudiante_id=20,
            db=db,
            current_user={
                "id": 50,
                "rol": "admin",
            },
        )

    assert exc.value.status_code == 403
    assert db.query_calls == []


def test_perfil_inexistente_conserva_404(
    monkeypatch,
):
    db = FakeDB(
        estudiante=None,
    )

    monkeypatch.setattr(
        admin,
        "obtener_alcance_administrativo_efectivo",
        lambda db, current_user: _alcance_institucional(),
    )

    with pytest.raises(HTTPException) as exc:
        admin.perfil_estudiante_admin(
            estudiante_id=999,
            db=db,
            current_user={
                "id": 1,
                "rol": "superadmin",
            },
        )

    assert exc.value.status_code == 404


def test_perfil_no_expone_campos_clinicos(
    monkeypatch,
):
    cita = _cita()

    # Aunque el objeto tenga campos cl?nicos, no deben salir.
    cita.medicamento = "NO DEBE SALIR"
    cita.observaciones_atencion = "NO DEBE SALIR"

    db = FakeDB(
        estudiante=_estudiante(),
        citas=[cita],
        profesionales=[_profesional()],
        scalar_values=[
            1,
            1,
        ],
    )

    monkeypatch.setattr(
        admin,
        "obtener_alcance_administrativo_efectivo",
        lambda db, current_user: _alcance_institucional(),
    )

    resultado = admin.perfil_estudiante_admin(
        estudiante_id=20,
        db=db,
        current_user={
            "id": 1,
            "rol": "superadmin",
        },
    )

    atencion = resultado["ultimas_atenciones"][0]

    assert "medicamento" not in atencion
    assert "observaciones_atencion" not in atencion


def test_perfil_no_reintroduce_n_mas_1_al_crecer_las_citas(
    monkeypatch,
):
    """
    Antes se consultaba Profesional una vez por cada cita (N+1).
    Con muchas citas del mismo profesional, el n?mero de consultas
    a Profesional debe mantenerse fijo (1 consulta batch), sin
    crecer con la cantidad de citas.
    """
    citas = [
        SimpleNamespace(
            id=100 + i,
            estudiante_id=20,
            profesional_id=10,
            fecha=f"2026-09-{(i % 28) + 1:02d}",
            hora="09:00",
            estado="completada",
        )
        for i in range(25)
    ]

    db = FakeDB(
        estudiante=_estudiante(),
        citas=citas,
        profesionales=[_profesional()],
        scalar_values=[25, 25],
    )

    monkeypatch.setattr(
        admin,
        "obtener_alcance_administrativo_efectivo",
        lambda db, current_user: _alcance_institucional(),
    )

    resultado = admin.perfil_estudiante_admin(
        estudiante_id=20,
        db=db,
        current_user={
            "id": 1,
            "rol": "superadmin",
        },
    )

    assert resultado["historial_total"] == 25
    assert len(resultado["ultimas_atenciones"]) == 10

    # Una sola consulta a Cita y una sola consulta (batch) a
    # Profesional, sin importar que haya 25 citas.
    assert len(db.cita_queries) == 1
    assert len(db.profesional_queries) == 1


def test_perfil_urgente_y_sobrecupo_son_independientes(
    monkeypatch,
):
    """
    Una cita marcada como urgente Y sobrecupo simult?neamente no
    debe perder ninguna de las dos condiciones: "tipo" (condici?n)
    y "urgente" (prioridad) se exponen como atributos separados.
    """
    cita_ambas = SimpleNamespace(
        id=200,
        estudiante_id=20,
        profesional_id=10,
        fecha="2026-09-05",
        hora="09:00",
        estado="pendiente",
        urgente=True,
        sobrecupo=True,
    )

    db = FakeDB(
        estudiante=_estudiante(),
        citas=[cita_ambas],
        profesionales=[_profesional()],
        scalar_values=[1, 0],
    )

    monkeypatch.setattr(
        admin,
        "obtener_alcance_administrativo_efectivo",
        lambda db, current_user: _alcance_institucional(),
    )

    resultado = admin.perfil_estudiante_admin(
        estudiante_id=20,
        db=db,
        current_user={
            "id": 1,
            "rol": "superadmin",
        },
    )

    atencion = resultado["ultimas_atenciones"][0]

    assert atencion["tipo"] == "sobrecupo"
    assert atencion["urgente"] is True

    historial_fila = resultado["historial"][0]

    assert historial_fila["tipo"] == "sobrecupo"
    assert historial_fila["urgente"] is True
