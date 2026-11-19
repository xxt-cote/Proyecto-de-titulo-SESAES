# Instalación de SESAES desde cero

Guía actualizada para la versión integrada del 19-11-2026. El esquema final es
8d2e4f6a901b; la revisión base 253cae9c234a permanece como antecedente.
Para una instalación con contenedores, ver [Docker](DOCKER.md).

Esta entrega contiene **código y una base de datos por crear, sin datos**. No requiere ni incluye un dump de la base del autor. Cada institución debe crear sus propias cuentas, profesionales, especialidades y alumnos. Los nombres y correos de ejemplo de esta guía son ficticios: reemplazarlos por los autorizados para la instalación.

El esquema completo está versionado en **Alembic** y se aplica con `python -m alembic upgrade head`. `python -m app.init_db` es el atajo que ejecuta ese mismo historial. Los modelos SQLAlchemy siguen definiendo el estado deseado, pero ya no crean tablas directamente en la aplicación. No hay que importar `.sql`, ejecutar migraciones sueltas ni insertar datos manualmente en SQL. El historial `backend/alembic/` y `backend/alembic.ini` sí deben acompañar la entrega.

Los comandos siguientes se ejecutan en **PowerShell 7**. Abrir primero una terminal en la raíz del proyecto, donde están `backend/`, `frontend/` y `README.md`. Mantener las terminales abiertas cuando se indique.

## 1. Requisitos previos

| Herramienta | Versión de referencia                                                 | Verificación                |
| ----------- | --------------------------------------------------------------------- | --------------------------- |
| Python      | 3.13; verificado con 3.13.2                                           | `python --version`          |
| pip y venv  | Los incluidos con Python                                              | `python -m pip --version`   |
| Node.js     | 24.20.0; Angular instalado admite `^22.22.3`, `^24.15.0` o `>=26.0.0` | `node --version`            |
| npm         | 11; verificado con 11.6.0, `packageManager` declara 11.13.0           | `npm --version`             |
| PostgreSQL  | 17; verificado con 17.2                                               | `psql --version`            |
| PowerShell  | 7.1 o superior, para `Read-Host -MaskInput`                           | `$PSVersionTable.PSVersion` |

PostgreSQL debe estar iniciado. Tener una cuenta administradora de PostgreSQL para crear un rol y una base. Agregar su carpeta `bin` al PATH si no se reconocen `psql` o `createdb` (en Windows suele ser `C:\Program Files\PostgreSQL\17\bin`). Para instalar dependencias hace falta acceso a Internet y al CDN de SheetJS referenciado en `frontend/package-lock.json`.

Para contenedores, seguir la guía [Docker](DOCKER.md). Los comandos de esta guía utilizan PowerShell 7.1 o superior.

SQLite se usa en pruebas unitarias. **Esta guía y el funcionamiento de producción requieren PostgreSQL**, entre otras cosas por los locks transaccionales de concurrencia de la agenda. No sustituir `DATABASE_URL` por SQLite para operar la aplicación.

## 2. Preparar Python y las variables de entorno

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

| Variable                        | Uso                                                                           | Ejemplo / valor inicial                                               |
| ------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `DATABASE_URL`                  | Conexión SQLAlchemy a la base nueva. Obligatoria.                             | `postgresql+psycopg2://sesaes:TU_PASSWORD@localhost:5432/sesaes`      |
| `JWT_SECRET_KEY`                | Firma de sesiones. Obligatoria; secreto propio, nunca el texto de ejemplo.    | La salida aleatoria del comando anterior                              |
| `JWT_EXPIRE_MINUTES`            | Vigencia del token en minutos.                                                | `720`                                                                 |
| `CORS_ORIGINS`                  | Orígenes frontend autorizados, separados por comas y sin barra final.         | `http://localhost:4200`                                               |
| `SESAES_ENV`                    | `production` desactiva `/docs`, `/redoc` y `/openapi.json`.                   | `development` durante la instalación                                  |
| `FRONTEND_BASE_URL`             | URL para QR y recuperación de contraseña.                                     | `http://localhost:4200`                                               |
| `SEED_DEMO_DATA`                | Solo `true` activa el seed demo.                                              | **`false` en una instalación real**                                   |
| `SEED_DEMO_PASSWORD`            | Contraseña externa compartida por las once cuentas demo, hasheada por cuenta. | Omitir en una instalación real                                        |
| `SUPERADMIN_BOOTSTRAP_EMAIL`    | Correo del primer superadmin, proporcionado por el instalador.                | `superadmin@utem.cl`                                                  |
| `SUPERADMIN_BOOTSTRAP_PASSWORD` | Contraseña elegida por el instalador, no generada ni impresa por el backend.  | Definir mediante entrada oculta; ver paso 3                           |
| `SUPERADMIN_BOOTSTRAP_NAME`     | Nombre del primer superadmin; opcional.                                       | `Superadministrador SESAES`                                           |
| `SMTP_EMAIL`                    | Cuenta remitente Gmail para correos reales; opcional.                         | Omitir hasta configurar correo institucional autorizado               |
| `SMTP_APP_PASSWORD`             | Contraseña de aplicación Gmail; opcional.                                     | Omitir hasta configurar SMTP                                          |
| `SMTP_NOMBRE_REMITENTE`         | Nombre visible del remitente.                                                 | `SESAES`                                                              |
| RESET_TOKEN_MINUTES             | Vencimiento del enlace de recuperación, en minutos.                           | 30                                                                    |
| SESAES_TZ                       | Compatibilidad POSIX; conservar la zona del centro.                           | America/Santiago                                                      |
| `TEST_POSTGRES_URL`             | Solo pruebas de integración. Usar una base de pruebas separada.               | `postgresql+psycopg2://sesaes:TU_PASSWORD@localhost:5432/sesaes_test` |

