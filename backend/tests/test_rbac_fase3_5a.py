"""
SESAES — Fase 3.5A
Migración de backend administrativo desde guard global por rol hacia
autorización RBAC explícita endpoint por endpoint.
"""

from __future__ import annotations

import inspect

import pytest
from fastapi.routing import APIRoute

from app.rbac.permissions import Permission, has_permission
from app.routers import admin


ENDPOINTS = [
    ("GET", "/admin/estadisticas", Permission.REPORTES_VER),
    ("GET", "/admin/resumen-dia", Permission.AGENDA_GESTIONAR),
    ("GET", "/admin/proximas-citas", Permission.AGENDA_GESTIONAR),
    ("GET", "/admin/estudiantes", Permission.USUARIOS_GESTIONAR),
    ("GET", "/admin/estudiantes/listado", Permission.USUARIOS_GESTIONAR),
    ("GET", "/admin/estudiantes/{estudiante_id}/perfil", Permission.USUARIOS_GESTIONAR),
    ("GET", "/admin/graficos/especialidad", Permission.REPORTES_VER),
    ("GET", "/admin/graficos/semana", Permission.REPORTES_VER),
    ("GET", "/admin/profesionales", Permission.PROFESIONALES_GESTIONAR),
    ("POST", "/admin/profesionales", Permission.PROFESIONALES_GESTIONAR),
    ("PATCH", "/admin/profesionales/{prof_id}", Permission.PROFESIONALES_GESTIONAR),
    ("DELETE", "/admin/profesionales/{prof_id}", Permission.PROFESIONALES_GESTIONAR),
    ("PATCH", "/admin/profesionales/{prof_id}/estado", Permission.PROFESIONALES_GESTIONAR),
    ("GET", "/admin/profesionales/{prof_id}/historial-estados", Permission.PROFESIONALES_GESTIONAR),
    ("POST", "/admin/citas/urgente", Permission.AGENDA_GESTIONAR),
    ("PATCH", "/admin/citas/{cita_id}/cancelar", Permission.AGENDA_GESTIONAR),
    ("PATCH", "/admin/citas/{cita_id}/prioridad", Permission.AGENDA_GESTIONAR),
    ("GET", "/admin/dias-cerrados", Permission.AGENDA_GESTIONAR),
    ("POST", "/admin/dias-cerrados", Permission.AGENDA_GESTIONAR),
    ("GET", "/admin/dias-cerrados/{dia_id}/citas", Permission.AGENDA_GESTIONAR),
    ("DELETE", "/admin/dias-cerrados/{dia_id}", Permission.AGENDA_GESTIONAR),
    ("GET", "/admin/historial", Permission.REPORTES_VER),
    ("GET", "/admin/notificaciones", Permission.USUARIOS_GESTIONAR),
    ("GET", "/admin/exportar/cgr", Permission.REPORTES_CGR_EXPORTAR),
    ("GET", "/admin/exportar/alumnos", Permission.REPORTES_CGR_EXPORTAR),
    ("GET", "/admin/auditoria", Permission.AUDITORIA_VER),
    ("DELETE", "/admin/auditoria/{auditoria_id}", Permission.AUDITORIA_GESTIONAR),
    ("DELETE", "/admin/auditoria", Permission.AUDITORIA_GESTIONAR),
    ("GET", "/admin/configuracion", Permission.CONFIGURACION_GESTIONAR),
    ("PATCH", "/admin/configuracion", Permission.CONFIGURACION_GESTIONAR),
]


def _route(method: str, path: str) -> APIRoute:
    for route in admin.router.routes:
        if isinstance(route, APIRoute) and route.path == path and method in route.methods:
            return route
    raise AssertionError(f"No existe {method} {path}")


def _captured_permissions(route: APIRoute) -> list[Permission]:
    found: list[Permission] = []
    for param in inspect.signature(route.endpoint).parameters.values():
        dependency = getattr(param.default, "dependency", None)
        if dependency is None:
            continue
        closure = inspect.getclosurevars(dependency)
        permission = closure.nonlocals.get("permission")
        if isinstance(permission, Permission):
            found.append(permission)
    return found


def test_router_admin_ya_no_tiene_guard_global_por_rol():
    assert admin.router.dependencies == []
    assert not hasattr(admin, "solo_admin")


@pytest.mark.parametrize("method,path,permission", ENDPOINTS)
def test_cada_endpoint_admin_exige_su_permiso(method, path, permission):
    route = _route(method, path)
    assert _captured_permissions(route) == [permission]


def test_todas_las_rutas_admin_productivas_tienen_permiso_explicito():
    expected = {(method, path) for method, path, _ in ENDPOINTS}
    actual = {
        (method, route.path)
        for route in admin.router.routes
        if isinstance(route, APIRoute)
        for method in route.methods
        if method in {"GET", "POST", "PATCH", "PUT", "DELETE"}
    }
    assert actual == expected
    for method, path in sorted(actual):
        assert len(_captured_permissions(_route(method, path))) == 1


def test_auditoria_gestionar_es_superadmin_y_no_admin():
    assert has_permission("superadmin", Permission.AUDITORIA_GESTIONAR)
    assert not has_permission("admin", Permission.AUDITORIA_GESTIONAR)


def test_ver_auditoria_no_implica_gestionarla():
    assert Permission.AUDITORIA_VER != Permission.AUDITORIA_GESTIONAR


def test_historial_admin_no_expone_campos_clinicos():
    source = inspect.getsource(admin.get_historial_admin)
    assert '"medicamento"' not in source
    assert '"observaciones_atencion"' not in source


def test_notificaciones_admin_usan_usuario_autenticado():
    source = inspect.getsource(admin.get_notificaciones_admin)
    assert 'current_user["id"]' in source
    assert 'Usuario.rol == "admin"' not in source
    assert "admin.id" not in source
