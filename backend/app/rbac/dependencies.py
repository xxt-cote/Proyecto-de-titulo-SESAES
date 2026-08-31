"""
SESAES — RBAC: dependency factory para FastAPI (Fase 3.1)

require_permission(Permission.X) reutiliza get_current_user (la
autenticación ya existente) y agrega una capa de autorización por
permiso encima, sin crear una segunda autenticación ni tocar el JWT.

Comportamiento:
  - No autenticado / token inválido → conserva el 401 que ya lanza
    get_current_user (no se atrapa ni se reemplaza).
  - Autenticado pero sin el permiso → 403.
  - Con el permiso → devuelve current_user, permitiendo continuar
    al endpoint.
"""

from __future__ import annotations

from typing import Callable

from fastapi import Depends, HTTPException

from app.auth_dependencies import get_current_user
from app.rbac.permissions import Permission, has_permission


def require_permission(permission: Permission) -> Callable[..., dict]:
    """
    Devuelve una dependencia FastAPI que exige `permission` para el
    usuario autenticado actual.

    Uso típico en un endpoint:

        @router.get("/admin/auditoria")
        def get_auditoria(
            current_user: dict = Depends(require_permission(Permission.AUDITORIA_VER)),
        ):
            ...
    """

    def _dependency(current_user: dict = Depends(get_current_user)) -> dict:
        if not has_permission(current_user, permission):
            raise HTTPException(
                status_code=403,
                detail="No tienes permiso para acceder a este recurso.",
            )
        return current_user

    return _dependency