SMTP usa actualmente `smtp.gmail.com:465` con SSL; host y puerto están definidos en código, no son variables configurables. Sin credenciales SMTP la agenda funciona y los intentos de correo quedan registrados como no enviados. No hace falta SMTP para crear cuentas ni para esta verificación; las contraseñas se entregan por un canal privado, no mediante estos endpoints.

No agregar contraseñas reales al `.env.example`, a los ejemplos, a seeds ni al repositorio. Si la contraseña PostgreSQL tiene caracteres reservados para URLs, codificarlos en el segmento de contraseña (`@` → `%40`, por ejemplo).

## 3. Crear la base vacía, el esquema y el primer superadmin

### 3.1. Crear rol y base en PostgreSQL

En una terminal, con las herramientas PostgreSQL disponibles:

```powershell
psql -h localhost -p 5432 -U postgres -d postgres -c "CREATE ROLE sesaes LOGIN;"
psql -h localhost -p 5432 -U postgres -d postgres -c '\password sesaes'
createdb -h localhost -p 5432 -U postgres -O sesaes -E UTF8 sesaes
```

El segundo comando pide dos veces la contraseña del nuevo rol. Guardarla en `DATABASE_URL` dentro de `backend/.env`. Si la cuenta administradora no se llama `postgres`, sustituir ese argumento por su nombre. Si el rol/base ya existen porque se completó este paso, no repetir su creación. Estos comandos solo crean el contenedor y el acceso: todavía no crean tablas ni datos de SESAES.

### 3.2. Crear todas las tablas

Volver a la terminal Python, situada en `backend/`, con el entorno virtual activo y `.env` configurado:

```powershell
$env:SEED_DEMO_DATA = 'false'
python -m alembic upgrade head
python -m alembic current
python -m alembic check
python -m scripts.auditar_esquema
```

`current` debe mostrar `8d2e4f6a901b (head)` y el auditor no debe informar diferencias. Se crean tablas, índices, claves foráneas y constraints, incluidas auditoría, acceso administrativo, documentos clínicos y bloques horarios. Alembic no crea ninguna cuenta. Repetir el upgrade es seguro en una base versionada.

El atajo equivalente es `python -m app.init_db`, que responde `Inicialización completada.` y ejecuta internamente `alembic upgrade head`. Con `SEED_DEMO_DATA=false` no añade usuarios. La revisión queda en `alembic_version`, una tabla de control adicional.

**Protección de la base histórica:** una BD SESAES con tablas pero sin revisión Alembic válida se rechaza antes de ejecutar DDL. No ejecutar `stamp` ni usarla para autogenerate a ciegas. La entrega se instala sobre una base nueva; ver [Operación y migraciones](OPERACION.md) para el flujo activo y sus límites. La base local de trabajo no se migró durante la integración de Alembic.

### 3.3. Crear el primer superadmin

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

## 4. Cargar datos iniciales reales, sin seed demo ni SQL manual

### 4.1. Vías disponibles y modelo de especialidades

| Dato                       | Panel actual                                                             | API / procedimiento                                          |
| -------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------ |
| Especialidad               | **Profesionales → Agregar profesional → + Nueva especialidad**           | Campo `especialidad` al hacer `POST /admin/profesionales`    |
| Profesional y su cuenta    | **Profesionales → Agregar profesional**                                  | `POST /admin/profesionales`                                  |
| Alumno y su cuenta         | El panel permite consulta/edición; **no tiene formulario de alta**       | **`POST /admin/estudiantes`**, incorporado para esta entrega |
| Semana de bloques          | Profesional: **Agenda → Solicitar horario semanal → Enviar solicitud**   | `POST /profesional/{id}/solicitar-bloques-horario`           |
| Aprobación de semana       | Administración: **Agenda → Solicitudes de horario pendientes → Aprobar** | `PATCH /admin/solicitudes-horario/{id}/aprobar`              |
| Administradores y permisos | Superadmin: **Administradores → Acceso administrativo**                  | Rutas `/usuarios/administradores` explicadas más abajo       |

