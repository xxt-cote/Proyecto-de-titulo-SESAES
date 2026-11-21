# Plan de mejoras SESAES

> Documento para el equipo. Resume qué se revisó, qué ya se corrigió, qué se
> elimina y por qué, y qué falta antes de usar SESAES con usuarios reales.
> **Documento central de mantenimiento y entrega.** Conserva las guías y el historial;
> no debe eliminarse al cerrar los pendientes. Actualizado: 19 de noviembre de 2026.

Origen de la revisión: lectura completa del repositorio, ejecución de los
tests, y los informes de **PageSpeed Insights** (escritorio y celular) y
**CompliaScan** (accesibilidad) sobre las dos pantallas públicas.

## 1. Resultado de las herramientas

| Pantalla | PageSpeed (rend. / acces. / recom. / SEO) | CompliaScan |
|---|---|---|
| `/validar-documento` | 100 / 100 / 100 / 92 (celular y escritorio) | 87/100, 0 críticos |
| Login (`/`) | **No midió**: error `NO_FCP` (no pintó nada) | 73/100, 0 críticos |
| Dashboards (estudiante, profesional, admin) | **No se pueden medir** con herramientas online (requieren sesión) | — |

Hallazgo importante de PageSpeed: **no se están sirviendo las cabeceras de
seguridad** (CSP, COOP, protección contra clickjacking), aunque `vercel.json`
las define. Ver sección 4.

## 2. Qué ya se corrigió (listo para aplicar)

Verificación histórica inicial: **backend 1502 tests OK** (13 se saltan) y
**frontend 938/938 tests OK**. Los resultados posteriores están en el cierre Alembic
y la verificación actual del frontend en la sección 9.

### Backend

| Archivo | Cambio | Por qué |
|---|---|---|
| `backend/requirements.txt` | Estaba **vacío**. Ahora lista todas las dependencias con versión fija. | Sin esto nadie puede instalar ni desplegar el backend de forma reproducible. |
| `backend/app/security.py` | `JWT_SECRET_KEY` es **obligatoria**: si falta o es un valor de ejemplo, el backend no arranca. | Antes había una clave por defecto pública en el código: si se olvidaba la variable en producción, cualquiera podía fabricar un token (incluso de SUPERADMIN). |
| `backend/app/main.py` | `lifespan` en vez de `on_event` (obsoleto); `/docs`, `/redoc` y `/openapi.json` se apagan con `SESAES_ENV=production`; CORS limitado a los métodos y cabeceras que se usan; nuevo `GET /health`. | Menos superficie expuesta y un chequeo de vida para monitoreo. |
| `backend/app/schemas.py` | `foto_url` se valida (JPEG/PNG/WEBP en base64 o URL https, máx. ~450 KB). | Antes se aceptaba cualquier texto de cualquier tamaño en la base de datos. |
| `backend/.env.example` | Completo: JWT, `SESAES_ENV`, CORS, enlaces, correo, datos demo, superadmin. | Faltaban la mayoría de las variables que el código realmente lee. |
| `backend/scripts/migrar_passwords_texto_plano.py` | **Nuevo.** Convierte a bcrypt las contraseñas que sigan en texto plano (simulación por defecto, `--aplicar` para ejecutar). | Paso previo para poder eliminar la rama de texto plano (sección 3). |
| `backend/app/routers/admin.py`, `citas.py`, `historial_clinico.py` | Se quitan imports y una variable sin uso. | Código muerto. |
| `backend/tests/test_a4_2_conflictos.py` | Los tests que fallaban en fin de semana ahora usan "hoy hábil"; uno se salta en fin de semana. | Dependían del día en que se ejecutaban (rompían sábado y domingo). |
| `backend/tests/conftest.py` | Define una clave JWT solo para tests. | Consecuencia del cambio en `security.py`. |

### Frontend

| Archivo | Cambio | Por qué |
|---|---|---|
| `login.html` / `login.css` | `<main>`, `<footer>`, enlace "Saltar al contenido", etiquetas `<label>` reales y `autocomplete` en los campos, botón real (con `aria-label`) para mostrar/ocultar contraseña, `role="alert"` en el error, contraste del pie (3,9:1 a ~6:1), texto de 11 px a 12 px, tamaño mínimo de objetivos táctiles. | Hallazgos de CompliaScan + problemas que las herramientas no ven (los campos solo tenían placeholder y el ojo de la contraseña era un `span` que el teclado no alcanzaba). |
| `validar-documento.*` | Enlace "Saltar al contenido", `id="main"`, `<footer>`, tamaño del enlace "Iniciar sesión", foco visible, y `canonical` propio de la ruta. | Hallazgos de CompliaScan y SEO (el `canonical` apuntaba a la portada en todas las rutas). |
| `src/styles.css` | Estilo global de `.skip-link`. | Lo usan login y validar-documento. |
| `public/sitemap.xml` y `robots.txt` | Namespace corregido (`sitemaps.org`), se agrega `/validar-documento`; `robots` bloquea `/dashboard/`. | Errores de formato y no indexar áreas con sesión. |
| `frontend/vercel.json` | **Nuevo**, con las cabeceras de seguridad. CSP en modo **solo reporte**, `frame-src` para el mapa de Google, `camera=(self)` para el escáner de QR, sin `X-XSS-Protection` (obsoleta). | El archivo de la raíz no se está aplicando (ver sección 4). El original bloqueaba la cámara del escáner QR y el mapa. |
| `dashboard-admin.spec.ts`, `rbac-frontend.spec.ts`, `admin-reportes.spec.ts` | Los specs **no compilaban**. Se quitan 6 tests de una función que ya no existe (sobrecupo manual desde botón), se arregla la creación del componente de reportes (usa `inject()`) y se fija la fecha de un test que solo pasaba en septiembre de 2026. | Tests rotos o dependientes de la fecha. Desde ahora `ng test` pasa completo. |

## 3. Qué se elimina y por qué

### 3.1 Ya eliminado (sin riesgo, aplicar con el paquete)

| Archivo | Por qué |
|---|---|
| `frontend/src/assets/` (4 imágenes) | Angular solo publica `frontend/public/` (ver `angular.json`). Ninguna imagen de `src/assets` se referenciaba. |
| `A4_1_entrega_v3.md` y `CAMBIOS_PR.md` | Notas de parches ya aplicados. El historial de git conserva el detalle. |

### 3.2 Propuesto: necesita el visto bueno del equipo antes de borrar

No se eliminó nada de esta lista todavía. Si nadie se opone, se borra en un PR aparte.

