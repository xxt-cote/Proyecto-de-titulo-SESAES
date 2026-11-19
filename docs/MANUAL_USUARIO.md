# Manual de usuario

Esta guía explica el uso diario de SESAES para estudiante, profesional,
administrador y superadministrador. Los nombres corresponden a la interfaz
de la versión integrada. La disponibilidad de una opción depende de sus permisos.

## 1. Antes de empezar

Solicite al responsable la dirección de SESAES y una cuenta habilitada.
No hay registro público de estudiantes. La institución debe proporcionar
las cuentas o cargarlas por el procedimiento administrativo autorizado.

La sesión actual utiliza una contraseña de SESAES. No se debe introducir una
contraseña institucional suponiendo que existe una conexión SSO: esa integración
todavía no está implementada.

| Perfil      | Qué gestiona                                                 |
| ----------- | ------------------------------------------------------------ |
| Estudiante  | Citas, cuestionarios, documentos y datos propios             |
| Profesional | Agenda propia, pacientes permitidos y registro de atenciones |
| Admin       | Operación según permisos y especialidades asignados          |
| Superadmin  | Configuración y gobierno administrativo del sistema          |

## 2. Funciones comunes

### Entrar y salir

1. Abra la dirección proporcionada.
2. Escriba el correo institucional de la cuenta y la contraseña de SESAES.
3. Pulse **Iniciar sesión**.
4. Al terminar, use **Cerrar sesión**, especialmente en equipos compartidos.

El botón del ojo permite mostrar u ocultar la contraseña.
Cinco fallos consecutivos pueden bloquear la cuenta quince minutos.
Un aviso de conexión no significa que la contraseña sea incorrecta.

No se garantiza cambio obligatorio de contraseña en el primer acceso para
los cuatro roles. Si recibe una clave temporal, cámbiela según el procedimiento
de su perfil y las instrucciones del responsable.

### Recuperar acceso

1. En el login, pulse **¿Olvidaste tu contraseña?**.
2. Indique su correo y envíe la solicitud.
3. Revise entrada y spam; el enlace llega únicamente si el correo corresponde
   a una cuenta activa y el servicio de correo está configurado.
4. Abra el enlace y elija una nueva contraseña.
5. Vuelva al login.

Por defecto el enlace vence a los treinta minutos y solo sirve una vez.
Solicitar otro invalida los anteriores. La pantalla da la misma respuesta
para un correo registrado o no registrado; esa respuesta no acredita envío.
Si no llega, contacte a la administración: no repita solicitudes continuamente.

### Contraseñas

La política local exige al menos ocho caracteres, mayúscula, minúscula,
número y símbolo, sin espacios. Hay un límite de 72 bytes UTF-8 por bcrypt.
No comparta claves ni use las de ejemplo de la documentación.

### Navegación, tema y notificaciones

- **Inicio** presenta un resumen adecuado al rol.
- En teléfono, abra el menú con el botón de tres líneas y ciérrelo con la X.
- El botón de tema cambia la apariencia clara/oscura.
- La campana abre las notificaciones. Cerrar el panel no las marca como leídas.
- Puede marcar una notificación como leída o eliminarla mediante sus botones.
- Con teclado, **Saltar al contenido** evita recorrer todo el menú lateral.

### Mini calendario

Los cuatro perfiles usan el mismo calendario informativo:
cambie de mes y pulse una fecha para consultar feriado o efeméride registrada.
Pulse la misma fecha para ocultar el detalle. El calendario del estudiante
también marca los días con cita.

Este mini calendario no reserva horas. Para reservar se utiliza **Agendar cita**
o la **Agenda** administrativa.

## 3. Estudiante

### 3.1. Entender Inicio

Los indicadores muestran próxima cita, cuestionarios pendientes, documentos
disponibles y atenciones realizadas. **Actividad reciente de mis citas** puede
incluir cancelaciones o inasistencias; no todas sus filas son atenciones completadas.