**No existe tabla ni endpoint independiente de alta de especialidades.** La especialidad es un texto en `Profesional.especialidad`, con **una especialidad por profesional**. La primera alta de un profesional con un nombre de especialidad nuevo la incorpora a las listas dinámicas; no hay un catálogo vacío que deba precargarse antes. Mantener nombres coherentes, por ejemplo `Nutrición`. Un catálogo autónomo o múltiples especialidades por profesional requerirían otro desarrollo; no hacen falta para este flujo y no se resuelven insertando filas SQL.

El alta profesional está disponible tanto por panel como por API. **Ambas vías exigen una contraseña propia** con la política del paso 3 y un máximo de 72 bytes UTF-8. En el panel hay campos de contraseña y confirmación; no existe contraseña fija ni fallback, y la confirmación no muestra la clave. El alta de alumnos permanece **solo por API** por decisión de alcance: el panel no tiene formulario de alta y no se ofrece carga CSV. Está documentado como mejora futura; la vía API actual permite completar la instalación sin SQL manual.

Las listas, filtros y conteos de presentación normalizan mayúsculas, tildes y espacios: `Nutricion`, `nutrición` y `NUTRICIÓN` cuentan como una especialidad, conservando una etiqueta visible. No se reescriben datos históricos ni se amplían permisos RBAC por esta normalización visual. Sigue habiendo una especialidad por profesional, sin catálogo autónomo; un catálogo institucional y múltiples especialidades son deuda técnica explícita.

### 4.2. Iniciar API y preparar una consola de carga

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

### 4.3. Agregar especialidad y profesional

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

### 4.4. Agregar alumno

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

### 4.5. El profesional solicita sus bloques

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

### 4.6. El superadmin o administrador aprueba

```powershell
Api PATCH "/admin/solicitudes-horario/$($solicitud.id)/aprobar" $tokenSA
```

La API responde HTTP 200. También puede aprobar un admin con `agenda.gestionar` y alcance institucional o sobre la especialidad del profesional. Desde el panel, se hace en la tabla de solicitudes pendientes de la agenda administrativa.

**Sin bloques aprobados el calendario estudiantil queda completamente bloqueado.** La aprobación reemplaza toda la agenda semanal vigente del profesional. Los días no incluidos quedan sin atención. Una jornada simple, una solicitud pendiente o una solicitud rechazada no habilitan fechas para estudiantes.

### 4.7. Roles y permisos opcionales de otros administradores

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

## 5. Seed demo: opcional y separado de los datos reales

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

| Rol             | Cuentas de ejemplo incluidas en el código                                                                                                                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4 estudiantes   | `maria.gonzalez@utem.cl`, `carlos.munoz@utem.cl`, `valentina.rojas@utem.cl`, `diego.soto@utem.cl`                                                                                                                                     |
| 6 profesionales | `ana.martinez@utem.cl` (Medicina General), `roberto.fuentes@utem.cl` (Psicología), `klgo.soto@utem.cl` (Kinesiología), `val.rojas@utem.cl` (Odontología), `nut.munoz@utem.cl` (Nutrición), `joaquin.rodriguez@utem.cl` (Oftalmología) |
| 1 admin         | `admin@utem.cl`, sin acceso administrativo efectivo hasta configurarlo                                                                                                                                                                |

También crea seis registros profesionales vinculados con **duracion_min=60** y **90 bloques aprobados**: por profesional y día, disponible 09:00–13:00, colación 13:00–14:00 y disponible 14:00–17:30 de lunes a jueves o 14:00–16:30 el viernes (60 disponibles y 30 de colación). El default del modelo permanece en 45. Incluye los campos de perfil ficticios definidos en `app/init_db.py`. No crea citas, superadmin, fichas clínicas ni un catálogo independiente de especialidades. Todas esas cuentas utilizan la contraseña externa indicada.

El seed es transaccional y no duplica usuarios: si existe cualquier usuario, omite la carga. Por eso, en una base demo hay que sembrar **antes** de crear el superadmin, o ejecutar ambos con `python -m app.init_db --superadmin` y las variables necesarias. No activarlo para intentar completar una base real parcialmente cargada.

## 6. Levantar backend y frontend

### Backend — terminal 1

