from app.database import Base, engine, SessionLocal
from app.models.usuario import Usuario
from app.models.profesional import Profesional
from app.models.horario import HorarioDisponible
from app.models.cita import Cita


def init_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    if db.query(Usuario).count() > 0:
        db.close()
        return  # ya está inicializado

    # ── USUARIOS ──────────────────────────────────────────────
    usuarios = [
        Usuario(correo="maria.gonzalez@utem.cl",   password="est123",   rol="estudiante", nombre="María González",     telefono="+56 9 1234 5678", rut="12.345.678-5", carrera="Ingeniería en Informática"),
        Usuario(correo="carlos.munoz@utem.cl",      password="est123",   rol="estudiante", nombre="Carlos Muñoz",       telefono="+56 9 2345 6789", rut="9.876.543-3",  carrera="Ingeniería Comercial"),
        Usuario(correo="valentina.rojas@utem.cl",   password="est123",   rol="estudiante", nombre="Valentina Rojas",    telefono="+56 9 3456 7890", rut="11.222.333-9", carrera="Contador Auditor"),
        Usuario(correo="diego.soto@utem.cl",        password="est123",   rol="estudiante", nombre="Diego Soto",         telefono="+56 9 4567 8901", rut="8.765.432-K",  carrera="Ingeniería Civil Industrial"),
        Usuario(correo="ana.martinez@utem.cl",      password="prof123",  rol="profesional", nombre="Dra. Ana Martínez",     telefono="+56 9 5111 2222"),
        Usuario(correo="roberto.fuentes@utem.cl",   password="prof123",  rol="profesional", nombre="Psic. Roberto Fuentes", telefono="+56 9 5222 3333"),
        Usuario(correo="klgo.soto@utem.cl",         password="prof123",  rol="profesional", nombre="Klgo. Diego Soto",      telefono="+56 9 5333 4444"),
        Usuario(correo="val.rojas@utem.cl",         password="prof123",  rol="profesional", nombre="Dra. Valentina Rojas",  telefono="+56 9 5444 5555"),
        Usuario(correo="nut.munoz@utem.cl",         password="prof123",  rol="profesional", nombre="Nut. Carlos Muñoz",     telefono="+56 9 5555 6666"),
        Usuario(correo="joaquin.rodriguez@utem.cl", password="prof123",  rol="profesional", nombre="Dr. Joaquín Rodríguez", telefono="+56 9 5666 7777"),
        Usuario(correo="admin@utem.cl",             password="admin123", rol="admin",      nombre="Administrador SESAES", telefono=None),
    ]
    for u in usuarios:
        db.add(u)
    db.commit()

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
        db.add(Profesional(**pd))
    db.commit()

    # ── HORARIOS DISPONIBLES (semana 23–27 Jun 2026) ──────────
    horarios = [
        (1,"LUN",23,"2026-06-23",["09:00 AM","09:15 AM","09:30 AM","10:00 AM","10:15 AM","10:30 AM"]),
        (1,"MIÉ",25,"2026-06-25",["09:00 AM","09:15 AM","10:00 AM","10:15 AM","10:30 AM"]),
        (1,"VIE",27,"2026-06-27",["09:00 AM","09:15 AM","10:00 AM","10:15 AM"]),
        (2,"MAR",24,"2026-06-24",["10:00 AM","10:30 AM","11:00 AM","11:30 AM"]),
        (2,"JUE",26,"2026-06-26",["10:00 AM","10:30 AM","11:00 AM"]),
        (3,"LUN",23,"2026-06-23",["08:00 AM","08:20 AM","08:40 AM","09:00 AM"]),
        (3,"MAR",24,"2026-06-24",["08:00 AM","08:20 AM","09:00 AM"]),
        (3,"MIÉ",25,"2026-06-25",["08:00 AM","08:20 AM","09:00 AM"]),
        (3,"JUE",26,"2026-06-26",["08:00 AM","08:20 AM","09:00 AM"]),
        (3,"VIE",27,"2026-06-27",["08:00 AM","08:20 AM"]),
        (4,"MAR",24,"2026-06-24",["09:00 AM","09:30 AM","10:00 AM","10:30 AM"]),
        (4,"JUE",26,"2026-06-26",["09:00 AM","09:30 AM","10:00 AM"]),
        (5,"MIÉ",25,"2026-06-25",["11:00 AM","11:30 AM","12:00 PM"]),
        (5,"VIE",27,"2026-06-27",["11:00 AM","11:30 AM","12:00 PM"]),
        (6,"LUN",23,"2026-06-23",["09:00 AM","09:15 AM","09:30 AM"]),
        (6,"MIÉ",25,"2026-06-25",["09:00 AM","09:15 AM","09:30 AM"]),
    ]
    for prof_id, dia_nombre, dia_num, fecha, horas in horarios:
        for hora in horas:
            db.add(HorarioDisponible(
                profesional_id=prof_id,
                dia_nombre=dia_nombre,
                dia_num=dia_num,
                fecha=fecha,
                hora=hora,
                estado="disponible"
            ))
    db.commit()
    db.close()