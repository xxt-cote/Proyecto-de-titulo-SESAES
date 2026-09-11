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

── Corrección v5 (A.2B) — núcleo común para slot puntual y rango ──

  A.2B necesita evaluar un rango de días (Agenda Admin → Semana) sin
  hacer una query por celda. En vez de escribir un segundo algoritmo
  de precedencia "parecido" al de evaluar_disponibilidad_slot() (que
  hoy coincide pero mañana podría divergir por un cambio hecho en un
  solo lugar), se extrajo la precedencia completa a una función pura
  sin acceso a base de datos: `_evaluar_slot_en_contexto()`. Recibe el
  profesional, el día cerrado (si aplica) y el set de horas ocupadas
  ya precargados por quien llama, y devuelve la decisión para UN
  slot ya parseado.

  Tanto `evaluar_disponibilidad_slot()` (que sigue siendo la función
  pública para un slot puntual, con su mismo contrato — sigue
  encargándose de resolver profesional/fecha/hora desde parámetros
  crudos y hacer sus propias queries puntuales) como
  `listar_disponibilidad_rango()` (que precarga profesional, días
  cerrados y citas del rango en un puñado de queries, y evalúa cada
  slot generado por `generar_bloques_jornada()` contra ese contexto
  ya en memoria) llaman exactamente a `_evaluar_slot_en_contexto()`
  para decidir cada slot. Ningún router debe reimplementar esta
  precedencia ni copiarla: cualquier consumidor nuevo de "¿está este
  slot disponible?" debe pasar por uno de estos dos puntos de
  entrada.

  `listar_disponibilidad_rango()` no es una función de Semana: recibe
  fecha_inicio/fecha_fin genéricos (con un máximo defensivo de
  `MAX_DIAS_RANGO_DISPONIBILIDAD` días inclusive) para poder
  reutilizarse después en Día/Mes sin crear una tercera fuente.
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


def _duracion_efectiva(profesional: Profesional) -> int:
    """
    Duración de bloque efectiva para este profesional: su
    `duracion_min` si es un entero positivo, o
    DURACION_MIN_POR_DEFECTO en cualquier otro caso (None, 0,
    negativo, no-entero) — exactamente el mismo criterio que ya
    aplica generar_bloques_jornada() puertas adentro (ver su
    docstring, "Blindaje corrección v3").

    Existe para que exista un solo lugar que decida "cuál es la
    duración que realmente se usa": antes de A.2B, un profesional con
    duracion_min negativo o 0 pasaba ese valor crudo a
    generar_bloques_jornada() (que lo neutralizaba puertas adentro y
    usaba 45 para construir la grilla), pero el valor crudo (p. ej.
    -10) se seguía reportando como `duracion_min` en la respuesta —
    dos números distintos describiendo la misma grilla. Ahora tanto la
    grilla como el campo `duracion_min` de la respuesta salen de esta
    misma función.
    """
    valor = profesional.duracion_min
    return valor if isinstance(valor, int) and valor > 0 else DURACION_MIN_POR_DEFECTO

# Ventana máxima de anticipación — política de agendamiento de
# Estudiante, NO una regla estructural del slot (ver docstring del
# módulo). Mismo valor que ya usaba GET /disponibilidad/{id}.
VENTANA_AGENDAMIENTO_ESTUDIANTE_DIAS = 7

# Máximo de días (inclusive) que puede pedir un solo llamado a
# listar_disponibilidad_rango(). Defensivo: evita que un rango
# arbitrariamente grande dispare una respuesta enorme o quede abierto
# a abuso. No está acoplado a "7 días de Semana" a propósito, para
# poder servir después a Día/Mes sin cambiar el contrato (A.2B,
# corrección v5).
MAX_DIAS_RANGO_DISPONIBILIDAD = 31


class ParametrosRangoInvalidosError(ValueError):
    """
    Rango de fechas sintácticamente inválido, invertido, o que supera
    MAX_DIAS_RANGO_DISPONIBILIDAD. `motivo` es un código estable
    (no pensado para mostrarse tal cual) para que quien llama (tests,
    código interno) distinga el tipo de error sin tener que parsear
    `mensaje`. Solo `mensaje` llega al cliente: el router lo usa como
    `detail` del HTTP 400 — `motivo` no viaja en la respuesta HTTP.
    """

    def __init__(self, motivo: str, mensaje: str):
        self.motivo = motivo
        self.mensaje = mensaje
        super().__init__(mensaje)


class ProfesionalNoEncontradoError(LookupError):
    """profesional_id no corresponde a ningún Profesional existente."""


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