Si ya está corriendo desde el paso 4, dejar ese proceso; no abrir otro en el mismo puerto. En caso contrario, desde la raíz:

```powershell
cd backend
.\venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8080
```

La API queda en `http://localhost:8080`. El arranque también ejecuta `init_db()` para asegurar el esquema; no crea el superadmin automáticamente. `--reload` es para desarrollo local; en un despliegue real usar el proceso/supervisor correspondiente sin esa opción y definir `SESAES_ENV=production`.

### Frontend — terminal 2

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

## 7. Verificación final

### 7.1. Verificar el recorrido por API

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

### 7.2. Comprobar los paneles en el navegador

1. Abrir `http://localhost:4200`, iniciar sesión como superadmin y comprobar que aparece el profesional en **Profesionales** y el alumno en **Estudiantes**. No hace falta asignarse permisos adicionales.
2. Cerrar sesión, entrar con el correo/contraseña profesional y abrir **Agenda**. En **Solicitar horario semanal**, comprobar que la solicitud está aprobada y que los bloques corresponden al día elegido. En la agenda debe aparecer la cita si se realizó la prueba por API.
3. Cerrar sesión, entrar como alumno y abrir **Agendar hora**. Seleccionar el profesional y abrir el calendario: el día aprobado con cupos estará habilitado; otro día hábil sin bloques, los fines de semana y los cierres estarán deshabilitados. Mientras carga o falla la consulta, el calendario permanece bloqueado.
4. Para probar la reserva **por pantalla**, hacer este paso antes de la reserva API o cancelar primero la cita pendiente. La regla de una cita pendiente por especialidad impedirá una segunda reserva del mismo alumno. Elegir fecha habilitada y hora, confirmar y comprobar **Mis citas**.

### 7.3. Pruebas reproducibles

Seguir [PRUEBAS](PRUEBAS.md) para comandos de SQLite y PostgreSQL aislado.
Los resultados de la integración están identificados por fecha y no equivalen
a una medición de cobertura porcentual. No apuntar TEST_POSTGRES_URL a una base real.

## 8. Qué entregar y qué conservar en privado

Entregar código fuente, `PLAN_DE_MEJORAS.md`, README, evidencias de `docs/evidencias/`, requisitos Python, **`backend/alembic/` completo y `backend/alembic.ini`**, archivos de configuración frontend y lockfile npm, tests y `backend/.env.example`. **No entregar `backend/.env`, dumps, archivos `.db`/`.sqlite`, respaldos, credenciales, entornos virtuales, `node_modules`, cachés o exportaciones clínicas.** `.gitignore` ya excluye `.env`, entornos y dependencias; si se arma un ZIP copiando carpetas manualmente, revisar igualmente su contenido porque `.gitignore` no filtra un ZIP.

La base PostgreSQL local vive en el servicio PostgreSQL de la máquina del autor, no dentro del código. No exportarla ni incluirla: su ausencia es parte del diseño de esta entrega y no impide la instalación descrita. No hace falta ningún `.sql` ni script de migración. `backend/scripts/migrar_passwords_texto_plano.py` es mantenimiento para datos históricos y **no se ejecuta en una instalación limpia**.

La verificación de esta entrega se ejecutó también sobre una **base PostgreSQL 17 nueva y temporal**, eliminada al finalizar: esquema completo, superadmin, profesional/especialidad, alumno, logins, bloques pendientes/aprobados y cita auditada funcionaron sin parches. No se copiaron ni consultaron registros de la base local del autor.

## 9. Comprobaciones y decisiones actuales

- La entrega no incluye una base local ni dump. No se necesita SQL de parches.
- El esquema incluye las tablas de recuperación y bloqueo de cuenta.
- Recuperar contraseña requiere SMTP real; la solicitud puede responder de forma
  uniforme aunque no exista una cuenta o no llegue un mensaje.
- La API de alta de alumnos existe, pero la integración académica y la validación
  de matrícula no están conectadas.
- El seed demo usa 60 minutos por profesional y 90 bloques aprobados; no habilitarlo
  para completar una base real.
- El manual de uso de cada perfil está en [MANUAL_USUARIO](MANUAL_USUARIO.md).
- Para respaldos, actualizaciones y restauración, seguir [OPERACION](OPERACION.md).

### Linux y macOS

La configuración funcional y los endpoints son los mismos. Para crear el
entorno Python, sustituir la activación de PowerShell por:

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
python -m pip install -r requirements.txt
cp .env.example .env
```

Los ejemplos administrativos de esta guía usan PowerShell. Puede ejecutarse
PowerShell 7 o utilizar un cliente HTTP con los JSON equivalentes de [API](API.md).
No copiar secretos a una terminal compartida.
