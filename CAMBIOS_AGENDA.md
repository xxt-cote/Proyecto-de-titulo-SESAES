# SESAES — Cambios: agenda por bloques, restricciones institucionales, aprobación de citas y anti-acaparamiento

Resumen de todo lo que se agregó/modificó sobre tu proyecto real (no sobre el
Documento Maestro, que en varias partes describe funcionalidad aspiracional
que todavía no estaba en el código). Todo se aplicó sobre el `.zip` que
subiste (rama base, commit ~`0c0a64a` según tu propio documento).

Antes de mezclar esto con tu repo: **corre `database/migration_agenda_bloques.sql`**
contra tu base de datos si ya tiene datos (si es una base nueva, no hace falta,
`Base.metadata.create_all` crea todo solo al levantar el backend).

---

## Cosas que YA EXISTÍAN y no se tocaron (para que no las busques de más)

- Agenda visual del admin verde/gris con hover y click-to-agendar.
- "Sobrecupo" del admin como excepción manual para el horario personal del profesional.
- Aprobar/rechazar solicitudes de colación y jornada.
- Reporte de ausencia (temporal / día completo / licencia) — solo le faltaba la fecha exacta en "día completo".
- `/admin/auditoria` para trazabilidad — ahí mismo aparecen los nuevos eventos.

## Nota importante sobre RBAC

El Documento Maestro describe un sistema de permisos (`AGENDA_GESTIONAR_PROPIA`,
etc.) que **no existe en tu código real**. Tu RBAC real es rol + ownership
(`verificar_rol`, `verificar_acceso_profesional` en `auth_dependencies.py`).
Todo lo nuevo se construyó sobre ese sistema real, no sobre el del documento.

## Nota sobre iconografía

El Documento Maestro dice "obligatorio Google Material Symbols Outlined",
pero esa fuente **no está cargada** en `index.html` de tu proyecto actual —
todo el proyecto usa emojis como iconos. Usé emojis en lo nuevo para no
introducir un ícono roto. Si más adelante cargan esa fuente, es fácil de cambiar.

---

## PASO 1 — Módulo del Profesional

**Backend**
- `app/reglas_horario.py` (nuevo): rango institucional único (Lun-Jue 09:00-17:30,
  Vie 09:00-16:30), usado por horarios, solicitudes y citas para no desincronizarse.
- `app/models/bloque_horario_semanal.py` (nuevo): tabla `bloque_horario_semanal`
  — la agenda semanal aprobada, por día + rango + tipo (disponible/colación).
- `app/models/ausencia_profesional.py` (nuevo): tabla `ausencia_profesional`
  — fecha exacta de un día no laborado, para BLOQUEAR agendamiento nuevo ahí
  (no solo cancelar lo que ya existía).
- `routers/solicitudes_horario.py`:
  - `solicitar_colacion` / `solicitar_jornada`: ahora validan contra el rango
    institucional (antes no había ningún límite, se podía pedir 06:00-22:00).
  - Nuevo endpoint `POST /profesional/{id}/solicitar-bloques-horario`: recibe
    una lista de bloques `{dia_semana, hora_inicio, hora_fin, tipo}`, valida
    cada uno contra el rango institucional de ESE día, rechaza sábado/domingo,
    y lo guarda como una sola solicitud (tipo `"bloques"`) pendiente de aprobación.
- `routers/profesionales.py`:
  - `reportar_ausencia` (tipo `dia_completo`): ahora acepta cualquier fecha
    futura (antes solo "hoy"), y crea un registro en `ausencia_profesional`.
    Corregí además un bug: reportar una ausencia futura ya no marca al
    profesional como "inasistencia" *desde ahora mismo* — solo afecta el día
    reportado.
- `routers/horarios.py` (`get_disponibilidad`): reescrito para que, si el
  profesional ya tiene bloques semanales aprobados, se use ESA agenda (por
  día), y si no, siga usando el horario simple de antes — siempre acotado al
  rango institucional. También ahora respeta `ausencia_profesional`.

**Frontend**
- Modal de ausencia: agregado el selector de fecha para "Todo el día"
  (`dashboard-profesional.html` / `.ts`).
