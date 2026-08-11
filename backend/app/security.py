import bcrypt

_HASH_PREFIXES = ("$2a$", "$2b$", "$2y$")


def hash_password(password: str) -> str:
    """Genera el hash bcrypt de una contraseña en texto plano."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def is_legacy_plaintext(stored_password: str) -> bool:
    """
    True si la contraseña guardada todavía es texto plano (usuarios creados
    antes de esta migración a bcrypt), False si ya es un hash bcrypt.
    """
    return not (stored_password and stored_password.startswith(_HASH_PREFIXES))


def verify_password(plain_password: str, stored_password: str) -> bool:
    """
    Verifica una contraseña contra lo guardado en la base de datos.
    Soporta tanto hashes bcrypt (usuarios ya migrados) como texto plano
    (usuarios antiguos, hasta que inicien sesión y se migren automáticamente).
    """
    if not stored_password or not plain_password:
        return False
    if is_legacy_plaintext(stored_password):
        return stored_password == plain_password
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), stored_password.encode("utf-8"))
    except ValueError:
        return False
