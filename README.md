# SESAES

**Agenda y atención de salud estudiantil · Proyecto de título UTEM**

[![CI](https://github.com/xxt-cote/Proyecto-de-titulo-SESAES/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/xxt-cote/Proyecto-de-titulo-SESAES/actions/workflows/ci.yml)
[![Cobertura](https://img.shields.io/badge/cobertura-no%20medida-lightgrey)](docs/PRUEBAS.md)
![Angular 22](https://img.shields.io/badge/Angular-22-DD0031)
![FastAPI 0.163](https://img.shields.io/badge/FastAPI-0.163-009688)
![Python 3.13](https://img.shields.io/badge/Python-3.13-3776AB)
![PostgreSQL 17](https://img.shields.io/badge/PostgreSQL-17-4169E1)
[![Licencia](https://img.shields.io/badge/licencia-pendiente%20de%20definici%C3%B3n-lightgrey)](LICENSE)

SESAES centraliza profesionales, disponibilidad, citas, antecedentes, documentos
y operación administrativa del servicio de salud estudiantil. Angular presenta
la interfaz; FastAPI aplica las reglas, permisos y alcance; PostgreSQL conserva
el estado transaccional.

**La entrega contiene código y migraciones, no una base local ni un dump con datos.**
El esquema se genera con Alembic. Las cuentas reales las carga el responsable de
la instalación; los datos demo son optativos y ficticios.

> Versión documentada: integración del 19-11-2026. El badge CI consulta GitHub;
> los resultados locales y sus límites están en docs/PRUEBAS.md.
> No se declara cobertura porcentual ni licencia abierta no aprobada.

## Empezar aquí

- **Usar la aplicación:** [manual de los cuatro roles](docs/MANUAL_USUARIO.md).
- **Recibir e instalar el proyecto:** [instalación desde cero](docs/INSTALACION.md).
- **Continuar el desarrollo:** [arquitectura](docs/ARQUITECTURA.md),
  [diagramas](docs/DIAGRAMAS.md) y [contribución](CONTRIBUTING.md).
- **Consultar todo:** [índice de documentación](docs/INDICE.md).

## Qué permite hacer

| Perfil      | Funciones principales                                                                              |
| ----------- | -------------------------------------------------------------------------------------------------- |
| Estudiante  | Reservar horas permitidas, gestionar citas, responder cuestionarios y descargar documentos propios |
| Profesional | Consultar agenda/pacientes autorizados, solicitar bloques y registrar atenciones/documentos        |
| Admin       | Operar agenda, profesionales, estudiantes, solicitudes y reportes según permiso y alcance          |
| Superadmin  | Configurar acceso administrativo, capacidades, cierres y consultar actividad institucional         |

ADMIN no recibe permisos efectivos por defecto. SUPERADMIN no obtiene acceso
clínico universal. La API verifica identidad, permiso, alcance y pertenencia.

## Instalación desde cero

1. Preparar PostgreSQL, Python y Node compatibles, o elegir Docker local.
2. Crear una base vacía y configurar secretos propios desde las plantillas.
3. Ejecutar **python -m app.init_db**, equivalente al upgrade Alembic vigente.
4. Crear el primer superadmin con **python -m app.init_db --superadmin**.
5. Cargar datos autorizados y aprobar los bloques profesionales.
6. Levantar la interfaz y verificar acceso y una reserva.

La [guía de instalación](docs/INSTALACION.md) contiene comandos completos de
PowerShell, ejemplos de carga por API y alternativas para otros entornos.
No hacen falta dumps ni parches SQL. Si se quiere demo y superadmin, el seed se
ejecuta primero, sobre una base sin usuarios.

## Inicio rápido con Docker

Incluye PostgreSQL, backend y frontend en Nginx. Requiere Docker Engine activo,
Compose v2 y conexión a los registros de imágenes y dependencias.

**Estado:** la ejecución de contenedores está pendiente de validar; el motor
Docker no estaba activo durante esta ronda. No se anuncia como un despliegue
productivo. Instrucciones y alcance en [DOCKER](docs/DOCKER.md).

Desde la raíz:

```powershell
Copy-Item .env.docker.example .env.docker
# Editar .env.docker: definir POSTGRES_PASSWORD y JWT_SECRET_KEY propios.
docker compose --env-file .env.docker config --quiet
docker compose --env-file .env.docker up -d --build
docker compose --env-file .env.docker ps
```

Abrir http://localhost:4200. La API está en http://localhost:8080.
Al iniciar se crea el esquema, pero todavía no hay usuarios.

Para crear el primer superadmin:

```powershell
$env:SUPERADMIN_BOOTSTRAP_EMAIL = 'superadmin@utem.cl'
$env:SUPERADMIN_BOOTSTRAP_NAME = 'Superadministrador SESAES'
$env:SUPERADMIN_BOOTSTRAP_PASSWORD = Read-Host -MaskInput 'Contraseña nueva'
docker compose --env-file .env.docker run --rm -e SUPERADMIN_BOOTSTRAP_EMAIL -e SUPERADMIN_BOOTSTRAP_NAME -e SUPERADMIN_BOOTSTRAP_PASSWORD backend python -m app.init_db --superadmin
Remove-Item Env:SUPERADMIN_BOOTSTRAP_PASSWORD
```

Para practicar con once cuentas ficticias y 90 bloques, seguir el orden
**seed primero, bootstrap después** de [Docker](docs/DOCKER.md).
No hay contraseñas demo publicadas.

Para detener conservando datos:

```powershell
docker compose --env-file .env.docker down
```

## Desarrollo local sin contenedores

Referencias: Python 3.13, PostgreSQL 17 y npm 11. Angular instalado admite Node
^22.22.3, ^24.15.0 o >=26.0.0. CI también contempla Python 3.12.
La guía explica instalación de dependencias, rol/base y variables antes de estos
comandos.

Terminal backend, desde backend y con el entorno virtual activo:

```powershell
python -m app.init_db
python -m uvicorn app.main:app --reload --port 8080
```

Terminal frontend:

```powershell
cd frontend
npm ci
npm start
```

NG_APP_API_URL permite configurar la API antes de serve/build; su valor local
predeterminado es http://localhost:8080. Consultar [CONFIGURACION](docs/CONFIGURACION.md).
En desarrollo, Swagger está en /docs y el chequeo de vida en /health.

## Reglas que conviene conocer

- El calendario estudiantil depende de bloques aprobados y disponibilidad real.
  Una solicitud pendiente no habilita días.
- Una hora libre se agenda como normal. El sobrecupo necesita permiso adicional,
  motivo y capacidad; conserva la cita anterior.
- El horario de negocio es America/Santiago. La colación se configura explícitamente.
- Los documentos nuevos incluyen identificación, folio, barras y QR, sin firma
  gráfica. Autenticidad, cobertura de ausencia y vigencia son comprobaciones distintas.
- No existe SSO, consulta académica o verificación de matrícula conectados.
  Correo institucional no equivale a alumno matriculado.
- Una especialidad textual por profesional; alta de estudiantes disponible por API.
- Head de esquema: **8d2e4f6a901b**, posterior a **253cae9c234a**.

## Documentación técnica y operativa

| Tema                                       | Guía                                                                 |
| ------------------------------------------ | -------------------------------------------------------------------- |
| Arquitectura y decisiones                  | [ARQUITECTURA](docs/ARQUITECTURA.md)                                 |
| Diagramas de arquitectura, ER y secuencias | [DIAGRAMAS](docs/DIAGRAMAS.md), [MODELO_DATOS](docs/MODELO_DATOS.md) |
| API y rutas                                | [API](docs/API.md), [referencia HTTP](docs/API_REFERENCIA.md)        |
| Configuración y secretos                   | [CONFIGURACION](docs/CONFIGURACION.md)                               |
| Migraciones, backups y restauración        | [OPERACION](docs/OPERACION.md)                                       |
| Pruebas, evidencia y cobertura             | [PRUEBAS](docs/PRUEBAS.md)                                           |
| Continuación de integración universitaria  | [INTEGRACION_INSTITUCIONAL](docs/INTEGRACION_INSTITUCIONAL.md)       |
| Problemas frecuentes                       | [SOLUCION_PROBLEMAS](docs/SOLUCION_PROBLEMAS.md)                     |
| Vulnerabilidades                           | [SECURITY](SECURITY.md)                                              |
| Trabajo del equipo                         | [CONTRIBUTING](CONTRIBUTING.md)                                      |
| Cambios visibles                           | [CHANGELOG](CHANGELOG.md)                                            |
| Historial y pendientes detallados          | [PLAN_DE_MEJORAS](PLAN_DE_MEJORAS.md)                                |

## Estado de calidad y licencia

La integración registró 1.691 pruebas backend aprobadas, 8 omitidas y 20 subtests;
1.007 frontend aprobadas, y build correcto con dos avisos CSS. Los 52 casos
PostgreSQL forman parte de la comprobación conjunta. No es una cifra de cobertura.

SMTP institucional, ejecución Docker, despliegue y decisiones de datos/SSO
conservan pendientes expresos. Para cambios nuevos, ejecutar las comprobaciones
correspondientes; no reutilizar una cifra histórica como resultado de otro commit.

[LICENSE](LICENSE) registra que la licencia propia todavía está por definir con
el equipo y la institución. Las dependencias conservan sus licencias respectivas.
