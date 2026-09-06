"""
Helper central de auditoría (SA-2).

Reemplaza los 3 `registrar_auditoria` locales de admin.py, profesionales.py
y solicitudes_horario.py.

Contrato de seguridad (acordado, no renegociable en SA-2):
- El actor (usuario_id, actor_rol) se deriva EXCLUSIVAMENTE de
  `current_user`, nunca se acepta usuario_id/actor_id/actor_rol como
  parámetro externo del helper.
- current_user["id"] y current_user["rol"] son obligatorios: su ausencia
  falla cerrado (ValueError). Nunca se persiste un evento con actor
  desconocido de forma silenciosa.
- `resultado` solo puede ser "exito", "denegado" o "error"; cualquier
  otro valor lanza ValueError.
- Este helper SOLO hace `db.add(...)`. Nunca hace commit() ni
  rollback(): la transaccionalidad (commit único junto con la mutación
  de negocio, o rollback + commit best-effort del evento de error) es
  responsabilidad exclusiva del call-site.
- NUNCA pasar detalle=str(exc): una excepción puede contener información
  sensible. El call-site debe pasar solo mensajes/códigos de error
  seguros, definidos explícitamente.
"""

from typing import Any, Mapping, Optional

from app.models.auditoria import Auditoria

RESULTADOS_VALIDOS = {"exito", "denegado", "error"}


def registrar_evento_auditoria(
    db,
    current_user: Mapping[str, Any],
    accion: str,
    *,
    resultado: str = "exito",
    entidad: Optional[str] = None,
    entidad_id: Optional[int] = None,
    detalle: Optional[str] = None,
) -> Auditoria:
    """
    Construye un evento de Auditoria y lo agrega a la sesión (db.add).
    No hace commit ni rollback.

    Lanza ValueError si:
    - `resultado` no está en RESULTADOS_VALIDOS
    - current_user no trae "id"
    - current_user no trae "rol"
    """
    if resultado not in RESULTADOS_VALIDOS:
        raise ValueError(
            f"resultado inválido: {resultado!r}. "
            f"Debe ser uno de {sorted(RESULTADOS_VALIDOS)}."
        )

    usuario_id = current_user.get("id") if current_user else None
    actor_rol = current_user.get("rol") if current_user else None

    if usuario_id is None:
        raise ValueError(
            "No se puede registrar un evento de auditoría sin "
            "current_user['id']: el actor nunca se infiere ni se acepta "
            "como parámetro externo."
        )
    if not actor_rol:
        raise ValueError(
            "No se puede registrar un evento de auditoría sin "
            "current_user['rol']: el actor nunca se infiere ni se acepta "
            "como parámetro externo."
        )

    evento = Auditoria(
        usuario_id=usuario_id,
        actor_rol=actor_rol,
        accion=accion,
        resultado=resultado,
        entidad=entidad,
        entidad_id=entidad_id,
        detalle=detalle,
    )
    db.add(evento)
    return evento
