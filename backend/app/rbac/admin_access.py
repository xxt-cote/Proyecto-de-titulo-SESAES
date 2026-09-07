"""
SESAES - SA-8: perfiles y alcance administrativo.

Esta capa NO concede permisos. Solo modela:
- perfil administrativo;
- tipo de alcance;
- especialidades incluidas en un alcance limitado.

La autorizacion efectiva se implementara en SA-9 combinando:
permiso + alcance + estado de la cuenta.

SUPERADMIN no usa esta configuracion y no obtiene acceso clinico por ella.
"""

from __future__ import annotations

import enum
import unicodedata
from dataclasses import dataclass
from typing import Iterable


class PerfilAccesoAdmin(str, enum.Enum):
    ADMINISTRADOR_GENERAL = "administrador_general"
    ADMINISTRADOR_ESPECIALIDAD = "administrador_especialidad"
    SECRETARIA_GENERAL = "secretaria_general"
    SECRETARIA_ESPECIALIDAD = "secretaria_especialidad"


class TipoAlcanceAdmin(str, enum.Enum):
    INSTITUCIONAL = "institucional"
    ESPECIALIDADES = "especialidades"


PERFILES_INSTITUCIONALES = frozenset(
    {
        PerfilAccesoAdmin.ADMINISTRADOR_GENERAL,
        PerfilAccesoAdmin.SECRETARIA_GENERAL,
    }
)

PERFILES_ESPECIALIDAD = frozenset(
    {
        PerfilAccesoAdmin.ADMINISTRADOR_ESPECIALIDAD,
        PerfilAccesoAdmin.SECRETARIA_ESPECIALIDAD,
    }
)


@dataclass(frozen=True)
class EspecialidadAlcance:
    nombre: str
    normalizada: str


def limpiar_especialidad(valor: str) -> str:
    """
    Conserva una representacion legible pero elimina diferencias triviales:
    Unicode compatible, espacios externos y espacios repetidos.
    """
    if not isinstance(valor, str):
        raise ValueError("La especialidad debe ser texto.")

    limpia = " ".join(unicodedata.normalize("NFKC", valor).split())

    if not limpia:
        raise ValueError("La especialidad no puede estar vacia.")

    return limpia


def normalizar_especialidad(valor: str) -> EspecialidadAlcance:
    """
    Genera nombre visible + clave estable para comparar/deduplicar.

    No valida contra un catalogo fijo: Profesional.especialidad sigue siendo
    texto libre en la arquitectura actual de SESAES.
    """
    nombre = limpiar_especialidad(valor)

    return EspecialidadAlcance(
        nombre=nombre,
        normalizada=nombre.casefold(),
    )


def validar_configuracion_acceso_admin(
    *,
    rol_usuario: object,
    perfil: PerfilAccesoAdmin | str,
    tipo_alcance: TipoAlcanceAdmin | str,
    especialidades: Iterable[str] | None = None,
) -> tuple[
    PerfilAccesoAdmin,
    TipoAlcanceAdmin,
    tuple[EspecialidadAlcance, ...],
]:
    """
    Valida las invariantes de SA-8.

    Reglas:
    - solo rol base ADMIN puede tener esta configuracion;
    - perfiles generales -> alcance institucional y cero especialidades;
    - perfiles de especialidad -> alcance especialidades y al menos una;
    - no se permiten especialidades duplicadas tras normalizacion.
    """
    rol_valor = getattr(rol_usuario, "value", rol_usuario)
    rol_normalizado = str(rol_valor or "").strip().lower()

    if rol_normalizado != "admin":
        raise ValueError(
            "Solo una cuenta con rol base admin puede tener "
            "configuracion de acceso administrativo."
        )

    try:
        perfil_enum = PerfilAccesoAdmin(perfil)
    except (TypeError, ValueError) as exc:
        raise ValueError("Perfil administrativo invalido.") from exc

    try:
        alcance_enum = TipoAlcanceAdmin(tipo_alcance)
    except (TypeError, ValueError) as exc:
        raise ValueError("Tipo de alcance administrativo invalido.") from exc

    normalizadas: list[EspecialidadAlcance] = []
    claves: set[str] = set()

    for valor in especialidades or ():
        especialidad = normalizar_especialidad(valor)

        if especialidad.normalizada in claves:
            raise ValueError(
                "No se permiten especialidades duplicadas en el alcance."
            )

        claves.add(especialidad.normalizada)
        normalizadas.append(especialidad)

    if perfil_enum in PERFILES_INSTITUCIONALES:
        if alcance_enum is not TipoAlcanceAdmin.INSTITUCIONAL:
            raise ValueError(
                "Un perfil general debe tener alcance institucional."
            )

        if normalizadas:
            raise ValueError(
                "Un alcance institucional no debe declarar especialidades."
            )

    elif perfil_enum in PERFILES_ESPECIALIDAD:
        if alcance_enum is not TipoAlcanceAdmin.ESPECIALIDADES:
            raise ValueError(
                "Un perfil de especialidad debe tener alcance por especialidades."
            )

        if not normalizadas:
            raise ValueError(
                "Un perfil de especialidad requiere al menos una especialidad."
            )

    return perfil_enum, alcance_enum, tuple(normalizadas)