| Qué | Por qué se propone | Antes de borrar |
|---|---|---|
| Componentes compartidos sin uso: `shared/empty-state`, `status-badge`, `card`, `tabs`, `input`, `button`, `modal`, `search-input` | Ningún template ni archivo los importa. | Confirmar que nadie los esté preparando para una pantalla nueva. |
| Mapas de estado sin uso: `shared/status/*.map.ts` (5 archivos) | Ningún archivo los importa. | Misma confirmación. |
| Dump SQL histórico | Retirado; el esquema completo se crea desde los modelos mediante `python -m app.init_db`. | Resuelto en la limpieza integral; ver [historial técnico](#historial-tecnico). |
| Rama de contraseñas en texto plano (`security.py`) | Es un riesgo: acepta contraseñas sin hash. | **Primero** ejecutar `migrar_passwords_texto_plano.py --aplicar` en la base real, con respaldo. |
| Endpoints legacy de jornada y colación | Se mantenían por solicitudes antiguas. | Confirmar que no queden solicitudes pendientes con ese formato. |
| Una de las dos librerías de iconos (Lucide en 15 archivos, Material Symbols en 41) | El README dice no agregar librerías de iconos y hoy hay dos. | Decidir cuál queda (lo más barato: quedarse con Material Symbols). |
| `.vscode/mcp.json` | Configuración de una herramienta de desarrollo. | Solo si nadie la usa. **`.vsls.json` NO se toca** (protege el `.env` al compartir sesión de Live Share). |
| `temporal.jpg` (3 copias idénticas) | Es un marcador provisional: se usa en 4 pantallas y 2 PDFs. | Reemplazarlo por el logo definitivo, no borrarlo. |

## 4. Qué falta antes de salir a producción

Marcar al terminar y poner responsable.

### Crítico (antes de cualquier usuario real)

- [ ] **Cabeceras de seguridad.** El `vercel.json` de la raíz usa `services`; el nuevo está en `frontend/`. Tras desplegar, comprobar con PageSpeed (sección *Recomendaciones*) o securityheaders.com que aparezcan CSP, COOP y protección contra clickjacking. Si aparecen, borrar el duplicado de la raíz.
- [ ] **Pasar la CSP de "solo reporte" a "obligatoria".** Abrir cada pantalla con F12 → Consola y corregir lo que se reporte (Angular puede necesitar ajustes por scripts en línea). Después cambiar `Content-Security-Policy-Report-Only` por `Content-Security-Policy`.
- [ ] **Definir `JWT_SECRET_KEY` y `SESAES_ENV=production`** en Render. El backend ya no arranca sin la clave.
- [ ] **Migrar contraseñas** (script de la sección 2) y luego quitar la rama de texto plano.
- [x] **Recuperar contraseña.** Integrado desde main: token de un solo uso con vencimiento, SMTP y rutas /recuperar y /restablecer. Pendiente probar correo institucional. Ver 9.11.
- [x] **Zona horaria.** Reglas de negocio centralizadas en America/Santiago para Windows y POSIX; se conserva la compatibilidad de zona de proceso del compañero. Ver 9.7 y 9.11.
- [ ] **Respaldos automáticos de la base y prueba de restauración.**
- [x] **Límite de login por cuenta.** Cinco fallos bloquean quince minutos, además del límite por IP. Pendiente configurar y validar proxy confiable en despliegue.

### Importante (primer mes)

- [x] **Migraciones versionadas (Alembic)**: revisión base `253cae9c234a`; `init_db` delega en upgrade head. Ver [cierre Alembic](#cierre-alembic) y [guía de migraciones](#guia-migraciones).
- [ ] **Logging y monitoreo de errores** (hoy el backend tiene 0 llamadas a logging) y un monitor que consulte `/health`.
- [x] **CI en GitHub Actions.** Workflows del compañero conservados: pytest, tests/build Angular, pip-audit, npm audit y CodeQL. Pendiente verificar ejecución remota. Dependabot continúa retirado por decisión del equipo.
- [ ] **Correo transaccional con dominio propio** (SPF/DKIM) en vez de una cuenta Gmail con contraseña de aplicación.
- [ ] **Ambiente de pruebas separado** de producción, con datos ficticios.
- [ ] **Auditoría de lecturas de ficha clínica** (revisar que quede registro de quién la consulta).
- [ ] **Política de privacidad, aviso de tratamiento y retención de datos.** Los datos de salud son datos sensibles: revisar con UTEM o un abogado qué exigen la Ley 20.584 y la Ley 21.719 (confirmar su fecha de entrada en vigor, que estaba en discusión).
- [ ] `xlsx` se instala desde `cdn.sheetjs.com`: si ese sitio cae, el build también. Vendorizar el paquete o cambiar de librería.
- [ ] Reemplazar los 4 `except Exception` genéricos del backend y revisar paginación en listados que van a crecer.

### Después

- [ ] **Dashboards accesibles:** hay unos 52 `div`/`span` con `(click)` que no funcionan con teclado; convertirlos en `<button>`/`<a>` (sección 6).
- [ ] 2FA opcional para profesionales y administradores.
- [ ] Pruebas de extremo a extremo (Playwright) de los flujos críticos: agendar, cancelar, sobrecupo, receta/justificativo.
- [ ] Dividir los archivos más grandes: `dashboard-admin.ts` (3365 líneas), `admin.py` (2897), `agenda_disponibilidad_service.py` (2425).
- [ ] Declaración de accesibilidad y prueba manual con lector de pantalla (NVDA).

## 5. Cómo aplicar y comprobar

1. Trabajar en una **rama**, no directo en `main`, y abrir un PR para que el resto lo revise.
2. Descomprimir el paquete **sobre la raíz del repositorio** (respeta las rutas) y borrar lo marcado en 3.1:

   ```bash
   git rm -r frontend/src/assets A4_1_entrega_v3.md CAMBIOS_PR.md
   ```
3. Backend (desde `backend/`):

   ```bash
   pip install -r requirements.txt
   # en backend/.env: definir JWT_SECRET_KEY (ver .env.example)
   python -m pytest -q
   ```
4. Frontend (desde `frontend/`):

   ```bash
   npm ci
   npx ng test --watch=false
   npx ng build
   ```
5. Variables nuevas en **Render**: `JWT_SECRET_KEY` (obligatoria) y `SESAES_ENV=production`.

**Cambios que afectan a todos:** el backend ya no arranca sin `JWT_SECRET_KEY` en su `.env`. Genérenla con
`python -c "import secrets; print(secrets.token_hex(32))"`.

## 6. Cómo validar el frontend de los dashboards

PageSpeed y CompliaScan solo analizan páginas públicas. Los dashboards están
detrás del login, así que se validan **desde el navegador, con sesión iniciada**:

| Herramienta | Para qué | Costo |
|---|---|---|
| **WAVE** (extensión de WebAIM, `wave.webaim.org`) | Principal recomendada. Marca errores de accesibilidad directamente sobre la pantalla, funciona con la sesión abierta. | Gratis |
| **axe DevTools** (extensión de Deque) | Segunda opinión con otro motor; da pasos de corrección. | Gratis (versión básica) |
| **Lighthouse** (pestaña *Lighthouse* de Chrome, F12) | Rendimiento, accesibilidad y buenas prácticas de la pantalla actual, con sesión. | Gratis, ya viene en Chrome |
| **Navegación solo con teclado** (Tab, Shift+Tab, Enter, Esc) | Lo que más fallan los dashboards (los `div` con clic). Ninguna herramienta lo reemplaza. | — |
| **NVDA** (lector de pantalla, Windows) | Comprobar que los botones, modales y mensajes se anuncian bien. | Gratis |
| **Playwright + `@axe-core/playwright`** | Automatizar el análisis iniciando sesión por código; puede correr en el CI. | Gratis |

**Procedimiento por pantalla** (estudiante, profesional, administrador, superadmin):

1. Iniciar sesión con una **cuenta de demostración**.
2. Pasar WAVE y Lighthouse en la vista principal y en **cada pestaña y cada modal**.
3. Recorrer la pantalla solo con el teclado: todo debe poder activarse y el foco debe verse.
4. Anotar cada hallazgo (pantalla, elemento, severidad) en un issue de GitHub.
5. Repetir el análisis después de corregir.

> **Importante:** no usar datos reales de estudiantes ni de fichas clínicas al
> pasar estas herramientas, y no darle credenciales a servicios online de
> terceros. Para los dashboards usar siempre cuentas y datos ficticios.

## 7. Qué no se pudo verificar

- El build de producción no pudo comprobarse en la revisión inicial. **Resuelto posteriormente:** compila; ver la sección 9 para la verificación actual y sus advertencias CSS.
- Si las cabeceras de `frontend/vercel.json` quedan activas en Vercel: depende de la configuración del proyecto y hay que comprobarlo tras desplegar.
- El comportamiento en Render (proxy, plan gratuito que se duerme) y la base real.
- Los dashboards en uso real: no se midieron con PageSpeed ni CompliaScan.
- Esta revisión es de código y no reemplaza una prueba de penetración.

## 8. Firma del profesional en recetas y justificativos — antecedente histórico

> La emisión actual sigue 9.8: sin firma gráfica, con identificación del profesional,
> folio, barras y QR. Se conserva el aporte original y la compatibilidad de
> documentos históricos; no se reactiva firma en PDFs nuevos.

El profesional puede registrar su **firma manuscrita digitalizada** (dibujarla, escribirla con letra manuscrita o subir una imagen) en **Mi perfil → Mi firma**. También se ve, en versión corta, dentro de "Completar atención". La imagen se copia dentro de cada receta y justificativo que emite, queda cubierta por la huella SHA-256 y se dibuja en el PDF sobre la línea de firma.

| Qué | Detalle |
|---|---|
| Qué es | Una **imagen** de la firma. El documento se rotula como **"documento electrónico verificable"** (folio + QR). **No es una firma electrónica avanzada** con certificado digital. Antes el PDF decía "Firmado electrónicamente", lo que podía inducir a error. |
| Cambios de firma | Si el profesional cambia o elimina su firma, los documentos **ya emitidos no cambian**. |
| Sin firma registrada | Los documentos salen igual, sin imagen. Hacerla **obligatoria** es un cambio pequeño, pero es una decisión del equipo y de la unidad de salud. |
| Quién puede | Solo el propio profesional (permiso + ownership). La imagen nunca se escribe en la auditoría ni la devuelve la validación pública. |
| Base de datos | Tabla `firma_profesional` incluida en la revisión base Alembic. El arranque aplica el historial mediante init_db; no requiere un parche manual. |

**Corrección incluida:** si una receta tenía más medicamentos de los que caben en la hoja, el PDF **omitía los sobrantes en silencio** (con 10 medicamentos se veían 3). Ahora continúa en otra hoja y la firma y el QR quedan en la última.

**Pendiente de decisión (equipo + Minsal / UTEM):**

- [ ] Qué firma exige hoy cada documento. Si se requiere **firma electrónica avanzada**, hay que contratar un prestador acreditado que emita certificados; la imagen digitalizada no la reemplaza.
- [ ] Si la firma será obligatoria para poder emitir.
- [ ] Vigencia de la receta y medicamentos controlados (hoy el PDF no muestra vigencia).

**Sin probar:** el dibujo en el lienzo, la escritura y la subida de imagen necesitan un navegador real (las pruebas automáticas no tienen lienzo). Probar en computador y en celular.


## 9. Cabeceras unificadas y documentación centralizada — 18-11-2026

### Qué se hizo, por qué y cómo

| Trabajo realizado | Motivo | Implementación |
|---|---|---|
| Saludo del profesional en la barra superior | Inicio ocultaba el h1 y repetía un saludo debajo de la barra; difería de admin/superadmin | La topbar muestra el nombre y la descripción en Inicio; las otras secciones conservan su título |
| Saludo del alumno en la barra superior | Mismo problema de jerarquía visual | El h1 de la topbar muestra nombre e icono, junto al subtítulo; se quitó el encabezado duplicado del contenido |
| Limpieza de estilos de los saludos antiguos | Evitar selectores huérfanos | Se retiraron las reglas que solo usaban los encabezados eliminados y se permitió ajustar nombres largos |
| Conservación del contenido útil | Mover el saludo no debe eliminar información de Inicio | Se mantienen la fecha del profesional, el mensaje de bienestar del alumno, indicadores y accesos |
| Actualización de pruebas existentes | Los tests anteriores exigían ocultar el título de Inicio | Se comprueba saludo visible en la topbar, ausencia del encabezado duplicado y conservación de títulos al navegar |
| Integración de seis Markdown de docs/ | Una sola fuente de documentación solicitada por el responsable | Se trasladaron sus contenidos a la sección 10, con anclas por documento y sección, y se actualizaron enlaces antes de retirar los originales |
| Corrección de instrucciones antiguas del seed | La guía todavía mencionaba 30 bloques después de Fase 5B | La guía consolidada documenta 90 bloques, colación explícita y duración demo de 60 minutos |

**Validación actual:** 974 pruebas Angular aprobadas (53 archivos) y build de producción correcto.
Persisten las advertencias anteriores de presupuesto CSS: profesional 60,10 kB y admin 69,62 kB
frente a advertencia de 50 kB. No se modificaron presupuestos para ocultarlas.
La suite backend no se repitió en esta ronda: no se cambió código backend; su último
resultado registrado es 1.557 aprobadas, 13 omitidas y 20 subtests aprobados (Fase 5B).

**Verificación visual realizada:** login con cuentas demo de profesional y alumno;
saludo único como h1 dentro de la barra superior en ambos paneles. Se revisaron
escritorio y pantalla estrecha (375 px de ancho efectivo), con nombres ajustados
sin desbordamiento horizontal. Se restauró el tamaño del navegador al terminar.
Evidencias: [profesional](docs/evidencias/saludo-profesional.png) y
[alumno](docs/evidencias/saludo-estudiante.png).

**Archivos modificados:** plantillas y CSS de dashboard-profesional y dashboard-estudiante;
dashboard-estudiante.spec.ts, dashboard-profesional-inicio.spec.ts y
dashboard-profesional-inicio-ajustes.spec.ts; este plan; README.md; backend/alembic/README.md.
Las imágenes de verificación se conservan en docs/evidencias/ y se enlazan aquí.
Admin y superadmin no requieren cambios de interfaz.

Inventario de código de esta ronda:

- frontend/src/app/dashboard-profesional/dashboard-profesional.html
- frontend/src/app/dashboard-profesional/dashboard-profesional.css
- frontend/src/app/dashboard-estudiante/dashboard-estudiante.html
- frontend/src/app/dashboard-estudiante/dashboard-estudiante.css
- frontend/src/app/dashboard-estudiante/dashboard-estudiante.spec.ts
- frontend/src/app/dashboard-profesional/dashboard-profesional-inicio.spec.ts
- frontend/src/app/dashboard-profesional/dashboard-profesional-inicio-ajustes.spec.ts

Nuevas evidencias: docs/evidencias/saludo-profesional.png y
docs/evidencias/saludo-estudiante.png. Las capturas contienen solo cuentas demo.

**Archivos retirados después de consolidar su contenido:** docs/INSTALACION.md,
docs/MIGRACIONES.md, docs/CIERRE_ALEMBIC.md, docs/CIERRE_ENTREGA.md,
docs/CHANGELOG_TECNICO.md y docs/DATOS_SENSIBLES.md.
No se eliminan las imágenes de evidencia ni los README de los módulos.

### Qué queda por hacer

- [x] Unificar el saludo de Inicio en la barra superior de los cuatro roles.
- [x] Conservar los títulos de las otras secciones y las pruebas existentes.
- [x] Centralizar las guías, cierres e historial de docs/ en este plan.
- [ ] Resolver las advertencias de tamaño CSS sin ampliar el presupuesto para ocultarlas.
- [ ] Completar los pendientes de producción de la sección 4 y las condiciones de datos sensibles.
- [ ] Acordar con la institución una fuente oficial de matrícula vigente antes de diseñar carga masiva o SSO: hoy no hay integración académica ni verificación de alumno regular.
- [ ] Mantener este plan actualizado tras cada fase: las cifras históricas identifican la ronda en que se midieron y no sustituyen una nueva ejecución.

### 9.1. Retirada completa de Ayuda del profesional — 18-11-2026

| Qué se hizo | Por qué | Cómo se hizo |
|---|---|---|
| Se retiró el apartado Ayuda del profesional | El responsable indicó que no aporta al flujo profesional | Se quitó el botón del menú, el bloque del template y la entrada del mapa de títulos |
| Se eliminó su código exclusivo | Ocultarlo dejaría código muerto | Se retiraron el import y el registro standalone; se eliminaron componente, HTML, CSS, spec y su carpeta vacía |
| Se verificó el resto del panel | Mantener Inicio, Agenda, Pacientes, Historial, Solicitudes y Configuración | Búsqueda de referencias sin coincidencias en el módulo profesional, suite Angular y build; login real con cuenta demo para comprobar el menú |

**Modificados:** frontend/src/app/dashboard-profesional/dashboard-profesional.ts,
frontend/src/app/dashboard-profesional/dashboard-profesional.html y este plan.

**Eliminados:** frontend/src/app/dashboard-profesional/ayuda/professional-ayuda.ts,
professional-ayuda.html, professional-ayuda.css y professional-ayuda.spec.ts
(los tres últimos en la misma carpeta). No existe ya la carpeta ayuda de este módulo.

**Validación de esta ronda:** 968 pruebas Angular aprobadas en 52 archivos y build
de producción correcto. Antes eran 974 en 53 archivos: la diferencia corresponde
exclusivamente a las seis pruebas del componente retirado junto con la funcionalidad;
no se quitaron pruebas de funcionalidades conservadas para resolver errores.
Persisten las advertencias CSS previas de profesional y admin. No se cambió backend,
RBAC, base de datos ni el apartado de Ayuda de otros roles.

- [x] Retirar la opción, el contenido y todas las referencias ejecutables de Ayuda del profesional.
- [x] Eliminar el componente y sus estilos/estado/pruebas exclusivos.
- [x] Comprobar login y ausencia del apartado en el menú profesional.

Evidencia: [panel profesional sin Ayuda](docs/evidencias/profesional-sin-ayuda.png).
El historial documental conserva esta decisión; no es una referencia de código activa.

### 9.2. Correcciones de Citas, Gestión profesional y Agenda — 18-11-2026

| Qué se hizo | Por qué | Cómo se hizo |
|---|---|---|
| Un solo selector de Estado en Citas, con Solo urgentes | El selector y las pestañas repetían el mismo filtro | Se retiraron las pestañas y el chip separado; Solo urgentes filtra por prioridad y, al cambiar a otro estado, se limpia esa prioridad para no dejar filtros ocultos. Se mantienen Todos, Pendiente, Completada, Cancelada e Inasistencia |
| Un solo acceso rápido a Agenda | Agendar cita y Ver agenda emitían navegación al mismo destino | Se conserva Ver agenda, también para cuentas con permiso de lectura; se retiran el botón duplicado, su output y handler, los contadores de pestañas y estilos exclusivos sin uso |
| Correo institucional y RUT editables en Gestionar Profesional | Solo podían completarse durante el alta | Se añaden campos editables y Guardar correo y RUT; el shell utiliza el PATCH existente con profesionales.gestionar y el backend mantiene el control de alcance |
| Datos de contacto sincronizados y validados | Cambiar solo la ficha dejaba el login con el correo antiguo | Se normaliza el correo a minúsculas, se exige @utem.cl, se validan RUT y duplicados, y se actualizan ficha y Usuario vinculado en la misma transacción con auditoría. Un correo ya ocupado devuelve 409; un RUT inválido no cambia datos |
| Correo visible en profesionales de datos antiguos/demo | Algunos registros solo tenían correo en Usuario | El listado completa el correo desde la cuenta vinculada con una consulta agrupada, sin consultar una cuenta por cada fila |
| Especialidad sincronizada al seleccionar profesional | Solo funcionaba la selección en sentido especialidad → profesional | Al cargar la agenda se identifica el profesional y se actualiza la etiqueta normalizada de su especialidad, conservando su ID |
| Agenda laborable también en Mes y Día | Semana ya ocultaba sábados y domingos, pero las otras vistas seguían incluyéndolos | Mes muestra cinco columnas y celdas laborables; Día excluye fines de semana, avanza/retrocede por días hábiles y, si Hoy cae en fin de semana, abre el siguiente lunes. El rango de lectura interno y los bloqueos de backend se conservan |
| Botón Solicitar sobrecupo conectado al shell | El componente ya tenía botón/output, pero el padre no pasaba el permiso ni escuchaba el evento | Se conecta agenda.sobrecupo y la apertura del formulario existente en modo sobrecupo. Se exige además agenda.gestionar; sin permiso aparece deshabilitado con explicación. No se eluden bloqueos de horario aprobado ni validación backend |

**Permisos de sobrecupo del admin:** ser ADMIN no equivale a tener agenda.sobrecupo.
Situación al cierre de 9.2 (actualizada posteriormente en 9.3): el admin demo conservaba sus permisos; se comprobó
que le falta ese permiso. Para habilitarlo, el SUPERADMIN debe ir a
Administradores, gestionar el acceso de esa cuenta y asignar agenda.sobrecupo,
manteniendo agenda.gestionar y el alcance correspondiente. La misma condición
habilita el botón a cualquier admin autorizado; no se restringe por nombre de rol.
No se otorgaron permisos automáticamente ni se modificaron los valores RBAC.

**Cambio de correo:** el nuevo correo institucional pasa a ser también el correo
de inicio de sesión del profesional. La contraseña no se cambia. El RUT sigue
siendo opcional y puede limpiarse; si se informa debe superar la validación vigente.
No se añadieron tablas, columnas ni migraciones.

**Verificación:** 1.562 pruebas backend aprobadas, 12 omitidas y 20 subtests aprobados;
973 pruebas Angular aprobadas en 52 archivos; build de producción correcto.
Se añadieron cuatro pruebas backend y cinco frontend, sin eliminar casos existentes.
El total backend difiere del registro del 15-11 porque además se ejecuta un caso
que se omite en fin de semana. Las pruebas de navegación que antes esperaban
sábados/domingos ahora verifican la nueva navegación hábil, conservando permisos
y comprobaciones de consultas. Persisten únicamente las advertencias CSS previas.
Una repetición con build y tests simultáneos agotó memoria de Node; se repitió
la suite sin esa compilación paralela y terminó con las 973 pruebas aprobadas.
No se cambiaron dependencias ni configuración para ocultar el fallo.

**Prueba visual realizada con datos demo:** admin normal → Citas → selector Solo
urgentes y un único acceso a Agenda; selección de Roberto → especialidad Psicología;
vista Mes con Lun–Vie; Gestión con correo y RUT editables. Con SUPERADMIN se
comprobó apertura de Nueva Cita — SOBRECUPO y motivo obligatorio. Se cerraron los
formularios sin guardar cambios de contacto, crear citas ni modificar permisos.
La API local se reinició para cargar las correcciones del backend.

**Archivos de producción modificados:**

- frontend/src/app/dashboard-admin/citas/admin-citas.ts, admin-citas.html y admin-citas.css.
- frontend/src/app/dashboard-admin/dashboard-admin.ts y dashboard-admin.html.
- frontend/src/app/dashboard-admin/profesionales/admin-profesionales.ts y admin-profesionales.html.
- frontend/src/app/dashboard-admin/horario/admin-horario.ts y admin-horario.html.
- backend/app/schemas.py y backend/app/routers/admin.py.

**Pruebas actualizadas/ampliadas:** admin-citas.spec.ts, dashboard-admin.spec.ts,
admin-profesionales.spec.ts, admin-horario.spec.ts y
backend/tests/test_sa9_actualizar_profesional_alcance.py. Los specs frontend están
junto a sus respectivos componentes. También se actualiza este plan.

**Evidencias:** [filtro único](docs/evidencias/admin-citas-filtro-unico.png),
[agenda laborable](docs/evidencias/admin-agenda-laborable.png),
[contacto editable](docs/evidencias/admin-contacto-editable.png) y
[botón de sobrecupo](docs/evidencias/admin-boton-sobrecupo.png).

- [x] Quitar filtros y navegación duplicados de Citas.
- [x] Permitir edición validada y auditada de correo/RUT.
- [x] Sincronizar profesional y especialidad y ocultar fines de semana en Agenda.
- [x] Conectar el botón de sobrecupo respetando los permisos efectivos.
- [ ] La institución debe decidir a qué administradores delega agenda.sobrecupo;
  esa asignación se realiza por SUPERADMIN, no cambiando la lógica de autorización.

### 9.3. Agendamiento directo y sobrecupo excepcional — 18-11-2026

**Decisión acordada:** el administrador autorizado agenda directamente, sin enviar
una solicitud de aprobación. Una reserva libre es normal; un sobrecupo agrega una
cita excepcional y conserva la fecha, hora y estado de la cita original.
No se desplazan automáticamente las reservas siguientes.

| Qué se hizo | Por qué | Cómo se hizo |
|---|---|---|
| Renombrar el botón a Agendar sobrecupo | Solicitar daba a entender que existía una aprobación posterior | Se reutiliza el formulario y POST /citas existentes; el botón de confirmación indica Agendar sobrecupo |
| Clasificar al editar fecha/hora | La hora escrita podía quedar marcada según el modo inicial del formulario | Se consulta la disponibilidad ya recibida del servidor: una hora libre limpia el motivo y pasa a normal; una ocupada habilitada activa sobrecupo solo con ambos permisos. Backend vuelve a evaluar bajo el lock existente |
| Quitar la excepción de sobrecupo en horas libres | El campo legado sobrecupo_forzado permitía registrar sobrecupos sin conflicto | Se conserva el campo por compatibilidad, pero ya no altera la clasificación. Se retiran la rama y el código de decisión exclusivos de esa excepción |
| Explicar la operación antes de confirmar | Dos reservas coincidentes no significan dos consultas simultáneas | El aviso indica coordinar previamente con el profesional, informar posible espera al alumno y conservar la reserva original. El motivo pide describir la coordinación |
| Informar el resultado real | Una hora ocupada puede liberarse entre abrir el formulario y guardar | POST /citas devuelve también sobrecupo y el mensaje de éxito usa ese resultado; una reserva que quedó libre se informa como normal |
| Habilitar al administrador demo | La cuenta tenía gestión de agenda, pero no el permiso excepcional | Desde el panel existente del superadmin se añadió únicamente agenda.sobrecupo a admin@utem.cl en sesaes_defensa_v2; conserva sus siete permisos previos, perfil y alcance. Se verificaron ocho permisos guardados |

**Flujo para practicar:**

1. Iniciar sesión como administrador y abrir Agenda. Elegir un profesional activo.
2. Elegir un horario futuro libre dentro de sus bloques aprobados: completar alumno
   y confirmar una cita normal.
3. Para una hora ocupada habilitada, entrar desde el bloque o desde Agendar sobrecupo;
   también se detecta al escribir una hora ocupada en Nueva cita.
4. Coordinar fuera del sistema con el profesional que puede recibir la atención
   adicional. Si no hay capacidad real, buscar otro horario.
5. Informar al estudiante que puede tener espera; escribir el motivo y la
   coordinación en el campo obligatorio. Confirmar Agendar sobrecupo.
6. La nueva cita queda creada, identificada como sobrecupo y auditada con el actor
   y motivo. No espera aprobación. El estado pendiente de la cita significa que
   falta realizar la atención; no es una solicitud pendiente de autorización.
7. La reserva original conserva su horario. Si hubiera que reprogramarla, debe
   acordarse expresamente con el paciente; este flujo no la mueve ni incorpora
   una reprogramación automática.
8. Si se cambia a una hora libre, el formulario vuelve a cita normal. Si otra
   persona ocupa el horario mientras se completa el formulario, el servidor
   vuelve a validar y puede rechazar la operación; no se fuerza el guardado.

**Reglas conservadas:** agenda.gestionar + agenda.sobrecupo, alcance administrativo,
motivo obligatorio para sobrecupo efectivo, auditoría y límite de dos citas activas
simultáneas por intervalo. El límite técnico no garantiza capacidad asistencial.
Los bloqueos absolutos (horario semanal aprobado, colación aprobada, cierres,
fechas pasadas y demás reglas existentes) siguen siendo obligatorios. Urgencia
y sobrecupo mantienen sus flujos separados. No se añadieron rutas, modelos,
migraciones, dependencias ni un circuito de aprobación.

**Validación realizada:**

- Backend: 1.566 pruebas aprobadas, 12 omitidas y 20 subtests aprobados.
  Se amplió la integración de hora libre para cubrir sobrecupo_forzado en ambos
  valores; tres casos de política comprueban que no crea sobrecupo en una hora
  libre, incluso variando los permisos. La integración de horario ocupado
  comprueba fecha, hora y estado intactos de la original, segunda cita creada,
  motivo, ausencia de revisión pendiente y auditoría del actor.
- Frontend: 976 pruebas aprobadas en 52 archivos. Tres pruebas nuevas cubren
  cambio a hora libre, detección de ocupación y ausencia de concesión implícita
  de permisos. Se actualizaron las expectativas de textos sin eliminar tests.
- Build de producción correcto; permanecen los dos avisos previos de tamaño CSS.
  El primer intento quedó bloqueado por permisos de lectura de esbuild; se
  repitió con acceso autorizado, sin cambiar código ni presupuestos.
- Verificación visual con admin demo: Agendar sobrecupo habilitado; Nueva cita
  del 19-11-2026 a las 09:00 del profesional de Nutrición cambia a sobrecupo,
  muestra aviso y motivo obligatorio. Al cambiar a las 10:00 libres vuelve a
  normal. Se cerró sin guardar: no se creó ni modificó ninguna cita demo.
- Se reinició la API local con el código actualizado y SEED_DEMO_DATA=false.
  No se recreó ninguna base y no se accedió a sesaes_old_backup.

**Archivos modificados:**

- backend/app/services/sobrecupo_policy_service.py.
- backend/app/schemas.py y backend/app/routers/citas.py.
- backend/tests/test_a4_3_politica_sobrecupo.py y test_a4_4_sobrecupo_slot_ocupado.py.
- frontend/src/app/dashboard-admin/dashboard-admin.ts, dashboard-admin.html y dashboard-admin.spec.ts.
- frontend/src/app/dashboard-admin/horario/admin-horario.html y admin-horario.spec.ts.
- PLAN_DE_MEJORAS.md.

**Evidencias nuevas:** [formulario de sobrecupo directo](docs/evidencias/admin-sobrecupo-directo.png)
y [permiso asignado al admin demo](docs/evidencias/admin-permiso-sobrecupo-directo.png).

- [x] Agendamiento directo con distinción entre normal y sobrecupo.
- [x] Preservar la cita original y las comprobaciones de seguridad y auditoría.
- [x] Habilitar el permiso específico en la cuenta admin demo y verificarlo.
- [x] Documentar coordinación, espera y límite de capacidad.
- [ ] Para uso institucional, definir qué administradores reciben ese permiso y
  acordar con los profesionales el protocolo operativo de atención adicional.
  La coordinación se realiza fuera del sistema; no hay integración ni evidencia
  automática de que la conversación ocurrió.

### 9.4. Consultar todas las citas desde el encabezado del día — 18-11-2026

| Qué se hizo | Por qué | Cómo se hizo |
|---|---|---|
| Encabezado del día seleccionable en Semana y Día | Consultar la jornada obligaba a pulsar un bloque horario | El encabezado es un botón que emite diaSeleccionadoChange; el binding existente del padre actualiza el panel derecho con todas las citas cargadas de esa fecha, incluidas distintas horas y sobrecupos |
| Identificar el día seleccionado | Facilitar la lectura del panel contextual | Se resalta su encabezado; aria-pressed indica selección y el botón permite activación mediante teclado. Se conserva la identificación de hoy y feriados |
| Mantener la consulta separada del agendamiento | Pulsar el día solo debe mostrar información | No se emite bloqueClick, no se abre Nueva cita y no se exige permiso de gestión para consultar datos ya autorizados. Se reutilizan filtros, permisos y carga existentes |
| Actualizar la indicación del panel vacío | Hacer visible el nuevo acceso | Se indica que se puede pulsar el encabezado del día o un bloque |

**Uso:** Agenda → seleccionar profesional → pulsar, por ejemplo, JUE 19 en la
parte superior del calendario. El panel contextual muestra las citas de ese día
con hora, estudiante, estado y las etiquetas de sobrecupo/urgencia existentes.
Pulsar otro encabezado cambia el día consultado; la X del panel limpia la selección.
Las acciones sobre bloques conservan su comportamiento. Al compartir componente,
la selección también está disponible en la agenda del profesional.

**Verificación:** 977 pruebas frontend aprobadas en 52 archivos (976 anteriores
más una prueba nueva); build de producción correcto, con los avisos CSS previos.
La nueva prueba comprueba selección en modo lectura, ausencia de apertura de
reserva, estado accesible y un panel con dos citas coincidentes (una sobrecupo)
más otra a distinta hora. Se recuperó el archivo de pruebas tras un incidente de
codificación durante la edición, conservando sus 80 casos existentes y añadiendo
el nuevo. Un intento de ejecución agotó memoria de Node; la ejecución final
completa terminó correctamente. No se modificó backend, esquema ni base de datos.

**Comprobación visual:** admin demo → Agenda → Nut. Carlos Muñoz → encabezado
JUE 19. El panel mostró tres citas: dos a las 09:00 (una sobrecupo) y otra a las
10:00, sin abrir un modal de reserva ni guardar cambios. Se iniciaron los
servidores locales existentes para la revisión.
Evidencia: [resumen desde el encabezado](docs/evidencias/admin-citas-dia-encabezado.png).

**Archivos modificados:**

- frontend/src/app/dashboard-admin/horario/admin-horario.html.
- frontend/src/app/dashboard-admin/horario/admin-horario.css.
- frontend/src/app/dashboard-admin/horario/admin-horario.spec.ts.
- PLAN_DE_MEJORAS.md.

- [x] Seleccionar el día desde su encabezado sin abrir una reserva.
- [x] Reutilizar el panel con todas las citas de esa fecha y preservar los permisos.
- [x] Verificar pruebas y compilación de producción.

### 9.5. Alcance de identidad institucional y seguridad local — 19-11-2026

**Qué se acordó trabajar y por qué:** la institución ya dispone de una fuente de
alumnos; no se implementa carga masiva para reemplazarla. Se documenta cómo deberá
definirse su integración y se corrige la validación de cambio de contraseña de
las cuentas administrativas locales del prototipo.

**Base documental:** la propuesta original «Propuesta de plataforma Web
SESAES_2026.docx», sección 6, contempla APIs institucionales, SSO, estudiantes
desde SIGA y datos contractuales desde AMANDA. Su sección 4.2 plantea diseñar
mecanismos de integración y elaborar un prototipo funcional. Estas referencias
son requisitos de diseño; no demuestran que la universidad haya entregado APIs,
acceso a bases ni un proveedor de identidad.

| Elemento | Situación actual | Supuesto de integración pendiente de validación |
|---|---|---|
| Estudiantes | Login y contraseñas locales para demostrar el prototipo | Autenticación institucional mediante el SSO que la universidad indique |
| Matrícula | SESAES no consulta una fuente oficial ni acredita alumno regular | SIGA u otra fuente oficial confirmará período y matrícula vigente |
| Profesionales | Cuenta local y datos operativos propios de SESAES | AMANDA aportaría datos contractuales según la propuesta; no se asume que autentique usuarios |
| Admin y superadmin | Cuentas locales, permisos y alcance gestionados por SESAES | Se mantienen locales salvo acuerdo posterior para incorporar estos roles al SSO |

**Responsabilidades y conexión futura:**

1. La universidad debe confirmar el proveedor de identidad, los roles que cubre,
   el mecanismo de autenticación, sus identificadores y los accesos de prueba.
   SIGA y AMANDA son fuentes propuestas de información; no se presupone que
   sean proveedores de identidad ni que tengan una API disponible.
2. Debe definirse el acceso autorizado a la fuente académica: API, vista de
   consulta de solo lectura o intercambio oficial de archivos. No se conecta
   directamente una base desconocida ni se copian contraseñas institucionales.
3. El contrato de datos deberá precisar identificador estable del alumno,
   nombre, correo, carrera, período y estado de matrícula; RUT solo si resulta
   necesario para el vínculo acordado. Debe fijar frecuencia de actualización
   y qué hacer ante datos ausentes, errores o indisponibilidad.
4. El futuro ingreso institucional debería autenticar identidad, obtener el
   estado académico autorizado y aplicar la regla de matrícula vigente antes
   de habilitar las funciones estudiantiles. Autenticarse no demuestra matrícula.
   No debe vincularse una identidad únicamente por un correo editable.
5. Para usuarios con SSO, la universidad gestionará contraseña, recuperación y
   las medidas de autenticación de su proveedor. SESAES seguirá protegiendo
   sesión, permisos, acceso a datos clínicos, reglas de matrícula y auditoría.
6. Si un alumno deja de cumplir la condición académica, se deberá restringir
   su acceso según la política institucional, conservando el historial y la
   auditoría. Esa automatización no está implementada.
7. El alcance de la defensa debe distinguir lo implementado, lo diseñado y lo
   dependiente de accesos institucionales. Obtener validación escrita del encargado
   y del evaluador sobre qué integración debe demostrarse realmente.

**Corrección implementada en seguridad local:**

- Se reutiliza la política central existente en el cambio de contraseña de
  ADMIN y SUPERADMIN: mínimo ocho caracteres, mayúscula, minúscula, número,
  carácter especial y ausencia de espacios.
- Se valida que ambos valores sean texto no vacío y que la contraseña nueva no
  supere 72 bytes UTF-8, límite de bcrypt usado por la aplicación.
- Se conserva la verificación de la contraseña actual y la restricción a la
  propia cuenta autenticada; se rechaza reutilizar la contraseña actual.
- Los rechazos devuelven HTTP 400 sin cambiar el hash. La falta de rol autorizado
  sigue devolviendo 403. El guardado válido continúa utilizando bcrypt.
- No se cambian contraseñas de usuarios existentes, permisos ni datos demo.
  No hay rutas, tablas, migraciones o dependencias nuevas.

**Límites que siguen vigentes:** los estudiantes todavía se autentican localmente.
No existe SSO ni verificación real de matrícula. El primer acceso estudiantil
existente permite mantener la contraseña y el login no devuelve su bandera:
no debe presentarse como cambio obligatorio. Tampoco se añadió recuperación de
contraseña ni cambio obligatorio inicial para otros roles. Si se conservan
cuentas locales con contraseñas temporales en producción, ese flujo deberá
resolverse antes de habilitarlas. La corrección de esta sección no equivale a
una certificación de seguridad o aptitud para producción.

**Archivos modificados:** backend/app/routers/configuracion_centro.py,
backend/tests/test_delivery_account_password.py,
backend/tests/test_a2c_disponibilidad_duracion_completa.py y PLAN_DE_MEJORAS.md.

**Resultado final:** pytest completo: 1.594 pruebas aprobadas, 12 omitidas,
20 subtests aprobados y 171 advertencias existentes. No se modificó el frontend.

**Pruebas de seguridad:** se añadieron 28 casos sin eliminar los existentes.
Cubren ambos roles administrativos, contraseña débil, límite de bytes UTF-8,
tipos inválidos, contraseña actual incorrecta, reutilización, roles no autorizados
y persistencia real con bcrypt en una base SQLite aislada. El caso de éxito
comprueba que un usuario_id ajeno enviado en el cuerpo no cambia otra cuenta.

**Estabilidad de pruebas de agenda:** la primera ejecución completa detectó
tres casos preexistentes que escogían el siguiente día hábil y esperaban horarios
posteriores a las 16:30, incluso cuando ese día era viernes. Se precisó el dato
de entrada de esos tres casos para elegir lunes a jueves, conservando las
aserciones y la lógica productiva de disponibilidad. No se eliminó ningún test.


- [x] Documentar la separación entre identidad, matrícula y datos contractuales.
- [x] Corregir la validación backend del cambio de contraseña administrativo.
- [ ] Confirmar por escrito proveedor SSO, roles cubiertos y fuente de matrícula.
- [ ] Definir y validar contrato de integración y política ante indisponibilidad.
- [ ] Implementar y probar integración cuando se proporcionen interfaces y accesos.
- [ ] Resolver activación/recuperación de las cuentas locales que permanezcan en producción.

### 9.6. Contrato propuesto para integración institucional — 19-11-2026

**Estado:** diseño bajo supuestos para el prototipo; no es una especificación
oficial de SIGA, AMANDA o del proveedor SSO. No se ha implementado el adaptador,
la fuente simulada ni el login institucional. La indicación comunicada por el
encargado es suponer una base institucional existente; esto no confirma su
estructura, interfaces o autenticación.

**Qué se hizo:** se revisaron los puntos de integración del código y se definió
un contrato mínimo propio de SESAES, sus responsables, el flujo y criterios para
demostrarlo con datos ficticios. **Por qué:** preparar una conexión sustituible
sin inventar tablas, credenciales o endpoints institucionales. **Cómo:** separar
autenticación, consulta académica y almacenamiento clínico/operativo; conservar
el ID local y prever su vínculo explícito con la identidad externa.

#### Responsabilidad de cada fuente

| Información | Fuente propuesta | Qué mantiene SESAES |
|---|---|---|
| Identidad autenticada | Proveedor SSO por definir; no se presupone que sea SIGA | Vínculo de identidad, sesión propia y rol autorizado |
| Nombre, correo, carrera y matrícula | Fuente académica institucional, SIGA según la propuesta | Datos mínimos necesarios y procedencia/frescura de la consulta; no un registro académico maestro |
| Datos contractuales de profesionales | Fuente de recursos humanos, AMANDA según la propuesta | Vínculo del profesional; no nómina, remuneraciones ni contratos completos |
| Especialidad clínica, bloques aprobados y duración de cita | Gestión operativa de SESAES | Reglas de atención y disponibilidad locales |
| Citas, ficha clínica y documentos | SESAES | Persistencia, permisos y auditoría vigentes |
| Contraseñas de cuentas institucionales | Proveedor de identidad de la universidad | Ninguna copia de la contraseña institucional |
| Contraseñas de cuentas locales | SESAES mientras esos roles sigan locales | Hash bcrypt y controles locales; no exportar contraseñas |

**Interpretación de no replicador:** SESAES no modifica ni pretende sustituir el
registro académico o contractual. Necesita mantener relaciones locales para sus
citas y registros clínicos; almacenar datos mínimos de referencia no equivale a
importar todo SIGA o AMANDA. Qué atributos se conservan, por cuánto tiempo y cómo
se actualizan debe acordarse antes de producción. Los datos clínicos no deben
enviarse a la fuente académica o de recursos humanos mediante este contrato.

#### Contrato interno propuesto versión 1

El adaptador académico entregaría a SESAES un objeto normalizado como este.
Todos los valores son ficticios. Los nombres pertenecen a esta propuesta:
no afirman que existan campos equivalentes en una API real.

```json
{
  "version_contrato": "1",
  "fuente": "academica_simulada",
  "id_institucional": "EST-DEMO-0001",
  "nombre": "Estudiante de prueba",
  "correo": "estudiante.prueba@utem.cl",
  "carrera": "Carrera de ejemplo",
  "periodo": "2026-2",
  "matricula_vigente": true,
  "consultado_en": "2026-11-19T12:00:00Z"
}
```

| Campo | Tipo y condición | Regla propuesta |
|---|---|---|
| version_contrato | Texto obligatorio | Versión 1; rechazar versiones incompatibles |
| fuente | Texto obligatorio | Procedencia conocida configurada en servidor; la marca simulada solo para pruebas |
| id_institucional | Texto obligatorio y estable | Identificador externo, no el ID autoincremental de Usuario; único dentro de su fuente |
| nombre | Texto obligatorio no vacío | Nombre obtenido de la fuente autorizada |
| correo | Texto obligatorio | Normalizar y validar formato/dominio según la política institucional; no vincular automáticamente una cuenta solo por correo |
| carrera | Texto obligatorio no vacío | Dato de la fuente oficial, no catálogo inventado por SESAES |
| periodo | Texto obligatorio | Período al que se refiere la respuesta; comparar con el período vigente configurado en servidor |
| matricula_vigente | Booleano obligatorio | true habilita únicamente si el resto de controles es válido; false restringe acceso estudiantil; null o ausencia es error de contrato |
| consultado_en | Fecha/hora ISO 8601 con zona | Momento de consulta fiable fijado por el adaptador del servidor; no aceptar un reloj del navegador |

El RUT no forma parte del mínimo: solo se incorporaría si la institución lo
exige y define su uso. Una respuesta de matrícula no debe incluir contraseña,
ficha clínica ni permisos administrativos. El período vigente no lo elige el
alumno desde el frontend.

**Identidad SSO, contrato separado:** el proveedor deberá entregar una identidad
validada que pueda relacionarse de manera inequívoca con id_institucional.
Si se adopta OpenID Connect, el vínculo de identidad utilizaría emisor y sujeto
(issuer + subject), cuya validación debe implementar una biblioteca apropiada;
no basta con decodificar un token. El protocolo concreto está sin confirmar.
El navegador no puede declarar su rol, matrícula o ID como prueba de identidad.

**Profesionales y AMANDA:** contrato mínimo propuesto: fuente, id_funcionario,
nombre, correo, vinculo_activo y consultado_en. No se presupone que
vinculo_activo equivalga al estado operativo de la agenda. Una baja contractual
deberá tratarse según una política explícita, sin borrar citas, ficha ni
auditoría. Tener una fila en AMANDA tampoco crea por sí solo un permiso clínico
o administrativo en SESAES. Este contrato es independiente de cómo se autentique
el profesional.

#### Flujo previsto y comportamiento ante errores

1. Autenticar al estudiante con el proveedor institucional definido. En una
   demostración, una identidad ficticia deberá estar claramente identificada
   y aislada del modo de producción.
2. Resolver el identificador académico mediante el vínculo configurado; no
   aceptar un id_institucional arbitrario enviado por el cliente.
3. Consultar al adaptador académico y validar estructura, fuente, identificador,
   período vigente y frescura.
4. Si matrícula es válida, crear o resolver una referencia local mínima y emitir
   la sesión de SESAES con su ID local. El alta local sería aprovisionamiento
   automático desde identidad verificada, no una carga masiva administrativa.
5. Aplicar los permisos y las reglas operativas existentes. Un alumno no recibe
   privilegios administrativos por campos de la fuente externa.
6. Volver a comprobar la vigencia de forma controlada durante la sesión. Antes
   de implementar deben fijarse plazo máximo de caché y renovación; no asumir
   que consultar una sola vez habilita indefinidamente.
7. Fuente caída, timeout o respuesta incompleta: informar que no se pudo
   verificar la condición; no autorizar por defecto ni convertir el error en
   una baja permanente. Reintentar de forma acotada.
8. Matrícula false, período no vigente o vínculo inexistente: no habilitar
   funciones estudiantiles; no borrar historial. Distinguir este rechazo de
   un error técnico.
9. Identidad ambigua o correo ocupado por otra cuenta: detener el vínculo y
   requerir resolución administrativa auditada. No fusionar historiales
   automáticamente.
10. Registrar resultado, procedencia y fecha de la verificación con datos mínimos.
    Nunca registrar contraseñas, tokens o respuestas institucionales completas.

**Frescura y continuidad:** cualquier uso de un último resultado válido durante
una caída debe tener autorización institucional y vencimiento explícito. Hasta
definir esa política, el diseño no concede nuevos accesos sin verificación
válida. La continuidad de las funciones del profesional requiere su propia
política operativa y no se deduce de la regla de matrícula estudiantil.

#### Revisión de reutilización del código actual

| Punto revisado | Qué existe | Trabajo pendiente para integrar |
|---|---|---|
| backend/app/routers/auth.py | POST /login verifica contraseña local y emite JWT propio | Incorporar entrada institucional verificada sin usar la contraseña de la universidad en el login local |
| backend/app/auth_dependencies.py | Resuelve Usuario actual, activo y rol, y aplica propiedad de recursos | Incorporar la condición académica/frescura en la capa estudiantil sin alterar acceso clínico de otros roles |
| backend/app/models/usuario.py | Alumno representado por Usuario con rol estudiante; no hay un modelo separado de Estudiante en este proyecto | Persistir vínculo externo estable y procedencia; definir almacenamiento de matrícula/caché y autenticación local/institucional |
| backend/app/models/profesional.py | Relación usuario_id y datos operativos locales | Resolver vínculo contractual de forma independiente de agenda y especialidades |
| Citas, ficha, documentos, RBAC y auditoría | Relaciones y controles por ID local | Reutilizarlos conservando IDs e historiales; no cambiar claves de registros clínicos al sincronizar |

No existe hoy un campo id_institucional, un mapeo issuer/subject ni un adaptador
de matrícula. La futura implementación requerirá decidir la persistencia y
añadir la migración correspondiente si se agregan datos persistentes.
Por tanto, la conexión todavía no puede hacerse cambiando únicamente una URL.
Las cuentas demo actuales prueban los roles; no prueban integración institucional.

#### Plan de demostración con fuente simulada

**Pendiente de implementar:** un adaptador académico simulado con datos ficticios,
separado de una futura implementación real mediante una interfaz de consulta
por identificador y período. El formato de origen podría ser un archivo de
prueba o un servicio simulado; no se necesita una pantalla de importación masiva.
La misma batería de pruebas deberá poder aplicarse a ambos adaptadores.

| Caso de aceptación | Resultado esperado |
|---|---|
| Identidad válida y matrícula true en período vigente | Resolver/crear referencia local y permitir funciones estudiantiles |
| Repetir el mismo ingreso | Reutilizar el mismo Usuario; no duplicar historial |
| Mismo correo con identidad externa distinta | Rechazar vínculo ambiguo; no mezclar cuentas |
| Matrícula false o período anterior | Denegar funciones estudiantiles, conservando registros |
| Fuente inaccesible o campo faltante | Error controlado, sin autorizar ni desactivar permanentemente |
| Matrícula cambia de true a false | Restringir tras nueva verificación o vencimiento establecido; token anterior no habilita indefinidamente |
| Token institucional inválido o identidad no verificable | No crear sesión SESAES |
| Cliente altera matrícula o rol en la solicitud | Ignorar/rechazar la declaración del cliente; no elevar privilegios |
| Modo simulado en entorno de producción | Rechazar configuración; nunca habilitar simulación como fallback |
| Sustituir adaptador simulado por implementación de prueba real | Mantener contrato normalizado y resultados de aceptación |

#### Qué entregará la documentación final

Cuando el usuario confirme el cierre del proyecto, consolidar la documentación
sobre la implementación final: arquitectura y diagramas, contrato de datos y
mapeos, instalación limpia y configuración, manual por rol, flujos de agenda y
sobrecupo, seguridad, pruebas y evidencias, guía para sustituir la simulación,
limitaciones, respaldo/restauración y pendientes de producción. No incluir
credenciales ni datos reales; distinguir siempre implementado, simulado,
diseñado y pendiente. El presente diseño no se presentará como código terminado.

**Verificación de esta etapa:** revisión de modelos, login, dependencias de
autenticación y referencias a integración en el código. Solo se modifica este
Markdown; no se cambia lógica, base de datos o configuración. No corresponde
repetir pytest por este cambio documental. Las cifras de pruebas de 9.5
pertenecen a la ejecución allí registrada.

- [x] Auditar qué partes actuales pueden reutilizarse y qué vínculos faltan.
- [x] Definir contrato propuesto y reglas de autoridad de cada dato.
- [x] Definir escenarios para demostrar integración sin sistemas reales.
- [ ] Implementar y probar adaptador/fuente simulada y vínculo persistente.
- [ ] Definir modo de identidad de prueba seguro y sustituible por SSO real.
- [ ] Acordar parámetros de frescura, períodos y respuesta ante indisponibilidad.
- [ ] Obtener validación académica del alcance simulado y las limitaciones.
- [ ] Elaborar documentación final cuando el usuario confirme el cierre.

### 9.7. Zona horaria única del centro America/Santiago — 19-11-2026

**Problema encontrado:** PostgreSQL local ya utilizaba America/Santiago, pero la
agenda leía date.today()/datetime.now() del servidor, Angular dependía de la zona
del navegador y algunos cálculos usaban toISOString() para obtener el día. Los
documentos intentaban usar ZoneInfo y, al faltar los datos IANA en Windows,
continuaban silenciosamente sin convertir la hora.

**Decisión:** la zona de negocio de SESAES es America/Santiago, correspondiente
a Santiago/Chile central. Se utiliza la zona IANA y no un offset fijo UTC-3 o
UTC-4: los cambios estacionales los resuelven los datos de zona. El idioma es-CL
solo define presentación; por sí solo no fija una zona horaria.

| Qué se hizo | Por qué | Cómo se hizo |
|---|---|---|
| Hora explícita del centro en backend | Evitar que un despliegue en UTC cambie hoy o las horas pasadas | Módulo app/tiempo.py con ZONA_CENTRO; agenda obtiene un snapshot de datetime.now(ZONA_CENTRO) y reutiliza su fecha/hora. Se actualizan reportes, resúmenes, cierres, atenciones y reglas de citas |
| Separar horas civiles e instantes | Una cita 09:00 pertenece al horario del centro; el vencimiento de un token es un instante global | JWT y emisión/anulación de documentos conservan UTC. La resolución de solicitudes usa UTC con offset en lugar de utcnow() sin zona |
| Calcular cancelación por tiempo transcurrido | Un cambio de horario puede añadir o quitar una hora real | Se interpretan fecha/hora de la cita en Santiago y se comparan instantes en UTC antes de aplicar las cinco horas existentes |
| Fijar la zona de la sesión PostgreSQL | Los defaults de columnas antiguas sin zona dependían de la configuración del servidor | El engine PostgreSQL establece timezone=America/Santiago en cada conexión; SQLite conserva su configuración de pruebas |
| Hoy y calendarios iguales en todos los roles | El navegador podía estar en otro país o calcular el día UTC siguiente | Helpers compartidos fechaCentro y calendarioCentro; este último es un portador de componentes civiles para calendarios, no un instante para persistir |
| Formatear eventos con zona explícita | DatePipe y new Date sin offset dependían del equipo | Pipe fechaCentro con Intl/timeZone America/Santiago; timestamps con Z/offset se convierten como instantes y los legacy sin offset se interpretan como hora civil de Santiago |
| Evitar corrimiento de fechas sin hora | YYYY-MM-DD no debe convertirse a otro día por zona | Se conservan componentes de calendario; se retiran los toISOString usados para hoy, próxima cita y nombres de exportación |
| Impresión, reportes y avisos consistentes | Las fechas de generación también dependían del navegador | Intl con timeZone explícita y helpers compartidos, manteniendo formatos visibles existentes |
| Resolver zonas IANA en Windows | ZoneInfo no encontraba America/Santiago y se ocultaba el fallo | Se incorpora tzdata==2026.6 y se elimina el fallback silencioso de documentos |

**Dependencia nueva justificada:** tzdata es necesaria para ZoneInfo en Windows,
que normalmente no dispone de una base IANA del sistema. Se instaló y fijó la
versión probada en backend/requirements.txt. No se añade una librería de fechas
al frontend; utiliza Intl nativo. Para un entorno ya creado:

```powershell
cd backend
.\venv\Scripts\python.exe -m pip install -r requirements.txt
```

Después de actualizar un entorno en ejecución, reiniciar los procesos de backend
y frontend para cargar módulos y dependencias. La instalación limpia sigue
utilizando requirements.txt; no necesita configurar la zona del sistema operativo.
La zona del centro está definida en app/tiempo.py y shared/tiempo-centro.ts.
No se introduce una variable de entorno ficticia ni configurable en esta fase.

**Compatibilidad de datos y límites:**

- No se cambian fechas ni horas de citas existentes, bloques, duración, colación,
  plazos de cancelación, permisos o reglas de sobrecupo.
- Las columnas legacy timestamp without time zone se conservan: representan hora
  civil de Santiago y el código/defaults nuevos mantienen esa convención.
  No se afirma que todas esas columnas almacenen UTC.
- Las columnas con zona, los tokens y los instantes técnicos conservan su
  interpretación absoluta. PostgreSQL timestamptz conserva un instante aunque la
  sesión lo presente con offset chileno.
- El helper de documentos interpreta un timestamp sin offset recibido de sus
  campos UTC como UTC; los eventos legacy de las otras pantallas sin offset se
  interpretan como Santiago. Son contratos distintos de campos, no otra zona de
  negocio. No se deben intercambiar timestamps sin offset entre ambos contratos.
- Una conversión general de históricos a UTC requeriría verificar la zona de
  origen y una migración explícita. No se reinterpreta ni reescribe la base local
  o sesaes_old_backup para intentar resolver esa ambigüedad.
- Las fechas sin hora se mantienen como YYYY-MM-DD. No usar calendarioCentro()
  para enviar un timestamp o calcular expiraciones; para eso se utilizan instantes.
- Una hora civil inexistente durante un adelanto de reloj no se desplaza
  silenciosamente en el frontend. Las horas de atención diurnas siguen sujetas
  a las validaciones del backend.
- Mantener actualizados tzdata y los navegadores/runtimes cuando cambien las
  reglas oficiales. Fijar un offset manual no sustituye esa actualización.

**Verificación:**

- pytest completo: 1.600 aprobadas, 12 omitidas, 20 subtests aprobados y 167
  advertencias. Se añaden seis casos para invierno/verano, UTC, fecha chilena del
  día anterior, contrato UTC de documentos y horas transcurridas al cambiar DST.
- Suite Angular: 982 pruebas aprobadas en 53 archivos (977 existentes más cinco
  nuevas). Se mantienen las pruebas de disponibilidad, permisos y cancelación.
- Repetición de las cinco pruebas nuevas con TZ=Asia/Tokyo: cinco aprobadas.
  Se verifica que el día y la hora de Santiago no dependan de la zona del equipo.
- Tras limpiar imports y usar un solo snapshot en Inicio, se verifican además
  las pruebas de Inicio, PostgreSQL aislado y tiempo: 44 aprobadas y una omitida.
- Build de producción correcto. Solo permanecen los dos avisos anteriores de
  tamaño CSS; se retiran imports DatePipe que dejaron de usarse.
- alembic check: No new upgrade operations detected. No hay migración nueva.
- Consulta de solo lectura de la conexión local: timezone=America/Santiago;
  Python resuelve explícitamente esa zona sin fallback.

**Archivos nuevos:**

- backend/app/tiempo.py y backend/tests/test_tiempo_centro.py.
- frontend/src/app/shared/tiempo-centro.ts, fecha-centro.pipe.ts y tiempo-centro.spec.ts.

**Archivos modificados:**

- backend/requirements.txt y backend/app/database.py.
- backend/app/models/notificacion.py e historial_estado_profesional.py.
- backend/app/routers/admin.py, admin_inicio.py, citas.py, historial_clinico.py,
  horarios.py, profesionales.py y solicitudes_horario.py.
- backend/app/services/agenda_disponibilidad_service.py,
  documento_clinico_service.py y reportes_resumen_service.py.
- frontend/src/app/dashboard-admin/dashboard-admin.ts y dashboard-admin.html.
- Componentes admin de Configuración y Horario: sus .ts y .html.
- Componentes admin de Inicio, Historial y Reportes: sus .ts.
- frontend/src/app/dashboard-admin/citas/admin-citas.utils.ts.
- frontend/src/app/dashboard-admin/horario/agenda-impresion.ts.
- Inicio superadmin: superadmin-inicio.ts, superadmin-inicio-calendario.ts y
  superadmin-inicio.utils.ts.
- frontend/src/app/dashboard-estudiante/dashboard-estudiante.ts y
  citas-proximas/estudiante-citas-proximas.ts.
- frontend/src/app/dashboard-profesional/dashboard-profesional.ts y .html,
  completar-atencion/completar-atencion.ts, mi-firma/mi-firma.ts y .html.
- PLAN_DE_MEJORAS.md.

- [x] Unificar reloj de negocio en Santiago y conservar UTC para instantes técnicos.
- [x] Evitar dependencia del navegador/servidor para hoy y cancelaciones.
- [x] Probar cambios estacionales y navegador con otra zona.
- [x] Documentar dependencia tzdata y convención de timestamps históricos.
- [ ] En producción, mantener actualizados los datos IANA y documentar la zona de
  origen de cualquier dato histórico externo antes de convertirlo.

### 9.8. Cobertura de justificativos y vigencia de recetas — 19-11-2026

**Objetivo:** respetar el período indicado por el profesional y evitar que la
verificación de autenticidad se interprete como autorización ilimitada de uso.
Se conserva la identidad del emisor y se retira la firma gráfica del PDF,
utilizando el folio único como código de barras además del QR.

| Qué se hizo | Por qué | Cómo se hizo |
|---|---|---|
| Separar autenticidad y uso | El resultado vigente no decía si una ausencia concreta estaba cubierta o si una receta había vencido | La pantalla dice Documento registrado y no anulado y muestra por separado verificacion_uso |
| Consultar una fecha de ausencia | Presentar un justificativo después del reposo puede ser correcto, pero no extender el período | GET /documentos/validar/{codigo}?fecha=YYYY-MM-DD compara la fecha con reposo_desde/reposo_hasta, incluyendo ambos extremos |
| Justificativo sin reposo | No debe justificar días adicionales por defecto | Solo cubre la fecha de atención registrada |
| Fecha límite de receta elegida por el profesional | El período de tratamiento es texto clínico por medicamento y no determina por sí solo la vigencia para obtenerlo | RecetaIn exige valida_hasta; formulario, borrador, revisión y PDF conservan ese dato, protegido por la huella |
| Verificación de receta con reloj del centro | No permitir elegir una fecha pasada para aparentar vigencia | El servidor comprueba desde la fecha de emisión hasta valida_hasta inclusive contra hoy en America/Santiago; ignora fecha de consulta para recetas |
| Tratar documentos antiguos sin inventar datos | Las recetas anteriores no registraban vencimiento | Se informa sin_vigencia_definida y apto_para_uso=null; autenticidad no equivale a vigencia confirmada |
| PDF sin firma gráfica, con emisor identificado | Decisión comunicada por el encargado para esta entrega | No se adjunta firma a nuevas instantáneas ni se dibuja imagen/línea de firma; se conservan nombre, especialidad y RUN/RUT del profesional y los datos previos del documento |
| Barras y QR para el mismo documento | Evitar identificadores distintos para una sola emisión | FPDF dibuja Code 39 con el folio aleatorio existente y sus marcadores de inicio/fin. Continúan el folio escrito, QR y restricción UNIQUE en PostgreSQL |
| Mejorar legibilidad de recetas largas | Textos extensos se juntaban entre columnas | Se calcula la altura real, se envuelven valores y se continúa en otra hoja sin omitir medicamentos |

#### Cómo utilizarlo

**Profesional:**

1. Completar la atención con las capacidades clínicas existentes. Activar receta
   solo si la especialidad está autorizada.
2. Completar medicamentos, dosis, vía, frecuencia y período de cada tratamiento.
3. Elegir Fecha límite para usar la receta. No se propone automáticamente un
   plazo fijo ni se deduce a partir de los medicamentos; lo decide el profesional.
   La fecha debe ser hoy o posterior según Santiago.
4. Para justificativo, indicar si hay reposo y sus fechas desde/hasta. Los días
   son inclusivos; si se indica del 19 al 23 son cinco días.
5. Revisar el resumen y confirmar. El guardado mantiene su transacción: una
   fecha de receta pasada se rechaza antes de completar la cita o emitir documentos.
6. Descargar el PDF: mantiene los datos del emisor y del estudiante, información
   clínica correspondiente, fecha de emisión, folio, barras y QR, sin firma gráfica.
   Se retira el editor de firma de la pantalla Completar atención.

**Persona que verifica un justificativo:**

1. Escanear el QR o ingresar el folio en Validar documento.
2. Comprobar que el documento esté registrado y no anulado.
3. Leer el período y elegir Fecha de la ausencia que necesitas justificar.
4. Pulsar Comprobar fecha de ausencia. Para reposo 19–23, el día 23 queda cubierto
   y el 24 no. Una consulta realizada después del 23 puede confirmar una ausencia
   ocurrida el 20; la fecha de presentación no extiende ni elimina la cobertura.
5. La fecha consultada aparece en el resultado. Este resultado informa cobertura;
   no registra aceptación administrativa de una justificación ni verifica que
   el paciente haya cumplido el reposo.

**Persona que verifica una receta:**

1. Abrir el QR o consultar el folio.
2. Ver la autenticidad y, por separado, la vigencia de uso con la fecha actual de
   Santiago. El último día está incluido hasta el fin de ese día local.
3. Fuera del período se muestra el resultado de uso rechazado, aunque el documento
   siga siendo auténtico y no anulado.
4. La página no muestra medicamentos, dosis, diagnóstico ni RUT del estudiante.
   Solo añade los límites necesarios para verificar el período.

#### Contrato y compatibilidad

**Emisión nueva:** el objeto receta del PATCH existente para completar atención
debe incluir valida_hasta en formato YYYY-MM-DD, además de medicamentos. Falta
de fecha o formato inválido: 422 por esquema; fecha anterior al día de emisión:
400 antes de mutar la atención. Los clientes antiguos deben enviar el campo nuevo.
No se cambia el contrato clínico periodo de cada medicamento.

**Consulta pública:** el parámetro fecha es opcional y tipado como fecha.
Un valor imposible, por ejemplo 2026-02-30, devuelve 422. Sin fecha elegida, el
justificativo devuelve requiere_fecha, muestra su período y no declara una
ausencia concreta cubierta. No es necesario iniciar sesión para consultar;
se conserva el límite de 20 consultas por minuto.

**Resultado:** valido y estado conservan la semántica de autenticidad/anulación
para compatibilidad. No usar valido como autorización de dispensación.
verificacion_uso contiene estado, desde, hasta, fecha_consultada,
apto_para_uso (true/false/null) y mensaje. Para receta con vencimiento definido,
los estados son vigente, vencida o aun_no_vigente; para justificativo, cubierto,
fuera_de_periodo o requiere_fecha. Los documentos anulados o con huella alterada
no reciben una validación de uso positiva.

**Persistencia:** nuevas instantáneas de contenido versión 2 guardan la fecha de
receta en JSON, cubierta por la huella SHA-256. Se conservan folio único, capacidad
clínica, propiedad de la atención, auditoría y anulación. No hay columnas,
tablas o migraciones nuevas. La huella comprueba la instantánea guardada, no el
archivo PDF que un tercero pueda editar: el verificador debe contrastar los
datos y períodos mostrados por SESAES con el documento presentado.

**Históricos:** no se reescriben JSON, firmas antiguas o huellas existentes.
Los PDFs se generan al descargarlos, por lo que usan el nuevo formato sin imagen
de firma también para instantáneas antiguas. Una receta sin fecha límite conserva
su autenticidad comprobable, pero no se le inventa un vencimiento ni se presenta
como autorización indefinida. La gestión legacy de firmas sigue fuera del flujo
de emisión; sus modelos/endpoints y pruebas de permisos se conservan para
compatibilidad, sin incorporarlas al PDF nuevo.

**Códigos:** el folio sigue siendo aleatorio y único por documento; no se genera
otro código al descargar o escanear. El QR abre la página de validación; el código
de barras representa el mismo folio para un lector compatible o ingreso manual.
La cámara integrada de la página mantiene el lector QR existente; no se promete
compatibilidad universal de cámaras con Code 39. Las barras no son una firma
electrónica ni se presentan como tal.

#### Límite pendiente de farmacia

No existe registro ni integración de dispensación. Esta entrega controla fechas,
pero no puede saber si una farmacia entregó medicamento anteriormente ni impedir
retiros múltiples dentro de un período si nadie los registra. La consulta no
marca una receta como usada, no modifica stock y no autoriza repeticiones.
Cantidad, entregas parciales y repeticiones deberán definirse con la institución
e integrarse mediante personal autorizado y auditoría antes de afirmar ese control.
No se crea un módulo de farmacia ni un rol nuevo.

#### Verificación y archivos

**Resultado final:** pytest completo: 1.612 aprobadas, 12 omitidas, 20 subtests
aprobados y 163 advertencias. Angular: 988 aprobadas en 53 archivos. Build de
producción correcto con los dos avisos CSS previos. alembic check no detecta
operaciones nuevas. No se añadieron dependencias: las barras utilizan FPDF ya
instalado; la generación QR conserva segno.


Se añaden doce casos backend y seis frontend, conservando y actualizando los
existentes. Cubren extremos del reposo, ausencia de reposo, sexto día rechazado
por el endpoint real, fecha inválida, medianoche de Santiago, receta vencida,
fecha de visitante ignorada para receta, falta de fecha, rechazo antes de mutar,
vigencia incluida en la huella, documentos antiguos, barras y datos del emisor.
Las pruebas de firma pasan a comprobar PDFs sin imagen y compatibilidad de
instantáneas históricas; no se eliminan pruebas de propiedad, permisos o auditoría.

PDFs generados únicamente con datos ficticios en memoria, sin insertar nada en la
base local. Revisión visual de las cinco páginas: receta corta de una hoja,
justificativo de una hoja y receta larga de tres hojas. Se verifican texto,
identificación del profesional, fechas, barras, QR y ausencia de firma gráfica;
no se ha certificado lectura con un escáner físico.

**Producción modificada:**

- backend/app/schemas.py.
- backend/app/routers/documentos_clinicos.py.
- backend/app/services/documento_clinico_service.py.
- frontend/src/app/dashboard-profesional/completar-atencion/completar-atencion.ts y .html.
- frontend/src/app/validar-documento/validar-documento.ts, .html y .css.

**Pruebas modificadas:** backend/tests/test_documentos_clinicos.py,
test_firma_profesional.py y test_estudiante_tipo_cita_y_documentos.py;
frontend/src/app/dashboard-profesional/completar-atencion/completar-atencion.spec.ts
y frontend/src/app/validar-documento/validar-documento.spec.ts.

**Documentación y evidencias:** este PLAN_DE_MEJORAS.md y las imágenes
[receta sin firma](docs/evidencias/receta-vigencia-sin-firma.png),
[justificativo sin firma](docs/evidencias/justificativo-vigencia-sin-firma.png),
más docs/evidencias/receta_larga-1.png, receta_larga-2.png y receta_larga-3.png.
Los PDFs intermedios de revisión permanecen en la caché de pruebas, no son
documentos clínicos emitidos ni datos para entregar con una base.

- [x] Comprobar cobertura de fechas del justificativo.
- [x] Exigir fecha límite de uso de recetas y comprobarla con reloj de Santiago.
- [x] Retirar firma gráfica del PDF conservando identificación e información.
- [x] Añadir barras del folio existente y conservar QR.
- [x] Mantener privacidad pública, compatibilidad de históricos y controles clínicos.
- [ ] Definir e integrar dispensación si se necesita controlar retiros repetidos.
- [ ] Confirmar reglas institucionales y requisitos aplicables antes de utilizar
  estos documentos fuera del prototipo; no se afirma validez legal universal.

### 9.9. Unificación de mini calendarios de bienvenida — 19-11-2026

**Problema y motivo.** Existían cuatro implementaciones del mini calendario:
administrador, superadmin, profesional y estudiante. La del estudiante marcaba
hoy y los días con cita, pero no permitía consultar feriados. Las demás repetían
construcción del mes, navegación y detalle de efemérides, con diferencias visuales.

**Qué se hizo y cómo.** Se trasladó el componente informativo del superadmin a
frontend/src/app/shared/calendario-institucional/ y se reutiliza mediante
app-calendario-institucional en los cuatro dashboards. Ahora todos permiten
pulsar cualquier fecha para ver su día, mes y año, el nombre del feriado y las
efemérides registradas. Un segundo clic oculta el detalle; cambiar de mes limpia
la selección. Si no hay información registrada se muestra un mensaje explícito.
Los botones admiten teclado, muestran foco y anuncian selección con aria-pressed;
el detalle utiliza aria-live. Se conserva soporte de tema claro/oscuro.

Una sola implementación recibe tres entradas: titulo (por defecto Calendario),
fechasConCita (solo fechas ISO, sin datos de pacientes) y mostrarAdyacentes
(por defecto false). El estudiante conserva Tu calendario y los puntos que marcan
sus días con cita, incluso sobrecupos; el profesional conserva semanas completas
con fechas adyacentes atenuadas. La semana empieza en lunes y hoy se calcula con
calendarioCentro(), en America/Santiago. Los feriados y efemérides provienen de
los helpers existentes feriados-chile.ts y dias-internacionales.ts; no se añadió
otro catálogo ni una consulta HTTP.

Se retiraron de los tres dashboards restantes las propiedades, funciones,
plantillas y estilos exclusivos del mini calendario anterior. El calendario
para solicitar horas y la agenda clínica conservan sus reglas de disponibilidad:
el calendario de bienvenida sigue siendo informativo y no agenda ni bloquea horas.
No hay cambios en backend, base de datos, permisos o dependencias.

**Archivos nuevos por traslado:** calendario-institucional.ts, .html, .css y
.spec.ts en frontend/src/app/shared/calendario-institucional/.

**Archivos retirados:** superadmin-inicio-calendario.ts, .html, .css y .spec.ts
de frontend/src/app/dashboard-admin/superadmin-inicio/. Las diez pruebas del
componente original se conservaron en su nueva ubicación.

**Archivos modificados:** dashboard-estudiante.ts/.html/.css/.spec.ts;
dashboard-profesional.ts/.html/.css y dashboard-profesional-inicio-diseno.spec.ts;
dashboard-admin/inicio/admin-inicio.ts/.html; dashboard-admin/dashboard-admin.css;
dashboard-admin/superadmin-inicio/superadmin-inicio.ts/.html/.spec.ts;
y este PLAN_DE_MEJORAS.md. Las rutas abreviadas de dashboards están dentro de
frontend/src/app/.

**Verificación.** Las pruebas previas de navegación, alineación semanal, fechas
adyacentes en cambio de año y marcas de citas se adaptaron al componente compartido,
sin eliminar casos. Se agregó una prueba del clic en Fiestas Patrias desde Inicio
del estudiante y se conservaron las pruebas compartidas de feriados, efemérides,
selección y limpieza del detalle. Resultado final: 989 pruebas aprobadas en 53 archivos mediante npm test -- --watch=false.
Build de producción aprobado mediante npm run build; permanecen los dos avisos
previos de presupuesto CSS de admin y profesional (66,67 kB y 57,39 kB).
No se ejecutó pytest en esta ronda porque no hubo cambios de backend.
La comprobación manual indicada abajo queda como guía, no como ejecución registrada.

**Comprobación manual para practicar.**

1. Ingresar con cada rol y abrir Inicio.
2. Navegar a septiembre de 2026 y pulsar 18: debe aparecer Fiestas Patrias.
3. Pulsar de nuevo para ocultar el detalle y cambiar de mes para limpiar selección.
4. En estudiante, comprobar que una fecha con cita mantiene su punto indicador.
5. Repetir en modo oscuro y navegar por los botones con Tab y Enter.

- [x] Compartir un único mini calendario entre los cuatro roles.
- [x] Conservar citas del estudiante y semanas completas del profesional.
- [x] Mantener hora de Chile central y catálogo común.
- [ ] Revisar el catálogo compartido cuando se incorporen feriados extraordinarios
  o se amplíe el periodo cubierto; que no haya un registro no certifica día hábil.

### 9.10. Pulido de interfaz y coherencia entre portales — 19-11-2026

> Actualización por integración (9.11): la recuperación del compañero sí tiene
> implementación. Se restaura su enlace funcional; Recordarme sigue retirado.
> El diagnóstico original de abajo corresponde a la copia local antes de main.

**Objetivo y alcance.** Revisar presentación, textos, navegación y controles de
acceso, bienvenida, notificaciones y listado de pacientes. Se revisaron las
plantillas de los módulos administrativos y los portales de estudiante y
profesional para detectar duplicaciones, mensajes ambiguos y controles sin efecto.
Esta ronda aplica mejoras de interfaz sobre el funcionamiento existente.

**Problemas encontrados y solución aplicada.**

- **Login con promesas sin función conectada.** Recordarme solo cambiaba una
  variable local, sin modificar la persistencia de la sesión; la supuesta
  recuperación era un texto con apariencia de enlace. Se retiraron ambos controles,
  la variable huérfana recordarme y sus estilos. No se cambió el almacenamiento
  de tokens ni la duración de la sesión.
- **Identidad y ayuda de acceso.** Se reemplazaron credenciales UTEM por cuenta
  de SESAES y la mención Soporte SIAC por una indicación de contactar a la
  administración de SESAES. El correo institucional sigue siendo el identificador;
  la pantalla no afirma que ya exista SSO. Tampoco se inventó un correo de soporte.
  La descripción de seguridad ahora explica el acceso según rol, en lugar de
  prometer estándares no identificados.
- **Errores de login.** Un fallo de red podía presentarse como contraseña
  incorrecta. Ahora HTTP 0 informa que no fue posible conectar, HTTP 5xx informa
  indisponibilidad del servicio, y HTTP 401 mantiene el error de credenciales.
  Se conserva el detalle del servidor para los demás errores. El aviso de demora
  ya no asegura que el servidor estaba inactivo, pues ese motivo no se conoce.
  El formulario anuncia carga y vincula el correo inválido con su mensaje.
- **Notificaciones uniformes.** Admin y profesional ahora tienen un botón visible
  Cerrar notificaciones, igual que estudiante. Los tres portales muestran el
  estado expandido del panel, región con nombre, etiquetas para seleccionar cada
  notificación y nombres accesibles para leer/eliminar. En un panel vacío no se
  ofrece marcar todas como leídas. Cerrar el panel solo modifica estado visual:
  no marca ni elimina notificaciones.
- **Fechas.** Las notificaciones del estudiante usan FechaCentroPipe con
  dd/MM HH:mm, como los otros portales. La tabla de pacientes del profesional
  presenta dd/MM/yyyy. Se reutiliza America/Santiago; no se reinterpretan ni
  escriben fechas en la base.
- **Navegación con teclado.** Los tres portales incorporan Saltar al contenido,
  aria-current en la sección activa, nombre en la navegación principal y botones
  de menú con estado expandido y destino identificado. Se añadió un foco visible
  común, con color adecuado al tema. En las pantallas públicas se corrigió también
  el enlace de salto existente: el clic evita navegar por el base href de Angular
  y enfoca el main local con tabindex=-1. Antes podía devolver al login.
- **Menú móvil.** Los tres portales tienen una X dentro del lateral para cerrarlo,
  reutilizando toggleSidebarMovil(). Solo aparece en el punto de quiebre de cada
  portal: 1024 px para admin/estudiante y 768 px para profesional.
- **Cabecera administrativa móvil.** En teléfonos de hasta 640 px, saludo y menú
  ocupan una fila; buscador, tema, notificaciones y avatar ocupan la siguiente.
  Se evita que el buscador comprima el nombre del usuario en varias líneas.
  La búsqueda sigue disponible.
- **Listados y títulos coherentes.** La tabla de pacientes con cero coincidencias
  indica que no hay citas que coincidan con los filtros y muestra 0–0 de 0,
  conservando paginación y filtros. Sus botones de página tienen nombre y estado
  actual. En Inicio del estudiante, Mis últimas atenciones se renombró a
  Actividad reciente de mis citas, porque incluye cancelaciones e inasistencias;
  se conserva el contenido y sus acciones.

**Cómo se implementó.** Se ajustaron plantillas, estilos y estado visual existente.
Las funciones de login mantienen sus llamadas y permisos; solo se distingue el
mensaje según el estado HTTP. Los controles comunes de cierre y foco se definen
en styles.css, sin añadir otra biblioteca. No se crearon rutas, modelos,
migraciones ni endpoints. No se modificaron usuarios, citas ni documentos clínicos
durante las comprobaciones; no se ejecutaron comandos contra sesaes_old_backup.

**Verificación realizada.**

- npm test -- --watch=false: **992 pruebas aprobadas, 53 archivos**. Se conservaron
  los 989 casos anteriores y se añadieron tres casos de error de acceso
  (0, 503 y 401), comprobando que no se guarde una sesión fallida.
- npm run build: **aprobado**. Persisten los dos avisos de presupuesto CSS:
  admin 67,14 kB y profesional 57,39 kB, frente a 50 kB de aviso.
  No se elevó el límite para ocultarlos.
- Navegador local: acceso con los cuatro roles; apertura/cierre de notificaciones
  en estudiante, profesional y admin; tabla profesional con filtro sin resultados
  y contador 0–0 de 0; salto de foco en estudiante, admin, login y validador público;
  menú móvil del estudiante y cierre explícito del menú administrativo.
- Vistas de 1280 y 390 px: no se observó desborde horizontal del documento en las
  pantallas medidas de Inicio del estudiante, Inicio administrativo, login y
  validador público. Se verificó visualmente la cabecera del superadmin a 390 px.
  Esto no equivale a recorrer todos los formularios en todos los dispositivos.
- Las comprobaciones locales se hicieron con http://localhost:4200 y la API en
  http://localhost:8080, respetando el origen permitido. Usar 127.0.0.1 como origen
  del navegador requiere que CORS lo autorice; esta ronda no amplió CORS.
- No se ejecutó pytest en esta ronda: no hubo cambios de backend.

**Archivos modificados.**

- frontend/src/styles.css.
- frontend/src/app/login/login.ts, login.html, login.css y login.spec.ts.
- frontend/src/app/dashboard-admin/dashboard-admin.html y dashboard-admin.css.
- frontend/src/app/dashboard-profesional/dashboard-profesional.html.
- frontend/src/app/dashboard-estudiante/dashboard-estudiante.ts, .html y .css.
- frontend/src/app/validar-documento/validar-documento.html.
- PLAN_DE_MEJORAS.md.

**Evidencias nuevas:** [cabecera administrativa móvil](docs/evidencias/pulido-cabecera-admin-movil.jpg)
y [login móvil](docs/evidencias/pulido-login-movil.jpg). La evidencia administrativa
muestra el entorno demo; no contiene contraseñas ni datos clínicos. No se eliminó
ningún archivo de lógica en esta ronda; se retiraron controles, estado y estilos
sin uso dentro de los archivos existentes.

**Qué queda por hacer.**

- [x] Retirar controles de acceso sin comportamiento conectado.
- [x] Unificar controles de notificaciones y navegación accesible.
- [x] Corregir saltos de contenido, formato de fechas y contador vacío.
- [x] Mejorar cabecera y cierre de menú en móvil.
- [x] Ejecutar pruebas, compilar y registrar evidencias.
- [ ] Definir el canal institucional de recuperación de acceso y el contrato SSO
  antes de incorporar botones que dependan de ellos (continuidad con 9.6).
- [ ] Reducir los dos estilos de dashboard que exceden el presupuesto, separando
  estilos por módulos tras comprobar sus dependencias.
- [ ] Completar revisión de accesibilidad de diálogos, foco y lectores de pantalla,
  y recorrer todos los formularios en otros navegadores. No se afirma certificación
  de accesibilidad completa.

### 9.11. Integración de avances del equipo con main — 19-11-2026

**Procedencia y ubicación.** Copia de integración en .integracion/sesaes-unificado,
rama local integracion/avances-equipo-2026-11-19, desde main
854a727e31a691287a81cd4552f903e51183779f. Las fuentes y credenciales de la carpeta
original se conservan sin sobrescribir. Se creó un commit local de integración y un ZIP del código; no se publicó nada en GitHub.
La revisión 549fbb0 fue la referencia técnica más cercana (268 archivos idénticos):
ayuda a comparar, pero no demuestra filiación Git de la copia local exportada.

**Qué se conserva y cómo se resolvieron los cruces.**

| Área | Aporte del compañero | Resultado integrado |
|---|---|---|
| Recuperación | Router, servicios, modelos, pantallas /recuperar y /restablecer, pruebas y SMTP | Conservados. El login vuelve a enlazar /recuperar porque ahora existe una función real. Recordarme continúa retirado por no tener efecto. |
| Seguridad de cuenta | Token SHA-256 de un solo uso, vencimiento y respuesta uniforme; cinco fallos bloquean quince minutos | Conservados, incluidos límites por IP/cuenta, privacidad de correo_log y sus pruebas. No se envían correos reales durante la verificación. |
| Esquema | Dos tablas nuevas en modelos | Registradas en models/init.py y revisión incremental 8d2e4f6a901b sobre 253cae9c234a. No se modifica la revisión base ya revisada. |
| Horario | Configuración POSIX al arrancar y sus cuatro pruebas | Conservadas como compatibilidad. El negocio sigue usando ZoneInfo America/Santiago explícitamente, también en Windows; tokens y seguridad mantienen UTC. |
| Conexión PostgreSQL | Hora de centro de la copia local | Se preservan opciones previas de DATABASE_URL al añadir timezone para no destruir search_path y el aislamiento de esquemas. |
| Recetas | Aviso de medicamentos de control legal en formulario y PDF, con pruebas | Integrado conservando vigencia, barras, QR, contenido y paginación actuales. Sus pruebas usan ahora valida_hasta. |
| Firma | Modelos, endpoints y pruebas manuscritas ya existentes en la referencia | Se mantiene compatibilidad de perfil e históricos. La decisión posterior de 9.8 prevalece para nuevas emisiones sin firma gráfica. |
| Frontend y agenda | Base compartida de componentes y permisos | Se conservan cambios locales de dashboards, filtros, sobrecupos, contactos, calendario común y pulido de 9.1–9.10. No se restaura la ayuda profesional retirada. |
| CI y Node | GitHub Actions, CodeQL y storage de pruebas para Node recientes | Conservados. Angular usa setupFiles del compañero y runnerConfig local, con un trabajador para limitar memoria. |
| Scripts y SQL | Archivos históricos de la base común | Se respetan eliminaciones locales: no vuelven dumps ni parches obsoletos. Continúa el script operativo de contraseñas legacy que aún se documenta. |

**Actualización del esquema.** En backend/.env.example se conserva configuración
local y se añade RESET_TOKEN_MINUTES=30. La recuperación necesita FRONTEND_BASE_URL,
SMTP_EMAIL y SMTP_APP_PASSWORD; no se copia ningún .env real. No incorpora SSO.

Desde backend, sobre una base nueva o una copia ya versionada:

~~~powershell
python -m alembic upgrade head
python -m alembic current
python -m alembic check
~~~

El head es **8d2e4f6a901b**, con **28 tablas de dominio** más alembic_version.
python -m app.init_db recorre el mismo historial. Si se quieren demo y superadmin,
el orden sigue siendo seed primero y bootstrap después. Antes de actualizar una
base con datos, respaldar y probar una copia. Esta ronda no actualiza
sesaes_defensa_v2 ni sesaes_old_backup.

**Verificación.**

- Frontend: **1.007 pruebas aprobadas, 55 archivos**, y build de producción aprobado.
  Permanecen los dos avisos previos de tamaño CSS.
- Backend sin PostgreSQL: primera pasada **1.638 aprobadas, 16 omitidas y 20 subtests
  aprobados**. Las omisiones incluyen POSIX en Windows y casos PostgreSQL.
  Cierre conjunto con PostgreSQL y el caso incremental: **1.691 aprobadas,
  8 omitidas, 20 subtests aprobados y ningún fallo**, en 112,08 s. Las omisiones
  conservan sus condiciones de plataforma/entorno; no se eliminaron pruebas.
- PostgreSQL: base nueva con prefijo sesaes_integracion_test_, sin datos locales.
  Primera pasada: 45 aprobadas y 7 fallos. Se corrigieron fixtures sin bloques
  aprobados, fecha de prueba que no siempre cambiaba al quitar ceros, y la
  sobrescritura de search_path. Se conservan aserciones de exclusión y capacidad
  bajo concurrencia. Repetición PostgreSQL: **52 aprobadas, ningún fallo**, en
  33,35 s. Después se ejecutó también la suite completa indicada arriba.
  Las bases temporales creadas para estas pruebas se eliminaron al terminar;
  no se tocó ninguna base preexistente.
- Prueba incremental nueva: subir desde 253cae9c234a, conservar un usuario,
  revertir solo tablas de seguridad y comprobar que el usuario continúa intacto.
- Los resultados y números de tablas de 9.1–9.10 y 10 siguen como evidencia de
  cada ronda; para esta copia rige el presente cierre.

**Planes combinados sin duplicaciones.** Los apartados 1–8 eran comunes y aparecen
una sola vez. Se actualizaron pendientes de recuperación, horario, bloqueo, CI y
Alembic. Firma se rotula como antecedente y remite a 9.8. Se conservan las preguntas
institucionales nuevas del apartado 9 del compañero. SMTP real, despliegue remoto,
CodeQL e integración académica no se presentan como verificados.

**Antecedente normativo del compañero.** Se conserva a continuación su revisión de
noviembre de 2026 como transcripción histórica. No se revalidó jurídicamente en
esta integración ni confirma legislación vigente: fechas, referencias y
conclusiones requieren revisión institucional antes del uso externo.

| Tema | Qué se encontró |
|---|---|
| Firma electrónica (Ley 19.799) | Hay dos tipos: **simple** (incluye una firma digitalizada) y **avanzada** (la certifica un prestador acreditado). Un documento con firma simple vale como instrumento privado; con firma avanzada, como instrumento público. En junio de 2026 ingresó al Congreso un proyecto que modifica la ley. |
| Receta electrónica | Desde diciembre de 2025 existe el **Sistema Nacional de Receta Electrónica (SNRE)** del Minsal, gratuito, con firma por Clave Única o firma electrónica avanzada. El Decreto 466 (art. 38) exige que la receta electrónica lleve firma. |
| ¿Es obligatoria? | **Todavía no.** El proyecto de ley (Boletín 17.355-11) está en el Senado; el 10 de septiembre de 2026 pasó a la Comisión de Hacienda. El texto da 3 años (receta cheque) y 4 años (receta retenida) desde su publicación. |
| Vigencia | La receta simple no tiene plazo legal de vigencia; la receta retenida vale 30 días corridos (fuente periodística). |
| Medicamentos de control legal | Estupefacientes y psicotrópicos usan formatos oficiales (receta retenida y receta cheque, con talonarios entregados por el Servicio de Salud). SESAES **no los reemplaza**. |
| Datos personales | La Ley 21.719 estaba fijada para el 1 de diciembre de 2026, con un proyecto en trámite para postergarla. Los datos de salud son sensibles. Confirmar la fecha vigente. |

**Preguntas para UTEM (unidad de salud y área jurídica):**

1. ¿Las recetas de SESAES se llevan a farmacias o son indicaciones internas?
2. ¿Los profesionales de UTEM ya emiten por el SNRE?
3. ¿Se exige firma electrónica avanzada para los justificativos?
4. ¿Qué vigencia se declara en el documento?
5. ¿Quién es el responsable de datos personales (Ley 21.719)?

Según las respuestas, el paso siguiente es registrar el folio del SNRE en la atención y dejar el PDF de SESAES como copia informativa.

La fecha límite elegida por el profesional está implementada (9.8); no equivale
a resolver validez externa ni integración al SNRE.

**Archivos relevantes.** Se incorporan seguridad_cuenta.py, recuperar_password.py,
bloqueo_login_service.py, recuperar_password_service.py, las pantallas y pruebas
de recuperar-password/restablecer-password, test_seguridad_cuenta.py,
test_zona_horaria.py, frontend/src/test-setup.ts y los dos workflows de .github.
Se añade backend/alembic/versions/8d2e4f6a901b_seguridad_cuenta.py. Se combinan
.env.example, main.py, auth.py, models/init.py, tiempo.py, database.py,
documento_clinico_service.py y sus pruebas, formulario de atención, login,
angular.json y tsconfig.spec.json. Se ajustan test_alembic.py y fixtures de
concurrencia PostgreSQL, README.md y este plan. Los demás cambios locales se
describen en 9.1–9.10. El informe .integracion/comparacion.json enumera los archivos
comparados y retirados, fuera del proyecto entregable.

- [x] Integrar en rama y carpeta separadas conservando fuentes originales.
- [x] Conservar funcionalidades y pruebas compatibles de ambos avances.
- [x] Resolver firma, hora, recuperación, Alembic y calendario.
- [x] Unificar documentación y pendientes sin duplicar la base común.
- [x] Cerrar resultados de PostgreSQL y prueba incremental.
- [ ] Verificar SMTP institucional y entrega del enlace.
- [ ] Publicar rama/PR cuando se solicite y comprobar Actions.
- [ ] Completar pendientes de respaldo, despliegue, CSP, privacidad e integración
  institucional ya recogidos en 4 y 9.6.

### 9.12. Documentación profesional de entrega — 19-11-2026

**Qué se hizo y por qué.** Se creó una documentación para personas sin contexto
del desarrollo: usuarios finales, instaladores, responsables técnicos y quienes
continuarán el código. La nueva solicitud pide guías en docs; por ello se separan
las instrucciones actuales del historial central, sin eliminar los aportes
consolidados de ambos integrantes ni reescribir su evidencia.

**Cómo se organizó.** README es la entrada breve y docs/INDICE.md dirige por tarea.
MANUAL_USUARIO explica los cuatro roles con nombres de pantallas y consecuencias
de sus acciones. ARQUITECTURA, DIAGRAMAS y MODELO_DATOS describen el sistema;
el diccionario y el ER completo se obtuvieron de los modelos SQLAlchemy, sin
consultar registros de usuarios: 28 tablas de dominio y 196 columnas.
API y API_REFERENCIA incluyen ejemplos y 119 operaciones obtenidas de los
decoradores de main.py y routers, con enlaces a su implementación.
INSTALACION deriva de la guía ya verificada y actualiza el head a 8d2e4f6a901b.

**Guías adicionales.** CONFIGURACION reúne todas las variables de aplicación,
pruebas, frontend y Compose. OPERACION explica migraciones, respaldo y restauración
sobre una base separada. PRUEBAS distingue evidencia de integración, checks de esta
ronda y cobertura no medida. SOLUCION_PROBLEMAS permite interpretar errores.
INTEGRACION_INSTITUCIONAL separa las capacidades actuales del contrato propuesto
para la universidad; no se afirma que SSO o matrícula ya estén conectados.

**Archivos de comunidad.** SECURITY.md establece reporte privado y límites reales;
CONTRIBUTING.md describe ramas, revisión, pruebas y documentación; CHANGELOG.md
resume cambios visibles sin inventar una versión de release. LICENSE registra
que la licencia está pendiente de decisión del equipo/institución. No se eligió
MIT ni se concedieron permisos de distribución sin aprobación. El README incluye
badge CI enlazado al workflow, versiones de archivos, cobertura no medida y
licencia pendiente, sin porcentajes o checks de éxito fabricados.

**Docker.** Para que el inicio rápido tenga archivos reales se añadieron
compose.yaml, Dockerfiles y .dockerignore para backend/frontend, nginx.conf y
.env.docker.example. La plantilla privada .env.docker queda ignorada en Git.
El manifiesto es local: PostgreSQL 17 con volumen propio, FastAPI y frontend
compilado en Nginx; no reemplaza un despliegue productivo con HTTPS y custodia de
datos. Se conserva el seed optativo y el bootstrap existente; no se creó lógica
de aplicación nueva.

**Validación y límites de esta ronda.** Se comprueban enlaces relativos, anclas,
rutas de ejemplos, JSON, cercos Markdown, inventario de esquema y formato.
No se vuelve a anunciar la suite de integración como ejecutada por escribir
Markdown: los resultados de 1.691/1.007 y 52 PostgreSQL pertenecen al cierre 9.11.
Docker Engine no estaba iniciado. La validación con docker compose config fue
solicitada, pero el sistema de aprobación automática no pudo procesarla por un
límite de uso y el comando no se ejecutó. No es una aprobación rechazada por
inseguridad. Por tanto, build/arranque Docker y render visual de Mermaid en GitHub
se mantienen pendientes; se hace revisión estructural local de los diagramas.

**Resultado de comprobaciones documentales:** 18 documentos principales revisados,
188 enlaces internos válidos, 7 bloques JSON válidos, 9 diagramas Mermaid con
estructura revisada y formato Prettier aprobado para Markdown/YAML.
git diff --check sin errores. .env.docker y backend/.env permanecen ignorados,
mientras .env.docker.example se permite como plantilla pública.
No se ejecutaron pytest, npm test ni un nuevo build de aplicación en esta ronda:
no hay modificaciones de lógica. Docker y su recorrido siguen pendientes según
la limitación anterior.

**Archivos creados:** docs/INDICE.md, INSTALACION.md, MANUAL_USUARIO.md,
ARQUITECTURA.md, DIAGRAMAS.md, MODELO_DATOS.md, API.md, API_REFERENCIA.md,
CONFIGURACION.md, DOCKER.md, PRUEBAS.md, OPERACION.md,
INTEGRACION_INSTITUCIONAL.md y SOLUCION_PROBLEMAS.md; SECURITY.md,
CONTRIBUTING.md, CHANGELOG.md y LICENSE; compose.yaml, .env.docker.example;
backend/Dockerfile y .dockerignore; frontend/Dockerfile, .dockerignore y nginx.conf.
**Modificados:** README.md, .gitignore y este plan.
No se modificaron rutas, modelos, permisos ni reglas de negocio.

- [x] Manual de los cuatro perfiles y catálogo de documentación.
- [x] Arquitectura, ER y secuencias solicitadas.
- [x] Instalación, configuración, API, operación y pruebas explicadas.
- [x] Archivos de comunidad y changelog visible.
- [x] Badges con estado real, sin inventar licencia ni cobertura.
- [ ] Definir licencia con el equipo y la institución.
- [ ] Validar build y recorrido de Docker con el motor activo.
- [ ] Revisar render de Mermaid y Markdown en el Pull Request de GitHub.
- [ ] Ejecutar los checks remotos tras publicar estos archivos.

### 9.13. Manual integral en Word — 19-11-2026

**Qué se hizo y por qué.** Se preparó una edición independiente y editable en
Word para leer, imprimir y entregar las guías sin navegar por archivos Markdown.
El archivo se llama `SESAES_documentacion_integral.docx` y queda en la carpeta
`.integracion` del espacio de trabajo, junto a la copia integrada del repositorio.
Es un entregable separado; los Markdown siguen siendo las fuentes de mantenimiento.

**Cómo se hizo.** Se consolidaron las guías vigentes y los archivos de comunidad
en 19 capítulos: uso de los cuatro roles, arquitectura, diagramas y secuencias,
instalación, Docker, configuración, API, modelo de datos, operación, pruebas,
integración institucional, problemas, seguridad, contribución, cambios y licencia.
Se añadieron portada, índice navegable, numeración, tablas y figuras. Las secuencias
Mermaid se adaptaron a tablas de pasos; las relaciones completas se presentan en
una página A3 horizontal para conservar legibilidad. El historial del plan se
referencia sin duplicar instrucciones antiguas sustituidas.

**Revisión documental.** Se corrigió en `docs/DIAGRAMAS.md` la etiqueta del
participante API del alta profesional: representa la API SESAES, porque también
recibe el login y la solicitud de bloques; la operación de alta conserva su ruta
explícita. No se cambió ningún endpoint ni comportamiento de la aplicación.

**Validación.** Se abrió y exportó el DOCX con Microsoft Word en segundo plano,
se actualizaron índice y campos, y se revisaron visualmente las 77 páginas
renderizadas. Se ajustaron encabezados de tablas para que no queden solos al
final de página y se corrigió la representación de enlaces con corchetes.
No se consultaron bases de datos ni se incluyeron credenciales o registros reales.
La revisión corresponde al documento; no se repitió la suite de aplicación.

**Archivos.** Entregable nuevo: `SESAES_documentacion_integral.docx`, fuera de la
raíz Git integrada. Modificados: `docs/DIAGRAMAS.md` y este plan. Los recursos de
generación y revisión se conservan fuera del repositorio, en
`.integracion/documentacion-word-qa`, sin formar parte de la entrega del código.

- [x] Edición Word editable con índice y capítulos.
- [x] Revisión de paginación, tablas y figuras en Word.
- [x] Conservación de los límites y pendientes técnicos de las guías originales.
- [ ] Regenerar la edición Word cuando cambien las guías de origen.
- [ ] Completar autores e identidad institucional de portada si el equipo lo requiere.

### 9.14. Preparación de publicación en main oficial — 20-11-2026

**Solicitud y destino.** Se autoriza incorporar los avances al `main` oficial de
`xxt-cote/Proyecto-de-titulo-SESAES`. GitHub identifica ese repositorio como
original, no fork. Al consultar el remoto, main sigue en `854a727`; ese commit
es ancestro de la integración. No se requiere reescribir el historial ni usar
force push. El PR existente es el número 17.

**Conservación de aportes.** Recuperación/restablecimiento de contraseña,
bloqueo de cuentas y sus servicios, pantallas y workflows del compañero se
conservan sin diferencias respecto al main de referencia. Los cruces adaptados
se detallan en 9.11. Sí existen eliminaciones intencionales: Ayuda profesional,
modelo sin referencias `ausencia_profesional.py`, dump/parche SQL y scripts y
pruebas de migraciones manuales sustituidos por Alembic y sus pruebas. No debe
describirse la integración como una copia donde no se eliminó ningún archivo.
Las versiones anteriores continúan en el historial Git.

**Incidencia remota detectada.** El CI del commit `194d3c5` aprobó backend y
CodeQL, pero falló frontend. Las anotaciones muestran fixtures que construían
instantes con la zona local del runner y después los comparaban con hora de
Santiago. Esto hacía variar cancelaciones y tiempos relativos en servidores UTC.

**Corrección limitada.** Se ajustan únicamente seis archivos de pruebas:
`estudiante-citas-proximas.spec.ts` fija el instante de agosto con UTC-04;
`superadmin-inicio.utils.spec.ts` fija septiembre con UTC-03;
`superadmin-inicio.spec.ts` genera timestamps históricos mediante `formatoCentro`
para expresar la hora civil de Santiago. Las pruebas de citas administrativas y
los dos archivos de inicio profesional usan `fechaCentro` para el día actual:
UTC puede estar en otro día entre las 21:00 y las 23:59 de Chile. La ejecución
local bajo UTC detectó 22 fallos adicionales por ese cruce de fecha.
No se eliminan casos ni se cambian
aserciones, permisos, endpoints o reglas de aplicación para hacer pasar CI.

**Publicación y comprobación.** Se prepara la rama de integración con la
documentación pendiente de 9.12–9.13 y esta corrección, se comprueban pruebas y
build, y se verifica CI antes de actualizar main. No se ejecutan migraciones ni
se accede a las bases locales durante esta tarea. La actualización del código
no certifica ni ejecuta un despliegue o una migración productiva.

**Resultado local de esta ronda.** Las 1.007 pruebas de frontend en 55 archivos
pasan tanto con `TZ=UTC` como con `TZ=America/Santiago`, sin cambiar aserciones.
La primera ejecución aislada no pudo resolver los archivos por permisos del
entorno; se repitió fuera de ese aislamiento. No se atribuye ese error al código.
El build de producción también pasa; conserva los dos avisos de presupuesto CSS
de los dashboards administrativo y profesional. `git diff --check` pasa.

## 10. Guías operativas e historial consolidado

Se conservan los seis documentos retirados. Las guías vigentes están ahora en [docs/INDICE.md](docs/INDICE.md).
Los textos consolidados a continuación preservan rondas anteriores; contrastar
comandos, revisiones y resultados con la guía actual antes de ejecutarlos.
Las rutas de archivos eliminados en inventarios históricos describen su estado
en esa ronda, no instrucciones para recrearlos. Las credenciales siguen fuera del documento.
Las referencias legales se conservan como revisión del 15-11-2026, sin nueva certificación jurídica.
Las referencias a apartados numerados dentro de una guía mantienen la numeración
original de esa guía; el índice siguiente y las anclas permiten acceder a cada contenido.

| Contenido | Ubicación |
|---|---|
| Instalación desde cero y carga de datos | [10.1](#guia-instalacion) |
| Migraciones, respaldo y reversión | [10.2](#guia-migraciones) |
| Alembic, base de defensa y demo de horario en vivo | [10.3](#cierre-alembic) |
| Correcciones y verificaciones anteriores de entrega | [10.4](#cierre-entrega) |
| Historial técnico de refactorizaciones | [10.5](#historial-tecnico) |
| Datos personales y requisitos previos a producción | [10.6](#datos-sensibles) |

<a id="guia-instalacion"></a>

### 10.1. Instalación desde cero y carga de datos

> Origen consolidado: `docs/INSTALACION.md`.

<a id="guia-instalacion--instalacion-de-sesaes-desde-cero"></a>
#### Instalación de SESAES desde cero

Esta entrega contiene **código y una base de datos por crear, sin datos**. No requiere ni incluye un dump de la base del autor. Cada institución debe crear sus propias cuentas, profesionales, especialidades y alumnos. Los nombres y correos de ejemplo de esta guía son ficticios: reemplazarlos por los autorizados para la instalación.

El esquema completo está versionado en **Alembic** y se aplica con `python -m alembic upgrade head`. `python -m app.init_db` es el atajo que ejecuta ese mismo historial. Los modelos SQLAlchemy siguen definiendo el estado deseado, pero ya no crean tablas directamente en la aplicación. No hay que importar `.sql`, ejecutar migraciones sueltas ni insertar datos manualmente en SQL. El historial `backend/alembic/` y `backend/alembic.ini` sí deben acompañar la entrega.

Los comandos siguientes se ejecutan en **PowerShell 7**. Abrir primero una terminal en la raíz del proyecto, donde están `backend/`, `frontend/` y `README.md`. Mantener las terminales abiertas cuando se indique.

<a id="guia-instalacion--1-requisitos-previos"></a>
##### 1. Requisitos previos

| Herramienta | Versión de referencia | Verificación |
|---|---|---|
| Python | 3.13; verificado con 3.13.2 | `python --version` |
| pip y venv | Los incluidos con Python | `python -m pip --version` |
| Node.js | 24.20.0; Angular instalado admite `^22.22.3`, `^24.15.0` o `>=26.0.0` | `node --version` |
| npm | 11; verificado con 11.6.0, `packageManager` declara 11.13.0 | `npm --version` |
| PostgreSQL | 17; verificado con 17.2 | `psql --version` |
| PowerShell | 7.1 o superior, para `Read-Host -MaskInput` | `$PSVersionTable.PSVersion` |

PostgreSQL debe estar iniciado. Tener una cuenta administradora de PostgreSQL para crear un rol y una base. Agregar su carpeta `bin` al PATH si no se reconocen `psql` o `createdb` (en Windows suele ser `C:\Program Files\PostgreSQL\17\bin`). Para instalar dependencias hace falta acceso a Internet y al CDN de SheetJS referenciado en `frontend/package-lock.json`.

SQLite se usa en pruebas unitarias. **Esta guía y el funcionamiento de producción requieren PostgreSQL**, entre otras cosas por los locks transaccionales de concurrencia de la agenda. No sustituir `DATABASE_URL` por SQLite para operar la aplicación.

<a id="guia-instalacion--2-preparar-python-y-las-variables-de-entorno"></a>
##### 2. Preparar Python y las variables de entorno

Desde la raíz:

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Debe existir **`backend/.env.example`**, incluido en esta entrega. El archivo privado que lee el backend es **`backend/.env`**; ejecutar los comandos Python desde `backend/`. Si Windows impide activar el entorno, se puede invocar directamente `.\venv\Scripts\python.exe` en lugar de `python`, sin cambiar la política del equipo.

Generar una clave JWT propia:

```powershell
python -c "import secrets; print(secrets.token_hex(32))"
```

Editar `.env` y reemplazar sus valores. Las variables del proceso tienen prioridad sobre `.env`; quitar valores antiguos de la terminal si apuntan a otra instalación.

| Variable | Uso | Ejemplo / valor inicial |
|---|---|---|
| `DATABASE_URL` | Conexión SQLAlchemy a la base nueva. Obligatoria. | `postgresql+psycopg2://sesaes:TU_PASSWORD@localhost:5432/sesaes` |
| `JWT_SECRET_KEY` | Firma de sesiones. Obligatoria; secreto propio, nunca el texto de ejemplo. | La salida aleatoria del comando anterior |
| `JWT_EXPIRE_MINUTES` | Vigencia del token en minutos. | `720` |
| `CORS_ORIGINS` | Orígenes frontend autorizados, separados por comas y sin barra final. | `http://localhost:4200` |
| `SESAES_ENV` | `production` desactiva `/docs`, `/redoc` y `/openapi.json`. | `development` durante la instalación |
| `FRONTEND_BASE_URL` | URL propia usada en enlaces/QR de documentos clínicos. | `http://localhost:4200` |
| `SEED_DEMO_DATA` | Solo `true` activa el seed demo. | **`false` en una instalación real** |
| `SEED_DEMO_PASSWORD` | Contraseña externa compartida por las once cuentas demo, hasheada por cuenta. | Omitir en una instalación real |
| `SUPERADMIN_BOOTSTRAP_EMAIL` | Correo del primer superadmin, proporcionado por el instalador. | `superadmin@utem.cl` |
| `SUPERADMIN_BOOTSTRAP_PASSWORD` | Contraseña elegida por el instalador, no generada ni impresa por el backend. | Definir mediante entrada oculta; ver paso 3 |
| `SUPERADMIN_BOOTSTRAP_NAME` | Nombre del primer superadmin; opcional. | `Superadministrador SESAES` |
| `SMTP_EMAIL` | Cuenta remitente Gmail para correos reales; opcional. | Omitir hasta configurar correo institucional autorizado |
| `SMTP_APP_PASSWORD` | Contraseña de aplicación Gmail; opcional. | Omitir hasta configurar SMTP |
| `SMTP_NOMBRE_REMITENTE` | Nombre visible del remitente. | `SESAES` |
| `TEST_POSTGRES_URL` | Solo pruebas de integración. Usar una base de pruebas separada. | `postgresql+psycopg2://sesaes:TU_PASSWORD@localhost:5432/sesaes_test` |

SMTP usa actualmente `smtp.gmail.com:465` con SSL; host y puerto están definidos en código, no son variables configurables. Sin credenciales SMTP la agenda funciona y los intentos de correo quedan registrados como no enviados. No hace falta SMTP para crear cuentas ni para esta verificación; las contraseñas se entregan por un canal privado, no mediante estos endpoints.

No agregar contraseñas reales al `.env.example`, a los ejemplos, a seeds ni al repositorio. Si la contraseña PostgreSQL tiene caracteres reservados para URLs, codificarlos en el segmento de contraseña (`@` → `%40`, por ejemplo).

<a id="guia-instalacion--3-crear-la-base-vacia-el-esquema-y-el-primer-superadmin"></a>
##### 3. Crear la base vacía, el esquema y el primer superadmin

<a id="guia-instalacion--31-crear-rol-y-base-en-postgresql"></a>
###### 3.1. Crear rol y base en PostgreSQL

En una terminal, con las herramientas PostgreSQL disponibles:

```powershell
psql -h localhost -p 5432 -U postgres -d postgres -c "CREATE ROLE sesaes LOGIN;"
psql -h localhost -p 5432 -U postgres -d postgres -c '\password sesaes'
createdb -h localhost -p 5432 -U postgres -O sesaes -E UTF8 sesaes
```

El segundo comando pide dos veces la contraseña del nuevo rol. Guardarla en `DATABASE_URL` dentro de `backend/.env`. Si la cuenta administradora no se llama `postgres`, sustituir ese argumento por su nombre. Si el rol/base ya existen porque se completó este paso, no repetir su creación. Estos comandos solo crean el contenedor y el acceso: todavía no crean tablas ni datos de SESAES.

<a id="guia-instalacion--32-crear-todas-las-tablas"></a>
###### 3.2. Crear todas las tablas

Volver a la terminal Python, situada en `backend/`, con el entorno virtual activo y `.env` configurado:

```powershell
$env:SEED_DEMO_DATA = 'false'
python -m alembic upgrade head
python -m alembic current
python -m alembic check
python -m scripts.auditar_esquema
```

`current` debe mostrar `253cae9c234a (head)` y el auditor no debe informar diferencias. Se crean tablas, índices, claves foráneas y constraints, incluidas auditoría, acceso administrativo, documentos clínicos y bloques horarios. Alembic no crea ninguna cuenta. Repetir el upgrade es seguro en una base versionada.

El atajo equivalente es `python -m app.init_db`, que responde `Inicialización completada.` y ejecuta internamente `alembic upgrade head`. Con `SEED_DEMO_DATA=false` no añade usuarios. La revisión queda en `alembic_version`, una tabla de control adicional.

**Protección de la base histórica:** una BD SESAES con tablas pero sin revisión Alembic válida se rechaza antes de ejecutar DDL. No ejecutar `stamp` ni usarla para autogenerate a ciegas. La entrega se instala sobre una base nueva; ver [MIGRACIONES.md](#guia-migraciones) para el flujo activo y sus límites. La base local de trabajo no se migró durante la integración de Alembic.

<a id="guia-instalacion--33-crear-el-primer-superadmin"></a>
###### 3.3. Crear el primer superadmin

En la misma terminal:

```powershell
$env:SUPERADMIN_BOOTSTRAP_EMAIL = 'superadmin@utem.cl'
$env:SUPERADMIN_BOOTSTRAP_NAME = 'Superadministrador SESAES'
$env:SUPERADMIN_BOOTSTRAP_PASSWORD = Read-Host -MaskInput 'Elige la contraseña del primer superadmin'
python -m app.init_db --superadmin
Remove-Item Env:SUPERADMIN_BOOTSTRAP_PASSWORD
```

Elegir una contraseña de al menos ocho caracteres con mayúscula, minúscula, número y carácter especial, sin espacios. Usar correo `@utem.cl`, que es el dominio aceptado por el formulario de login actual. Para otra institución hay que adaptar esa validación y las altas, no basta cambiar CORS.

El comando lee estos datos del entorno o `.env`; **no genera una contraseña ni pregunta datos interactivamente por su cuenta**. `Read-Host` es la entrada oculta que hemos añadido al comando de instalación. Guarda un hash bcrypt, crea el rol `superadmin` activo y no promueve cuentas existentes. Una segunda ejecución con `--superadmin` se rechaza si ya existe cualquier superadmin; para arrancar después usar `python -m app.init_db` o iniciar FastAPI. El superadmin trae sus permisos por rol y no necesita configurar `AccesoAdministrativo`.

Si se escribieron credenciales de bootstrap en `.env`, retirarlas después de usarlas. Conservar la contraseña en un gestor seguro. La API nunca ejecuta automáticamente el bootstrap del superadmin.

<a id="guia-instalacion--4-cargar-datos-iniciales-reales-sin-seed-demo-ni-sql-manual"></a>
##### 4. Cargar datos iniciales reales, sin seed demo ni SQL manual

<a id="guia-instalacion--41-vias-disponibles-y-modelo-de-especialidades"></a>
###### 4.1. Vías disponibles y modelo de especialidades

| Dato | Panel actual | API / procedimiento |
|---|---|---|
| Especialidad | **Profesionales → Agregar profesional → + Nueva especialidad** | Campo `especialidad` al hacer `POST /admin/profesionales` |
| Profesional y su cuenta | **Profesionales → Agregar profesional** | `POST /admin/profesionales` |
| Alumno y su cuenta | El panel permite consulta/edición; **no tiene formulario de alta** | **`POST /admin/estudiantes`**, incorporado para esta entrega |
| Semana de bloques | Profesional: **Agenda → Solicitar horario semanal → Enviar solicitud** | `POST /profesional/{id}/solicitar-bloques-horario` |
| Aprobación de semana | Administración: **Agenda → Solicitudes de horario pendientes → Aprobar** | `PATCH /admin/solicitudes-horario/{id}/aprobar` |
| Administradores y permisos | Superadmin: **Administradores → Acceso administrativo** | Rutas `/usuarios/administradores` explicadas más abajo |

**No existe tabla ni endpoint independiente de alta de especialidades.** La especialidad es un texto en `Profesional.especialidad`, con **una especialidad por profesional**. La primera alta de un profesional con un nombre de especialidad nuevo la incorpora a las listas dinámicas; no hay un catálogo vacío que deba precargarse antes. Mantener nombres coherentes, por ejemplo `Nutrición`. Un catálogo autónomo o múltiples especialidades por profesional requerirían otro desarrollo; no hacen falta para este flujo y no se resuelven insertando filas SQL.

El alta profesional está disponible tanto por panel como por API. **Ambas vías exigen una contraseña propia** con la política del paso 3 y un máximo de 72 bytes UTF-8. En el panel hay campos de contraseña y confirmación; no existe contraseña fija ni fallback, y la confirmación no muestra la clave. El alta de alumnos permanece **solo por API** por decisión de alcance: el panel no tiene formulario de alta y no se ofrece carga CSV. Está documentado como mejora futura; la vía API actual permite completar la instalación sin SQL manual.

Las listas, filtros y conteos de presentación normalizan mayúsculas, tildes y espacios: `Nutricion`, `nutrición` y `NUTRICIÓN` cuentan como una especialidad, conservando una etiqueta visible. No se reescriben datos históricos ni se amplían permisos RBAC por esta normalización visual. Sigue habiendo una especialidad por profesional, sin catálogo autónomo; un catálogo institucional y múltiples especialidades son deuda técnica explícita.

<a id="guia-instalacion--42-iniciar-api-y-preparar-una-consola-de-carga"></a>
###### 4.2. Iniciar API y preparar una consola de carga

Dejar el backend corriendo en la terminal Python:

```powershell
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8080
```

Abrir **otra terminal PowerShell 7**. Esta terminal puede estar en cualquier carpeta y no necesita activar Python. Definir la siguiente función, usada en todos los ejemplos posteriores:

```powershell
$base = 'http://localhost:8080'
function Api([string]$Metodo, [string]$Ruta, [string]$Token = '', $Datos = $null) {
    $p = @{ Method = $Metodo; Uri = "$base$Ruta"; ContentType = 'application/json; charset=utf-8' }
    if ($Token) { $p.Headers = @{ Authorization = "Bearer $Token" } }
    if ($null -ne $Datos) { $p.Body = ($Datos | ConvertTo-Json -Depth 10) }
    Invoke-RestMethod @p
}
$sa = Api POST '/login' '' @{
    correo = 'superadmin@utem.cl'
    password = (Read-Host -MaskInput 'Contraseña del superadmin creado en el paso 3')
}
$tokenSA = $sa.access_token
```

Todos los ejemplos utilizan IDs devueltos por la API; **no suponer que parten en 1**. Para Swagger, abrir `http://localhost:8080/docs` en modo development; el login también se hace con JSON en `/login`, y las llamadas protegidas envían `Authorization: Bearer TOKEN`.

<a id="guia-instalacion--43-agregar-especialidad-y-profesional"></a>
###### 4.3. Agregar especialidad y profesional

En la consola de carga, reemplazar los datos ficticios por los del profesional autorizado:

```powershell
$correoProf = 'profesional.nuevo@utem.cl'
$claveProf = Read-Host -MaskInput 'Contraseña propia para el profesional'
$prof = Api POST '/admin/profesionales' $tokenSA @{
    nombre = 'Profesional de ejemplo'
    correo = $correoProf
    password = $claveProf
    especialidad = 'Nutrición'
    duracion_min = 30
}
$profId = $prof.id
```

Respuesta esperada HTTP 200 con el profesional y su `id`. Crea además `Usuario` con rol `profesional`, enlazado mediante `usuario_id`. `prof.id` y `usuario_id` son identificadores distintos. `rut`, tratamiento, iniciales, descripción y color son opcionales; si se informa RUT, debe tener dígito verificador válido. Esta operación requiere `profesionales.gestionar` y alcance sobre esa especialidad; el superadmin ya los tiene. Todavía no tiene bloques ni ofrece citas al estudiante.

<a id="guia-instalacion--44-agregar-alumno"></a>
###### 4.4. Agregar alumno

```powershell
$correoAlumno = 'alumno.nuevo@utem.cl'
$claveAlumno = Read-Host -MaskInput 'Contraseña propia para el alumno'
$alumno = Api POST '/admin/estudiantes' $tokenSA @{
    nombre = 'Alumno de ejemplo'
    correo = $correoAlumno
    password = $claveAlumno
    carrera = 'Ingeniería en Informática'
}
$alumnoId = $alumno.id
```

Respuesta HTTP **201**, sin contraseña ni hash. `nombre`, correo institucional, contraseña y carrera son obligatorios; `rut` y `telefono` son opcionales. Aplica la política de contraseña indicada en el paso 3 y un máximo de 72 bytes UTF-8 para bcrypt. Rechaza correo duplicado con HTTP 409. El rol siempre es `estudiante`, la cuenta nace activa y la creación queda auditada. No se aceptan campos como `rol`, permisos o `activo` enviados por el cliente. No hay registro público ni alta masiva CSV vigente.

Se exige **`usuarios.gestionar` y alcance institucional**: puede hacerlo el superadmin o un admin correctamente configurado. Un administrador limitado a especialidades no puede crear estas cuentas globales. No es necesario crear datos clínicos, fichas de antecedentes ni cuestionarios para habilitar el login o la reserva.

<a id="guia-instalacion--45-el-profesional-solicita-sus-bloques"></a>
###### 4.5. El profesional solicita sus bloques

Autenticarse con la cuenta profesional recién creada:

```powershell
$sesionProf = Api POST '/login' '' @{ correo = $correoProf; password = $claveProf }
$tokenProf = $sesionProf.access_token
$perfilProf = Api GET "/profesional/buscar-por-usuario/$($sesionProf.id)" $tokenProf
$profId = $perfilProf.id
$fechaPrueba = (Get-Date).Date.AddDays(1)
while ($fechaPrueba.DayOfWeek -in @([DayOfWeek]::Saturday, [DayOfWeek]::Sunday)) {
    $fechaPrueba = $fechaPrueba.AddDays(1)
}
$diaSemana = (([int]$fechaPrueba.DayOfWeek + 6) % 7)
Api POST "/profesional/$profId/solicitar-bloques-horario" $tokenProf @{
    bloques = @(@{
        dia_semana = $diaSemana
        hora_inicio = '09:00'
        hora_fin = '13:00'
        tipo = 'disponible'
    })
}
$solicitudes = @(Api GET "/profesional/$profId/solicitudes-horario" $tokenProf)
$solicitud = $solicitudes | Where-Object { $_.tipo -eq 'bloques' -and $_.estado -eq 'pendiente' } | Select-Object -First 1
```

Este ejemplo propone **solo el próximo día hábil** para que se pueda comprobar fácilmente que los otros días están bloqueados. En una instalación real, enviar en `bloques` la **semana completa** acordada: `0=lunes`, `1=martes`, `2=miércoles`, `3=jueves`, `4=viernes`. Tipos: `disponible` o `colacion`. El horario institucional es lunes–jueves 09:00–17:30 y viernes 09:00–16:30. No se admiten sábados, domingos ni intervalos fuera de esos límites.

La solicitud requiere el token del **profesional dueño** de esa agenda. El superadmin no suplanta al profesional en esta ruta. Una solicitud nueva reemplaza su solicitud de bloques pendiente anterior; por sí sola todavía no habilita días.

<a id="guia-instalacion--46-el-superadmin-o-administrador-aprueba"></a>
###### 4.6. El superadmin o administrador aprueba

```powershell
Api PATCH "/admin/solicitudes-horario/$($solicitud.id)/aprobar" $tokenSA
```

La API responde HTTP 200. También puede aprobar un admin con `agenda.gestionar` y alcance institucional o sobre la especialidad del profesional. Desde el panel, se hace en la tabla de solicitudes pendientes de la agenda administrativa.

**Sin bloques aprobados el calendario estudiantil queda completamente bloqueado.** La aprobación reemplaza toda la agenda semanal vigente del profesional. Los días no incluidos quedan sin atención. Una jornada simple, una solicitud pendiente o una solicitud rechazada no habilitan fechas para estudiantes.

<a id="guia-instalacion--47-roles-y-permisos-opcionales-de-otros-administradores"></a>
###### 4.7. Roles y permisos opcionales de otros administradores

Para arrancar basta el superadmin: no hay que sembrar roles, permisos ni accesos SQL. Estudiante y profesional reciben sus capacidades por rol. Crear otro admin solo si se necesita delegar tareas; su cuenta sola **no concede acceso**.

Ejemplo mínimo con acceso institucional para altas y horarios:

```powershell
$otroAdmin = Api POST '/usuarios/administradores' $tokenSA @{
    nombre = 'Administrador de ejemplo'
    correo = 'administrador.nuevo@utem.cl'
    password = (Read-Host -MaskInput 'Contraseña propia del administrador')
    rol = 'admin'
}
Api PUT "/usuarios/administradores/$($otroAdmin.id)/acceso-administrativo" $tokenSA @{
    perfil = 'administrador_general'
    permisos = @('usuarios.ver', 'usuarios.gestionar', 'profesionales.ver', 'profesionales.gestionar', 'agenda.ver', 'agenda.gestionar')
    alcance = @{ tipo = 'institucional'; especialidades = @() }
}
```

El PUT reemplaza el conjunto completo de permisos/alcance. Solo el superadmin gestiona esta configuración. Consultar `GET /usuarios/administradores/catalogo-acceso` con `$tokenSA` para ver combinaciones válidas. No asignar permisos clínicos a administradores. `agenda.sobrecupo` es una autorización adicional y no hace falta para reservar horas ordinarias.

<a id="guia-instalacion--5-seed-demo-opcional-y-separado-de-los-datos-reales"></a>
##### 5. Seed demo: opcional y separado de los datos reales

**Omitir esta sección al preparar un entorno real.** Dejar `SEED_DEMO_DATA=false` en `.env` y en el entorno; omitir `SEED_DEMO_PASSWORD`. El inicializador no deduce que una base es demo por su nombre o porque `SESAES_ENV=development`.

Solo para una base demo **sin usuarios** y diferente de la real, configurar su propia `DATABASE_URL` y ejecutar desde `backend/`:

```powershell
$env:SEED_DEMO_DATA = 'true'
$env:SEED_DEMO_PASSWORD = Read-Host -MaskInput 'Contraseña externa para las cuentas demo'
python -m app.init_db
$env:SEED_DEMO_DATA = 'false'
Remove-Item Env:SEED_DEMO_PASSWORD
```

El seed requiere contraseña externa no vacía; no tiene contraseña por omisión y almacena hashes bcrypt independientes. Crea exactamente:

| Rol | Cuentas de ejemplo incluidas en el código |
|---|---|
| 4 estudiantes | `maria.gonzalez@utem.cl`, `carlos.munoz@utem.cl`, `valentina.rojas@utem.cl`, `diego.soto@utem.cl` |
| 6 profesionales | `ana.martinez@utem.cl` (Medicina General), `roberto.fuentes@utem.cl` (Psicología), `klgo.soto@utem.cl` (Kinesiología), `val.rojas@utem.cl` (Odontología), `nut.munoz@utem.cl` (Nutrición), `joaquin.rodriguez@utem.cl` (Oftalmología) |
| 1 admin | `admin@utem.cl`, sin acceso administrativo efectivo hasta configurarlo |

También crea seis registros profesionales vinculados con **duracion_min=60** y **90 bloques aprobados**: por profesional y día, disponible 09:00–13:00, colación 13:00–14:00 y disponible 14:00–17:30 de lunes a jueves o 14:00–16:30 el viernes (60 disponibles y 30 de colación). El default del modelo permanece en 45. Incluye los campos de perfil ficticios definidos en `app/init_db.py`. No crea citas, superadmin, fichas clínicas ni un catálogo independiente de especialidades. Todas esas cuentas utilizan la contraseña externa indicada.

El seed es transaccional y no duplica usuarios: si existe cualquier usuario, omite la carga. Por eso, en una base demo hay que sembrar **antes** de crear el superadmin, o ejecutar ambos con `python -m app.init_db --superadmin` y las variables necesarias. No activarlo para intentar completar una base real parcialmente cargada.

<a id="guia-instalacion--6-levantar-backend-y-frontend"></a>
##### 6. Levantar backend y frontend

<a id="guia-instalacion--backend--terminal-1"></a>
###### Backend — terminal 1

Si ya está corriendo desde el paso 4, dejar ese proceso; no abrir otro en el mismo puerto. En caso contrario, desde la raíz:

```powershell
cd backend
.\venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8080
```

La API queda en `http://localhost:8080`. El arranque también ejecuta `init_db()` para asegurar el esquema; no crea el superadmin automáticamente. `--reload` es para desarrollo local; en un despliegue real usar el proceso/supervisor correspondiente sin esa opción y definir `SESAES_ENV=production`.

<a id="guia-instalacion--frontend--terminal-2"></a>
###### Frontend — terminal 2

En otra terminal situada en la raíz:

```powershell
cd frontend
npm ci
npm start -- --host localhost --port 4200
```

Abrir **`http://localhost:4200`**. Sin configuración adicional se utiliza `http://localhost:8080`; esta entrega no se conecta al servidor alojado del autor. Para otro backend, configurar **`NG_APP_API_URL` en el entorno del proceso de build/serve**, sin editar TypeScript:

```powershell
$env:NG_APP_API_URL = 'https://api.tu-institucion.example'
npm run build
Remove-Item Env:NG_APP_API_URL
```

El mismo valor se admite con `npm start`. `frontend/scripts/angular.mjs` valida la URL y usa la opción `define` nativa de Angular; no se añadieron dependencias. No se carga automáticamente un `.env` frontend: en CI definir `NG_APP_API_URL` como variable de build. El valor queda incorporado al bundle y cambiarlo requiere recompilar; no debe contener contraseñas, tokens ni otros secretos. Configurar también `CORS_ORIGINS` y `FRONTEND_BASE_URL` en el backend. Usar los scripts npm, pues `npx ng build` invocado directamente no lee esta variable por sí solo.

<a id="guia-instalacion--7-verificacion-final"></a>
##### 7. Verificación final

<a id="guia-instalacion--71-verificar-el-recorrido-por-api"></a>
###### 7.1. Verificar el recorrido por API

Volver a la consola de carga del paso 4, donde siguen definidos `Api`, los IDs y los tokens:

```powershell
Api GET '/health'
$sesionAlumno = Api POST '/login' '' @{ correo = $correoAlumno; password = $claveAlumno }
$tokenAlumno = $sesionAlumno.access_token
$calendario = Api GET "/disponibilidad/$profId/calendario" $tokenAlumno
$fechaIso = $fechaPrueba.ToString('yyyy-MM-dd')
if ($fechaIso -notin $calendario.fechas) { throw 'La fecha aprobada no aparece disponible; revisar bloques, cierres y estado del profesional.' }
$disponibilidad = Api GET "/disponibilidad/$profId`?fecha=$fechaIso" $tokenAlumno
if (-not $disponibilidad.horas.Count) { throw 'No hay horas disponibles para la prueba.' }
$cita = Api POST '/citas' $tokenAlumno @{
    estudiante_id = $alumnoId
    profesional_id = $profId
    fecha = $fechaIso
    hora = $disponibilidad.horas[0]
}
$cita
Api GET "/citas/estudiante/$alumnoId" $tokenAlumno
```

Debe responder una cita con `estado: pendiente`. El calendario publica solo fechas con bloques aprobados y cupos reales entre hoy y hoy + 7 días, excluyendo cierres y fines de semana. El intervalo completo debe caber en el bloque. En una base nueva no hay cierres institucionales cargados; si ya se cargaron, elegir una fecha no cerrada.

Comprobar el bloqueo de otro día de semana sin bloques, dentro de la ventana:

```powershell
$sinBloques = $fechaPrueba.AddDays(1)
while ($sinBloques.DayOfWeek -in @([DayOfWeek]::Saturday, [DayOfWeek]::Sunday)) { $sinBloques = $sinBloques.AddDays(1) }
$sinBloquesIso = $sinBloques.ToString('yyyy-MM-dd')
if ($sinBloquesIso -in $calendario.fechas) { throw 'Se publicó un día que no fue aprobado.' }
# La siguiente llamada DEBE devolver HTTP 400; no debe crear otra cita:
Api POST '/citas' $tokenAlumno @{
    estudiante_id = $alumnoId; profesional_id = $profId
    fecha = $sinBloquesIso; hora = '09:00'
}
```

Si el login devuelve 429, se superó su límite de cinco intentos por minuto; esperar un minuto y usar las credenciales correctas. Si las llamadas devuelven 401 después de varias horas, iniciar sesión de nuevo y renovar el token.

<a id="guia-instalacion--72-comprobar-los-paneles-en-el-navegador"></a>
###### 7.2. Comprobar los paneles en el navegador

1. Abrir `http://localhost:4200`, iniciar sesión como superadmin y comprobar que aparece el profesional en **Profesionales** y el alumno en **Estudiantes**. No hace falta asignarse permisos adicionales.
2. Cerrar sesión, entrar con el correo/contraseña profesional y abrir **Agenda**. En **Solicitar horario semanal**, comprobar que la solicitud está aprobada y que los bloques corresponden al día elegido. En la agenda debe aparecer la cita si se realizó la prueba por API.
3. Cerrar sesión, entrar como alumno y abrir **Agendar hora**. Seleccionar el profesional y abrir el calendario: el día aprobado con cupos estará habilitado; otro día hábil sin bloques, los fines de semana y los cierres estarán deshabilitados. Mientras carga o falla la consulta, el calendario permanece bloqueado.
4. Para probar la reserva **por pantalla**, hacer este paso antes de la reserva API o cancelar primero la cita pendiente. La regla de una cita pendiente por especialidad impedirá una segunda reserva del mismo alumno. Elegir fecha habilitada y hora, confirmar y comprobar **Mis citas**.

<a id="guia-instalacion--73-pruebas-reproducibles-de-la-entrega"></a>
###### 7.3. Pruebas reproducibles de la entrega

Desde `backend/`, con el entorno virtual activo:

```powershell
python -m pytest -q
```

Las integraciones PostgreSQL se omiten si no se indica una URL de pruebas. Para reproducir la comprobación de instalación, crear una base **separada y sin datos reales**:

```powershell
createdb -h localhost -p 5432 -U postgres -O sesaes -E UTF8 sesaes_test
$env:TEST_POSTGRES_URL = Read-Host -MaskInput 'URL PostgreSQL completa de sesaes_test'
python -m pytest tests/test_alembic.py tests/test_esquema_inicial.py tests/test_instalacion_limpia.py -q
Remove-Item Env:TEST_POSTGRES_URL
```

La prueba de instalación crea un esquema temporal vacío, ejecuta los dos comandos `init_db` en procesos nuevos y prueba altas, tres logins, solicitud, aprobación, reserva auditada y rechazo de día no aprobado mediante la API real en `TestClient`. Usa exclusivamente datos ficticios y contraseñas aleatorias de prueba; elimina su esquema al terminar y no envía correos. No verifica automáticamente el navegador: para eso seguir 7.2.

Desde `frontend/`:

```powershell
npm test -- --watch=false
npm run build
```

Vitest está limitado a un worker para reducir consumo de memoria. Los resultados de la última ronda, la prueba real en navegador y el inventario actualizado de archivos están en [CIERRE_ENTREGA.md](#cierre-entrega). Las pruebas PostgreSQL se ejecutaron sobre bases temporales; la suite ordinaria omite integraciones sin su URL de prueba.

<a id="guia-instalacion--8-que-entregar-y-que-conservar-en-privado"></a>
##### 8. Qué entregar y qué conservar en privado

Entregar código fuente, `PLAN_DE_MEJORAS.md`, README, evidencias de `docs/evidencias/`, requisitos Python, **`backend/alembic/` completo y `backend/alembic.ini`**, archivos de configuración frontend y lockfile npm, tests y `backend/.env.example`. **No entregar `backend/.env`, dumps, archivos `.db`/`.sqlite`, respaldos, credenciales, entornos virtuales, `node_modules`, cachés o exportaciones clínicas.** `.gitignore` ya excluye `.env`, entornos y dependencias; si se arma un ZIP copiando carpetas manualmente, revisar igualmente su contenido porque `.gitignore` no filtra un ZIP.

La base PostgreSQL local vive en el servicio PostgreSQL de la máquina del autor, no dentro del código. No exportarla ni incluirla: su ausencia es parte del diseño de esta entrega y no impide la instalación descrita. No hace falta ningún `.sql` ni script de migración. `backend/scripts/migrar_passwords_texto_plano.py` es mantenimiento para datos históricos y **no se ejecuta en una instalación limpia**.

La verificación de esta entrega se ejecutó también sobre una **base PostgreSQL 17 nueva y temporal**, eliminada al finalizar: esquema completo, superadmin, profesional/especialidad, alumno, logins, bloques pendientes/aprobados y cita auditada funcionaron sin parches. No se copiaron ni consultaron registros de la base local del autor.

<a id="guia-instalacion--9-archivos-de-esta-preparacion-de-entrega"></a>
##### 9. Archivos de esta preparación de entrega

Esta sección lista la ronda inicial de preparación; la ronda posterior de correcciones se detalla en [CIERRE_ENTREGA.md](#cierre-entrega). Para actualizar tu BD histórica sin reconstruirla, consultar [MIGRACIONES.md](#guia-migraciones). Antes de datos clínicos reales, cumplir [DATOS_SENSIBLES.md](#datos-sensibles).

Nuevos:

- `docs/INSTALACION.md`
- `backend/tests/test_alta_estudiantes.py`
- `backend/tests/test_instalacion_limpia.py`

Modificados:

- `README.md`
- `CHANGELOG_TECNICO.md`
- `backend/.env.example`
- `backend/app/schemas.py`
- `backend/app/routers/admin.py`
- `backend/tests/test_rbac_fase3_5a.py`
- `frontend/src/app/config.ts`
- `frontend/vitest.config.ts`

La ronda inicial no añadió dependencias. Posteriormente se incorporó **Alembic 1.20.1** y su historial como parte del flujo activo; ver el inventario y resultados en [CIERRE_ALEMBIC.md](#cierre-alembic). Las herramientas temporales de comprobación no son necesarias para instalar.

<a id="guia-migraciones"></a>

### 10.2. Migraciones, respaldo y reversión

> Origen consolidado: `docs/MIGRACIONES.md`.

<a id="guia-migraciones--migraciones-activas-con-alembic"></a>
#### Migraciones activas con Alembic

Alembic está instalado y operativo. La revisión base es **`253cae9c234a`** y se encuentra en `backend/alembic/versions/253cae9c234a_esquema_base.py`. Esta guía sustituye el plan de incorporación y los ajustes SQL manuales documentados en rondas anteriores.

<a id="guia-migraciones--1-fuente-de-verdad-y-configuracion"></a>
##### 1. Fuente de verdad y configuración

- Los modelos describen el estado deseado mediante `Base.metadata`.
- **El historial Alembic es la única vía de creación/actualización del esquema de la aplicación.** `python -m app.init_db` ejecuta internamente `alembic upgrade head`; ya no utiliza `Base.metadata.create_all`.
- `backend/alembic/env.py` importa `app.models.init` y establece `target_metadata = Base.metadata`. La conexión se toma de `DATABASE_URL` del proceso o `backend/.env`, igual que la app. Una variable de proceso tiene prioridad sobre `.env`.
- `backend/alembic.ini` no contiene URL ni credenciales. Las rutas usan la ubicación del archivo y no dependen de la carpeta desde la que se llame al inicializador.
- `alembic==1.20.1` está fijado en `backend/requirements.txt`; funciona con SQLAlchemy 2.0.50 y Python 3.13 del proyecto. No existe `requirements-dev.txt`. Mako y MarkupSafe se instalan como dependencias transitivas obligatorias de Alembic, no como nuevas dependencias funcionales de SESAES.

La revisión base fue generada con `revision --autogenerate -m "esquema base"` **sobre PostgreSQL vacío**, no sobre la base de trabajo. Sus operaciones están congeladas: no llaman a modelos dinámicos ni a `create_all`. Se revisaron tablas, columnas, PK, FK, CHECK, unicidades, índices y defaults. Los `now()` se expresaron como `sa.func.now()` para conservar PostgreSQL y las pruebas SQLite sin cambiar el esquema de producción.

Los defaults Python/ORM y `onupdate` del lado cliente permanecen en los modelos; no se transformaron en defaults/triggers de servidor inexistentes en el esquema anterior.

<a id="guia-migraciones--2-instalar-sobre-una-base-nueva"></a>
##### 2. Instalar sobre una base nueva

Desde PowerShell 7, situado en `backend/`:

```powershell
.\venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
# Configurar DATABASE_URL y JWT_SECRET_KEY propios en backend/.env.
$env:SEED_DEMO_DATA = 'false'
python -m alembic upgrade head
python -m alembic current
python -m alembic check
python -m scripts.auditar_esquema
```

`current` debe mostrar `253cae9c234a (head)`. El auditor estructural debe mostrar listas/mapas de diferencias vacíos. `alembic check` compara metadatos para los elementos que autogenerate reconoce; no sustituye revisar CHECK ni otros cambios no detectados por esa herramienta.

El atajo equivalente es:

```powershell
python -m app.init_db
```

Ese comando aplica las mismas revisiones. Con seed desactivado no crea usuarios ni superadmin. Repetir el upgrade sobre `head` no recrea tablas ni datos. La tabla adicional `alembic_version` conserva la revisión aplicada; no es un dato de paciente.

El seed demo y el bootstrap siguen separados del esquema. Un `alembic upgrade head` **nunca siembra usuarios**. Para seed demo se exige opt-in y contraseña externa; para el primer superadmin se exige el bootstrap explícito. Como el seed se omite si ya existen usuarios, una defensa con opción A debe sembrar antes de crear el primer superadmin. Los detalles están en [INSTALACION.md](#guia-instalacion).

<a id="guia-migraciones--3-crear-y-revisar-una-migracion-futura"></a>
##### 3. Crear y revisar una migración futura

1. Trabajar en una rama y sobre PostgreSQL **de desarrollo/pruebas**, nunca usando la base histórica como referencia de autogenerate.
2. Llevar esa base a `head` y comprobar `python -m alembic check` antes de editar el modelo.
3. Modificar el modelo SQLAlchemy y generar una revisión:

```powershell
python -m alembic revision --autogenerate -m "descripcion del cambio"
```

4. Revisar manualmente **upgrade y downgrade** del nuevo archivo en `alembic/versions/`. No aceptar drops inesperados, renombres inferidos como borrado/alta, constraints omitidos ni backfills que inventen datos clínicos.
5. Probar en una base desechable: upgrade desde vacío hasta head, upgrade desde la revisión previa con datos ficticios y reversión cuando sea segura.
6. Versionar modelo, revisión y pruebas en el mismo cambio. Aplicar en despliegue durante una ventana controlada y con backup verificado.

Ejemplo **ficticio, no añadido al esquema**: agregar una referencia externa opcional a una cita. Tras añadir la columna al modelo, generar:

```powershell
python -m alembic revision --autogenerate -m "agregar referencia externa opcional a cita"
```

Revisar que la nueva revisión contenga únicamente el cambio esperado:

```python
def upgrade():
    op.add_column('cita', sa.Column('referencia_externa', sa.String(), nullable=True))

def downgrade():
    op.drop_column('cita', 'referencia_externa')
```

Para revisar el SQL de una revisión incremental antes de aplicarla:

```powershell
python -m alembic upgrade REVISION_ANTERIOR:REVISION_NUEVA --sql
python -m alembic upgrade head
python -m alembic current
python -m alembic check
```

Sustituir los dos identificadores por los reales. `upgrade head --sql` desde base imprime todo el historial, no solo la diferencia con la BD conectada. El modo SQL no ejecuta las sentencias.

Autogenerate no decide la intención de renombres ni las migraciones de datos, y puede omitir cambios de CHECK u otros objetos. Un campo NOT NULL nuevo debe añadirse por fases cuando haya datos históricos: nullable, backfill autorizado, comprobación y restricción. Revisar locks, tiempos y tamaños de tablas.

**No añadir scripts de esquema `scripts/migrar_*.py`, no usar `create_all` para arreglar drift y no ejecutar ALTER sueltos sin una revisión versionada.** `scripts/auditar_esquema.py` es diagnóstico de solo lectura; la herramienta histórica de contraseñas es mantenimiento de datos, no un mecanismo de migración de esquema.

<a id="guia-migraciones--4-revertir-y-recuperar"></a>
##### 4. Revertir y recuperar

Solo en una copia/base descartable, después de revisar qué datos se pierden:

```powershell
python -m alembic downgrade -1
python -m alembic current
```

Para probar la revisión base sobre una base **vacía de datos de trabajo**:

```powershell
python -m alembic downgrade base
python -m alembic upgrade head
```

El downgrade base elimina las **26 tablas de aplicación**, índices y constraints en orden inverso de dependencias. **Borra sus datos si existen**: no es un rollback de pacientes ni un sustituto del backup. Alembic conserva su tabla `alembic_version` sin filas; la aplicación queda sin tablas. Este comportamiento fue comprobado y luego se repitió el upgrade correctamente.

Antes de un despliegue que altere datos, detener escrituras y crear un backup fuera del repo. Ejemplo con las variables libpq de la base explícitamente seleccionada:

```powershell
# PGHOST, PGPORT, PGUSER y PGDATABASE deben identificar la BD a respaldar.
$dirBackup = Join-Path $env:USERPROFILE 'RespaldosSESAES'
New-Item -ItemType Directory -Path $dirBackup -Force | Out-Null
$backup = Join-Path $dirBackup ('sesaes_' + (Get-Date -Format 'yyyyMMdd_HHmmss') + '.dump')
pg_dump -W --format=custom --file=$backup
if ($LASTEXITCODE -ne 0) { throw 'Backup fallido: no migrar.' }
pg_restore --list $backup
if ($LASTEXITCODE -ne 0) { throw 'Backup ilegible: no migrar.' }
```

Verificar también una restauración de ensayo. Ante un fallo de DDL en PostgreSQL, la transacción de migración revierte lo no confirmado. Después de un cambio confirmado que perdió datos, restaurar el backup a **otra base** y validarla antes de cambiar `DATABASE_URL`; no usar `--clean` sobre la única original. Downgrade de columnas no recupera contenido eliminado. En producción suele ser preferible una corrección hacia adelante.

<a id="guia-migraciones--5-la-base-historica-no-se-adopta-automaticamente"></a>
##### 5. La base histórica no se adopta automáticamente

La inspección previa detectó diferencias en la base de trabajo. **No se migró, no se estampó, no se renombró y no se cambió su conexión en esta Parte 1.** La creación de una base local de defensa y su backup son Parte 2, pendiente del cierre por etapas solicitado.

Si se intenta iniciar la app o ejecutar Alembic sobre tablas SESAES **sin `alembic_version` válida**, el entorno se detiene con un error explícito **antes de ejecutar DDL**. Esto evita confundir `upgrade head` con una adopción segura del esquema antiguo. Mientras `.env` siga apuntando a esa base, no se debe esperar que la API nueva arranque sobre ella; hay que completar la Parte 2 y cambiar la conexión a la base nueva.

No ejecutar `alembic stamp head` a ciegas: no crea ni corrige columnas, defaults, índices o datos. La adopción de una base histórica necesitaría un procedimiento separado de reconciliación sobre copia, equivalencia completa y un mecanismo explícito de adopción revisado; queda fuera de este cambio porque el usuario ordenó conservarla intacta.

<a id="guia-migraciones--6-verificacion-reproducible"></a>
##### 6. Verificación reproducible

```powershell
# TEST_POSTGRES_URL debe apuntar a una base PostgreSQL de pruebas separada.
python -m pytest tests/test_alembic.py tests/test_esquema_inicial.py tests/test_instalacion_limpia.py -q
python -m pytest -q
```

La prueba PostgreSQL crea tres esquemas temporales dentro de la base de pruebas: referencia independiente con modelos, CLI `alembic upgrade head` e inicializador. Compara estructura física completa: columnas/tipos/nulabilidad/defaults, PK/FK, CHECK, unicidades e índices, ignorando solo el nombre aleatorio del esquema y la tabla de control Alembic. Comprueba el auditor sin diferencias, `alembic check`, downgrade, tabla de control sin filas y nuevo upgrade. Los esquemas de ensayo se eliminan al finalizar.

En esta Parte 1 se ejecutó además contra una **base PostgreSQL nueva descartable**, eliminada tras los ocho casos de migración/esquema/instalación. Las pruebas SQLite protegen seed, rollback y rechazo de bases sin versión; no sustituyen la comprobación del motor PostgreSQL.

Referencias de mantenimiento: [documentación oficial de Alembic](https://alembic.sqlalchemy.org/en/latest/), [compatibilidad e instalación](https://alembic.sqlalchemy.org/en/latest/front.html), [límites de autogenerate](https://alembic.sqlalchemy.org/en/latest/autogenerate.html).

<a id="cierre-alembic"></a>

### 10.3. Alembic, base de defensa y demo de horario en vivo

> Origen consolidado: `docs/CIERRE_ALEMBIC.md`.

<a id="cierre-alembic--cierre-alembic--fase-5b-completada"></a>
#### Cierre Alembic — Fase 5B completada

Actualizado el **15 de noviembre de 2026**. La Parte 1 dejó Alembic instalado y verificado. Después de la autorización del responsable se preparó la base local de defensa y, en la Fase 5B, se recreó con el seed institucional uniforme descrito aquí. La revisión sigue siendo `253cae9c234a`: esta fase no añade migraciones ni cambia el esquema.

<a id="cierre-alembic--estado-por-etapa"></a>
##### Estado por etapa

| Elemento | Estado real |
|---|---|
| Alembic instalado | **1.20.1**, compatible con SQLAlchemy 2.0.50 y Python 3.13.2 |
| Revisión base | **`253cae9c234a`**, generada mediante autogenerate contra PostgreSQL vacío |
| Equivalencia con modelos y antiguo esquema `create_all` | **Verificada**, sin diferencias estructurales |
| `python -m app.init_db` | Delega en Alembic upgrade head; ya no crea tablas directamente |
| Downgrade y nuevo upgrade | **Verificados** en PostgreSQL y SQLite de prueba |
| Base local de defensa | **`sesaes_defensa_v2` recreada**, esquema generado con Alembic |
| Superadmin listo para defensa | **Creado, activo y login verificado**, mediante bootstrap existente |
| Seed demo de defensa | **11 usuarios demo + superadmin**, 6 profesionales y 90 bloques semanales |
| Conexión local | `backend/.env` ya apunta a la base de defensa; no se modificó en la Fase 5B |
| Backup previo a Fase 5B | **Creado y verificado** con `pg_restore --list`, fuera del repo |
| Base de trabajo anterior | **`sesaes_old_backup` intacta**; no se conectó a su contenido ni se modificó en la Fase 5B |
| Credenciales de defensa | **Nuevas y distintas de las anteriores**, entregadas únicamente en el chat; ausentes de documentación y archivos |

Las cuentas de las pruebas de instalación de la Parte 1 fueron ficticias y temporales. Las cuentas demo de `sesaes_defensa_v2` son también ficticias, pero permanecen disponibles para la defensa. Ningún registro de la base histórica se trasladó a esta base nueva.

<a id="cierre-alembic--fase-5b-seed-institucional-y-recreacion-local"></a>
##### Fase 5B: seed institucional y recreación local

Se modificó únicamente el seed existente dentro de `app/init_db.py`: los seis profesionales reciben `duracion_min=60`. El default del modelo `Profesional` **permanece en 45**. Cada profesional tiene 15 bloques aprobados, tres por día, sin variaciones entre profesionales:

| Días | Disponible | Colación explícita | Disponible |
|---|---|---|---|
| Lunes a jueves | 09:00–13:00 | 13:00–14:00 | 14:00–17:30 |
| Viernes | 09:00–13:00 | 13:00–14:00 | 14:00–16:30 |

Total: **90 bloques: 60 disponibles y 30 de colación**. La colación 13:00–14:00 es una decisión para estos datos demo. No se introdujo una regla de colación automática. El motor vigente considera los intervalos completos de las citas, por lo que no ofrece citas que invadan esa colación ni que terminen después del bloque aprobado. Con duración de 60 minutos, antes de ocupación/cierres, las horas son:

- Lunes a jueves: **09:00, 10:00, 11:00, 12:00, 14:00, 15:00 y 16:00**.
- Viernes: **09:00, 10:00, 11:00, 12:00, 14:00 y 15:00**.
- El tramo final de media hora forma parte del bloque aprobado, pero no permite una cita completa de 60 minutos.

El seed sigue creando 4 estudiantes, 6 usuarios profesionales asociados a sus 6 profesionales/especialidades y 1 admin. El bootstrap existente añade después el superadmin: **12 usuarios en total**. El seed no crea citas ni configura permisos administrativos por sí mismo. Para permitir la demostración del admin se configuró su acceso mediante el endpoint existente y autenticado `PUT /usuarios/administradores/{id}/acceso-administrativo`: perfil `administrador_general`, alcance institucional y permisos `usuarios.ver`, `usuarios.gestionar`, `profesionales.ver`, `profesionales.gestionar`, `agenda.ver`, `agenda.gestionar` y `reportes.ver`. No se modificó RBAC.

<a id="cierre-alembic--respaldo-y-ejecucion-realizados"></a>
###### Respaldo y ejecución realizados

1. Se detuvo el servidor Uvicorn que mantenía conexiones a la base de defensa. Se comprobó ausencia de conexiones antes del respaldo y del DROP.
2. Se creó el dump privado **`%USERPROFILE%\RespaldosSESAES\sesaes_defensa_v2_pre_5b_20261115_225615.dump`**, de 93.386 bytes, y se verificó con `pg_restore --list` antes de borrar la base.
3. Se ejecutó `DROP DATABASE sesaes_defensa_v2` y se recreó vacía. La base anterior de defensa tenía OID 1028119 y la nueva tiene OID 1028553.
4. Se ejecutó `python -m alembic upgrade head`.
5. Con variables temporales y contraseña externa nueva, se ejecutó **primero** `SEED_DEMO_DATA=true` + `python -m app.init_db`. Después se desactivó el seed y se ejecutó `python -m app.init_db --superadmin` con sus variables temporales y otra contraseña nueva. Se retiraron las variables de contraseña/bootstrap de los entornos de ejecución.
6. Se repitieron `init_db` y `upgrade head` sin duplicar ni romper datos. El auditor dejó vacías todas sus listas/mapas de diferencias.
7. Se inició Uvicorn en `127.0.0.1:8080`; Angular en `http://localhost:4200` usa la API local `http://localhost:8080`. La API de demostración se ejecuta con SMTP vacío para evitar correos externos.

Solo se recreó la base de defensa. **No se tocó `sesaes_old_backup`**: se comprobó desde el catálogo de PostgreSQL que mantiene su OID 939083; no se ejecutaron migraciones, lecturas de registros ni operaciones de escritura en ella. El backup histórico previo también permanece fuera del repo. Ni esta base histórica ni sus dumps forman parte de la entrega del código.

<a id="cierre-alembic--evidencia-de-la-fase-5b"></a>
###### Evidencia de la Fase 5B

- Backend completo: **1.557 aprobadas, 13 omitidas y 20 subtests aprobados**. El test `test_seed_true_con_password_crea_seed_esperado` conserva la comprobación de 11 usuarios y añade cantidades, duración, pertenencia, días y rangos exactos de los bloques de cada profesional. No se eliminó ni debilitó ningún test.
- Angular completo, repetido después del cambio: **974 aprobadas en 53 archivos**, sin modificar archivos frontend.
- Los cuatro roles iniciaron sesión por API. El admin pudo consultar profesionales, alumnos y agenda; el profesional pudo consultar su agenda; el superadmin configuró el acceso del admin mediante la API existente.
- Se comprobaron en PostgreSQL los 90 bloques exactos y la duración de 60 de los seis profesionales. El default del modelo se verificó en 45.
- Desde el navegador, la alumna demo vio **60 min**, las siete horas hábiles del lunes sin 13:00, y fines de semana deshabilitados. Reservó con Ana Martínez el **lunes 16 de noviembre de 2026 a las 09:00**. La cita quedó `pendiente`, con duración efectiva de 60 minutos y su evento de auditoría.
- La reserva aparece en **Mis citas**. Se reemplazó la captura con la nueva base: [defensa-mis-citas.png](docs/evidencias/defensa-mis-citas.png).
- Al cerrar hay **90 bloques y ninguna solicitud de cambio de horario**. No se ejecutó el cambio a martes/jueves, para conservar el estado inicial uniforme que se mostrará en vivo.

Credenciales de superadmin y demo: entregadas por canal privado al responsable del proyecto. Rotar antes de cualquier uso real. Las claves no se guardaron en archivos, documentación ni salidas de consola.

<a id="cierre-alembic--archivos-de-la-fase-5b"></a>
###### Archivos de la Fase 5B

- `backend/app/init_db.py`: solo datos/configuración del seed existente.
- `backend/tests/test_sa0_seed_seguridad.py`: ampliación del test indicado.
- `docs/CIERRE_ALEMBIC.md`: cierre actual y guía de demostración.
- `docs/evidencias/defensa-mis-citas.png`: captura reemplazada.

No se crearon scripts temporales, rutas, endpoints, modelos, formularios, dependencias ni migraciones. Se utilizaron comandos directos y las CLI/API ya existentes. `backend/.env` no cambió en esta fase.

<a id="cierre-alembic--que-se-implemento"></a>
##### Qué se implementó

1. Se añadió únicamente la dependencia directa `alembic==1.20.1` a `backend/requirements.txt`; no existe `requirements-dev.txt`. Su instalación trae Mako y MarkupSafe como dependencias transitivas obligatorias. `pip check` no informa incompatibilidades.
2. Se inicializó `backend/alembic/`. `alembic.ini` no guarda URL ni contraseña; `env.py` lee la misma variable `DATABASE_URL` y el mismo `backend/.env` que la aplicación, registra `app.models.init` y usa `target_metadata = Base.metadata`.
3. Se ejecutó realmente `python -m alembic revision --autogenerate -m "esquema base"` sobre una base PostgreSQL nueva y descartable. La revisión se inspeccionó y se corrigió el render de defaults `now()` a `sa.func.now()` para mantener también la compatibilidad SQLite de las pruebas. Se conservaron todos los objetos actuales, sin backfills ni datos iniciales dentro de la revisión.
4. `app/migrations.py` comparte la conexión/transacción del motor con Alembic. `init_db` aplica el historial y después mantiene el seed opt-in y el bootstrap explícito; `alembic upgrade head` por sí solo no siembra cuentas.
5. Una base SESAES existente sin revisión Alembic válida se rechaza **antes de ejecutar DDL**. No se intenta adoptar automáticamente la base histórica ni ocultar sus diferencias con `stamp`.

<a id="cierre-alembic--revision-manual-del-archivo-base"></a>
##### Revisión manual del archivo base

La revisión `backend/alembic/versions/253cae9c234a_esquema_base.py` **no se aceptó solamente por haber sido autogenerada**. Se leyó completo su `upgrade()` y su `downgrade()` y se contrastaron las declaraciones con los modelos. Esta comprobación se reiteró ante la consulta de cierre del responsable del proyecto.

- Los **6 CHECK** están escritos explícitamente en la revisión, con sus expresiones y nombres: tres de perfil/alcance administrativo, dos de especialidades no vacías y uno de permisos administrativos válidos.
- Se conservaron los nombres explícitos de restricciones UNIQUE e índices. Las PK, FK y la unicidad de `cita_sobrecupo.cita_id` que no tienen nombre explícito en los modelos tampoco lo reciben artificialmente en la revisión: PostgreSQL les asigna sus nombres. La comparación física previa incluye los nombres reflejados de las restricciones.
- Se revisaron los **40 índices**, incluidos los **4 únicos**, y los índices compuestos de citas y auditoría. **Los modelos actuales no declaran índices parciales** (`postgresql_where`/`sqlite_where`); no existe un predicado pendiente de trasladar a esta revisión. El índice de agenda sigue siendo no único para admitir sobrecupos autorizados.
- Se comprobaron las FK y sus opciones `CASCADE`/`RESTRICT`, los tipos, la nulabilidad y los defaults de servidor. La corrección manual de `sa.text('now()')` a `sa.func.now()` conserva el default PostgreSQL y permite ejecutar las pruebas SQLite. Los `default=` y `onupdate=` del ORM siguen perteneciendo a los modelos; no se convirtieron en defaults ni triggers de servidor inexistentes.
- Se verificó que el downgrade retire índices y tablas en orden inverso de dependencias, y que la revisión sea autónoma: no importa modelos actuales ni ejecuta `create_all` ni seeds.

No se encontraron omisiones adicionales en esta revisión manual. Esta lectura complementa la comparación física y las pruebas PostgreSQL descritas a continuación; no se usa `alembic check` como única garantía sobre CHECK o nombres de constraints. En esta comprobación de cierre solo se amplió este documento: no se cambió el DDL de la revisión ni se intervino ninguna base de datos.

<a id="cierre-alembic--evidencia-de-equivalencia-y-reversion"></a>
##### Evidencia de equivalencia y reversión

Se ejecutaron pruebas en una **base PostgreSQL 17 nueva y descartable**, distinta de la base local. Dentro de ella se crearon tres esquemas aislados:

- Referencia independiente: esquema producido directamente por los modelos, equivalente al `init_db` previo.
- Camino CLI: `python -m alembic upgrade head`.
- Camino de aplicación: nuevo `init_db`, que ejecuta el mismo historial.

La comparación usa introspección física, no solo que el comando termine sin error. Compara tablas, orden/nombre/tipo/nulabilidad/defaults de columnas, PK, FK, CHECK, restricciones UNIQUE e índices. Solo normaliza el nombre aleatorio de cada esquema y excluye de la comparación de aplicación la tabla de control `alembic_version`.

| Objeto del esquema de aplicación | Cantidad equivalente |
|---|---:|
| Tablas | 26 |
| Columnas | 185 |
| Índices | 40 |
| Índices únicos, incluidos en los 40 | 4 |
| Claves foráneas | 27 |
| CHECK | 6 |
| Restricciones UNIQUE, además de los índices únicos | 7 |

Se verificó además `alembic check`, el auditor sin diferencias, ausencia de usuarios al aplicar solo el esquema, downgrade y repetición del upgrade. La revisión preserva el índice de agenda **no único**, compatible con los sobrecupos, y las restricciones administrativas/auditoría existentes.

`downgrade base` elimina las 26 tablas de aplicación en orden inverso de dependencias. Alembic conserva **`alembic_version` vacía**, comportamiento normal del framework; no se presenta como ausencia literal de toda tabla. Este downgrade destruye los datos que contengan esas tablas: solo se ejecutó en pruebas descartables y nunca es sustituto de un backup.

<a id="cierre-alembic--resultados-de-pruebas"></a>
##### Resultados de pruebas

- Suite backend completa: **1.557 aprobadas, 13 omitidas por configuración de integración y 14 subtests aprobados**. No se eliminaron pruebas. El caso que preparaba un esquema sin versión mediante `create_all` se adaptó a preparar un esquema migrado; las aserciones de seed/idempotencia se conservaron.
- PostgreSQL nuevo, suite focal `test_alembic.py`, `test_esquema_inicial.py` y `test_instalacion_limpia.py`: **8 aprobadas**. Incluye la equivalencia de los tres caminos, downgrade/re-upgrade y recorrido CLI/API con cuentas ficticias temporales.
- Angular: **974 aprobadas en 53 archivos**.
- `npm run build`: **correcto**. Persisten únicamente las advertencias CSS anteriores: dashboard profesional 60,12 kB y administrativo 69,62 kB, frente a advertencia de 50 kB y error de 100 kB.
- `pip check`: **sin dependencias rotas**.

Durante la verificación Angular se cruzó medianoche UTC mientras aún era el día anterior en Chile. Tres archivos de fixtures usaban `toISOString()` como “hoy”, aunque la aplicación compara fecha local. Se corrigieron para usar la utilidad local existente `fechaISOLocal`. No se cambió la lógica de producción frontend ni se eliminaron casos; después pasaron las mismas 974 pruebas.

<a id="cierre-alembic--comandos-reproducibles"></a>
##### Comandos reproducibles

Desde PowerShell 7, en `backend/`, con el entorno virtual y una `DATABASE_URL` **de una base nueva o de pruebas**:

```powershell
.\venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
$env:SEED_DEMO_DATA = 'false'
python -m alembic upgrade head
python -m alembic current
python -m alembic check
python -m scripts.auditar_esquema
```

El atajo de instalación es `python -m app.init_db`. Ambos deben dejar `253cae9c234a` en head. No ejecutar este bloque contra la base histórica sin versión: se rechaza y esa adopción no forma parte de esta entrega.

Crear una migración futura, después de editar modelos y usando una base de desarrollo en head:

```powershell
python -m alembic revision --autogenerate -m "descripcion del cambio"
# Revisar el archivo generado antes de aplicar:
python -m alembic upgrade head
```

Reproducir la verificación PostgreSQL, con una base de pruebas separada:

```powershell
$env:TEST_POSTGRES_URL = Read-Host -MaskInput 'URL completa de la base PostgreSQL de pruebas'
python -m pytest tests/test_alembic.py tests/test_esquema_inicial.py tests/test_instalacion_limpia.py -q
Remove-Item Env:TEST_POSTGRES_URL
```

La instalación completa, incluidas cuentas reales o seed demo y bootstrap, sigue en [INSTALACION.md](#guia-instalacion). El desarrollo/reversión versionados están en [MIGRACIONES.md](#guia-migraciones).

<a id="cierre-alembic--reproducir-el-seed-y-bootstrap-en-otra-instalacion-vacia"></a>
##### Reproducir el seed y bootstrap en otra instalación vacía

No repetir `DROP` sobre la base preparada para practicar la demo. El seed no actualiza una base que ya tiene usuarios: para otra instalación se necesita una base nueva, creada siguiendo [INSTALACION.md](#guia-instalacion), y su `DATABASE_URL` configurada. Desde PowerShell 7 en `backend/`, con el entorno virtual activo:

```powershell
python -m alembic upgrade head
$env:SEED_DEMO_DATA = 'true'
$env:SEED_DEMO_PASSWORD = Read-Host -MaskInput 'Contraseña externa NUEVA para las cuentas demo'
try {
    python -m app.init_db
    if ($LASTEXITCODE -ne 0) { throw 'El seed no finalizó correctamente' }
} finally {
    $env:SEED_DEMO_DATA = 'false'
    Remove-Item Env:SEED_DEMO_PASSWORD -ErrorAction SilentlyContinue
}

$env:SUPERADMIN_BOOTSTRAP_EMAIL = Read-Host 'Correo del primer superadmin'
$env:SUPERADMIN_BOOTSTRAP_NAME = Read-Host 'Nombre del primer superadmin'
$env:SUPERADMIN_BOOTSTRAP_PASSWORD = Read-Host -MaskInput 'Contraseña NUEVA y diferente para el superadmin'
try {
    python -m app.init_db --superadmin
    if ($LASTEXITCODE -ne 0) { throw 'El bootstrap no finalizó correctamente' }
} finally {
    Remove-Item Env:SUPERADMIN_BOOTSTRAP_EMAIL, Env:SUPERADMIN_BOOTSTRAP_NAME, Env:SUPERADMIN_BOOTSTRAP_PASSWORD -ErrorAction SilentlyContinue
}
python -m alembic current
python -m scripts.auditar_esquema
```

El orden **seed primero, bootstrap después** es obligatorio en este recorrido porque el seed omite la carga cuando ya existe cualquier usuario. El esquema se genera exclusivamente con el historial Alembic; no se requiere ningún `.sql` ni parche manual. La configuración de permisos del admin se realiza con el endpoint existente descrito arriba y en la guía de instalación; crear su usuario mediante el seed no le concede permisos efectivos automáticamente.

<a id="cierre-alembic--demo-de-cambio-de-horario-en-vivo"></a>
##### Demo de cambio de horario en vivo

Este recorrido está **documentado para practicar/ejecutar durante la defensa**. No se aplicó a los bloques iniciales de la nueva base. Usa Roberto Fuentes, que no tiene citas al cierre, y Carlos Muñoz como alumno; así la cita de evidencia de María con Ana queda separada del ejemplo. Todo ocurre en la base local ficticia `sesaes_defensa_v2`.

<a id="cierre-alembic--1-mostrar-el-estado-inicial"></a>
###### 1. Mostrar el estado inicial

Abrir `http://localhost:4200`. Ingresar como Carlos Muñoz y abrir **Agendar cita → Psic. Roberto Fuentes → Agendar Cita → Elegir Una Fecha**. Dentro de los próximos siete días deberían estar habilitados los lunes a viernes con cupos. Fines de semana, fechas fuera de ventana, feriados/cierres y días sin cupos no se habilitan. Las horas de colación no aparecen como disponibles.

Los bloques iniciales de Roberto son los 15 de la tabla institucional anterior, igual que los otros cinco profesionales. No reservar todavía: mostrar primero el calendario. Para hacer la solicitud y aprobación con requests reproducibles, abrir PowerShell 7 y mantener las siguientes variables únicamente en esa sesión. La API debe estar ejecutándose en el puerto 8080.

<a id="cierre-alembic--2-el-profesional-solicita-solo-martes-y-jueves-09001300"></a>
###### 2. El profesional solicita solo martes y jueves 09:00–13:00

```powershell
$api = 'http://localhost:8080'
$sesionPro = Invoke-RestMethod -Method Post -Uri "$api/login" -ContentType 'application/json' -Body (@{
    correo = 'roberto.fuentes@utem.cl'
    password = (Read-Host -MaskInput 'Clave demo del profesional')
} | ConvertTo-Json)
$authPro = @{ Authorization = "Bearer $($sesionPro.access_token)" }
$profesional = Invoke-RestMethod -Uri "$api/profesional/buscar-por-usuario/$($sesionPro.id)" -Headers $authPro
$profId = $profesional.id

$nuevoHorario = @{
    bloques = @(
        @{ dia_semana = 1; hora_inicio = '09:00'; hora_fin = '13:00'; tipo = 'disponible' }
        @{ dia_semana = 3; hora_inicio = '09:00'; hora_fin = '13:00'; tipo = 'disponible' }
    )
}
Invoke-RestMethod -Method Post -Uri "$api/profesional/$profId/solicitar-bloques-horario" -Headers $authPro -ContentType 'application/json' -Body ($nuevoHorario | ConvertTo-Json -Depth 5)
$solicitudes = Invoke-RestMethod -Uri "$api/profesional/$profId/solicitudes-horario" -Headers $authPro
$solicitud = $solicitudes | Where-Object { $_.tipo -eq 'bloques' -and $_.estado -eq 'pendiente' } | Select-Object -First 1
if (-not $solicitud) { throw 'No se encontró la solicitud de bloques pendiente' }
$solicitudId = $solicitud.id
```

Los días se numeran desde cero: **1=martes, 3=jueves**. Esta solicitud no incluye colación porque termina a las 13:00 y no hay atención posterior. **Mientras está pendiente, el alumno sigue viendo la semana aprobada anterior**. La solicitud por sí sola no cambia los bloques vigentes.

<a id="cierre-alembic--3-el-administrador-aprueba-el-cambio"></a>
###### 3. El administrador aprueba el cambio

En la interfaz, cerrar la sesión del alumno, ingresar como admin, abrir **Agenda** y localizar a Roberto en **Solicitudes de horario pendientes**; pulsar **Aprobar**. El superadmin también puede hacerlo. Para ejecutar el mismo paso por API en la sesión PowerShell anterior:

```powershell
$sesionAdmin = Invoke-RestMethod -Method Post -Uri "$api/login" -ContentType 'application/json' -Body (@{
    correo = 'admin@utem.cl'
    password = (Read-Host -MaskInput 'Clave demo del administrador')
} | ConvertTo-Json)
$authAdmin = @{ Authorization = "Bearer $($sesionAdmin.access_token)" }
Invoke-RestMethod -Method Patch -Uri "$api/admin/solicitudes-horario/$solicitudId/aprobar" -Headers $authAdmin
```

Elegir **una** de las dos vías de aprobación: UI o API. Intentar aprobar la misma solicitud dos veces devuelve error porque ya está resuelta. El admin preparado tiene `agenda.gestionar` y alcance institucional; un admin sin esa configuración no puede aprobar.

<a id="cierre-alembic--4-mostrar-el-cambio-al-alumno"></a>
###### 4. Mostrar el cambio al alumno

Ingresar nuevamente como Carlos Muñoz y volver a **Agendar cita → Roberto Fuentes → Elegir Una Fecha**. Si ya estaba abierto ese selector, salir y volver a elegir el profesional para consultar nuevamente la disponibilidad.

Ahora **solo martes y jueves** deben aparecer habilitados dentro de la ventana y mientras tengan cupos. Lunes, miércoles y viernes quedan bloqueados; los fines de semana siguen bloqueados. Cada día habilitado ofrece **09:00, 10:00, 11:00 y 12:00**, descontando las horas ocupadas. Un cierre institucional o falta total de cupos puede bloquear también un martes/jueves.

Para comprobar el mismo resultado por API:

```powershell
$sesionAlumno = Invoke-RestMethod -Method Post -Uri "$api/login" -ContentType 'application/json' -Body (@{
    correo = 'carlos.munoz@utem.cl'
    password = (Read-Host -MaskInput 'Clave demo del alumno')
} | ConvertTo-Json)
$authAlumno = @{ Authorization = "Bearer $($sesionAlumno.access_token)" }
$calendario = Invoke-RestMethod -Uri "$api/disponibilidad/$profId/calendario" -Headers $authAlumno
$calendario.fechas
```

Finalmente, elegir una fecha habilitada y reservar desde el portal; comprobarla en **Mis citas**. La disponibilidad se calcula en cada consulta: no usar fechas fijas antiguas durante la defensa. Después de reservar, para seguir mostrando el selector puede utilizarse otro alumno demo si la política de una cita futura por especialidad impide una segunda reserva.

<a id="cierre-alembic--5-explicar-y-restaurar-la-semana-completa-para-otra-practica"></a>
###### 5. Explicar y restaurar la semana completa para otra práctica

**Aprobar reemplaza toda la semana**, no suma bloques. El endpoint elimina los bloques anteriores de ese profesional e inserta el paquete completo aprobado, con auditoría y notificación interna. Por eso desaparecen lunes, miércoles y viernes. Los otros cinco profesionales conservan sus horarios.

Para recuperar el estado inicial sin tocar SQL ni volver a sembrar, enviar otra solicitud del mismo profesional con sus **15 bloques** y aprobarla siguiendo los pasos 2 y 3. En la sesión PowerShell anterior:

```powershell
$semanaCompleta = @{
    bloques = @(
        for ($diaDemo = 0; $diaDemo -lt 5; $diaDemo++) {
            @{ dia_semana = $diaDemo; hora_inicio = '09:00'; hora_fin = '13:00'; tipo = 'disponible' }
            @{ dia_semana = $diaDemo; hora_inicio = '13:00'; hora_fin = '14:00'; tipo = 'colacion' }
            @{ dia_semana = $diaDemo; hora_inicio = '14:00'; hora_fin = $(if ($diaDemo -eq 4) { '16:30' } else { '17:30' }); tipo = 'disponible' }
        }
    )
}
Invoke-RestMethod -Method Post -Uri "$api/profesional/$profId/solicitar-bloques-horario" -Headers $authPro -ContentType 'application/json' -Body ($semanaCompleta | ConvertTo-Json -Depth 5)
$solicitudes = Invoke-RestMethod -Uri "$api/profesional/$profId/solicitudes-horario" -Headers $authPro
$solicitud = $solicitudes | Where-Object { $_.tipo -eq 'bloques' -and $_.estado -eq 'pendiente' } | Select-Object -First 1
if (-not $solicitud) { throw 'No se encontró la solicitud de restauración' }
Invoke-RestMethod -Method Patch -Uri "$api/admin/solicitudes-horario/$($solicitud.id)/aprobar" -Headers $authAdmin
Remove-Variable sesionPro, sesionAdmin, sesionAlumno, authPro, authAdmin, authAlumno -ErrorAction SilentlyContinue
```

Si el token expiró, volver a iniciar sesión antes del request correspondiente. La restauración del horario no elimina citas previamente creadas durante una práctica. El seed nunca debe utilizarse como mecanismo para editar horarios ya existentes.

<a id="cierre-alembic--archivos-de-la-parte-1-historico"></a>
##### Archivos de la Parte 1 (histórico)

Nuevos:

- `backend/alembic.ini`
- `backend/alembic/env.py`
- `backend/alembic/script.py.mako`
- `backend/alembic/README.md`
- `backend/alembic/versions/253cae9c234a_esquema_base.py`
- `backend/app/migrations.py`
- `backend/tests/test_alembic.py`
- `docs/CIERRE_ALEMBIC.md`

Modificados:

- `backend/requirements.txt`
- `backend/app/database.py`
- `backend/app/init_db.py`
- `backend/app/bootstrap_superadmin.py` — documentación de esquema
- `backend/app/models/init.py` — documentación del registro
- `backend/app/models/especialidad_capability.py` — documentación de esquema
- `backend/app/models/solicitud_bloques.py` — documentación de esquema
- `backend/tests/test_esquema_inicial.py`
- `backend/tests/test_sa0_seed_seguridad.py`
- `frontend/src/app/dashboard-admin/citas/admin-citas.spec.ts`
- `frontend/src/app/dashboard-profesional/dashboard-profesional-inicio.spec.ts`
- `frontend/src/app/dashboard-profesional/dashboard-profesional-inicio-diseno.spec.ts`
- `README.md`
- `PLAN_DE_MEJORAS.md`
- `CHANGELOG_TECNICO.md`
- `docs/INSTALACION.md`
- `docs/MIGRACIONES.md`
- `docs/CIERRE_ENTREGA.md`

No se eliminó ningún test. Las herramientas temporales de autogeneración y comprobación se retiraron al finalizar. Esta copia sigue sin `.git`, por lo que no se presentan commits inventados.

<a id="cierre-entrega"></a>

### 10.4. Correcciones y verificaciones anteriores de entrega

> Origen consolidado: `docs/CIERRE_ENTREGA.md`.

<a id="cierre-entrega--cierre-de-correcciones-y-verificaciones-de-entrega"></a>
#### Cierre de correcciones y verificaciones de entrega

Revisión del **15 de noviembre de 2026**. Este documento responde la lista consolidada de once puntos y registra cambios reales. No se modificó ni reconstruyó la BD local de trabajo. Los datos de navegador fueron ficticios y se crearon en bases PostgreSQL temporales separadas, ya eliminadas.

**Actualización posterior:** Alembic ya está instalado y probado. Su flujo vigente y el cierre de la Parte 1 están en [CIERRE_ALEMBIC.md](#cierre-alembic) y [MIGRACIONES.md](#guia-migraciones). Los apartados siguientes conservan el registro de la ronda anterior.

<a id="cierre-entrega--1-bloqueante-contrasena-fija-eliminada"></a>
##### 1. Bloqueante: contraseña fija eliminada

Se eligió la **vía (a)**: conservar el formulario de alta profesional y añadir contraseña inicial y confirmación. Ambos campos parten vacíos, ocultan el texto y validan la misma política del backend: ocho caracteres como mínimo, mayúscula, minúscula, número y carácter especial, sin espacios; máximo 72 bytes UTF-8. La confirmación debe coincidir. Al cerrar el formulario se vacían ambos campos y la pantalla de confirmación no revela la clave.

Se eliminó la contraseña fija de la inicialización, el envío del formulario, la pantalla de confirmación, el mensaje de éxito y el fallback del backend. `POST /admin/profesionales` ahora rechaza una contraseña omitida o inválida con HTTP 422 antes de insertar. La validación del servidor es la autoridad y no se puede eludir enviando una request manual. El hash sigue siendo bcrypt y la contraseña no se incluye en la auditoría.

Archivos: `frontend/src/app/dashboard-admin/profesionales/admin-profesionales.ts`, su `.html`, `frontend/src/app/dashboard-admin/dashboard-admin.ts`, `backend/app/routers/admin.py`, `backend/app/schemas.py`. Hay pruebas nuevas de contraseña ausente/débil, política, hash, no filtrado de secretos, confirmación y limpieza del formulario. Los fixtures anteriores de alta profesional ahora proporcionan una contraseña propia de prueba.

<a id="cierre-entrega--2-alta-de-alumnos-decision-de-alcance"></a>
##### 2. Alta de alumnos: decisión de alcance

Se recomienda un formulario institucional de alumnos en una siguiente iteración, reutilizando `POST /admin/estudiantes`. **En esta entrega se eligió la vía (b), solo API**, para mantener la carga inicial acotada sin añadir una segunda interfaz administrativa sin revisión completa de UX. Es una limitación real y visible en [INSTALACION.md](#guia-instalacion): el panel consulta/edita alumnos, pero no tiene alta ni carga CSV.

La vía disponible y probada no requiere SQL: `POST /admin/estudiantes`, con contraseña explícita y permiso `usuarios.gestionar` de alcance institucional. El backend fija el rol a estudiante y audita la creación. Los ejemplos completos están en la guía. No se afirma que se haya implementado un formulario de alumnos.

<a id="cierre-entrega--3-especialidades"></a>
##### 3. Especialidades

Las listas dinámicas, filtros visuales, KPI y agrupaciones de reportes normalizan mayúsculas, diacríticos y espacios. `Nutricion`, `nutrición` y `NUTRICIÓN` cuentan como una especialidad. Se conserva una grafía original como etiqueta visible; no se actualizan masivamente registros históricos ni se cambia el significado de los permisos/alcances administrativos.

La normalización se aplica en estudiante, historial estudiantil, profesionales, filtros de agenda administrativa, lista de citas, KPI de inicio y agrupaciones de reportes. Las pruebas cubren variantes con/sin tilde y espacios. **Sigue existiendo una especialidad textual por profesional, sin catálogo autónomo.** Catálogo institucional, sinonimia semántica (`Salud Mental` y `Psicología` no son automáticamente equivalentes) y múltiples especialidades quedan como deuda explícita.

<a id="cierre-entrega--4-url-de-la-api-configurable-al-compilar"></a>
##### 4. URL de la API configurable al compilar

Se incorporó **`NG_APP_API_URL`** usando `define`, una capacidad nativa del builder Angular ya instalado. No se añadió `@ngx-env/builder` ni otra dependencia. `frontend/scripts/angular.mjs` valida la URL y la pasa a Angular; `npm start` y `npm run build` usan ese script. Sin variable, el valor es `http://localhost:8080`.

```powershell
cd frontend
$env:NG_APP_API_URL = 'https://api.tu-institucion.example'
npm run build
Remove-Item Env:NG_APP_API_URL
```

No hace falta editar `.ts`; el valor queda incorporado al bundle y cambiarlo exige otro build. No se carga un `.env` frontend automáticamente. La variable no debe contener secretos ni credenciales. La prueba de navegador usó el mismo mecanismo con una API local aislada en el puerto 8091.

<a id="cierre-entrega--5-actualizacion-segura-de-tu-bd-local"></a>
##### 5. Actualización segura de tu BD local

Se inspeccionaron **solo metadatos**, con el nuevo `python -m scripts.auditar_esquema`. No se consultaron fichas, cuentas, citas ni otros registros reales. Se encontraron cinco índices y una unicidad ausentes, además de diferencias de nulabilidad/tipo. `create_all` no basta para reconciliarlas.

[MIGRACIONES.md](#guia-migraciones) contiene el diagnóstico concreto, backup con `pg_dump`, ensayo en una restauración separada, consultas para duplicados/NULL, DDL propuesto en una transacción revisable, verificación post-cambio y rollback. **Ese DDL no se ejecutó.** No se borran fichas duplicadas ni se asigna un estado de revisión inventado. Si existen esos casos, el procedimiento aborta y requiere decisión del responsable.

<a id="cierre-entrega--6-git-y-secretos-evidencia-y-limite"></a>
##### 6. Git y secretos: evidencia y límite

Se ejecutaron en la carpeta entregada:

```text
git rev-parse --show-toplevel
git log --all --full-history -- backend/.env
git log --oneline -8
```

Los tres devolvieron **`fatal: not a git repository (or any of the parent directories): .git`**. Esta carpeta es una copia sin metadatos Git accesibles. Por tanto:

- **No se puede confirmar** que un `.env` real nunca haya estado en el historial. El comando no devolvió un historial vacío válido: falló.
- No existen commits de esta ronda realizados por el asistente ni hashes de commit que se puedan presentar. No se inicializó un repositorio artificial para simular evidencia.
- `backend/.env.example` se revisó: contiene placeholders, valores locales genéricos y campos opcionales comentados, sin credenciales reales copiadas del `.env` privado.
- `.gitignore` ahora incluye `.env`, `.env.*` con excepción de `.env.example`, `*.dump`, `*.backup`, `*.sql`, `*.db`, variantes SQLite, `node_modules/`, `venv/`, `.venv/`, `.angular/`, `dist/` y `build/`. Son reglas de prevención, no una limpieza retroactiva del historial ni un filtro para ZIP manual.

En el **repositorio Git original**, ejecutar:

```powershell
git log --all --full-history -- backend/.env
git log --all --full-history -- .env
git ls-files -- backend/.env .env
git check-ignore --no-index -v backend/.env backend/prueba.dump backend/prueba.db backend/prueba.sqlite frontend/node_modules/ejemplo backend/venv/ejemplo frontend/dist/ejemplo
```

Si alguna clave real fue versionada: revocarla/rotarla primero; quitar un archivo del historial no invalida credenciales expuestas. Coordinar la reescritura con todos los colaboradores y conservar una copia privada de recuperación. Un ejemplo con **git-filter-repo**, ejecutado sobre un clon nuevo y no sobre la única copia de trabajo:

```powershell
git clone --mirror 'URL_DEL_REPOSITORIO' sesaes-limpieza.git
cd sesaes-limpieza.git
git bundle create ../sesaes_historial_antes.bundle --all
git filter-repo --path backend/.env --path .env --invert-paths
git log --all --full-history -- backend/.env .env
```

`git-filter-repo` es una herramienta de mantenimiento **no instalada como dependencia del proyecto**. Revisar todos los nombres históricos/rutas alternas y posibles copias de secretos en otros archivos. Después de verificar ramas, etiquetas y builds, coordinar con el mantenedor el reemplazo remoto de refs, habitualmente mediante un push forzado del mirror; puede requerir restablecer el remoto que la herramienta elimina por seguridad. **No se ejecutó ningún push ni reescritura en esta revisión.** Los colaboradores deberán reclonar; no mezclar clones antiguos porque pueden reintroducir el secreto. También revisar forks, PRs, cachés y artefactos del proveedor. No existe una reescritura de historial que mantenga intactos todos los hashes antiguos. Referencia: [documentación oficial de git-filter-repo](https://github.com/newren/git-filter-repo).

Para revisar los cambios por bloques cuando se incorporen al repo original:

```powershell
git diff -- backend/app backend/tests backend/scripts
git diff -- frontend/src frontend/scripts frontend/package.json
git diff -- docs README.md CHANGELOG_TECNICO.md .gitignore
git log --oneline -8
```

Si ya se crea un único commit, sustituir `git diff --` por `git show --format=fuller COMMIT --` con los mismos grupos de rutas. No hay un COMMIT de esta ronda que se pueda inventar en esta copia sin `.git`.

<a id="cierre-entrega--7-verificacion-real-en-navegador-realizada"></a>
##### 7. Verificación real en navegador, realizada

Se levantaron frontend Angular en `http://localhost:4211` y FastAPI en `http://127.0.0.1:8091`, conectados a PostgreSQL temporal. Se usaron tres cuentas ficticias y SMTP deshabilitado. La semana de prueba fue 16–20 de noviembre de 2026, con un único bloque aprobado el lunes 16, 09:00–13:00.

Pasos observados en el navegador:

1. Login con superadmin: panel, profesional y alumno visibles; se abrió **Agregar profesional** y se comprobaron los dos campos de contraseña vacíos y su política. No se creó una cuenta adicional desde esa comprobación visual.
2. Cerrar sesión e ingresar como profesional: **Agenda** mostró horario personalizado aprobado, lunes disponible y martes–viernes sin atención al avanzar a la semana correspondiente.
3. Cerrar sesión e ingresar como alumno: **Agendar cita**, elegir profesional y abrir calendario. El 16 estaba habilitado; el 17 y los demás días no aprobados, los fines de semana y las fechas fuera de ventana estaban deshabilitados.
4. Seleccionar 16 de noviembre, 09:00, continuar y confirmar. Se observó el mensaje **“¡Tu hora fue agendada correctamente!”**.
5. Abrir **Mis citas**: apareció la cita con el profesional, fecha y hora elegidos.

![Calendario con un día aprobado y el resto bloqueado; datos ficticios] (evidencia histórica citada: evidencias/calendario-prueba.png; archivo no presente en esta copia)

Hubo una interrupción de la sesión y un primer intento de abrir la página antes de que el servidor estuviera listo; se reiniciaron solo los servicios de prueba y se completó el recorrido. No fue un fallo del agendamiento. Las dos bases temporales creadas durante los intentos fueron eliminadas al terminar; la base local de trabajo quedó intacta.

Qué revisar tú antes de entregar: tamaños móvil/escritorio, contraste y foco de los días deshabilitados, mensajes de validación del formulario, datos institucionales de dirección/contacto, fechas al cruzar de mes y autenticación bajo los dominios definitivos/CORS. Se detectan textos históricos con caracteres `?` en algunas acciones de auditoría; son una deuda de presentación separada. No se ha certificado accesibilidad completa ni todos los navegadores.

<a id="cierre-entrega--8-tamano-css"></a>
##### 8. Tamaño CSS

El budget actual es advertencia a **50 kB** y error a **100 kB** por estilo de componente. El último build verificado informa:

| Archivo | Tamaño | Exceso sobre advertencia |
|---|---:|---:|
| `frontend/src/app/dashboard-profesional/dashboard-profesional.css` | 60,12 kB | 10,12 kB |
| `frontend/src/app/dashboard-admin/dashboard-admin.css` | 69,62 kB | 19,62 kB |

La compilación de producción sigue siendo válida: son advertencias y ambos están bajo el máximo de error. **No se subió el budget para silenciarlo.** Se recomienda dividir estilos junto con la extracción de componentes de los dashboards y eliminar duplicaciones con revisión visual; queda como deuda de rendimiento documentada, sin una reorganización CSS extensa en esta ronda.

<a id="cierre-entrega--9-alembic"></a>
##### 9. Alembic

En esta ronda anterior se dejó como deuda. **La ronda posterior la cerró:** Alembic 1.20.1 está instalado, la revisión base está generada y verificada contra vacío, e `init_db` ya ejecuta upgrade head. El flujo activo está en [MIGRACIONES.md](#guia-migraciones), con resultados en [CIERRE_ALEMBIC.md](#cierre-alembic). La base histórica no fue estampada ni migrada.

<a id="cierre-entrega--10-datos-de-salud"></a>
##### 10. Datos de salud

Se creó [DATOS_SENSIBLES.md](#datos-sensibles): inventario de datos, cifrado de disco/volúmenes/backups y TLS, retención clínica y de auditoría, permisos, borrado/rectificación, incidentes y requisitos de operación. Cita fuentes oficiales chilenas sobre Ley 19.628, Ley 20.584 y la transición de Ley 21.719. **No hay cifrado aplicativo ni motor automático de retención implementados**; se documentan como requisitos previos a producción real, sujetos a aprobación institucional.

<a id="cierre-entrega--11-validaciones-e-inventario-de-esta-ronda"></a>
##### 11. Validaciones e inventario de esta ronda

Resultados finales de esta ronda:

- `python -m pytest -q --disable-warnings --tb=short`: **1.555 aprobadas, 12 omitidas y 14 subtests aprobados**. Las omitidas requieren configuración de integración PostgreSQL; no se cuentan como aprobadas. La prueba focal de inicio, incluyendo una variante nueva sin tilde, pasó sus 38 casos.
- `npm test -- --watch=false`: **974 pruebas aprobadas en 53 archivos**.
- `npm run build`: **correcto**, con las dos advertencias CSS cuantificadas en el punto 8; no hay errores de compilación.
- TypeScript con `--noEmit --noUnusedLocals --noUnusedParameters`: correcto.
- Recorrido real en navegador: completado, como se describe en el punto 7, con evidencia guardada y bases temporales eliminadas.
- Enlaces locales de README y documentos: verificados sin destinos ausentes.

Estos resultados sustituyen los recuentos históricos del changelog para esta ronda. El README y la guía describen el formulario profesional, el alta de alumnos solo API, las especialidades y `NG_APP_API_URL` ya implementados. No se crearon commits en esta carpeta sin `.git`.

<a id="cierre-entrega--nuevos"></a>
###### Nuevos

- `docs/CIERRE_ENTREGA.md`
- `docs/MIGRACIONES.md`
- `docs/DATOS_SENSIBLES.md`
- `docs/evidencias/calendario-prueba.png` — solo datos ficticios
- `backend/scripts/auditar_esquema.py` — diagnóstico de solo lectura, no migración
- `backend/tests/test_alta_profesional_password.py`
- `backend/tests/test_especialidades_normalizadas.py`
- `frontend/scripts/angular.mjs`

<a id="cierre-entrega--modificados"></a>
###### Modificados

- `.gitignore`
- `README.md`
- `CHANGELOG_TECNICO.md`
- `docs/INSTALACION.md`
- `backend/app/schemas.py`
- `backend/app/routers/admin.py`
- `backend/app/routers/admin_inicio.py`
- `backend/app/services/reportes_resumen_service.py`
- `backend/tests/test_admin_profesional_tratamiento.py`
- `backend/tests/test_admin_inicio.py`
- `frontend/package.json`
- `frontend/src/app/config.ts`
- `frontend/src/app/shared/text-normalization.ts`
- `frontend/src/app/dashboard-admin/dashboard-admin.ts`
- `frontend/src/app/dashboard-admin/citas/admin-citas.ts`
- `frontend/src/app/dashboard-admin/profesionales/admin-profesionales.ts`
- `frontend/src/app/dashboard-admin/profesionales/admin-profesionales.html`
- `frontend/src/app/dashboard-admin/profesionales/admin-profesionales.spec.ts`
- `frontend/src/app/dashboard-admin/superadmin-inicio/superadmin-inicio.ts`
- `frontend/src/app/dashboard-admin/superadmin-inicio/superadmin-inicio.spec.ts`
- `frontend/src/app/dashboard-estudiante/dashboard-estudiante.ts`
- `frontend/src/app/dashboard-estudiante/historial/estudiante-historial.ts`

<a id="cierre-entrega--eliminados"></a>
###### Eliminados

No se retiraron archivos funcionales preexistentes en esta ronda. Los auxiliares temporales `cerrar_entrega_tmp.py`, `ui_entrega_tmp.py`, `start_front_tmp.ps1` y `limpiar_ui_tmp.py` se retiraron tras usarlos. No forman parte de la instalación. No se añadieron dependencias ni se generaron dumps de datos reales.

<a id="historial-tecnico"></a>

### 10.5. Historial técnico de refactorizaciones

> Origen consolidado: `docs/CHANGELOG_TECNICO.md`.

<a id="historial-tecnico--cambios-tecnicos--15-de-noviembre-de-2026"></a>
#### Cambios técnicos — 15 de noviembre de 2026

<a id="historial-tecnico--alembic-instalado--parte-1"></a>
##### Alembic instalado — Parte 1

- Alembic 1.20.1 añadido a requirements, entorno inicializado sin credenciales en INI y revisión base `253cae9c234a` generada contra PostgreSQL vacío. `target_metadata` comparte el registro completo de modelos.
- `init_db` ahora ejecuta upgrade head sobre la conexión del motor; no hay un segundo creador de tablas en producción. Seed demo y bootstrap siguen siendo pasos explícitos posteriores al esquema. Las bases SESAES sin versión se rechazan antes de ejecutar DDL.
- Equivalencia física confirmada en PostgreSQL nuevo entre modelos, CLI Alembic e inicializador: 26 tablas/185 columnas/40 índices/27 FK/6 CHECK/7 UNIQUE y 4 índices únicos. Downgrade y nuevo upgrade verificados; `alembic_version` permanece vacía al volver a base.
- Backend: 1.557 pruebas aprobadas, 13 omitidas y 14 subtests aprobados; los ocho casos específicos PostgreSQL de migración/esquema/instalación pasaron en una BD descartable. Angular mantiene las 974 pruebas después de corregir tres fixtures con fecha UTC que fallaban al cambiar el día UTC antes del día local chileno. No se eliminó ningún caso ni se cambió lógica de negocio frontend.
- Guías de instalación/migraciones actualizadas como flujo activo; cierre e inventario en `docs/CIERRE_ALEMBIC.md`. La Parte 2 (backup/base permanente de defensa/superadmin/demo/cambio de .env) **no se ejecutó** hasta confirmar esta etapa. La base local anterior sigue intacta.

<a id="historial-tecnico--cierre-de-correcciones-posteriores"></a>
##### Cierre de correcciones posteriores

- Resuelto el bloqueante de contraseña fija profesional: formulario con clave explícita/confirmación, borrado de sus campos al cerrar, sin exposición en confirmación o mensajes; API sin fallback y con política de contraseña/longitud bcrypt validada. Se añadieron pruebas y se actualizaron fixtures de altas anteriores.
- Alumnos: decisión explícita de conservar solo `POST /admin/estudiantes`; el formulario de alta en panel queda como mejora futura. La guía ya no presenta la vía API profesional como sustituto de una interfaz insegura: el formulario profesional fue corregido.
- Especialidades: deduplicación y comparación de presentación normalizadas por acentos, mayúsculas y espacios en listas/filtros, KPI y agrupaciones de reportes; no se reescriben históricos ni se amplían permisos por esta equivalencia visual.
- `NG_APP_API_URL` incorporado mediante `define` nativo de Angular y `frontend/scripts/angular.mjs`, usado por scripts npm de build/serve. Sin dependencias nuevas ni edición de TypeScript por despliegue.
- Nueva documentación `docs/CIERRE_ENTREGA.md`, `docs/MIGRACIONES.md` y `docs/DATOS_SENSIBLES.md`. Incluye diagnóstico local exclusivamente de metadatos, actualización propuesta no ejecutada, backup/rollback, plan Alembic, requisitos de salud y evidencia de navegador con datos ficticios.
- `.gitignore` ampliado para entornos y respaldos/bases. No se pudo auditar historial ni producir commits: esta carpeta carece de `.git`, y los comandos Git fallaron. No se declara el historial libre de secretos sin evidencia.
- Comprobación en navegador completada: login de tres roles, agenda aprobada, bloqueo de días no aprobados, reserva por pantalla y aparición en Mis citas. Bases temporales eliminadas. Ver resultados y rutas de esta ronda en `docs/CIERRE_ENTREGA.md`.
- Validación final de esta ronda: 1.555 pruebas backend aprobadas, 12 omitidas y 14 subtests aprobados; 974 pruebas Angular aprobadas en 53 archivos; build de producción y control TypeScript sin errores. Persisten las dos advertencias CSS cuantificadas en el documento de cierre.

Las siguientes secciones conservan el registro histórico de rondas anteriores; las limitaciones corregidas después (por ejemplo la contraseña temporal del panel) ya no describen el estado vigente.

<a id="historial-tecnico--entrega-solo-de-codigo-e-instalacion-sin-datos"></a>
##### Entrega solo de código e instalación sin datos

- Nueva guía autocontenida `docs/INSTALACION.md`: requisitos, todas las variables, creación PostgreSQL, esquema, bootstrap, datos reales vía API/panel, aprobación de horarios, demo separado y verificación. README enlazado y `.env.example` ampliado, sin credenciales reales.
- Se confirmó que las especialidades son texto asociado a cada profesional, sin catálogo independiente; el alta profesional crea también su cuenta. La guía explica esta limitación y la vía de alta con contraseña propia, evitando la contraseña temporal fija del panel actual.
- Se incorporó `POST /admin/estudiantes`: no existía una vía de alta vigente. Requiere `usuarios.gestionar` y alcance institucional; fija rol estudiante, valida datos y contraseña explícita, hashea con bcrypt y registra auditoría en la misma transacción. No devuelve secretos ni acepta privilegios del cliente. El panel de alumnos sigue siendo de consulta/edición; el alta se hace por API.
- El frontend viene apuntando a `http://localhost:8080` en lugar de redirigir otros hostnames al servidor alojado del autor. El despliegue debe configurar su propia URL de API.
- Nuevas pruebas de alta de alumnos y de recorrido completo de instalación por CLI/API. Se ejecutó el recorrido en una base PostgreSQL 17 nueva, aislada y eliminada al terminar, con datos ficticios y sin SMTP: esquema, superadmin, profesional/especialidad, alumno, tres logins, solicitud, aprobación, cita auditada y rechazo de día sin bloques. No se exportaron ni consultaron registros de la base de trabajo.
- Se amplió el inventario RBAC para exigir explícitamente `usuarios.gestionar` en la nueva ruta de alta estudiantil. Verificación de entrega: 1.546 pruebas backend aprobadas, 12 omitidas y 14 subtests aprobados; cinco casos específicos de esquema/instalación aprobados en una base PostgreSQL nueva; 970 pruebas Angular aprobadas y build de producción correcto. Vitest se limitó a un worker tras agotamiento de memoria con dos. Los 20 bloques PowerShell de la guía pasan la comprobación de sintaxis.


<a id="historial-tecnico--agendamiento-estudiantil"></a>
##### Agendamiento estudiantil

- `GET /disponibilidad/{id}/calendario` publica fechas con horas reales disponibles entre hoy y hoy + 7 días. Reutiliza el motor de disponibilidad: bloques semanales aprobados, duración completa, colación, estado del profesional, ocupación, fines de semana y cierres institucionales.
- La tabla `bloque_horario_semanal` representa la agenda aprobada actual. Aprobar una solicitud de bloques reemplaza esa semana completa. Una solicitud pendiente/rechazada o la jornada genérica del profesional no habilitan días para estudiantes; sin bloques aprobados, el calendario queda bloqueado.
- Angular usa botones de calendario con `disabled`, conserva las marcas de cierre y fin de semana y solo habilita fechas publicadas por la API. Mientras carga o ante un error, todas quedan bloqueadas. Al cambiar de profesional o abandonar el flujo, las respuestas anteriores se descartan; también se protege la consulta de horas contra respuestas fuera de orden.
- `GET /disponibilidad/{id}` exige bloques al consultar como estudiante. `POST /citas` comprueba el día aprobado dentro del lock de agenda y responde HTTP 400 si se fuerza una fecha sin aprobación. El motor sigue comprobando el intervalo completo y la ocupación; conserva HTTP 409 para conflictos de reserva en días válidos.
- Se mantienen RBAC, alcance administrativo, urgencias, autorización y motivo del sobrecupo, trazabilidad del actor y auditoría de creación/cancelación. La jornada simple sigue disponible para operaciones administrativas; no habilita reservas estudiantiles.

<a id="historial-tecnico--esquema-e-inicializacion"></a>
##### Esquema e inicialización

- `app/models/init.py` registra explícitamente todos los modelos persistidos. `app/init_db.py` importa ese registro antes de `Base.metadata.create_all`, sin depender de imports de los routers o de la suite de pruebas.
- Las columnas de origen y fecha de creación de citas/usuarios, auditoría y su índice compuesto, tablas normalizadas de sobrecupos/conflictos, acceso administrativo y sus constraints, permisos incluyendo `agenda.sobrecupo`, bloques y detalle de solicitudes quedan declarados en SQLAlchemy.
- Se incorpora `ix_cita_profesional_fecha_estado` **no único**, compatible con sobrecupos autorizados. Se declara la unicidad de la ficha de antecedentes por profesional/estudiante (`uq_historial_paciente_par`). Se conservan las unicidades de correo, cierre por fecha, firma por profesional, folio clínico y permisos/accesos administrativos.
- Un único flujo recomendado: `python -m app.init_db`, opcionalmente con `--superadmin`. El arranque de FastAPI también crea el esquema. El bootstrap conserva sus validaciones y su comando anterior por compatibilidad; nunca se ejecuta automáticamente al arrancar la API.
- El seed demo sigue siendo opt-in y exige contraseña externa. Ahora crea usuarios, profesionales y bloques recurrentes de lunes a viernes (09:00–13:00) en una sola transacción, con rollback y sin asumir IDs de PostgreSQL. Se retiran los horarios demo fijos y vencidos de junio de 2026.
- `create_all` crea un esquema vacío e idempotente; **no actualiza columnas o constraints de tablas existentes**. No se modificó la base de datos de trabajo. Una instalación histórica requiere un plan de actualización/exportación revisado; estos cambios no autorizan borrar datos ni reconstruir una base compartida.

<a id="historial-tecnico--limpieza-y-auditoria-de-archivos"></a>
##### Limpieza y auditoría de archivos

Se eliminaron estos parches de esquema de `backend/scripts/`, reemplazados por los modelos y el inicializador:

- `migrar_a4_1_trazabilidad.py`
- `migrar_a4_3_permiso_sobrecupo.py`
- `migrar_a4_4_1_eliminar_indice_unico_slot.py`
- `migrar_acceso_administrativo_sa8.py`
- `migrar_agenda_bloques.py`
- `migrar_auditoria_agenda.py`
- `migrar_auditoria_sa2.py`
- `migrar_permisos_admin_sa9.py`
- `migrar_usuario_fecha_creacion.py`

Se conserva `migrar_passwords_texto_plano.py`: es mantenimiento de datos históricos, no instalación ni parche de esquema. Se simplificó para usar el registro central. Su modo predeterminado solo cuenta; `--aplicar` convierte contraseñas a bcrypt. La compatibilidad de autenticación histórica permanece.

Otros archivos retirados:

- `database/sesaes_db_v2.sql`: dump desactualizado que competía con los modelos como fuente de esquema.
- `database/migracion_bloques.sql`: creación duplicada de tablas ya modeladas.
- `backend/app/models/ausencia_profesional.py`: modelo huérfano, sin consultas ni rutas vigentes. El antiguo parche también proponía `cita.rechazada_por_profesional` y `solicitud_horario.bloques_json`, sin consumidores actuales: no se incorporan columnas muertas. El detalle de solicitudes vigente vive en `SolicitudBloques`.
- Pruebas exclusivas de parches retirados: `test_sa8_migracion_acceso.py`, `test_sa9_migracion_permisos_admin.py`, `test_a4_1_migracion_postgres.py`, `test_a4_3_migracion_permiso_sobrecupo.py`, `test_a4_4_1_migracion_indice_legacy.py`. Se conserva la cobertura funcional de RBAC, auditoría y sobrecupos. En `test_inicio_postgres.py` se retiró solo el caso de migración; siguen las consultas de inicio.

Frontend: se eliminaron los helpers privados sin llamadas `esHoraDeAlmuerzo` y `esFueraDeHorarioProfesional` del dashboard administrativo; la disponibilidad del servidor ya resuelve esas reglas. Se retiraron inyecciones/imports de Router sin uso del dashboard estudiantil y validación de documentos. Se identificó explícitamente el parámetro no utilizado de `clickBloque` profesional. TypeScript se verifica con `noUnusedLocals` y `noUnusedParameters`. La revisión AST de imports del backend no encontró imports de código sin uso; se preservan imports de registro, decoradores y compiladores SQLAlchemy.

<a id="historial-tecnico--verificacion"></a>
##### Verificación

- Suite inicial: 1.527 pruebas aprobadas, 13 omitidas.
- Se añadieron pruebas HTTP de calendario/reserva forzada, ausencia de bloques, solicitudes sin agenda efectiva, cierre, fin de semana, profesional inactivo y cambio de agenda; una reserva válida comprueba actor y auditoría.
- Las pruebas existentes de reserva estudiantil ahora preparan bloques aprobados explícitos mediante `tests/agenda_fixtures.py`; mantienen sus aserciones de concurrencia, conflictos y auditoría.
- `test_esquema_inicial.py` comprueba el registro en un proceso aislado, la creación idempotente y los índices/constraints definitivos en SQLite y PostgreSQL. PostgreSQL usa un schema temporal con nombre aleatorio, que elimina al terminar; no toca tablas de `public`.
- Angular incorpora pruebas de calendario bloqueado durante carga/error, filtrado de fechas, cierres, fines de semana y respuesta de un profesional anterior. `vitest.config.ts` limita los workers a dos tras observar agotamiento de memoria con el paralelismo predeterminado.
- Compilación de producción Angular verificada. Permanecen advertencias de tamaño CSS de los dashboards administrativo y profesional.
- Verificación final: `pytest` con 1.532 pruebas aprobadas, 11 omitidas y 14 subtests aprobados; Angular con 970 pruebas aprobadas en 53 archivos. La prueba específica de esquema también pasó en PostgreSQL 17 real.

Los comandos reproducibles están en [README.md](README.md). Las integraciones PostgreSQL omitidas sin `TEST_POSTGRES_URL` no se consideran verificadas por la suite general; la prueba nueva de esquema se ejecutó también contra PostgreSQL 17 real y pasó.

<a id="datos-sensibles"></a>

### 10.6. Datos personales y requisitos previos a producción

> Origen consolidado: `docs/DATOS_SENSIBLES.md`.

<a id="datos-sensibles--datos-personales-y-clinicos-requisito-previo-a-produccion"></a>
#### Datos personales y clínicos: requisito previo a producción

Estado al 15-11-2026. Este documento establece requisitos para la institución receptora; **no certifica cumplimiento legal ni implementa cifrado o borrado automático**. Antes de operar con pacientes reales, el responsable institucional, el equipo clínico y asesoría jurídica deben aprobar el tratamiento, la custodia, los plazos y el plan de incidentes. Hasta entonces usar exclusivamente información ficticia.

<a id="datos-sensibles--que-almacena-el-sistema"></a>
##### Qué almacena el sistema

- Identidad y contacto: nombres, RUT, correos, teléfono, carrera, fotos y preferencias; cuentas, roles, permisos, alcance administrativo y hashes de contraseña.
- Agenda: profesional y especialidad, fechas/horas, motivos/observaciones de consulta, estado, cancelaciones, urgencias, sobrecupos y su justificación.
- Antecedentes e historia de atención: respuestas a cuestionarios, fichas por profesional/paciente, medicamentos suministrados, observaciones clínicas y seguimiento.
- Documentos clínicos: recetas, justificativos, contenido JSON congelado al emitir, folio, hash de integridad, fechas y anulaciones.
- Firmas manuscritas digitalizadas de profesionales y copias incorporadas a documentos. No constituyen por sí solas firma electrónica avanzada.
- Auditoría y mensajería: actor, rol, acción, entidad, fecha, resultado y detalles; destinatarios/cuerpos y resultados de correos. Los logs y backups también pueden contener datos personales.

No copiar estos datos a ejemplos, seeds, tickets, capturas públicas, analítica externa, chats de soporte ni repositorios. Las pruebas de entrega utilizan cuentas y datos ficticios sobre bases separadas.

<a id="datos-sensibles--cifrado-y-custodia"></a>
##### Cifrado y custodia

Requerir TLS/HTTPS para el navegador y conexiones PostgreSQL con certificados verificados cuando crucen redes. El hash bcrypt protege contraseñas; el hash SHA-256 de un documento detecta alteración, **no cifra su contenido**.

La instalación actual no cifra campos clínicos de forma aplicativa. Usar cifrado de disco/volumen en el servidor PostgreSQL y almacenamiento de WAL, snapshots, réplicas y respaldos; en un servicio gestionado, verificar cifrado en reposo y gestión de claves. El cifrado del volumen no impide que un usuario autorizado de PostgreSQL lea datos: mantener roles mínimos, red privada, control de acceso y segregación de funciones. PostgreSQL estándar no debe describirse como si incluyera automáticamente un TDE configurado por esta app.

Backups: cifrarlos antes de salir del host, separar sus claves del backup, controlar accesos y registrar restauraciones; ensayar recuperación y custodia de claves. No guardar credenciales en el código, `.env.example`, argumentos registrados en CI o dumps compartidos. Los secretos reales deben residir en un gestor institucional o configuración privada con permisos restrictivos.

<a id="datos-sensibles--retencion-rectificacion-y-borrado"></a>
##### Retención, rectificación y borrado

La institución debe publicar una matriz de retención por categoría, finalidad, fundamento, responsable, evento inicial de cómputo y destino final. No fijar un único plazo para toda la BD ni borrar datos clínicos al eliminar/desactivar una cuenta.

Para fichas clínicas, la Ley 20.584 exige una conservación de **al menos quince años** por el prestador; la institución debe precisar el cómputo y obligaciones complementarias aplicables con su asesoría. No confundir ese mínimo con una autorización automática de borrado al cumplirse. [Ley 20.584, arts. 12–13, BCN](https://www.bcn.cl/leychile/navegar?idNorma=1039348&idVersion=2026-02-16).

Política propuesta, pendiente de aprobación institucional:

| Categoría | Tratamiento propuesto |
|---|---|
| Fichas y documentos clínicos | Custodia según mínimo legal y reglas clínicas aplicables; rectificación trazable/anulación, sin sobrescribir la historia |
| Citas y motivos relacionados con una atención | Incluir en la matriz clínica; no presumir que toda cita puede eliminarse al pasar su fecha |
| Cuentas y permisos | Desactivar acceso al finalizar vínculo; separar la revocación del acceso de la conservación del historial |
| Firmas | Revocar/actualizar la firma vigente; preservar las copias que sustentan documentos históricos durante su retención |
| Auditoría clínica y de acceso a datos | Proponer conservación alineada con los registros clínicos que sustenta; plazo exacto aprobado por institución, no implementado automáticamente |
| Logs operativos sin contenido clínico | Propuesta inicial: 90 días, ajustada por incidentes e investigación; no es un plazo legal universal |
| Backups | Propuesta inicial: rotación operativa de 90 días, con archivo legal independiente cuando corresponda; documentar cómo expiran copias y cómo se reaplica una rectificación al restaurar |

Antes de borrar, revisar obligaciones de conservación, investigación, litigios o suspensión del borrado; autorizar por escrito y registrar la ejecución. Contemplar sistemas derivados, archivos, exportaciones y expiración de backups. La anonimización debe impedir reidentificación de manera efectiva; cambiar un nombre o usar un hash de RUT no basta. Actualmente **no hay un motor de retención ni un flujo completo de eliminación/anonimización**: queda como requisito de producción, no como capacidad ya disponible.

<a id="datos-sensibles--acceso-y-auditoria"></a>
##### Acceso y auditoría

El backend aplica roles, permisos y alcance. Estudiantes acceden a lo propio y profesionales a sus recursos autorizados. Administradores no reciben acceso clínico universal por su rol. La lectura de auditoría administrativa exige `auditoria.ver`, reservado al superadmin en el catálogo actual; no delegar acceso a toda la institución por conveniencia. Auditar y revisar también los accesos del operador PostgreSQL, del proveedor y a los backups, fuera de la aplicación.

La auditoría de aplicación es de solo anexado a través de la API: no hay ruta para borrarla/modificarla. Eso **no impide** a un superusuario de BD alterarla. Para operación real: permisos SQL restrictivos, exportación protegida/inmutable o monitoreo independiente, revisión periódica y alertas sobre accesos indebidos. No poner contraseñas, tokens ni cuerpos clínicos completos en detalles de auditoría o logs. El login exitoso no tiene hoy auditoría completa de acceso; registrar y revisar accesos/consultas clínicas es una deuda previa a un despliegue institucional con esa exigencia.

<a id="datos-sensibles--marco-chileno-y-fechas-de-vigencia"></a>
##### Marco chileno y fechas de vigencia

- La **Ley 19.628** regula el tratamiento de datos personales; los antecedentes de salud requieren protección especial. Deben definirse finalidad, base jurídica/autorización, responsables y ejercicio de derechos. [Texto y versiones oficiales, BCN](https://www.bcn.cl/leychile/navegar?idNorma=141599).
- La **Ley 20.584**, en particular sus reglas sobre reserva, custodia y acceso a la ficha, se aplica a la atención de salud según corresponda al prestador. El acceso administrativo al sistema no equivale a autorización legal para revisar una ficha. [Texto oficial, BCN](https://www.bcn.cl/leychile/navegar?idNorma=1039348&idVersion=2026-02-16).
- La **Ley 21.719**, que modifica el régimen de protección de datos y crea la Agencia de Protección de Datos Personales, tiene vigencia general prevista para el **1 de diciembre de 2026**. A la fecha de esta revisión (15 de noviembre de 2026) esa fecha aún es futura. Preparar la puesta en producción considerando esa transición y verificar reglamentos y obligaciones vigentes en la fecha efectiva del despliegue. [Ley 21.719 y vigencia oficial, BCN](https://www.bcn.cl/leychile/navegar?idNorma=1209272).

Estas referencias no sustituyen una evaluación jurídica del prestador, transferencias a proveedores o servicios extranjeros, consentimiento/base legal, interoperabilidad y procedimientos específicos.

<a id="datos-sensibles--condiciones-minimas-antes-de-pacientes-reales"></a>
##### Condiciones mínimas antes de pacientes reales

1. Responsable institucional de datos y custodia clínica designado; aprobación de finalidades, avisos, base jurídica y matriz de retención.
2. HTTPS, red privada para BD, cifrado de volúmenes y backups, claves gestionadas y recuperación ensayada.
3. Cuentas individuales con contraseña propia; revisión de RBAC/alcances, baja de accesos, sin cuentas demo ni contraseñas compartidas.
4. Revisión de accesos a fichas, auditoría clínica, protección contra alteración y procedimientos de revisión de incidentes; completar las deudas identificadas.
5. Plan de incidentes, notificaciones exigibles, soporte, continuidad, restauración, borrado/rectificación y evaluación de proveedores aprobados.
6. Revisión de logs, QR/verificación pública y exportaciones para minimizar identificación; no publicar un folio como si fuera un dato sin sensibilidad.
7. Separación de desarrollo/pruebas/producción, secretos fuera del código, análisis de dependencias, pruebas de autorización y validación técnica y jurídica previa al lanzamiento.