### 3.2. Agendar una cita

1. Entre en **Agendar cita**.
2. Seleccione especialidad y profesional.
3. Revise las fechas habilitadas.
4. Elija un día, una hora disponible y complete los datos solicitados.
5. Revise antes de confirmar.
6. Compruebe el resultado en **Mis citas**.

El estudiante agenda dentro de la ventana de siete días del sistema.
Se excluyen fines de semana, cierres y fechas sin disponibilidad real de
bloques aprobados. Una solicitud de horario pendiente no habilita el calendario.

Si no hay días u horas, no significa que el calendario esté dañado:
puede no haber bloques aprobados, existir un cierre o estar completa la agenda.
La API vuelve a validar al confirmar; una hora visible puede ocuparse por
otra persona mientras se completa el formulario.

Una cita en estado **pendiente** ya está reservada: indica que la atención
todavía no se ha completado. No exige una aprobación administrativa posterior
para una reserva normal.

### 3.3. Consultar, cancelar o reagendar

En **Mis citas**, abra el detalle y compruebe profesional, fecha, hora y estado.
La regla general para cancelar una cita futura exige al menos cinco horas de
anticipación; el servidor decide si la operación corresponde.

**Reagendar puede cancelar primero la hora existente y abrir la elección de una
nueva.** No confirma automáticamente una alternativa ni garantiza conservar la
hora anterior. Lea el mensaje de confirmación y compruebe la nueva reserva.

Si la cita ya fue cancelada por el centro, la notificación puede ofrecer
**Reagendar cita** para volver al flujo de reserva.

### 3.4. Cuestionarios

1. Abra **Cuestionarios** o el aviso del profesional.
2. Seleccione el cuestionario pendiente.
3. Responda y revise la información.
4. Envíelo.

Lo consulta el profesional autorizado. Un cuestionario no sustituye la atención.

### 3.5. Atenciones y documentos

En **Mis atenciones**, abra una atención y sus documentos disponibles.
Descargue la receta o justificativo correspondiente; conserve su código y QR.
Si el profesional anula un documento, su validación informa ese estado.

El justificativo con reposo cubre solo el intervalo indicado, inclusive.
Presentarlo después no amplía los días cubiertos.
La receta tiene una fecha límite de uso, separada de los días de tratamiento.
Consultar el QR no registra entregas de medicamentos ni autoriza repeticiones.

### 3.6. Mi perfil

Revise datos personales y las opciones de contraseña. Al cambiarla se puede
solicitar la actual, la nueva y confirmación. No edite datos académicos como
si fueran una certificación de matrícula: hoy no se consultan a una fuente oficial.

## 4. Profesional

### 4.1. Inicio y agenda

**Inicio** resume atenciones del día, próxima cita, documentos y pendientes.
En **Agenda** consulte su calendario y las citas asignadas.
La grilla compartida se presenta en modo de consulta del profesional.

No puede completar una cita que aún no ocurre. Las acciones disponibles
dependen de fecha, estado y pertenencia del recurso.

### 4.2. Solicitar horario semanal

1. Abra **Agenda** y el apartado de horario semanal.
2. Añada los bloques de atención y, si corresponde, los de colación.
3. Revise todos los días de la semana que desea solicitar.
4. Envíe la solicitud completa.
5. Consulte su estado en **Solicitudes**.
6. Espere aprobación administrativa.

| Día              | Jornada institucional  |
| ---------------- | ---------------------- |
| Lunes a jueves   | 09:00–17:30            |
| Viernes          | 09:00–16:30            |
| Sábado y domingo | Sin atención ordinaria |

La colación debe existir como bloque explícito de tipo colacion.
No se descuenta automáticamente. Los bloques disponibles son de tipo disponible.

