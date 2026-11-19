# Referencia de rutas HTTP

Inventario de decoradores en main.py y routers de la versión documentada.
No incluye las rutas de documentación generadas por FastAPI. Para payloads y
autorización revisar [API](API.md), OpenAPI local y el código enlazado.
No todos los endpoints son públicos: esta tabla no concede acceso.

## main

| Método | Ruta      | Referencia de implementación                                                                              |
| ------ | --------- | --------------------------------------------------------------------------------------------------------- |
| GET    | `/`       | [home](../backend/app/main.py#L103)                                                                       |
| GET    | `/health` | [Chequeo de vida para el monitoreo (Render / UptimeRobot). No toca la base.](../backend/app/main.py#L108) |

## admin

| Método | Ruta                                               | Referencia de implementación                                                                                                |
| ------ | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/admin/estadisticas`                              | [get estadisticas](../backend/app/routers/admin.py#L114)                                                                    |
| GET    | `/admin/resumen-dia`                               | [get resumen dia](../backend/app/routers/admin.py#L204)                                                                     |
| GET    | `/admin/proximas-citas`                            | [get proximas citas](../backend/app/routers/admin.py#L251)                                                                  |
| POST   | `/admin/estudiantes`                               | [Alta de alumno sin SQL manual, restringida a gestión institucional.](../backend/app/routers/admin.py#L316)                 |
| GET    | `/admin/estudiantes`                               | [buscar estudiantes](../backend/app/routers/admin.py#L356)                                                                  |
| GET    | `/admin/estudiantes/listado`                       | [Listado completo de estudiantes con paginaci?n.](../backend/app/routers/admin.py#L427)                                     |
| GET    | `/admin/estudiantes/{estudiante_id}/perfil`        | [Ficha administrativa de un estudiante.](../backend/app/routers/admin.py#L592)                                              |
| GET    | `/admin/graficos/especialidad`                     | [get grafico especialidad](../backend/app/routers/admin.py#L754)                                                            |
| GET    | `/admin/graficos/semana`                           | [get grafico semana](../backend/app/routers/admin.py#L818)                                                                  |
| GET    | `/admin/profesionales`                             | [get profesionales admin](../backend/app/routers/admin.py#L894)                                                             |
| POST   | `/admin/profesionales`                             | [crear profesional](../backend/app/routers/admin.py#L969)                                                                   |
| PATCH  | `/admin/profesionales/{prof_id}`                   | [actualizar profesional](../backend/app/routers/admin.py#L1080)                                                             |
| DELETE | `/admin/profesionales/{prof_id}`                   | [eliminar profesional](../backend/app/routers/admin.py#L1236)                                                               |
| PATCH  | `/admin/profesionales/{prof_id}/estado`            | [cambiar estado profesional](../backend/app/routers/admin.py#L1379)                                                         |
| GET    | `/admin/profesionales/{prof_id}/historial-estados` | [Devuelve el historial administrativo de estados de un](../backend/app/routers/admin.py#L1560)                              |
| POST   | `/admin/citas/urgente`                             | [crear cita urgente](../backend/app/routers/admin.py#L1642)                                                                 |
| PATCH  | `/admin/citas/{cita_id}/cancelar`                  | [cancelar cita admin](../backend/app/routers/admin.py#L1831)                                                                |
| PATCH  | `/admin/citas/{cita_id}/prioridad`                 | [Cambia la prioridad administrativa de una cita existente.](../backend/app/routers/admin.py#L1953)                          |
| GET    | `/admin/dias-cerrados`                             | [Devuelve los d?as en que el centro completo est? cerrado.](../backend/app/routers/admin.py#L2092)                          |
| POST   | `/admin/dias-cerrados`                             | [crear dia cerrado](../backend/app/routers/admin.py#L2123)                                                                  |
| GET    | `/admin/dias-cerrados/{dia_id}/citas`              | [Detalle administrativo de las citas canceladas en un d?a](../backend/app/routers/admin.py#L2215)                           |
| DELETE | `/admin/dias-cerrados/{dia_id}`                    | [eliminar dia cerrado](../backend/app/routers/admin.py#L2332)                                                               |
| GET    | `/admin/reportes/resumen`                          | [get reportes resumen](../backend/app/routers/admin.py#L2418)                                                               |
| GET    | `/admin/reportes/resumen/pdf`                      | [PDF administrativo con los mismos números que el JSON; deja registro de auditoría.](../backend/app/routers/admin.py#L2439) |
| GET    | `/admin/reportes/resumen/excel`                    | [Excel (.xlsx real, OpenPyXL) con el mismo resumen que el JSON y el PDF:](../backend/app/routers/admin.py#L2484)            |
| GET    | `/admin/historial`                                 | [get historial admin](../backend/app/routers/admin.py#L2550)                                                                |
| GET    | `/admin/notificaciones`                            | [Devuelve ?nicamente las notificaciones de la cuenta](../backend/app/routers/admin.py#L2715)                                |
| GET    | `/admin/exportar/cgr`                              | [exportar cgr](../backend/app/routers/admin.py#L2856)                                                                       |
| GET    | `/admin/exportar/alumnos`                          | [exportar listado alumnos](../backend/app/routers/admin.py#L2862)                                                           |
| GET    | `/admin/exportar/cgr/datos`                        | [exportar cgr datos](../backend/app/routers/admin.py#L2872)                                                                 |
| GET    | `/admin/exportar/alumnos/datos`                    | [exportar listado alumnos datos](../backend/app/routers/admin.py#L2878)                                                     |
| GET    | `/admin/auditoria`                                 | [get auditoria](../backend/app/routers/admin.py#L2891)                                                                      |
| GET    | `/admin/configuracion`                             | [get configuracion](../backend/app/routers/admin.py#L2945)                                                                  |
| PATCH  | `/admin/configuracion`                             | [actualizar configuracion](../backend/app/routers/admin.py#L2957)                                                           |

## admin_capacidades_clinicas

| Método | Ruta                                  | Referencia de implementación                                                        |
| ------ | ------------------------------------- | ----------------------------------------------------------------------------------- |
| GET    | `/admin/capacidades-clinicas`         | [listar capacidades](../backend/app/routers/admin_capacidades_clinicas.py#L103)     |
| PUT    | `/admin/capacidades-clinicas/{clave}` | [actualizar capacidades](../backend/app/routers/admin_capacidades_clinicas.py#L118) |

## admin_inicio

| Método | Ruta                    | Referencia de implementación                                      |
| ------ | ----------------------- | ----------------------------------------------------------------- |
| GET    | `/admin/inicio/resumen` | [get resumen inicio](../backend/app/routers/admin_inicio.py#L374) |
| GET    | `/admin/inicio/gestion` | [get gestion inicio](../backend/app/routers/admin_inicio.py#L392) |

## agenda

| Método | Ruta                                                  | Referencia de implementación                                                                                  |
| ------ | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| GET    | `/agenda/profesionales`                               | [Catálogo operacional mínimo para seleccionar profesionales en Agenda.](../backend/app/routers/agenda.py#L37) |
| GET    | `/agenda/citas`                                       | [Listado administrativo/operacional de citas.](../backend/app/routers/agenda.py#L88)                          |
| GET    | `/agenda/profesional/{prof_id}/citas`                 | [Vista administrativa/operacional de la agenda de un profesional.](../backend/app/routers/agenda.py#L256)     |
| GET    | `/agenda/profesional/{profesional_id}/disponibilidad` | [A.2B — disponibilidad real de un profesional, día por día, para un](../backend/app/routers/agenda.py#L314)   |

## auth

| Método | Ruta     | Referencia de implementación                |
| ------ | -------- | ------------------------------------------- |
| POST   | `/login` | [login](../backend/app/routers/auth.py#L21) |

## capacidades_clinicas

| Método | Ruta                                | Referencia de implementación                                                                                       |
| ------ | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| GET    | `/profesional/capacidades-clinicas` | [Devuelve {"capacidades": [...]} con las capacidades clínicas](../backend/app/routers/capacidades_clinicas.py#L63) |

## citas

| Método | Ruta                                    | Referencia de implementación                                 |
| ------ | --------------------------------------- | ------------------------------------------------------------ |
| GET    | `/citas/estudiante/{estudiante_id}`     | [get citas estudiante](../backend/app/routers/citas.py#L231) |
| GET    | `/historial/estudiante/{estudiante_id}` | [get historial](../backend/app/routers/citas.py#L261)        |
| POST   | `/citas`                                | [crear cita](../backend/app/routers/citas.py#L304)           |
| DELETE | `/citas/{cita_id}`                      | [cancelar cita](../backend/app/routers/citas.py#L677)        |
| GET    | `/citas/{cita_id}/pdf`                  | [descargar pdf cita](../backend/app/routers/citas.py#L760)   |

## configuracion_centro

| Método | Ruta                                     | Referencia de implementación                                                                                             |
| ------ | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| GET    | `/configuracion-centro`                  | [get configuracion centro](../backend/app/routers/configuracion_centro.py#L62)                                           |
| PATCH  | `/configuracion-centro`                  | [actualizar configuracion centro](../backend/app/routers/configuracion_centro.py#L79)                                    |
| PATCH  | `/configuracion-centro/cambiar-password` | [ADMIN y SUPERADMIN pueden cambiar exclusivamente la contraseña de](../backend/app/routers/configuracion_centro.py#L122) |

## correos

| Método | Ruta       | Referencia de implementación                                                                     |
| ------ | ---------- | ------------------------------------------------------------------------------------------------ |
| GET    | `/correos` | [Lista los ?ltimos 100 correos visibles para el alcance](../backend/app/routers/correos.py#L120) |

## documentos_clinicos

| Método | Ruta                                    | Referencia de implementación                                                                                                             |
| ------ | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/documentos/validar/{codigo}`          | [Sin autenticación: lo usa la pantalla pública "Validar documento" y el](../backend/app/routers/documentos_clinicos.py#L60)              |
| GET    | `/documentos/profesional/{prof_id}/hoy` | [Cuántos documentos vigentes emitió el profesional hoy (solo el propio profesional).](../backend/app/routers/documentos_clinicos.py#L72) |
| GET    | `/documentos/cita/{cita_id}`            | [listar documentos de cita](../backend/app/routers/documentos_clinicos.py#L83)                                                           |
| GET    | `/documentos/{doc_id}/pdf`              | [descargar documento pdf](../backend/app/routers/documentos_clinicos.py#L96)                                                             |
| POST   | `/documentos/{doc_id}/anular`           | [anular documento](../backend/app/routers/documentos_clinicos.py#L111)                                                                   |

## estudiante

| Método | Ruta                                           | Referencia de implementación                                                                                  |
| ------ | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| GET    | `/estudiante/{estudiante_id}`                  | [obtener estudiante](../backend/app/routers/estudiante.py#L43)                                                |
| PATCH  | `/estudiante/{estudiante_id}`                  | [actualizar estudiante](../backend/app/routers/estudiante.py#L59)                                             |
| PATCH  | `/estudiante/{estudiante_id}/cambiar-password` | [cambiar password estudiante](../backend/app/routers/estudiante.py#L90)                                       |
| PATCH  | `/estudiante/{estudiante_id}/primer-acceso`    | [Se llama justo después del primer login de una cuenta creada con](../backend/app/routers/estudiante.py#L155) |

## firma_profesional

| Método | Ruta                           | Referencia de implementación                                       |
| ------ | ------------------------------ | ------------------------------------------------------------------ |
| GET    | `/profesional/{prof_id}/firma` | [ver firma](../backend/app/routers/firma_profesional.py#L46)       |
| PUT    | `/profesional/{prof_id}/firma` | [registrar firma](../backend/app/routers/firma_profesional.py#L52) |
| DELETE | `/profesional/{prof_id}/firma` | [eliminar firma](../backend/app/routers/firma_profesional.py#L69)  |

## historial_clinico

| Método | Ruta                                                               | Referencia de implementación                                                                                                            |
| ------ | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/historial-clinico/plantilla/{profesional_id}`                    | [obtener plantilla](../backend/app/routers/historial_clinico.py#L193)                                                                   |
| PUT    | `/historial-clinico/plantilla/{profesional_id}`                    | [Reemplaza el set de preguntas propias de este profesional. Las preguntas](../backend/app/routers/historial_clinico.py#L217)            |
| GET    | `/historial-clinico/config-cuestionario/{profesional_id}`          | [obtener config cuestionario](../backend/app/routers/historial_clinico.py#L274)                                                         |
| PUT    | `/historial-clinico/config-cuestionario/{profesional_id}`          | [actualizar config cuestionario](../backend/app/routers/historial_clinico.py#L287)                                                      |
| PUT    | `/historial-clinico/{profesional_id}/{estudiante_id}/cuestionario` | [El profesional decide, para ESTE estudiante, si recibe o no el cuestionario previo.](../backend/app/routers/historial_clinico.py#L306) |
| DELETE | `/historial-clinico/{profesional_id}/{estudiante_id}/cuestionario` | [Quita la decisión puntual: este estudiante vuelve a seguir el ajuste general.](../backend/app/routers/historial_clinico.py#L345)       |
| GET    | `/historial-clinico/cuestionarios-pendientes/{estudiante_id}`      | [Lista los profesionales con quienes el estudiante tiene AL MENOS UNA](../backend/app/routers/historial_clinico.py#L362)                |
| GET    | `/historial-clinico/cuestionarios-respondidos/{estudiante_id}`     | [Cuestionarios de antecedentes que el propio estudiante ya respondió, del más](../backend/app/routers/historial_clinico.py#L428)        |
| GET    | `/historial-clinico/cuestionario-estudiante/{profesional_id}`      | [El propio estudiante consulta las preguntas de un profesional para responderlas.](../backend/app/routers/historial_clinico.py#L468)    |
| POST   | `/historial-clinico/cuestionario-estudiante/{profesional_id}`      | [El estudiante envía sus respuestas por primera vez. Crea la ficha con](../backend/app/routers/historial_clinico.py#L515)               |
| GET    | `/historial-clinico/{profesional_id}/pacientes`                    | [Lista los estudiantes que este profesional ha atendido (según sus citas),](../backend/app/routers/historial_clinico.py#L563)           |
| GET    | `/historial-clinico/{profesional_id}/{estudiante_id}`              | [obtener historial](../backend/app/routers/historial_clinico.py#L669)                                                                   |
| PUT    | `/historial-clinico/{profesional_id}/{estudiante_id}`              | [guardar historial](../backend/app/routers/historial_clinico.py#L757)                                                                   |

## horarios

| Método | Ruta                                          | Referencia de implementación                                                                                          |
| ------ | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| GET    | `/dias-cerrados`                              | [Versión de solo-lectura, accesible para cualquier usuario logueado](../backend/app/routers/horarios.py#L17)          |
| GET    | `/disponibilidad/{profesional_id}`            | [Devuelve las horas disponibles para un profesional en una fecha específica.](../backend/app/routers/horarios.py#L28) |
| GET    | `/disponibilidad/{profesional_id}/calendario` | [Fechas seleccionables del estudiante, evaluadas con la disponibilidad real.](../backend/app/routers/horarios.py#L58) |

## notificaciones

| Método | Ruta                                          | Referencia de implementación                                                   |
| ------ | --------------------------------------------- | ------------------------------------------------------------------------------ |
| GET    | `/notificaciones/{usuario_id}`                | [get notificaciones](../backend/app/routers/notificaciones.py#L49)             |
| PATCH  | `/notificaciones/leer-todas/{usuario_id}`     | [marcar todas leidas](../backend/app/routers/notificaciones.py#L80)            |
| PATCH  | `/notificaciones/{notif_id}/leer`             | [marcar leida](../backend/app/routers/notificaciones.py#L101)                  |
| DELETE | `/notificaciones/eliminar-todas/{usuario_id}` | [eliminar todas notificaciones](../backend/app/routers/notificaciones.py#L121) |
| DELETE | `/notificaciones/{notif_id}`                  | [eliminar notificacion](../backend/app/routers/notificaciones.py#L139)         |

## profesionales

| Método | Ruta                                                  | Referencia de implementación                                                   |
| ------ | ----------------------------------------------------- | ------------------------------------------------------------------------------ |
| GET    | `/profesionales`                                      | [get profesionales](../backend/app/routers/profesionales.py#L124)              |
| GET    | `/profesional/buscar-por-usuario/{usuario_id}`        | [buscar profesional por usuario](../backend/app/routers/profesionales.py#L148) |
| GET    | `/profesional/{prof_id}/perfil`                       | [get perfil](../backend/app/routers/profesionales.py#L171)                     |
| PATCH  | `/profesional/{prof_id}/perfil`                       | [actualizar perfil](../backend/app/routers/profesionales.py#L210)              |
| PATCH  | `/profesional/{prof_id}/cambiar-password`             | [cambiar password](../backend/app/routers/profesionales.py#L238)               |
| GET    | `/profesional/{prof_id}/estadisticas-dia`             | [get estadisticas dia](../backend/app/routers/profesionales.py#L297)           |
| GET    | `/profesional/{prof_id}/citas-sin-cerrar`             | [get citas sin cerrar](../backend/app/routers/profesionales.py#L320)           |
| GET    | `/profesional/{prof_id}/citas`                        | [get citas profesional](../backend/app/routers/profesionales.py#L351)          |
| PATCH  | `/profesional/{prof_id}/citas/{cita_id}/completar`    | [completar cita](../backend/app/routers/profesionales.py#L391)                 |
| PATCH  | `/profesional/{prof_id}/citas/{cita_id}/inasistencia` | [marcar inasistencia](../backend/app/routers/profesionales.py#L475)            |
| GET    | `/profesional/{prof_id}/notificaciones`               | [get notificaciones profesional](../backend/app/routers/profesionales.py#L521) |

## recuperar_password

| Método | Ruta                    | Referencia de implementación                                             |
| ------ | ----------------------- | ------------------------------------------------------------------------ |
| POST   | `/recuperar-password`   | [recuperar password](../backend/app/routers/recuperar_password.py#L38)   |
| POST   | `/restablecer-password` | [restablecer password](../backend/app/routers/recuperar_password.py#L45) |

## solicitudes_horario

| Método | Ruta                                                 | Referencia de implementación                                                                                               |
| ------ | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/profesional/{prof_id}/solicitar-colacion`          | [solicitar colacion](../backend/app/routers/solicitudes_horario.py#L151)                                                   |
| POST   | `/profesional/{prof_id}/solicitar-jornada`           | [solicitar jornada](../backend/app/routers/solicitudes_horario.py#L198)                                                    |
| POST   | `/profesional/{prof_id}/solicitar-bloques-horario`   | [El profesional envia su agenda semanal completa: bloques de atencion](../backend/app/routers/solicitudes_horario.py#L252) |
| GET    | `/profesional/{prof_id}/solicitudes-horario`         | [get mis solicitudes](../backend/app/routers/solicitudes_horario.py#L326)                                                  |
| DELETE | `/solicitudes-horario/{solicitud_id}`                | [eliminar solicitud](../backend/app/routers/solicitudes_horario.py#L348)                                                   |
| GET    | `/admin/solicitudes-horario`                         | [get solicitudes admin](../backend/app/routers/solicitudes_horario.py#L377)                                                |
| PATCH  | `/admin/solicitudes-horario/{solicitud_id}/aprobar`  | [aprobar solicitud](../backend/app/routers/solicitudes_horario.py#L469)                                                    |
| PATCH  | `/admin/solicitudes-horario/{solicitud_id}/rechazar` | [rechazar solicitud](../backend/app/routers/solicitudes_horario.py#L601)                                                   |

## usuarios

| Método | Ruta                                                           | Referencia de implementación                                                                               |
| ------ | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| GET    | `/usuarios/me`                                                 | [Perfil propio del Usuario autenticado (SA-1.2).](../backend/app/routers/usuarios.py#L75)                  |
| PATCH  | `/usuarios/me`                                                 | [Actualiza el perfil propio del Usuario autenticado (SA-1.2).](../backend/app/routers/usuarios.py#L93)     |
| GET    | `/usuarios/me/acceso-administrativo`                           | [Entrega al propio ADMIN/SUPERADMIN su contexto administrativo](../backend/app/routers/usuarios.py#L131)   |
| GET    | `/usuarios/administradores`                                    | [Lista todas las cuentas ADMIN/SUPERADMIN. Solo SUPERADMIN llega](../backend/app/routers/usuarios.py#L440) |
| GET    | `/usuarios/administradores/catalogo-acceso`                    | [Catálogo server-side para construir la UI de perfiles/permisos.](../backend/app/routers/usuarios.py#L458) |
| GET    | `/usuarios/administradores/{usuario_id}/acceso-administrativo` | [Lee la configuración persistida de una cuenta ADMIN.](../backend/app/routers/usuarios.py#L500)            |
| PUT    | `/usuarios/administradores/{usuario_id}/acceso-administrativo` | [Reemplaza de forma completa y transaccional perfil + permisos +](../backend/app/routers/usuarios.py#L530) |
| POST   | `/usuarios/administradores`                                    | [Crea una cuenta ADMIN o SUPERADMIN nueva.](../backend/app/routers/usuarios.py#L692)                       |
| PATCH  | `/usuarios/administradores/{usuario_id}/estado`                | [Activa/desactiva una cuenta ADMIN/SUPERADMIN.](../backend/app/routers/usuarios.py#L791)                   |
| PATCH  | `/usuarios/administradores/{usuario_id}/rol`                   | [Cambia el rol de una cuenta administrativa entre "admin" y](../backend/app/routers/usuarios.py#L858)      |
