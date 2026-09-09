import bcrypt
import os
from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError

_HASH_PREFIXES = ("$2a$", "$2b$", "$2y$")

# ══════════════════════════════════════════════════════════
# JWT
# ══════════════════════════════════════════════════════════
# La clave se lee desde la variable de entorno JWT_SECRET_KEY.
# En producción (Render) esta variable DEBE estar configurada con un
# valor largo y aleatorio propio; el valor por defecto de acá abajo
# solo existe para que el proyecto no truene en desarrollo local si
# alguien olvidó definirla, y nunca debe usarse en producción.
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-only-inseguro-cambiar-en-produccion")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "720"))  # 12 horas


def create_access_token(data: dict) -> str:
    """
    Genera un JWT firmado con los datos mínimos necesarios para identificar
    al usuario en cada petición (id, rol, correo). No incluir datos sensibles
    acá: el payload de un JWT es legible por cualquiera (no está cifrado,
    solo firmado), solo garantiza que no fue alterado.
    """
    to_encode = data.copy()
    expira = datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRE_MINUTES)
    to_encode.update({"exp": expira})
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    """
    Valida la firma y expiración del token y devuelve su payload.
    Lanza jose.JWTError si el token es inválido, fue alterado, o expiró.
    """
    return jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])


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


# ══════════════════════════════════════════════════════════
# POLÍTICA DE COMPLEJIDAD DE CONTRASEÑA
# ══════════════════════════════════════════════════════════
# Política única para toda cuenta que cambia su propia contraseña
# (Estudiante, Profesional): mínimo 8 caracteres, una mayúscula, un
# número y un carácter especial, con verificación en vivo del lado del
# frontend (ver shared/password-validation.ts) y re-validación acá en
# el backend — el frontend nunca es la única barrera de seguridad.
_CARACTERES_ESPECIALES = "!@#$%^&*()_+-=[]{}|;:'\",.<>/?`~\\"


def errores_password(password: str) -> list[str]:
    """Devuelve la lista de requisitos de complejidad que NO cumple la
    contraseña dada. Lista vacía = contraseña válida."""
    password = password or ""
    errores = []
    if len(password) < 8:
        errores.append("Debe tener al menos 8 caracteres")
    if not any(c.isupper() for c in password):
        errores.append("Debe incluir al menos una letra mayúscula")
    if not any(c.isdigit() for c in password):
        errores.append("Debe incluir al menos un número")
    if not any(c in _CARACTERES_ESPECIALES for c in password):
        errores.append("Debe incluir al menos un carácter especial")
    return errores


def es_password_segura(password: str) -> bool:
    return len(errores_password(password)) == 0
