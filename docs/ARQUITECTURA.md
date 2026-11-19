# Arquitectura técnica

## 1. Propósito y alcance

SESAES administra la agenda y las atenciones del servicio de salud estudiantil:
cuentas, profesionales, bloques horarios, citas, cuestionarios, antecedentes,
documentos clínicos, reportes y trazabilidad administrativa.

La entrega contiene código y migraciones; la base comienza vacía.
PostgreSQL es el motor de operación. SQLite se usa en pruebas, pero no sustituye
los bloqueos transaccionales que protegen la agenda en PostgreSQL.

## 2. Componentes

| Componente           | Tecnología                                     | Responsabilidad                                                    |
| -------------------- | ---------------------------------------------- | ------------------------------------------------------------------ |
| Interfaz             | Angular 22, componentes standalone, TypeScript | Navegación por rol, formularios, agenda, presentación y descargas  |
| API                  | FastAPI, Pydantic                              | Autenticación, validación y autorización de cada operación         |
| Persistencia         | SQLAlchemy 2 y PostgreSQL 17                   | Estado transaccional y relaciones                                  |
| Evolución de esquema | Alembic                                        | Crear y actualizar el esquema versionado                           |
| PDFs                 | fpdf2 y segno                                  | Documentos, folio, barras, QR y reportes                           |
| Exportaciones        | openpyxl y SheetJS                             | Archivos de análisis y reportes                                    |
| Correo               | SMTP SSL de Gmail configurado en el backend    | Avisos y enlaces de recuperación                                   |
| Pruebas              | pytest, TestClient y Vitest                    | Reglas, permisos, interfaces y regresiones                         |
| CI                   | GitHub Actions y CodeQL                        | Automatización del repositorio; ejecución remota sujeta al entorno |

Ver la representación gráfica en [DIAGRAMAS](DIAGRAMAS.md).

## 3. Organización del código

```text
backend/
  app/
    main.py                 Entrada HTTP y ciclo de vida
    database.py             Motor y sesiones SQLAlchemy
    models/                 Modelos persistentes
    routers/                Endpoints por dominio
    services/               Reglas compartidas y generación de documentos
    rbac/                   Permisos y alcance administrativo
    security.py             Hash de contraseñas y JWT
    tiempo.py               Hora de negocio y compatibilidad POSIX
    migrations.py           Acceso común al historial Alembic
  alembic/versions/          Revisiones del esquema
  scripts/                  Herramientas operativas vigentes
  tests/                    Pruebas
frontend/
  src/app/
    dashboard-estudiante/
    dashboard-profesional/
    dashboard-admin/        Incluye inicio institucional del superadmin
    recuperar-password/
    validar-documento/
    shared/                 Calendario, fechas, documentos y otros elementos
  scripts/angular.mjs       Parámetro de URL de API para serve/build
docs/                       Guías actuales y evidencias
```

No todos los módulos compartidos se utilizan actualmente. Su retirada sigue
siendo una decisión de limpieza pendiente; no se asume que deban eliminarse
solo por aparecer en el historial del plan.

## 4. Autenticación y autorización

La autenticación actual es **local**: correo, contraseña, hash bcrypt y JWT.
El frontend conserva la sesión en sessionStorage y envía el token Bearer.
No hay SSO institucional conectado ni validación automática de matrícula.

El rol no basta para autorizar todos los recursos:

1. El backend verifica el token y la cuenta.
2. Resuelve permiso y, para administración, configuración efectiva y alcance.
3. Comprueba pertenencia del recurso cuando corresponde: profesional propio,
   estudiante propietario o especialidad permitida.
4. Ejecuta y registra los eventos que implementa el módulo.

ADMIN parte sin permisos efectivos si no tiene acceso válido configurado.
SUPERADMIN recibe permisos administrativos explícitos; no obtiene por ello
lectura universal de la ficha clínica. Ocultar un botón en Angular ayuda a
orientar al usuario, pero la decisión de seguridad ocurre en la API.

La recuperación usa token aleatorio cuyo hash se persiste. Tiene vencimiento,
uso único y respuesta uniforme al solicitar el enlace. Hay límites por IP y
cuenta, además de bloqueo temporal tras cinco fallos. No existe cierre automático
de todas las sesiones JWT previas documentado como parte del restablecimiento.

