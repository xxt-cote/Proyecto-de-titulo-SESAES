# Plan de mejoras SESAES

> Documento para el equipo. Resume qué se revisó, qué ya se corrigió, qué se
> elimina y por qué, y qué falta antes de usar SESAES con usuarios reales.
> **Es un documento temporal:** cuando todos los pendientes estén cerrados,
> se borra (igual que las notas de entrega antiguas).

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

Verificación hecha sobre estos cambios: **backend 1502 tests OK** (13 se saltan),
**frontend 938/938 tests OK**, y el build de Angular compila.

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
| `database/sesaes_db_v2.sql` | Tiene 11 tablas y los modelos tienen 26: está desactualizado. El esquema real lo crea el backend. | Confirmar que nadie lo use para restaurar una base. |
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
- [ ] **Recuperar contraseña.** Hoy "¿Olvidaste tu contraseña?" es solo un texto. Hace falta un enlace de un solo uso, con vencimiento, enviado por correo.
- [ ] **Zona horaria.** Hay 37 usos de `datetime.now()` / `date.today()` sin zona; el servidor corre en UTC y las citas son en `America/Santiago`. Centralizar un único reloj (esto además permite arreglar el test que hoy se salta en fines de semana).
- [ ] **Respaldos automáticos de la base y prueba de restauración.**
- [ ] **Límite de login detrás del proxy.** Arrancar con `--proxy-headers` en Render y agregar un límite por cuenta, no solo por IP (hoy todos podrían compartir el mismo límite de 5 por minuto).

### Importante (primer mes)

- [ ] **Migraciones versionadas (Alembic)** en lugar de `create_all` + scripts sueltos.
- [ ] **Logging y monitoreo de errores** (hoy el backend tiene 0 llamadas a logging) y un monitor que consulte `/health`.
- [ ] **CI en GitHub Actions**: tests del backend y frontend, `pip-audit`, `npm audit`; más Dependabot y CodeQL.
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

- El **build de producción** de Angular (descarga fuentes de Google; en el entorno de revisión no había acceso). Se verificó el build de desarrollo y los 938 tests.
- Si las cabeceras de `frontend/vercel.json` quedan activas en Vercel: depende de la configuración del proyecto y hay que comprobarlo tras desplegar.
- El comportamiento en Render (proxy, plan gratuito que se duerme) y la base real.
- Los dashboards en uso real: no se midieron con PageSpeed ni CompliaScan.
- Esta revisión es de código y no reemplaza una prueba de penetración.
