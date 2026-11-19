import os
from alembic.util import CommandError

from app.database import engine, SessionLocal
from app.migrations import upgrade_schema
import app.models.init  # noqa: F401 — registra el esquema completo
from app.models.usuario import Usuario
from app.models.profesional import Profesional
from app.models.bloque_horario_semanal import BloqueHorarioSemanal
from app.security import hash_password


class SeedConfigError(RuntimeError):
    """
    SEED_DEMO_DATA=true pero falta configuración requerida (ej. la variable
    SEED_DEMO_PASSWORD) para poder sembrar los datos demo de forma segura.
    """
    pass


def _seed_demo_habilitado() -> bool:
    """
    Fail closed: el seed demo SOLO se activa si SEED_DEMO_DATA está presente
    y su valor normalizado (lower/strip) es exactamente "true". Cualquier
    otro valor, o la ausencia total de la variable, se trata como False.

    Deliberadamente NO se usa DEBUG, ENV, hostname ni el nombre de la BD
    como señal implícita: solo esta variable, explícita, habilita el seed.
    """
    valor = os.getenv("SEED_DEMO_DATA")
    if valor is None:
        return False
    return valor.strip().lower() == "true"


def _obtener_password_seed() -> str:
    """
    Contraseña usada para las cuentas demo, provista explícitamente por
    entorno. Nunca hay un valor por defecto conocido: si falta, se falla
    de forma clara (SeedConfigError) sin revelar ningún secreto.
    """
    password = os.getenv("SEED_DEMO_PASSWORD")
    if not password or not password.strip():
        raise SeedConfigError(
            "SEED_DEMO_DATA=true requiere que la variable de entorno "
            "SEED_DEMO_PASSWORD esté definida (no puede estar vacía)."
        )
    return password