- Nueva card "Agenda semanal por bloques" en *Mi horario → Jornada y colación*:
  grilla clickeable (Lun-Vie × media hora, acotada al rango institucional),
  con dos "pinceles" (Disponible / Colación), fusiona la selección en bloques
  contiguos y la envía como una sola solicitud. Se precarga con lo ya aprobado.
  (`dashboard-profesional.ts`, `.html`, `.css`).

---

## PASO 2 — Módulo del Administrador

**Backend**
- `aprobar_solicitud` / `rechazar_solicitud` (`solicitudes_horario.py`):
  ahora manejan el tipo `"bloques"` — al aprobar, reemplaza toda la agenda
  semanal aprobada del profesional (`bloque_horario_semanal`) por el paquete
  nuevo.
- `citas.py` (`crear_cita`): agregado bloqueo DURO (sin excepción de
  sobrecupo) de sábado/domingo, fuera del rango institucional del día, hora
  ya pasada, y días con ausencia reportada. El sobrecupo del admin sigue
  funcionando igual que antes, pero solo para el horario *personal* del
  profesional (colación / fuera de su jornada propia) — nunca para saltarse
  el horario institucional completo.

**Frontend**
- Tarjeta de "Solicitudes de Horario Pendientes": ahora muestra
  correctamente el tipo "🗓️ Agenda semanal" y una vista previa legible de
  cada bloque (día, horario, si es colación) en vez de un rango vacío.
  Aprobar/Rechazar ya funcionaban de forma genérica, no necesitaron cambios.

*(No se tocó la grilla verde/gris de agenda del admin ni el flujo de
agendar-para-un-estudiante — ya cumplían lo pedido.)*

---

## PASO 3 — Estudiante, aprobación de citas y anti-acaparamiento

**Backend**
- `Cita`: nuevo campo `rechazada_por_profesional` (mismo patrón que
  `cancelada_por_admin` ya existente).
- `routers/profesionales.py`: nuevos endpoints
  `PATCH /profesional/{id}/citas/{cita_id}/aceptar` y `.../rechazar`
  (requiere motivo). Aceptar solo confirma y notifica — **no cambia el
  estado** de la cita (sigue "pendiente" hasta el día de la atención, para
  respetar la regla "Cita ≠ Atención" del propio Documento Maestro). Rechazar
  reutiliza el estado "cancelada" + el nuevo flag, para no inventar un 5°
  estado con su propio color.