Enviar otra solicitud de bloques pendiente sustituye la pendiente anterior.
La aprobación reemplaza la semana vigente completa; no agrega únicamente
los nuevos tramos. El rechazo conserva la semana aprobada anterior.
Las citas ya existentes no se desplazan automáticamente: coordine cualquier
conflicto con administración antes de cambiar la agenda.

### 4.3. Pacientes e historial

**Pacientes** permite buscar y filtrar citas de pacientes por estado.
**Historial Clínico** contiene la información clínica cuyo acceso está permitido.
No todos los usuarios son pacientes asignados al profesional.

Seleccione al paciente correcto antes de registrar información. Verifique
identidad y atención, no solo similitud del nombre.

### 4.4. Registrar una atención

1. Abra la cita que corresponde y pulse **Iniciar atención**.
2. Revise paciente y antecedentes permitidos.
3. Complete los campos clínicos de la pantalla.
4. Si procede y su especialidad tiene capacidad habilitada, active receta
   o justificativo.
5. Revise el resumen y confirme la finalización.
6. Compruebe la atención y los documentos emitidos.

**Receta:** complete cada medicamento con sus instrucciones y la fecha límite
de uso. La duración del tratamiento de cada medicamento no sustituye esa fecha.
El formulario informa sobre los medicamentos que requieren formatos oficiales.

**Justificativo:** indique modalidad y datos solicitados. Si señala reposo,
debe incluir fecha desde y hasta coherentes. No incluye diagnóstico en el PDF.

Los PDFs nuevos no muestran firma gráfica, pero mantienen identificación del
profesional, folio único, barras y QR. La opción de firma del perfil conserva
compatibilidad histórica; no es requisito de la emisión actual.

### 4.5. Inasistencia y anulación

Marque **Inasistencia** cuando corresponda a una cita que pueda gestionar.
No use una atención completada para representar que el paciente no asistió.

Si debe anular un documento emitido, abra sus documentos y utilice la opción
de anulación con motivo. Solo el profesional emisor autorizado puede hacerlo.
No borre ni modifique a mano una instantánea clínica en la base.

## 5. Administrador

### 5.1. Qué significa tener acceso administrativo

El superadmin configura perfil, permisos y alcance. Una cuenta admin recién
creada puede no mostrar módulos o recibir acceso denegado: no necesariamente
es un error. Solicite que revisen la configuración efectiva.

El alcance puede ser institucional o por especialidades. No debe usarse una
cuenta superadmin para evitar configurar a los administradores operativos.

### 5.2. Reservar una hora normal

1. Abra **Agenda**.
2. Seleccione especialidad y profesional; ambos filtros se relacionan.
3. Elija una fecha y un horario libre.
4. Seleccione al estudiante y revise los datos.
5. Confirme.
6. Verifique que la cita aparece en la agenda.

La reserva es directa; no se envía al profesional para aprobación.
Una hora libre se registra como normal aunque antes se haya iniciado el flujo
de sobrecupo. La cita creada no desplaza ninguna otra.

### 5.3. Usar sobrecupo

1. Compruebe que necesita agregar una atención en un intervalo ocupado.
2. Seleccione profesional y utilice **Agendar sobrecupo**, o la opción disponible
   del bloque ocupado.
3. Seleccione estudiante y escriba un motivo claro.
4. Revise las citas que coinciden y confirme únicamente si corresponde.
5. Compruebe ambas reservas y coordine la atención con el profesional.

Requiere agenda.gestionar y agenda.sobrecupo, además del alcance autorizado.
La capacidad de referencia es dos citas activas coincidentes; el servidor puede
rechazar otro conflicto. No es una autorización para saltar cualquier regla.

La primera cita conserva hora y estado. No se pospone ni cancela por crear
el sobrecupo. Es una decisión de capacidad adicional, no una reprogramación.

### 5.4. Consultar día y gestionar citas

En la vista semanal, pulse el encabezado de un día para ver todas sus citas
en el panel lateral. Pulse un bloque para consultar ese tramo.