def init_db():
    # ── A. INICIALIZACIÓN DE ESQUEMA ─────────────────────────────
    # Esto se ejecuta siempre, sin importar si el seed demo está habilitado.
    upgrade_schema(engine)

    # ── B. SEED DE DATOS DEMO (opt-in explícito) ─────────────────
    if not _seed_demo_habilitado():
        return  # SEED_DEMO_DATA ausente o != "true": no se siembra nada.

    db = SessionLocal()
    try:
        if db.query(Usuario).count() > 0:
            return  # ya está inicializado, no duplicar

        # Solo exigimos (y validamos) la contraseña demo cuando realmente
        # vamos a sembrar una BD vacía: si ya hay usuarios, no llegamos
        # hasta acá y por lo tanto no se exige SEED_DEMO_PASSWORD.
        password_seed = _obtener_password_seed()

        # ── USUARIOS ──────────────────────────────────────────────
        # Todas las cuentas demo usan la misma contraseña lógica (la
        # provista via SEED_DEMO_PASSWORD), pero cada una se hashea
        # individualmente con hash_password() para aprovechar el salt
        # aleatorio de bcrypt: los 11 hashes resultantes son distintos
        # entre sí aunque la contraseña en texto plano sea la misma.
        # Nunca se persiste en texto plano ni se loguea.
        usuarios = [
            Usuario(correo="maria.gonzalez@utem.cl",   password=hash_password(password_seed), rol="estudiante", nombre="María González",     telefono="+56 9 1234 5678", rut="12.345.678-5", carrera="Ingeniería en Informática"),
            Usuario(correo="carlos.munoz@utem.cl",      password=hash_password(password_seed), rol="estudiante", nombre="Carlos Muñoz",       telefono="+56 9 2345 6789", rut="9.876.543-3",  carrera="Ingeniería Comercial"),
            Usuario(correo="valentina.rojas@utem.cl",   password=hash_password(password_seed), rol="estudiante", nombre="Valentina Rojas",    telefono="+56 9 3456 7890", rut="11.222.333-9", carrera="Contador Auditor"),
            Usuario(correo="diego.soto@utem.cl",        password=hash_password(password_seed), rol="estudiante", nombre="Diego Soto",         telefono="+56 9 4567 8901", rut="8.765.432-K",  carrera="Ingeniería Civil Industrial"),
            Usuario(correo="ana.martinez@utem.cl",      password=hash_password(password_seed), rol="profesional", nombre="Dra. Ana Martínez",     telefono="+56 9 5111 2222"),
            Usuario(correo="roberto.fuentes@utem.cl",   password=hash_password(password_seed), rol="profesional", nombre="Psic. Roberto Fuentes", telefono="+56 9 5222 3333"),
            Usuario(correo="klgo.soto@utem.cl",         password=hash_password(password_seed), rol="profesional", nombre="Klgo. Diego Soto",      telefono="+56 9 5333 4444"),
            Usuario(correo="val.rojas@utem.cl",         password=hash_password(password_seed), rol="profesional", nombre="Dra. Valentina Rojas",  telefono="+56 9 5444 5555"),
            Usuario(correo="nut.munoz@utem.cl",         password=hash_password(password_seed), rol="profesional", nombre="Nut. Carlos Muñoz",     telefono="+56 9 5555 6666"),
            Usuario(correo="joaquin.rodriguez@utem.cl", password=hash_password(password_seed), rol="profesional", nombre="Dr. Joaquín Rodríguez", telefono="+56 9 5666 7777"),
            Usuario(correo="admin@utem.cl",             password=hash_password(password_seed), rol="admin",      nombre="Administrador SESAES", telefono=None),
        ]
        for u in usuarios:
            db.add(u)
        db.flush()

        # ── PROFESIONALES ─────────────────────────────────────────
        # foto_url, correo y rut se completan luego desde el panel del profesional/admin
        profesionales_data = [
            {"nombre": "Dra. Ana Martínez",     "especialidad": "Medicina General", "iniciales": "AM", "descripcion": "Consultas preventivas, recetas y atención integral de salud para estudiantes.", "usuario_id": 5},
            {"nombre": "Psic. Roberto Fuentes", "especialidad": "Psicología",        "iniciales": "RF", "descripcion": "Apoyo emocional, salud mental y psicoterapia en un ambiente seguro.",         "usuario_id": 6},
            {"nombre": "Klgo. Diego Soto",      "especialidad": "Kinesiología",      "iniciales": "DS", "descripcion": "Rehabilitación física y tratamiento de lesiones deportivas o posturales.",    "usuario_id": 7},
            {"nombre": "Dra. Valentina Rojas",  "especialidad": "Odontología",       "iniciales": "VR", "descripcion": "Salud bucal, limpiezas y tratamientos dentales preventivos.",                 "usuario_id": 8},
            {"nombre": "Nut. Carlos Muñoz",     "especialidad": "Nutrición",         "iniciales": "CM", "descripcion": "Planes de alimentación balanceados y asesoría nutricional deportiva.",        "usuario_id": 9},
            {"nombre": "Dr. Joaquín Rodríguez", "especialidad": "Oftalmología",      "iniciales": "JR", "descripcion": "Evaluación visual completa y cuidado especializado para la salud de tus ojos.", "usuario_id": 10},
        ]
        for pd in profesionales_data:
            # Los IDs no se suponen contiguos ni parten necesariamente en uno.
            pd["usuario_id"] = usuarios[pd["usuario_id"] - 1].id
            profesional = Profesional(**pd, duracion_min=60)
            db.add(profesional)
            db.flush()
            for dia in range(5):
                # Misma semana institucional para todos los profesionales demo.
                # La colación se representa explícitamente: el motor no la infiere.
                for inicio, fin, tipo in (
                    ("09:00", "13:00", "disponible"),
                    ("13:00", "14:00", "colacion"),
                    ("14:00", "16:30" if dia == 4 else "17:30", "disponible"),
                ):
                    db.add(BloqueHorarioSemanal(
                        profesional_id=profesional.id, dia_semana=dia,
                        hora_inicio=inicio, hora_fin=fin, tipo=tipo,
                    ))
        db.flush()

        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def main() -> int:
    """Flujo único de instalación: esquema, demo opt-in y bootstrap explícito."""
    import argparse
    from app.bootstrap_superadmin import bootstrap_superadmin, BootstrapError

    parser = argparse.ArgumentParser(description="Inicializar SESAES desde sus modelos")
    parser.add_argument("--superadmin", action="store_true", help="Crear el primer superadmin")
    args = parser.parse_args()
    try:
        init_db()
        if args.superadmin:
            bootstrap_superadmin()
    except (SeedConfigError, BootstrapError, CommandError) as exc:
        print(str(exc))
        return 1
    print("Inicialización completada.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