## 5. Agenda y concurrencia

Los bloques semanales aprobados constituyen la disponibilidad para estudiantes.
La solicitud pendiente no habilita días. Horario institucional: lunes a jueves
09:00–17:30 y viernes 09:00–16:30; colación explícita, no descuento automático.

El calendario de bienvenida es informativo y compartido entre roles.
El selector para reservar aplica reglas de disponibilidad y es un componente
distinto: no deben confundirse.

La creación vuelve a validar en backend: profesional, día aprobado, jornada,
cierres, intervalo y conflictos. PostgreSQL utiliza un advisory lock por
profesional/fecha para serializar intentos incompatibles. No se debe retirar el
lock porque la interfaz ya consultó disponibilidad: entre consulta y reserva
puede haber otra transacción.

Una hora libre se reserva como cita normal. El sobrecupo es excepcional:
requiere permisos de gestión y sobrecupo, motivo y capacidad admitida; no
mueve la cita anterior. Las pruebas comprueban que un mismo intervalo ocupado
no termine con más de dos citas activas.

Aprobar una solicitud de bloques reemplaza la semana aprobada completa.
No reprograma por sí mismo las citas ya creadas; revisar sus efectos al operar.

## 6. Tiempo

La zona de negocio es America/Santiago, con cambios estacionales de la base IANA.
Las funciones explícitas funcionan también en Windows. Se conserva el ajuste
POSIX de zona de proceso como compatibilidad; no sustituye el reloj de negocio.
JWT, tokens de recuperación e instantes técnicos mantienen UTC.

Existen columnas históricas sin zona: no se convierten masivamente al instalar.
Ver tipo físico y nulabilidad en [MODELO_DATOS](MODELO_DATOS.md).

## 7. Documentos

Al completar una atención, el profesional puede emitir receta o justificativo
si su especialidad tiene la capacidad habilitada. El contenido se guarda como
instantánea junto con huella SHA-256 y folio único; no se reconstruye únicamente
desde datos actuales del paciente o profesional.

Los PDFs nuevos conservan identificación del profesional y del estudiante, pero
no dibujan firma gráfica. Incluyen folio, barras y QR. La compatibilidad de
firmas históricas permanece en el modelo y perfil.

La autenticidad no equivale a aptitud para todo uso: un justificativo cubre
un intervalo y una receta tiene fecha límite independiente de la duración de
cada tratamiento. La consulta pública limita la información personal y no
registra dispensación ni impide por sí sola retiros repetidos.

## 8. Esquema y evolución

Head vigente: 8d2e4f6a901b, posterior a la base 253cae9c234a.
Hay 28 tablas de dominio y la tabla de control alembic_version.

Los modelos expresan el esquema objetivo; las revisiones Alembic son el
historial ejecutable. Modificar un modelo no actualiza automáticamente una
base existente. init_db ejecuta upgrade head; no crea usuarios salvo opciones
explícitas de seed/bootstrap. Una base con tablas SESAES sin versión válida se
rechaza para evitar una adopción accidental.

## 9. Dependencias y distribución

Las dependencias Python están en backend/requirements.txt; Node usa
frontend/package.json y package-lock.json. Para Node, instalar con npm ci.
SheetJS se descarga del CDN indicado en el lockfile: la instalación necesita
alcanzarlo. Las fuentes e iconos externos también requieren conectividad
según la configuración del frontend.

Las licencias de dependencias pertenecen a sus respectivos titulares.
La licencia propia de SESAES está pendiente; [LICENSE](../LICENSE) registra
ese estado sin otorgar permisos no acordados.

## 10. Límites vigentes

- Sin integración académica, SSO, lista oficial de carreras ni consulta de matrícula.
- Una especialidad textual por profesional; no hay catálogo autónomo.
- Alta estudiantil disponible por API, sin formulario dedicado de alta.
- Cuenta activa no equivale a estudiante matriculado en el período.
- Sin control integrado de entregas de medicamentos.
- Sin cobertura porcentual medida ni certificación de accesibilidad completa.
- SMTP real, publicación, respaldo automático y políticas institucionales
  requieren configuración o aprobación externa.

Ver [integración institucional](INTEGRACION_INSTITUCIONAL.md) y el plan de mejoras
para continuar sin confundir estas limitaciones con funcionalidades entregadas.