En **Citas**, utilice el filtro de estado, incluyendo **Solo urgentes**.
Seleccione una cita antes de cambiar prioridad o cancelar. Revise el resultado
y sus notificaciones; las operaciones dependen de permiso y alcance.

### 5.5. Profesionales

1. Abra **Profesionales** y la opción de alta.
2. Complete nombre, especialidad, datos de cuenta, RUT si corresponde y duración.
3. Defina contraseña y confirmación; no existe clave fija automática.
4. Guarde y compruebe la cuenta.
5. En **Gestión**, revise también correo y RUT cuando deba actualizarlos.

La versión actual conserva una especialidad textual por profesional.
El alta no crea por sí misma su semana de bloques aprobados.

### 5.6. Estudiantes, solicitudes y reportes

- **Estudiantes:** búsqueda y consulta de registros según alcance.
  No hay formulario dedicado de alta de alumnos. La carga autorizada actual
  se explica en la guía técnica de instalación/API.
- **Solicitudes de horario:** revisar la semana completa y aprobar o rechazar.
  Cambiar bloques no reubica citas existentes; revisar agenda y coordinar antes.
- **Reportes:** filtrar el período y utilizar las exportaciones disponibles.
  Interpretar los estados incluidos en cada reporte antes de comparar cifras.
- **Configuración:** solo aparecen las pestañas y acciones autorizadas.

## 6. Superadministrador

### 6.1. Inicio institucional

Incluye indicadores, usuarios, solicitudes y actividad administrativa.
El indicador de incidencias representa eventos de auditoría con error o
denegación; no es un sistema independiente de incidentes clínicos.

### 6.2. Crear y configurar administradores

1. Abra **Administradores**.
2. Cree o seleccione la cuenta administrativa.
3. Configure perfil, alcance y permisos coherentes con sus tareas.
4. Si el alcance es por especialidad, seleccione las especialidades permitidas.
5. Guarde y compruebe el acceso con esa cuenta.

Perfiles contemplados: administrador general, administrador de especialidad,
secretaría general y secretaría de especialidad. No son cuatro roles base
adicionales: son configuraciones de una cuenta admin.

El acceso de sobrecupo se concede explícitamente. No atribuya lectura clínica
universal a un administrador o superadmin.

### 6.3. Configuración institucional y auditoría

Gestione los días cerrados, configuración disponible y capacidades clínicas
por especialidad. Revise el efecto de un cierre sobre citas reservadas y use
los procedimientos de comunicación y gestión que corresponden.

La auditoría se consulta; no existe una función ordinaria para borrar sus
eventos. No elimine registros para que un reporte parezca correcto.

## 7. Validar un documento sin iniciar sesión

1. Abra **Validar documento** desde el login o escanee el QR del PDF.
2. Introduzca el código si no viene completado.
3. Consulte el resultado.
4. Para justificar una ausencia, seleccione la fecha de la ausencia y compruebe
   si está dentro del período.
5. Para recetas, compruebe la vigencia actual informada.

| Resultado                  | Interpretación                                         |
| -------------------------- | ------------------------------------------------------ |
| Registrado y no anulado    | Autenticidad comprobada según la huella guardada       |
| Anulado                    | El documento fue invalidado por el emisor              |
| No encontrado o modificado | No se confirma autenticidad                            |
| Fecha fuera del período    | La ausencia consultada no está cubierta                |
| Receta vencida             | Se superó la fecha límite indicada                     |
| Sin vigencia definida      | Documento antiguo; no se puede afirmar vigencia de uso |

El resultado público muestra información limitada. No es un acceso a la ficha,
al diagnóstico ni a la lista completa de medicamentos.

## 8. Si algo no coincide

No cree una segunda cuenta ni modifique SQL para resolverlo.
Anote pantalla, acción y mensaje, sin compartir contraseñas o datos clínicos.
Consulte [solución de problemas](SOLUCION_PROBLEMAS.md) o al responsable del sistema.