- `citas.py` (`crear_cita`): la detección de "ya tienes una cita pendiente"
  ahora distingue dos casos:
  - **Mismo profesional** (acaparamiento real): mensaje genérico ("esa hora
    ya no está disponible"), sin explicar el motivo, + registro en
    `Auditoria` con la acción `"Intento de acaparamiento detectado"`
    (visible para el admin en `/admin/auditoria`, que ya existía).
  - **Otro profesional, misma especialidad** (caso legítimo ya existente):
    mismo mensaje explícito de siempre, sin cambios.

**Frontend**
- Panel de detalle del día en *Mi Agenda* (profesional): las citas
  "pendiente" ahora muestran botones **✓ Aceptar** / **✗ Rechazar**, con un
  modal pidiendo el motivo de rechazo.
- Historial del estudiante (`/historial/estudiante/{id}`) ya exponía
  `motivo_cancelacion`; se agregó también `rechazada_por_profesional` para
  poder distinguirlo de una cancelación normal si en algún momento quieren
  mostrarlo distinto en el frontend del estudiante (no lo agregué ahí porque
  no vi ese template — el dato ya está disponible en el endpoint).

*(La trazabilidad admin de todo este flujo ya queda cubierta por
`/admin/auditoria`, que ya existía — no hizo falta una vista nueva.)*

---

## Verificación hecha

- Backend: `python -m py_compile` sobre todos los archivos tocados → sin errores.
- Frontend: `npx tsc --noEmit` sobre todo el proyecto → sin errores.
  (No pude correr `ng build` completo: el Node de este sandbox es más viejo
  que el mínimo que pide tu Angular CLI. Recomiendo correr `ng build` una vez
  en tu máquina antes de hacer merge, como validación final.)

---

## Iteración 2 — Ocultar fin de semana y bloquear pasado/fuera de rango institucional

**Frontend — `dashboard-profesional.ts` / `dashboard-admin.ts`**
- `buildSemana()` ahora genera solo Lunes a Viernes (antes generaba los 7
  días e igual mostraba Sábado/Domingo como columnas, aunque el backend ya
  las rechazaba). Se ajustaron las referencias que asumían 7 días
  (`semanaActual[6]` → último índice real).
- Grilla "Mi Agenda" del profesional: las columnas de días ya pasados ahora
  se ven atenuadas (`dia-pasado-prof`, solo visual — esa grilla es de solo
  lectura, no se agenda desde ahí).

**Frontend — `dashboard-admin.ts` / `.html` / `.css` (donde sí se agenda)**
- El rango de horas de la grilla ahora es el institucional real (09:00-17:30),
  en vez del genérico 08:00-18:00 que tenía antes.
- Nuevo estado `'pasado'`: cualquier bloque vacío cuya fecha/hora ya pasó
  ahora se ve gris y **no es clickeable** (antes se podía hacer clic e
  intentar agendar, y recién el backend lo rechazaba).
- Nuevo estado `'fuera-institucional'`: los bloques del viernes después de
  las 16:30 (fuera del rango que tiene habilitado la universidad ese día)
  ahora se ven con un patrón gris distinto y **tampoco son clickeables, ni
  siquiera como sobrecupo** — a diferencia de "fuera del horario personal
  del profesional", que sigue siendo forzable por el admin como excepción.
- Si un bloque pasado/fuera de rango YA tenía una cita agendada (de antes de
  este cambio), se sigue mostrando normalmente (ocupada/urgente/sobrecupo) —
  solo se bloquean los bloques vacíos, para no ocultar citas reales.

**Verificación:** `npx tsc --noEmit` sobre todo el frontend, sin errores.

**Detalle que dejo anotado, no arreglé:** si tenías citas agendadas antes de
este cambio fuera del rango 09:00-17:30 (por ejemplo a las 08:00 o 18:00, en
el sistema viejo sin restricción), esas citas seguirán existiendo en la base
de datos pero **no van a aparecer en la grilla** del admin porque ahora sus
filas de horas no llegan tan temprano/tarde. Si tienes citas históricas en
esos horarios, revísalas por otra vía (ej. `/admin/historial`) — no debería
haber muchas, porque para llegar ahí alguien tuvo que forzar un sobrecupo
manualmente.

---

## Iteración 3 — La grilla del admin ahora refleja el horario real, y el calendario del estudiante bloquea días sin atención

**El bug de fondo que encontré:** `GET /admin/profesionales` nunca devolvía
`horario_inicio`, `horario_fin` ni la colación del profesional — por eso tu
grilla de Agenda (la de la Image 3 que mandaste) se veía toda verde, sin
importar qué horario tuviera cada profesional. El frontend ya tenía la
lógica para pintar gris/colación, simplemente nunca le llegaba el dato.

**Backend**
- `routers/admin.py` (`GET /profesionales`): ahora incluye `horario_inicio`,
  `horario_fin`, `hora_almuerzo_inicio/fin` **y** `bloques_semanales`
  (la agenda por bloques aprobada, si el profesional ya migró a eso).
- `routers/profesionales.py` (`GET /profesionales`, el listado público que
  ve el estudiante): ahora incluye `dias_disponibles` — los días de semana
  (0=Lunes...4=Viernes) en que ese profesional realmente atiende, calculado
  a partir de sus bloques o de su jornada simple.
- `reglas_horario.py`: nueva función `calcular_dias_disponibles()`, para no
  duplicar esa lógica en cada router.

**Frontend — Admin (grilla de Agenda)**
- `esHoraDeAlmuerzo()` / `esFueraDeHorarioProfesional()` ahora reciben la
  fecha y, si el profesional tiene agenda semanal por bloques, la usan
  día por día (permite, por ejemplo, colación distinta el viernes); si no,
  siguen usando el horario simple de siempre. Con el fix del backend de
  arriba, esto ya debería verse reflejado en la grilla tal como en tu
  segunda foto de referencia (verde = disponible, gris = no).

**Frontend — Estudiante (mini-calendario al pedir hora)**
- El calendario mensual (Image 1) ahora deshabilita también los días de
  semana en que el profesional seleccionado NO tiene ningún bloque
  disponible ni jornada configurada — antes solo deshabilitaba fin de
  semana, fechas pasadas y días cerrados del centro. Si el profesional no
  tiene ninguna restricción cargada todavía, no se deshabilita nada de más
  (para no bloquear a alguien que aún no configuró su agenda).

**Verificación:** `tsc --noEmit` y `py_compile` sin errores.

**Nota sobre tu foto de referencia (Image 4):** esa pantalla (con sala de
espera, boxes, sobrecupos con colores por tipo de atención, etc.) es un
sistema bastante más grande y elaborado — no es algo que replique aquí,
son features aparte. Lo que sí impacté es que la grilla actual muestre
correctamente disponible/colación/fuera de horario según el horario real
del profesional, que es lo que estaba roto.

---

## Iteración 4 — Grilla del admin más rica visualmente (inspirada en tu Image 4, con datos que ya existen)

Como acordamos: no repliqué el sistema completo de la Image 4 (boxes, sala
de espera, TENS, cupos autorizados, recetas — eso son módulos nuevos aparte).
Esto es la mejora visual con lo que **ya existe** en `Cita`/`Usuario`.

**Frontend — `dashboard-admin.ts` / `.html` / `.css`**
- Nueva barra de estadísticas arriba de la grilla, calculada 100% en el
  cliente a partir de `citasHorario` + `semanaActual` + `horasGrilla` (sin
  endpoints nuevos): **Citas programadas / capacidad**, **% Ocupado**,
  **Urgentes**, **Sobrecupos** (estos dos solo aparecen si hay al menos 1),
  y **Bloques libres** — getter `estadisticasSemana`.
- Cada celda ocupada de la grilla ahora muestra una tarjeta con **nombre del
  estudiante + RUT**, y badges de color cuando corresponde (🔴 URGENTE,
  🟣 SOBRECUPO), en vez de solo el nombre truncado en una línea.
- Borde izquierdo de color por tipo de cita (azul = cita normal, rojo =
  urgente, morado = sobrecupo) en modo claro — ya existía en modo oscuro,
  faltaba en modo claro.
- Alto de celda subido de 48px a 52px para que la tarjeta de dos líneas
  quepa cómoda.
- Nuevo método público `citaEnBloque()` (antes la búsqueda de la cita en un
  bloque era privada, solo devolvía el nombre para el tooltip).

No se tocó el backend en esta iteración — todo lo que se muestra ya se
estaba cargando, solo faltaba mostrarlo mejor.

**Verificación:** `tsc --noEmit` sin errores, brackets/divs balanceados
(chequeo automático, no reemplaza correr `ng build` en tu máquina).

---

## Iteración 5 — Bug real en disponibilidad (backend) + colores que no distinguían nada (frontend profesional)

**El bug de fondo (backend, `horarios.py` → `get_disponibilidad`):**
decidía "¿este profesional usa bloques o jornada simple?" **por día**, no
por profesional. Si un profesional en modo bloques no tenía bloques
cargados para un día específico (ej. no trabaja los martes), el sistema
caía al horario simple de respaldo — que por defecto ofrece todo el rango
institucional si `horario_inicio`/`horario_fin` están vacíos (típico en un
profesional que ya migró a bloques). Esto explica el caso reportado: un día
"permitido" en el calendario pero sin ninguna hora disponible al abrirlo.

**Fix:** ahora se decide **una sola vez por profesional** (¿tiene algún
bloque cargado, en cualquier día?) si usa el sistema de bloques o el de
jornada simple — igual que ya hacía `calcular_dias_disponibles()` para el
calendario. Si usa bloques y no tiene ninguno para ESE día en particular,
la respuesta es "no atiende este día", sin mezclar con el horario simple.

**El segundo bug (frontend, `dashboard-profesional.css`):**
`.bloque-prof.ocupado` (una cita real) usaba **exactamente el mismo verde**
que `.bloque-prof.libre` (disponible) — por eso toda la grilla se veía del
mismo color, cita o no. Ahora "ocupado" es azul (🟦, misma convención que
ya usa el admin), y agregué un estado nuevo "fuera de horario" (⬜ gris)
para las horas en que el profesional simplemente no atiende — antes esas
horas no se distinguían de las disponibles, porque `getBloqueEstado()`
nunca miraba los bloques semanales, solo el horario_inicio/fin legado.

**Otros ajustes en `dashboard-profesional.ts`:**
- `generarHorasGrilla()`: ahora la grilla siempre parte a las 09:00 (antes
  cae al 08:00 fijo si el profesional no tenía horario_inicio configurado
  — el caso típico de alguien en modo bloques).
- `horaAPosicionPct()` (usado en "Pulso de hoy"): mismo fallback
  institucional 09:00-17:30 en vez de 08:00-18:00.
- Nuevos helpers `profesionalUsaBloques`, `diaSemanaBackend()`,
  `bloquesDelDia()` — mismo criterio que el backend, para que la grilla del
  profesional y la disponibilidad que ve el estudiante nunca queden
  desincronizadas otra vez.

**Verificación:** `py_compile` (backend) y `tsc --noEmit` (frontend) sin
errores, brackets/divs balanceados.

---

## Iteración 6 — Ventana de 7 días no coincidía entre calendario y backend, y aviso claro cuando no hay horario configurado

**El bug real (frontend, `dashboard-estudiante.ts` → `generarCalendario`):**
el texto de la UI dice "próximos 7 días, lunes a viernes", y el backend
(`GET /disponibilidad`) efectivamente rechaza cualquier fecha más allá de
`hoy + 7 días` — pero el calendario nunca aplicaba ese límite: dejaba
seleccionar cualquier día hábil del mes completo. Por eso un jueves o
viernes que cayera un poco más allá de esa ventana (ej. hoy miércoles 9,
ventana hasta el 16, y elegías el 17) siempre iba a devolver "Sin horas
disponibles" — no por el horario del profesional, sino porque el backend
ni siquiera evalúa fechas fuera de esa ventana. **Fix:** el calendario ahora
deshabilita también los días fuera de `hoy + 7 días`, con tooltip explicando
por qué ("Solo se puede agendar dentro de los próximos 7 días").

**Sobre la grilla del profesional que sigue toda verde:** revisé el código
de nuevo y, tal como quedó después de la Iteración 5, si un profesional NO
tiene ningún bloque semanal NI horario simple configurado, el sistema
correctamente no tiene nada que distinguir — toda la semana se ve
"disponible" porque, de hecho, ESE es el comportamiento real también en el
backend (sin restricciones configuradas, se ofrece todo el rango
institucional). Si el profesional que estás mirando en la Image 1 no tiene
un horario cargado y aprobado todavía, el verde uniforme es correcto, no un
bug de color. Para que esto no se preste a confusión, agregué un aviso
visible arriba de la grilla cuando pasa esto exacto:

> ⚠️ Todavía no tienes ningún horario configurado (ni por bloques ni jornada
> simple), por eso toda la semana se ve igual, sin distinción de colores...

**Importante para que puedas verificar tú mismo:** si después de este aviso
sigues viendo la grilla toda verde SIN el aviso arriba (es decir, el sistema
cree que sí tienes bloques/jornada cargados pero igual no distingue nada),
ahí sí sería un bug distinto — al que no le tengo visibilidad sin ver tu
base de datos real. En ese caso, dime específicamente: (1) si ese
profesional tiene una solicitud de horario ya **aprobada** (no solo
enviada) en la pestaña "Jornada y colación", y (2) si estás probando con el
código de este zip ya aplicado a tu entorno (backend Y frontend), porque
varias de estas correcciones son de backend — si solo actualizaste el
frontend, `/disponibilidad` seguiría con la lógica vieja.

**Verificación:** `tsc --noEmit` sin errores. Confirmé además que el
desbalance de divs en `dashboard-estudiante.html` (195 abren / 193 cierran)
ya existía en tu archivo original, no lo introduje yo.

## Lo que quedó fuera del alcance (no se tocó)

- No se probó contra una base de datos real (no hay Postgres disponible en
  este sandbox) — corre las migraciones y prueba el flujo completo antes de
  subir a producción.
- El dashboard del estudiante no muestra visualmente el rechazo del
  profesional de forma distinta a una cancelación normal (el dato ya está en
  el backend, falta solo el detalle visual si lo quieren).
- La columna Sábado/Domingo del grid de "Mi Agenda" del profesional/admin
  sigue renderizándose (aunque el backend ya las rechaza); si quieren, se
  pueden ocultar visualmente esas columnas como mejora cosmética aparte.
