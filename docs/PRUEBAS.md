# Pruebas y evidencia

## 1. Qué se verificó

Resultados locales de la integración del 19-11-2026, anterior a esta ronda
documental, commit 194d3c5:

| Comprobación                            | Resultado registrado                                            |
| --------------------------------------- | --------------------------------------------------------------- |
| Suite backend con PostgreSQL de pruebas | 1.691 aprobadas, 8 omitidas, 20 subtests aprobados              |
| Selección PostgreSQL aislada            | 52 aprobadas                                                    |
| Frontend                                | 1.007 aprobadas en 55 archivos                                  |
| Build de producción                     | Aprobado, dos avisos de tamaño CSS                              |
| Esquema                                 | Upgrade/downgrade, equivalencia con modelos y datos conservados |

Las 52 pruebas PostgreSQL forman parte de la verificación conjunta; no se suman
a 1.691 para anunciar otra cifra. Las omisiones tienen condiciones de entorno
o plataforma. Las pruebas POSIX de tzset no se ejecutan como tales en Windows.

Estos resultados no son un porcentaje de cobertura. No hay un reporte de
cobertura versionado ni un servicio de cobertura configurado que permita
afirmar, por ejemplo, 90 %. El badge del README dice **no medida**.

## 2. Backend sin acceso a datos reales

Desde backend, con el entorno virtual activo:

```powershell
$env:DATABASE_URL = 'sqlite:///:memory:'
$env:JWT_SECRET_KEY = 'clave-exclusiva-tests-no-produccion-0123456789'
$env:SEED_DEMO_DATA = 'false'
python -m pytest -q
```

No usar esa clave fuera de pruebas. No configurar SMTP real en esta terminal.
Las pruebas con envío de recuperación simulan el transporte.
Sin TEST_POSTGRES_URL, los casos que lo requieren se omiten explícitamente.

## 3. PostgreSQL real

Crear una base exclusiva de pruebas, con un rol que pueda crear sus esquemas.
Algunas pruebas crean tablas y eliminan recursos de prueba: no apuntar a
desarrollo con información útil ni a producción.

Ejemplo de creación, ajustando el usuario PostgreSQL:

```powershell
createdb -U postgres sesaes_test
```

Defina TEST_POSTGRES_URL en la terminal con la conexión privada a esa base.
Mantenga DATABASE_URL en SQLite para la configuración general de la suite.

```powershell
python -m pytest -q -m postgres
python -m pytest -q
```

La segunda ejecución incluye los casos PostgreSQL admitidos por ese entorno.
Prueban advisory locks reales con sesiones concurrentes, capacidad de
sobrecupo, aislamiento, creación desde cero y equivalencia física del esquema.

La prueba de migración incremental también comprueba que actualizar desde
253cae9c234a y revertir solo la revisión de seguridad no borre un usuario previo.

## 4. Frontend

Desde frontend, con las dependencias del lockfile:

```powershell
npm ci
npm test -- --watch=false
npm run build
```

Angular carga src/test-setup.ts para compatibilidad del storage de pruebas y
vitest.config.ts limita trabajadores para evitar agotar memoria.
El frontend actual usa Vitest con el builder de Angular, no Karma.

El build mantiene advertencias de presupuesto CSS de los dashboards de admin
y profesional. No se elevó el límite para ocultarlas; separar estilos sigue
siendo un pendiente.

## 5. Comprobación manual mínima

1. Entrar con cada uno de los cuatro roles.
2. Confirmar que un admin sin configuración no recibe permisos implícitos.
3. Crear profesional y alumno en un entorno de pruebas.
4. Sin bloques aprobados, comprobar que el estudiante no tiene fechas habilitadas.
5. Solicitar y aprobar bloques; reservar una hora permitida.
6. Intentar una fecha sin bloque por API: debe rechazarse.
7. Reservar como admin en una hora libre: cita normal.
8. Agregar sobrecupo autorizado sobre una ocupada: conservar la primera cita.
9. Comprobar que no se acepta una tercera cita activa incompatible.
10. Completar una atención y consultar PDF/QR/período según el tipo.
11. Probar recuperación solo con un buzón de pruebas autorizado.
12. Comprobar tema, navegación por teclado y menú móvil.

Nunca efectuar estas pruebas modificando pacientes reales.

## 6. CI, cobertura y límites

Los workflows están en .github/workflows. El badge de CI consulta el estado
publicado en GitHub; no representa un resultado local simulado.
En un repositorio privado, puede requerir autenticación para mostrarse.

Los análisis de dependencias configurados como informativos no bloquean
necesariamente una integración. Revisar sus resultados, no solo el color
global del workflow. CodeQL depende de la habilitación disponible del repositorio.

No se afirma que existan E2E automatizadas completas, auditoría de penetración,
certificación de accesibilidad, SMTP institucional verificado o un despliegue
Docker ejecutado en esta ronda. Los archivos Docker se incorporaron con la
documentación y su ejecución está pendiente de validar.

Las imágenes en docs/evidencias son comprobaciones de rondas identificadas;
no reemplazan la ejecución de la suite sobre un cambio nuevo.
