# -*- coding: utf-8 -*-
"""
SESAES — A.2: fuente única de verdad para disponibilidad de Agenda.

Antes de este módulo existían dos implementaciones independientes de
"¿puede este profesional recibir una cita en esta fecha/hora?":

  - GET /disponibilidad/{profesional_id} (app/routers/horarios.py),
    usado principalmente por Estudiante.
  - getBloqueEstado() en el frontend (dashboard-admin.ts), que
    recalculaba las mismas reglas en TypeScript para pintar la grilla
    de Agenda Admin.

Ninguna de las dos era consultada por POST /citas al insertar, así que
era posible crear una cita fuera de jornada, en colación, en una hora
que ni siquiera pertenece a la grilla real del profesional, o para un
profesional inactivo, solo porque el cliente no lo impidió.

Este módulo concentra la regla de negocio en un solo lugar:
  - `evaluar_disponibilidad_slot()`  → evalúa UN profesional+fecha+hora
    puntual contra las reglas ESTRUCTURALES del slot. La usa POST
    /citas antes de insertar una cita normal, y puede usarla cualquier
    otro router que necesite la misma pregunta.
  - `listar_horas_disponibles()`     → evalúa TODOS los bloques de un
    día para un profesional, aplicando además la política de
    agendamiento propia de Estudiante (ver más abajo). La usa GET
    /disponibilidad/{id}.
  - `excede_ventana_agendamiento_estudiante()` → política de
    agendamiento de Estudiante aplicada explícitamente, no una regla
    estructural del slot (ver sección "Reglas estructurales vs.
    política de consumidor").

Nadie más debe reimplementar jornada/colación/grilla/ocupación de un
slot; deben llamar a este módulo.

── Reglas estructurales vs. política de consumidor (corrección v2) ──

`evaluar_disponibilidad_slot()` NO es solo para Estudiante: también la
usa (o usará) cualquier flujo de creación de citas, incluida una futura
Agenda Admin que necesite agendar/navegar semanas más allá de la
ventana de 7 días que hoy limita a Estudiante. Por eso se separan dos
capas:

  1. Reglas ESTRUCTURALES del slot (viven en evaluar_disponibilidad_slot,
     se aplican SIEMPRE, a cualquier consumidor, porque describen algo
     que es objetivamente falso o imposible sin importar quién
     pregunte). El ORDEN importa: los bloqueos ABSOLUTOS (no
     overridable_con_sobrecupo) se evalúan todos antes que cualquier
     motivo overridable, para que un sobrecupo nunca "se cuele" delante
     de un bloqueo absoluto solo porque ese motivo se evaluó primero:
       - profesional existe / está activo
       - fecha y hora tienen formato válido
       - la fecha no es un día ya pasado
       - el día no cae en fin de semana (el centro no atiende entonces)
       - el día no está marcado DiaCerrado
       - la hora no es un horario ya pasado, si la fecha es hoy
       - la hora corresponde a un bloque real de la grilla CRUDA del
         centro según `duracion_min` (NO overridable: no existe tal
         cosa como "media cita"; evaluada ANTES que jornada — ver
         corrección v3 más abajo)
       - el slot no está ocupado por otra cita pendiente/completada
         (comparando hora normalizada, no el string crudo) — NO
         overridable; evaluada ANTES que jornada/colación (ver
         corrección v4 más abajo)
       - la hora cae dentro de jornada y fuera de colación del
         profesional (overridable con sobrecupo autorizado) —
         evaluada AL FINAL, precisamente por ser el único motivo que
         sobrecupo puede superar

  2. Política de CONSUMIDOR, aplicada explícitamente por encima de lo
     estructural, no dentro de evaluar_disponibilidad_slot:
       - la ventana máxima de 7 días de anticipación es una política de
         agendamiento de Estudiante (`excede_ventana_agendamiento_estudiante`),
         no una regla de que el slot en sí sea inválido. `listar_horas_disponibles()`
         la aplica porque es el endpoint que consume Estudiante. POST /citas
         la vuelve a aplicar explícitamente SOLO cuando quien agenda es el
         propio estudiante (sin agenda.gestionar) — así una llamada directa
         a la API no permite saltarse una restricción que la UI de
         disponibilidad ya le oculta. No se aplica a reservas hechas con
         capacidad administrativa, precisamente para no romper la
         capacidad futura de Agenda Admin de navegar/agendar semanas
         posteriores a esa ventana.

Alcance explícito de A.2 (ver auditoría previa de Agenda V2):
  - Esto NO decide permisos, ownership ni scope administrativo — eso
    sigue siendo responsabilidad de cada router (agenda.gestionar,
    alcance por especialidad, etc.).
  - Esto NO es protección de concurrencia/doble-reserva (eso es A.3,
    deliberadamente fuera de este bloque: no existe un
    UniqueConstraint(profesional_id, fecha, hora) porque debe convivir
    con sobrecupo legítimo — ver comentario ya existente en
    app/routers/admin.py sobre crear_cita_urgente).
  - `urgente=True` (POST /admin/citas/urgente) sigue sin pasar por esta
    validación. A.2 conserva la semántica actual de urgencias y no la
    redefine; su relación definitiva con disponibilidad se decidirá en
    la fase específica de urgencias/emergencias.
  - `sobrecupo=True` en una cita normal (POST /citas) SÍ pasa por acá,
    pero se le permite superar únicamente los motivos marcados como
    `overridable_con_sobrecupo=True` (fuera de jornada, en colación) —
    nunca centro cerrado, fin de semana, fecha/hora pasada, profesional
    inactivo/inexistente, un horario fuera de grilla o un slot ya
    ocupado por otra cita. Esto replica la semántica que ya tenía el
    frontend en `clickBloque()`: el flujo de sobrecupo solo se ofrece
    para 'fuera-horario' y 'colacion', nunca para 'bloqueado' ni
    'cerrado-centro'. El diseño *definitivo* de autorización de
    sobrecupo (quién puede, auditoría dedicada, límites, si algún día
    puede forzar también fuera de grilla) queda para la fase A.4, ya
    identificada en la auditoría.

── Corrección v3 ──

  1. Orden de reglas: la pertenencia a la grilla se evalúa antes que
     jornada/colación en evaluar_disponibilidad_slot (ver sección de
     reglas estructurales arriba). Antes de esta corrección, un valor
     fuera de grilla Y fuera de jornada a la vez (p. ej. "08:07" con
     jornada 09:00-17:00) devolvía motivo "fuera_de_jornada"
     (overridable), permitiendo que sobrecupo=True lo autorizara pese
     a no ser un slot real. Ahora, cualquier hora no alineada a la
     grilla se rechaza con "hora_fuera_de_grilla" (no overridable) sin
     importar si además cae fuera de jornada.
  2. `generar_bloques_jornada()` ya no puede recibir una `duracion_min`
     que produzca un bucle sin avance (0) o sin cota (negativa): un
     valor no-entero o <= 0 se reemplaza por DURACION_MIN_POR_DEFECTO
     antes de generar la grilla. Esto es un blindaje de la función en
     sí, no una validación de negocio de Profesional.

── Corrección v4 ──

  Bug de precedencia: `evaluar_disponibilidad_slot()` comprobaba
  jornada/colación ANTES que ocupación. Como "fuera_de_jornada" y
  "en_colacion" son overridable_con_sobrecupo=True, un slot que estaba
  simultáneamente fuera de jornada Y ya ocupado por otra cita devolvía
  primero el motivo overridable — permitiendo que sobrecupo=True lo
  autorizara sin llegar nunca a comprobar que la hora ya estaba
  reservada. La política vigente es "slot ocupado = bloqueo absoluto;
  fuera de jornada/colación = temporalmente overridable", así que el
  orden de evaluación ahora la refleja: ocupación se comprueba antes
  que `_evaluar_reglas_jornada()`. No cambia ninguna otra decisión ya
  tomada (fin de semana, fuera de grilla, urgencias, etc. siguen
  igual).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta

from sqlalchemy.orm import Session

from app.models.cita import Cita
from app.models.dia_cerrado import DiaCerrado
from app.models.profesional import Profesional

# Horario general de atención del centro — mismo valor que ya usaba
# GET /disponibilidad/{id} y que el frontend replica como
# CENTRO_HORA_INICIO/CENTRO_HORA_FIN en dashboard-admin.ts.
HORA_INICIO_CENTRO = time(8, 0)
HORA_FIN_CENTRO = time(18, 0)

# Estados de Cita que efectivamente ocupan un slot. Una cita cancelada
# o marcada como inasistencia no debe seguir bloqueando la hora.
ESTADOS_CITA_QUE_OCUPAN_SLOT = ("pendiente", "completada")

# Duración de bloque a usar cuando la del profesional no es utilizable
# (None, o <= 0 — ver generar_bloques_jornada). No es una validación de
# negocio de mantenimiento de Profesional (eso es de otro módulo);
# acá el único objetivo es que la grilla nunca pueda generarse de forma
# insegura, sin importar qué dato llegue.
DURACION_MIN_POR_DEFECTO = 45

# Ventana máxima de anticipación — política de agendamiento de
# Estudiante, NO una regla estructural del slot (ver docstring del
# módulo). Mismo valor que ya usaba GET /disponibilidad/{id}.
VENTANA_AGENDAMIENTO_ESTUDIANTE_DIAS = 7


@dataclass(frozen=True)
class ResultadoDisponibilidad:
    """Resultado de evaluar un profesional+fecha+hora puntual."""

    disponible: bool
    motivo: str | None
    mensaje: str | None
    # Si True, un sobrecupo autorizado (agenda.gestionar) puede
    # superar este motivo. Si False, es un bloqueo absoluto que ni
    # sobrecupo puede saltarse.
    overridable_con_sobrecupo: bool
    profesional: Profesional | None


def _parsear_hora_24h(hora_str: str | None) -> time | None:
    """'HH:MM' (24h) -> time, o None si es inválida/vacía."""
    if not hora_str:
        return None
    try:
        return datetime.strptime(hora_str, "%H:%M").time()
    except ValueError:
        return None


def _parsear_hora_flexible(hora_str: str | None) -> time | None:
    """
    Igual que _parsear_hora_24h pero además acepta 'HH:MM AM/PM', el
    mismo formato de compatibilidad que ya toleraba
    citas.py:_cita_a_datetime (ver comentario en schemas.CitaCreate).

    Se usa siempre que dos horas deban compararse por su valor real
    (p. ej. "09:30" y "09:30 AM" son el mismo slot) en vez de por
    igualdad de string — corrección v2 del punto 3.
    """
    hora = _parsear_hora_24h(hora_str)
    if hora is not None:
        return hora
    if not hora_str:
        return None
    try:
        return datetime.strptime(hora_str, "%I:%M %p").time()
    except ValueError:
        return None


def _parsear_fecha(fecha_str: str | None) -> date | None:
    if not fecha_str:
        return None
    try:
        return datetime.strptime(fecha_str, "%Y-%m-%d").date()
    except ValueError:
        return None


def generar_bloques_jornada(duracion_min: int) -> list[time]:
    """
    Genera la lista de horas posibles entre HORA_INICIO_CENTRO y
    HORA_FIN_CENTRO, según la duración de bloque del profesional.

    Esta es LA única fuente de la grilla real de un profesional — tanto
    la validación de un slot puntual como el listado de horas libres
    para un día deben generar sus candidatos a partir de esta misma
    función (corrección v2 del punto 1: nadie evalúa una hora que no
    haya salido de acá).

    Blindaje (corrección v3, punto 2): una `duracion_min` inválida
    (0, negativa, o no-entera) nunca debe poder producir un bucle que
    no avance — con 0 el bucle jamás terminaría, y con un valor
    negativo `actual` retrocedería en vez de avanzar hacia `fin`, en
    ambos casos sin cota. Se usa DURACION_MIN_POR_DEFECTO en esos
    casos en vez de propagar el valor tal cual. Esto es defensivo a
    nivel de esta función — no reemplaza ninguna validación de datos
    que deba existir en el mantenimiento de Profesional.
    """
    duracion = (
        duracion_min
        if isinstance(duracion_min, int) and duracion_min > 0
        else DURACION_MIN_POR_DEFECTO
    )
    bloques: list[time] = []
    actual = datetime.combine(date.today(), HORA_INICIO_CENTRO)
    fin = datetime.combine(date.today(), HORA_FIN_CENTRO)
    while actual < fin:
        bloques.append(actual.time())
        actual += timedelta(minutes=duracion)
    return bloques


def _evaluar_reglas_jornada(
    *,
    profesional: Profesional,
    hora_obj: time,
) -> tuple[bool, str | None, str | None, bool]:
    """
    Reglas de jornada/colación contra un profesional y una hora ya
    parseada. No toca la base de datos — se puede llamar en loop sin
    costo de queries adicionales.

    Devuelve (disponible, motivo, mensaje, overridable_con_sobrecupo).
    """
    jornada_inicio = _parsear_hora_24h(profesional.horario_inicio)
    jornada_fin = _parsear_hora_24h(profesional.horario_fin)
    if jornada_inicio and jornada_fin and not (jornada_inicio <= hora_obj < jornada_fin):
        return (
            False,
            "fuera_de_jornada",
            "La hora solicitada está fuera del horario habitual del profesional.",
            True,
        )

    almuerzo_inicio = _parsear_hora_24h(profesional.hora_almuerzo_inicio)
    almuerzo_fin = _parsear_hora_24h(profesional.hora_almuerzo_fin)
    if almuerzo_inicio and almuerzo_fin and almuerzo_inicio <= hora_obj < almuerzo_fin:
        return (
            False,
            "en_colacion",
            "La hora solicitada cae en el horario de colación del profesional.",
            True,
        )

    return True, None, None, False


def _bloques_grilla_profesional(profesional: Profesional) -> list[time]:
    """
    Bloques de la grilla real de este profesional: los generados por
    generar_bloques_jornada() según su duracion_min, filtrados por sus
    propias reglas de jornada/colación. Esta es la lista de "horas que
    existen" para el profesional — tanto para publicarlas (listar) como
    para validar que una hora puntual pertenezca a ella (evaluar).
    """
    duracion = profesional.duracion_min or 45
    bloques = generar_bloques_jornada(duracion)
    return [
        b for b in bloques
        if _evaluar_reglas_jornada(profesional=profesional, hora_obj=b)[0]
    ]


def _horas_ocupadas_normalizadas(
    db: Session,
    *,
    profesional_id: int,
    fecha: str,
) -> set[time]:
    """
    Horas ya ocupadas por una cita pendiente/completada de este
    profesional en esta fecha, normalizadas a `time` — para que
    "09:30" y "09:30 AM" se reconozcan como el mismo slot ocupado
    (corrección v2 del punto 3). Ignora silenciosamente cualquier
    `Cita.hora` que no se pueda parsear en ningún formato conocido, en
    vez de romper la evaluación de disponibilidad por un dato legado
    inválido.
    """
    filas = (
        db.query(Cita.hora)
        .filter(
            Cita.profesional_id == profesional_id,
            Cita.fecha == fecha,
            Cita.estado.in_(ESTADOS_CITA_QUE_OCUPAN_SLOT),
        )
        .all()
    )
    ocupadas = set()
    for (hora_str,) in filas:
        hora_obj = _parsear_hora_flexible(hora_str)
        if hora_obj is not None:
            ocupadas.add(hora_obj)
    return ocupadas


def excede_ventana_agendamiento_estudiante(
    fecha: str,
    *,
    ventana_dias: int = VENTANA_AGENDAMIENTO_ESTUDIANTE_DIAS,
) -> bool:
    """
    True si `fecha` cae más allá de la ventana de anticipación que se
    le permite agendar a un Estudiante (política de consumidor, no
    regla estructural del slot — ver docstring del módulo).

    Una fecha con formato inválido devuelve False acá: ese caso ya lo
    rechaza evaluar_disponibilidad_slot/listar_horas_disponibles con su
    propio motivo ("fecha inválida"), no corresponde duplicarlo aquí.
    """
    fecha_obj = _parsear_fecha(fecha)
    if fecha_obj is None:
        return False
    return fecha_obj > (date.today() + timedelta(days=ventana_dias))


def evaluar_disponibilidad_slot(
    db: Session,
    *,
    profesional_id: int,
    fecha: str,
    hora: str,
) -> ResultadoDisponibilidad:
    """
    Evalúa si un profesional puede recibir una cita NORMAL (no
    urgente) en `fecha`+`hora`, contra las reglas ESTRUCTURALES del
    slot (ver docstring del módulo — la ventana de 7 días de Estudiante
    NO se evalúa acá, es política de consumidor aplicada por separado).

    No aplica permisos, ownership ni alcance administrativo — eso es
    responsabilidad de cada router llamante (ya lo hacen citas.py y
    agenda.py antes/después de llamar a esta función).
    """
    profesional = (
        db.query(Profesional)
        .filter(Profesional.id == profesional_id)
        .first()
    )
    if not profesional:
        return ResultadoDisponibilidad(
            disponible=False,
            motivo="profesional_no_encontrado",
            mensaje="Profesional no encontrado.",
            overridable_con_sobrecupo=False,
            profesional=None,
        )

    if profesional.estado and profesional.estado != "activo":
        return ResultadoDisponibilidad(
            disponible=False,
            motivo="profesional_inactivo",
            mensaje="El profesional no está disponible (licencia, inasistencia u otro bloqueo).",
            overridable_con_sobrecupo=False,
            profesional=profesional,
        )

    fecha_obj = _parsear_fecha(fecha)
    if fecha_obj is None:
        return ResultadoDisponibilidad(
            disponible=False,
            motivo="fecha_invalida",
            mensaje="Fecha inválida.",
            overridable_con_sobrecupo=False,
            profesional=profesional,
        )

    hora_obj = _parsear_hora_flexible(hora)
    if hora_obj is None:
        return ResultadoDisponibilidad(
            disponible=False,
            motivo="hora_invalida",
            mensaje="Hora inválida.",
            overridable_con_sobrecupo=False,
            profesional=profesional,
        )

    hoy = date.today()

    # ── Reglas estructurales de fecha/hora (no dependen de quién pregunta) ──
    if fecha_obj < hoy:
        return ResultadoDisponibilidad(
            disponible=False,
            motivo="fecha_pasada",
            mensaje="No es posible agendar en una fecha que ya pasó.",
            overridable_con_sobrecupo=False,
            profesional=profesional,
        )

    if fecha_obj.weekday() >= 5:
        return ResultadoDisponibilidad(
            disponible=False,
            motivo="fin_de_semana",
            mensaje="El centro no atiende los fines de semana.",
            overridable_con_sobrecupo=False,
            profesional=profesional,
        )

    dia_cerrado = db.query(DiaCerrado).filter(DiaCerrado.fecha == fecha).first()
    if dia_cerrado:
        return ResultadoDisponibilidad(
            disponible=False,
            motivo="dia_cerrado",
            mensaje=f"El centro permanece cerrado ese día. {dia_cerrado.motivo or ''}".strip(),
            overridable_con_sobrecupo=False,
            profesional=profesional,
        )

    if fecha_obj == hoy and hora_obj <= datetime.now().time():
        return ResultadoDisponibilidad(
            disponible=False,
            motivo="hora_pasada",
            mensaje="Esa hora ya pasó.",
            overridable_con_sobrecupo=False,
            profesional=profesional,
        )

    # La hora debe pertenecer a un bloque real de la grilla del centro
    # para este profesional (múltiplo de su duracion_min a partir de
    # HORA_INICIO_CENTRO) — corrección v2 del punto 1. Esto se evalúa
    # ANTES que jornada/colación (corrección v3, punto 1): un slot que
    # ni siquiera pertenece a la grilla no es "una hora fuera de
    # jornada que sobrecupo puede forzar", es un valor que nunca fue
    # ni será una hora publicable, sin importar la jornada del
    # profesional. Si se evaluara después de jornada, un valor como
    # "08:07" (ni alineado NI dentro de jornada) devolvería
    # "fuera_de_jornada" (overridable) en vez de "hora_fuera_de_grilla"
    # (no overridable), permitiendo que sobrecupo autorizara un slot
    # que no existe. Por eso se usa la grilla CRUDA del centro
    # (generar_bloques_jornada), no la ya filtrada por jornada de
    # `_bloques_grilla_profesional` (esa sigue siendo correcta para
    # listar_horas_disponibles, donde sí se quiere solo lo publicable).
    # No overridable: no existe tal cosa como "media cita"; si algún
    # día sobrecupo debe poder forzar un horario fuera de grilla, esa
    # es una decisión de A.4, no un efecto colateral de unificar
    # disponibilidad.
    duracion = profesional.duracion_min or DURACION_MIN_POR_DEFECTO
    if hora_obj not in generar_bloques_jornada(duracion):
        return ResultadoDisponibilidad(
            disponible=False,
            motivo="hora_fuera_de_grilla",
            mensaje="Esa hora no corresponde a un bloque de atención válido.",
            overridable_con_sobrecupo=False,
            profesional=profesional,
        )

    # Ocupación (corrección v4): un slot ya ocupado por otra cita activa
    # es un bloqueo ABSOLUTO, así que debe comprobarse ANTES que
    # jornada/colación (que son overridable_con_sobrecupo=True). Si se
    # comprobara después, un slot fuera de jornada Y ya ocupado devolvía
    # primero "fuera_de_jornada" (overridable) y sobrecupo=True lo
    # autorizaba sin llegar nunca a ver que la hora ya estaba tomada —
    # ver docstring del módulo, sección "Corrección v4". La política
    # vigente es: slot ocupado = bloqueo absoluto; fuera de
    # jornada/colación = temporalmente overridable por sobrecupo. El
    # orden de evaluación debe reflejar esa jerarquía, no solo el hecho
    # de que ambos terminan en "no disponible".
    ocupadas = _horas_ocupadas_normalizadas(
        db, profesional_id=profesional_id, fecha=fecha,
    )
    if hora_obj in ocupadas:
        return ResultadoDisponibilidad(
            disponible=False,
            motivo="slot_ocupado",
            mensaje="Esa hora ya está reservada.",
            overridable_con_sobrecupo=False,
            profesional=profesional,
        )

    disponible, motivo, mensaje, overridable = _evaluar_reglas_jornada(
        profesional=profesional,
        hora_obj=hora_obj,
    )
    if not disponible:
        return ResultadoDisponibilidad(
            disponible=False,
            motivo=motivo,
            mensaje=mensaje,
            overridable_con_sobrecupo=overridable,
            profesional=profesional,
        )

    return ResultadoDisponibilidad(
        disponible=True,
        motivo=None,
        mensaje=None,
        overridable_con_sobrecupo=False,
        profesional=profesional,
    )


def listar_horas_disponibles(
    db: Session,
    *,
    profesional_id: int,
    fecha: str,
    ventana_dias: int = VENTANA_AGENDAMIENTO_ESTUDIANTE_DIAS,
) -> tuple[list[str], str | None]:
    """
    Devuelve (horas_disponibles, mensaje) para un profesional en una
    fecha dada. Es la lógica que consume GET /disponibilidad/{id}.

    Mantiene el contrato de negocio previo de ese endpoint: ventana de
    hoy a `ventana_dias` días, solo días hábiles (lunes a viernes), y
    los mismos mensajes exactos para cada caso de "sin horas" — el
    shape de la respuesta HTTP no cambia (lo arma horarios.py).

    La ventana de `ventana_dias` es la política de agendamiento de
    Estudiante descrita en el docstring del módulo — se aplica acá
    explícitamente porque este es el endpoint que consume Estudiante,
    no porque sea una regla estructural del slot.

    Cambio de comportamiento consciente respecto al código anterior a
    A.2: ahora también respeta `profesional.estado` (antes no se
    comprobaba en este endpoint). Si el profesional está inactivo, no
    se ofrecen horas — igual que ya hacía Agenda Admin en el frontend.
    """
    fecha_obj = _parsear_fecha(fecha)
    if fecha_obj is None:
        return [], "Fecha inválida"

    hoy = date.today()
    ventana_maxima = hoy + timedelta(days=ventana_dias)

    if fecha_obj < hoy or fecha_obj > ventana_maxima or fecha_obj.weekday() >= 5:
        return [], "Sin horas disponibles"

    dia_cerrado = db.query(DiaCerrado).filter(DiaCerrado.fecha == fecha).first()
    if dia_cerrado:
        return [], f"El centro permanece cerrado este día. {dia_cerrado.motivo or ''}".strip()

    profesional = (
        db.query(Profesional)
        .filter(Profesional.id == profesional_id)
        .first()
    )
    if not profesional:
        return [], "Profesional no encontrado"

    if profesional.estado and profesional.estado != "activo":
        return [], "Sin horas disponibles por esta semana"

    # Misma grilla real que usa evaluar_disponibilidad_slot() para
    # validar un slot puntual — ver _bloques_grilla_profesional().
    bloques = _bloques_grilla_profesional(profesional)

    if fecha_obj == hoy:
        ahora = datetime.now().time()
        bloques = [b for b in bloques if b > ahora]

    # Comparación normalizada (24h vs "HH:MM AM/PM") — corrección v2
    # del punto 3, misma función que usa evaluar_disponibilidad_slot().
    ocupadas = _horas_ocupadas_normalizadas(
        db, profesional_id=profesional_id, fecha=fecha,
    )

    horas_disponibles = [
        b.strftime("%H:%M") for b in bloques if b not in ocupadas
    ]

    if not horas_disponibles:
        return [], "Sin horas disponibles por esta semana"

    return horas_disponibles, None
