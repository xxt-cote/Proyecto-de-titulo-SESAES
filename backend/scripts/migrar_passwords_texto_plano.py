# -*- coding: utf-8 -*-
"""
SESAES — Migración puntual: convierte a bcrypt las contraseñas que aún estén
guardadas en texto plano (usuarios creados antes de la migración a bcrypt).

Hoy `verify_password` todavía acepta texto plano y re-hashea al iniciar
sesión. Este script deja TODOS los usuarios con hash de una vez, para poder
eliminar esa rama legacy de `app/security.py` (ver PLAN_DE_MEJORAS.md).

Es idempotente: si ya no queda ninguna contraseña en texto plano, no hace
nada. No imprime contraseñas ni correos, solo cantidades.

Uso (desde backend/, con el venv activado):

    python -m scripts.migrar_passwords_texto_plano            # solo cuenta (simulación)
    python -m scripts.migrar_passwords_texto_plano --aplicar  # aplica el cambio

Haz un respaldo de la base antes de usar --aplicar.
"""

import sys

import app.models.init  # noqa: F401 — registro central de modelos

from app.database import SessionLocal
from app.models.usuario import Usuario
from app.security import hash_password, is_legacy_plaintext


def main(aplicar: bool) -> int:
    db = SessionLocal()
    try:
        pendientes = [
            u for u in db.query(Usuario).all()
            if u.password and is_legacy_plaintext(u.password)
        ]
        print(f"Usuarios con contraseña en texto plano: {len(pendientes)}")
        if not pendientes:
            print("Nada que migrar.")
            return 0
        if not aplicar:
            print("Simulación: no se modificó nada. Usa --aplicar para convertirlas a bcrypt.")
            return 0
        for u in pendientes:
            u.password = hash_password(u.password)
        db.commit()
        print(f"Migradas a bcrypt: {len(pendientes)}")
        return 0
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main("--aplicar" in sys.argv))