def _evaluar_slot_en_contexto(
    *,
    profesional: Profesional,
    fecha_obj: date,
    hora_obj: time,
    hoy: date,
    dia_cerrado: DiaCerrado | None,
    ocupadas: set[time],
    bloques_grilla: list[time] | None = None,
) -> tuple[bool, str | None, str | None, bool]:
    """
    Núcleo único de evaluación de UN slot ya parseado (profesional,
    fecha, hora), sin tocar base de datos: todo el contexto que
    necesita (profesional, si el día está cerrado, qué horas están
    ocupadas) ya viene precargado por quien llama.

    Tanto evaluar_disponibilidad_slot() (slot puntual, hace sus
    propias queries) como listar_disponibilidad_rango() (precarga un
    rango completo en un puñado de queries) llaman exactamente a esta
    función para decidir cada slot — ver "Corrección v5" en el
    docstring del módulo. Ningún otro lugar debe reimplementar esta
    precedencia.

    NO incluye el chequeo de `profesional_inactivo`: en el contrato
    original de evaluar_disponibilidad_slot() (A.2A) ese motivo se
    evalúa ANTES que fecha_invalida/hora_invalida (que son un
    problema de parseo de los parámetros crudos, algo que no existe en
    el camino de rango). Por eso cada llamante lo comprueba una sola
    vez, con el mismo criterio, antes de invocar este núcleo — ver
    evaluar_disponibilidad_slot() y listar_disponibilidad_rango().
    Este núcleo empieza asumiendo que el profesional ya se sabe activo.

    `bloques_grilla`, si se entrega, evita recalcular
    generar_bloques_jornada() por cada slot (listar_disponibilidad_rango
    ya la calculó una vez para todo el rango). Si se omite, se calcula
    acá — es el caso de uso de un slot puntual.

    Devuelve (disponible, motivo, mensaje, overridable_con_sobrecupo).
    """
    if fecha_obj < hoy:
        return (
            False,
            "fecha_pasada",
            "No es posible agendar en una fecha que ya pasó.",
            False,
        )

    if fecha_obj.weekday() >= 5:
        return (
            False,
            "fin_de_semana",
            "El centro no atiende los fines de semana.",
            False,
        )

    if dia_cerrado:
        return (
            False,
            "dia_cerrado",
            f"El centro permanece cerrado ese día. {dia_cerrado.motivo or ''}".strip(),
            False,
        )

    if fecha_obj == hoy and hora_obj <= datetime.now().time():
        return (
            False,
            "hora_pasada",
            "Esa hora ya pasó.",
            False,
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
    # disponibilidad. Cuando se llama desde listar_disponibilidad_rango,
    # `bloques_grilla` ya viene de generar_bloques_jornada, así que esta
    # comprobación siempre pasa (el slot nació de esa misma grilla) —
    # se deja igual para que ambos caminos compartan literalmente la
    # misma condición, sin una rama especial para el caso de rango.
    duracion = _duracion_efectiva(profesional)
    bloques = (
        bloques_grilla
        if bloques_grilla is not None
        else generar_bloques_jornada(duracion)
    )
    if hora_obj not in bloques:
        return (
            False,
            "hora_fuera_de_grilla",
            "Esa hora no corresponde a un bloque de atención válido.",
            False,
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
    if hora_obj in ocupadas:
        return (
            False,
            "slot_ocupado",
            "Esa hora ya está reservada.",
            False,
        )

    disponible, motivo, mensaje, overridable = _evaluar_reglas_jornada(
        profesional=profesional,
        hora_obj=hora_obj,
    )
    if not disponible:
        return (False, motivo, mensaje, overridable)

    return (True, None, None, False)


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

    Resuelve profesional/fecha/hora desde parámetros crudos y hace sus
    propias queries puntuales; la decisión en sí (a partir de fecha/hora
    ya parseadas) se delega a _evaluar_slot_en_contexto(), el mismo
    núcleo que usa listar_disponibilidad_rango() — ver "Corrección v5".
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

    # profesional_inactivo se comprueba acá, ANTES de parsear fecha/hora
    # (orden original de A.2A) — no es parte de _evaluar_slot_en_contexto
    # porque ese núcleo asume que fecha_obj/hora_obj ya se parsearon con
    # éxito, y aquí el profesional puede estar inactivo incluso cuando
    # fecha/hora vienen inválidas. listar_disponibilidad_rango() hace el
    # mismo chequeo, con el mismo criterio, una sola vez por rango (no
    # cambia por slot) — ver su cuerpo.
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

    # Canonicalización (corrección v6, punto 1): las queries de fecha
    # deben usar la forma canónica ya parseada (fecha_canon), no el
    # string crudo de entrada. _parsear_fecha() acepta variantes no
    # zero-padded ("2026-9-7") vía strptime, pero DiaCerrado.fecha y
    # Cita.fecha se guardan siempre canónicas ("2026-09-07") — si se
    # compara contra el string crudo, un DiaCerrado o una Cita
    # reales pueden no encontrarse simplemente porque el formato de
    # entrada no coincidía byte a byte con lo guardado.
    fecha_canon = fecha_obj.isoformat()
    dia_cerrado = db.query(DiaCerrado).filter(DiaCerrado.fecha == fecha_canon).first()
    ocupadas = _horas_ocupadas_normalizadas(
        db, profesional_id=profesional_id, fecha=fecha_canon,
    )

    disponible, motivo, mensaje, overridable = _evaluar_slot_en_contexto(
        profesional=profesional,
        fecha_obj=fecha_obj,
        hora_obj=hora_obj,
        hoy=hoy,
        dia_cerrado=dia_cerrado,
        ocupadas=ocupadas,
    )
    return ResultadoDisponibilidad(
        disponible=disponible,
        motivo=motivo,
        mensaje=mensaje,
        overridable_con_sobrecupo=overridable,
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


def listar_disponibilidad_rango(
    db: Session,
    *,
    profesional_id: int,
    fecha_inicio: str,
    fecha_fin: str,
) -> dict:
    """
    Disponibilidad real de un profesional para cada slot de la grilla,
    día por día, en un rango [fecha_inicio, fecha_fin] inclusive.

    Contrato de retorno:
        {
          "profesional_id": int,
          "fecha_inicio": "YYYY-MM-DD",
          "fecha_fin": "YYYY-MM-DD",
          "duracion_min": int,
          "dias": [
            {
              "fecha": "YYYY-MM-DD",
              "slots": [
                {
                  "hora": "HH:MM",
                  "disponible": bool,
                  "motivo": str | None,
                  "overridable_con_sobrecupo": bool
                },
                ...
              ]
            },
            ...
          ]
        }

    No expone ningún dato clínico ni de paciente — solo la decisión de
    disponibilidad por slot, igual que evaluar_disponibilidad_slot().
    No aplica permisos, ownership ni alcance administrativo: eso es
    responsabilidad del router llamante (agenda.py), igual que en el
    resto de este módulo.

    Precarga profesional, días cerrados del rango y citas del rango en
    3 queries fijas (no una por día ni una por slot), y evalúa cada
    slot con _evaluar_slot_en_contexto() — el mismo núcleo que usa
    evaluar_disponibilidad_slot() (ver "Corrección v5" en el docstring
    del módulo), así que ambos caminos jamás pueden divergir en la
    precedencia de reglas.

    Levanta ParametrosRangoInvalidosError si fecha_inicio/fecha_fin
    tienen formato inválido, si fecha_fin es anterior a fecha_inicio, o
    si el rango supera MAX_DIAS_RANGO_DISPONIBILIDAD días. Levanta
    ProfesionalNoEncontradoError si profesional_id no existe. El router
    traduce ambas a HTTP 400/404 respectivamente.
    """
    fecha_inicio_obj = _parsear_fecha(fecha_inicio)
    if fecha_inicio_obj is None:
        raise ParametrosRangoInvalidosError(
            "fecha_inicio_invalida", "fecha_inicio inválida.",
        )

    fecha_fin_obj = _parsear_fecha(fecha_fin)
    if fecha_fin_obj is None:
        raise ParametrosRangoInvalidosError(
            "fecha_fin_invalida", "fecha_fin inválida.",
        )

    if fecha_fin_obj < fecha_inicio_obj:
        raise ParametrosRangoInvalidosError(
            "rango_invertido",
            "fecha_fin no puede ser anterior a fecha_inicio.",
        )

    dias_totales = (fecha_fin_obj - fecha_inicio_obj).days + 1
    if dias_totales > MAX_DIAS_RANGO_DISPONIBILIDAD:
        raise ParametrosRangoInvalidosError(
            "rango_excede_maximo",
            f"El rango no puede superar {MAX_DIAS_RANGO_DISPONIBILIDAD} días.",
        )

    profesional = (
        db.query(Profesional)
        .filter(Profesional.id == profesional_id)
        .first()
    )
    if not profesional:
        raise ProfesionalNoEncontradoError(profesional_id)

    # profesional_inactivo (mismo criterio y mismo motivo/mensaje que
    # evaluar_disponibilidad_slot() — ver su docstring): no es parte de
    # _evaluar_slot_en_contexto() porque no depende de fecha/hora/día
    # cerrado/ocupación, es un atributo del profesional que no cambia
    # slot a slot. Se resuelve UNA sola vez acá, no en el núcleo, para
    # conservar exactamente la precedencia de A.2A (profesional_inactivo
    # antes que cualquier regla de fecha/hora/grilla).
    profesional_inactivo = bool(
        profesional.estado and profesional.estado != "activo",
    )

    # Canonicalización (corrección v6, punto 2): igual que en
    # evaluar_disponibilidad_slot(), toda comparación de fecha contra
    # BD debe usar la forma canónica ya parseada, nunca el string
    # crudo de entrada — acá es aún más importante que en el slot
    # puntual, porque estas no son comparaciones de igualdad sino de
    # rango (>=/<=) sobre una columna de texto: una entrada no
    # zero-padded no solo puede fallar una igualdad, puede ordenar mal
    # lexicográficamente y dejar fuera (o de más) fechas del rango.
    fecha_inicio_canon = fecha_inicio_obj.isoformat()
    fecha_fin_canon = fecha_fin_obj.isoformat()

    # Un solo query para todos los días cerrados del rango, indexado
    # por fecha para lookup O(1) dentro del loop de días.
    dias_cerrados_por_fecha: dict[str, DiaCerrado] = {
        dia_cerrado.fecha: dia_cerrado
        for dia_cerrado in (
            db.query(DiaCerrado)
            .filter(
                DiaCerrado.fecha >= fecha_inicio_canon,
                DiaCerrado.fecha <= fecha_fin_canon,
            )
            .all()
        )
    }

    # Un solo query para todas las citas activas del rango, agrupadas
    # por fecha y ya normalizadas a `time` (misma normalización 24h /
    # "HH:MM AM/PM" que usa el resto del módulo — corrección v2, punto 3).
    ocupadas_por_fecha: dict[str, set[time]] = {}
    filas_citas = (
        db.query(Cita.fecha, Cita.hora)
        .filter(
            Cita.profesional_id == profesional_id,
            Cita.fecha >= fecha_inicio_canon,
            Cita.fecha <= fecha_fin_canon,
            Cita.estado.in_(ESTADOS_CITA_QUE_OCUPAN_SLOT),
        )
        .all()
    )
    for fecha_str, hora_str in filas_citas:
        hora_obj = _parsear_hora_flexible(hora_str)
        if hora_obj is not None:
            ocupadas_por_fecha.setdefault(fecha_str, set()).add(hora_obj)

    # Duración efectiva única (ver _duracion_efectiva): el mismo número
    # que se usa para construir la grilla es el que se reporta en
    # "duracion_min" — nunca dos valores distintos para la misma grilla.
    duracion = _duracion_efectiva(profesional)
    bloques_grilla = generar_bloques_jornada(duracion)

    hoy = date.today()
    dias_resultado: list[dict] = []
    fecha_actual = fecha_inicio_obj
    while fecha_actual <= fecha_fin_obj:
        fecha_str = fecha_actual.isoformat()
        dia_cerrado = dias_cerrados_por_fecha.get(fecha_str)
        ocupadas = ocupadas_por_fecha.get(fecha_str, set())

        slots = []
        for hora_obj in bloques_grilla:
            if profesional_inactivo:
                # Mismo motivo/mensaje que evaluar_disponibilidad_slot()
                # para este mismo caso — ver docstring de esta función.
                disponible, motivo, mensaje, overridable = (
                    False,
                    "profesional_inactivo",
                    "El profesional no está disponible (licencia, inasistencia u otro bloqueo).",
                    False,
                )
            else:
                disponible, motivo, mensaje, overridable = _evaluar_slot_en_contexto(
                    profesional=profesional,
                    fecha_obj=fecha_actual,
                    hora_obj=hora_obj,
                    hoy=hoy,
                    dia_cerrado=dia_cerrado,
                    ocupadas=ocupadas,
                    bloques_grilla=bloques_grilla,
                )
            slots.append({
                "hora": hora_obj.strftime("%H:%M"),
                "disponible": disponible,
                "motivo": motivo,
                "overridable_con_sobrecupo": overridable,
            })

        dias_resultado.append({"fecha": fecha_str, "slots": slots})
        fecha_actual += timedelta(days=1)

    return {
        "profesional_id": profesional_id,
        # Mismas variables canónicas que ya se usaron para las queries
        # de DiaCerrado/Cita más arriba (fecha_inicio_canon/
        # fecha_fin_canon) — una sola fuente para "cuál es la fecha
        # canónica de este rango", nunca el string crudo de entrada.
        "fecha_inicio": fecha_inicio_canon,
        "fecha_fin": fecha_fin_canon,
        "duracion_min": duracion,
        "dias": dias_resultado,
    }
