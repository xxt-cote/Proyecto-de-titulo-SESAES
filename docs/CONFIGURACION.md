# Configuración y variables de entorno

## Archivos y prioridad

| Modalidad      | Plantilla                       | Archivo privado                       |
| -------------- | ------------------------------- | ------------------------------------- |
| Backend local  | backend/.env.example            | backend/.env                          |
| Compose local  | .env.docker.example             | .env.docker                           |
| Frontend local | Variable de terminal o pipeline | NG_APP_API_URL antes de iniciar/build |

El backend carga backend/.env sin sobreescribir variables ya presentes en el
proceso. Un valor antiguo en una terminal puede apuntar a otra base aunque se
edite el archivo: comprobar el entorno antes de ejecutar migraciones.

Nunca versionar archivos privados, dumps, contraseñas, tokens ni URL de conexión
con credenciales reales. Los ejemplos siguientes son marcadores, no credenciales.

## Variables de aplicación

| Variable                      | Uso y comportamiento                                                       | Ejemplo                                                        |
| ----------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------- |
| DATABASE_URL                  | Obligatoria. Conexión SQLAlchemy; PostgreSQL para operar                   | postgresql+psycopg2://sesaes:TU_PASSWORD@localhost:5432/sesaes |
| JWT_SECRET_KEY                | Obligatoria, aleatoria y privada; se rechazan valores inseguros/de ejemplo | Generar con secrets.token_hex(32)                              |
| JWT_EXPIRE_MINUTES            | Vigencia del JWT; entero positivo de minutos                               | 720                                                            |
| CORS_ORIGINS                  | Orígenes completos autorizados, separados por coma                         | http://localhost:4200                                          |
| SESAES_ENV                    | production oculta docs, redoc y openapi.json                               | development local                                              |
| FRONTEND_BASE_URL             | URL visible para QR y enlace de recuperación                               | http://localhost:4200                                          |
| SEED_DEMO_DATA                | Solo true habilita seed; debe ser false para datos reales                  | false                                                          |
| SEED_DEMO_PASSWORD            | Externa, solo al sembrar una base sin usuarios                             | Entrada oculta por terminal                                    |
| SUPERADMIN_BOOTSTRAP_EMAIL    | Correo del primer superadmin                                               | superadmin@utem.cl                                             |
| SUPERADMIN_BOOTSTRAP_PASSWORD | Contraseña externa; no tiene fallback                                      | Entrada oculta por terminal                                    |
| SUPERADMIN_BOOTSTRAP_NAME     | Nombre visible del primer superadmin                                       | Superadministrador SESAES                                      |
| SMTP_EMAIL                    | Remitente Gmail; opcional hasta configurar correo                          | cuenta autorizada                                              |
| SMTP_APP_PASSWORD             | Contraseña de aplicación del remitente                                     | Secreto privado                                                |
| SMTP_NOMBRE_REMITENTE         | Nombre mostrado al enviar                                                  | SESAES                                                         |
| RESET_TOKEN_MINUTES           | Vencimiento del enlace de recuperación                                     | 30                                                             |
| SESAES_TZ                     | Compatibilidad POSIX de zona del proceso; conservar Santiago               | America/Santiago                                               |
| TEST_POSTGRES_URL             | Exclusiva para una base desechable de pruebas                              | Base distinta de desarrollo/producción                         |
| NG_APP_API_URL                | URL pública de API incorporada al bundle de Angular                        | http://localhost:8080                                          |

SMTP usa smtp.gmail.com:465 con SSL en el código actual. No existen variables
SMTP_HOST ni SMTP_PORT funcionales; agregarlas al .env no cambia ese servidor.
Sin SMTP, reservar no depende de correo, pero no llegará un enlace de recuperación.

El dominio @utem.cl de las altas y del formulario de login no es una variable
configurable. Cambiar de institución requiere adaptar esas validaciones.

## Particularidades Docker

POSTGRES_DB, POSTGRES_USER y POSTGRES_PASSWORD son variables de la imagen de
PostgreSQL y de Compose. La URL interna usa host db; el navegador usa localhost
para la API publicada. Usar una contraseña PostgreSQL hexadecimal en esta
configuración evita caracteres reservados en la URL.

Compose usa development y puertos vinculados a 127.0.0.1 para una práctica local.
No es un manifiesto de producción con HTTPS, dominio y gestión de secretos.

## Generación de secretos

En una consola privada con Python instalado:

```powershell
python -c "import secrets; print(secrets.token_hex(32))"
```

Generar valores diferentes para JWT y PostgreSQL. No pegar el resultado en
issues, documentación o capturas. Si la contraseña de una conexión local tiene
caracteres reservados, codificar el segmento de contraseña de la URL.

## Cambio de URL del frontend

Desde frontend, antes de compilar:

```powershell
$env:NG_APP_API_URL = 'https://api.ejemplo.invalid'
npm run build
Remove-Item Env:NG_APP_API_URL
```

La URL no es secreta. Cambiar la variable después de generar el bundle no
modifica ese bundle. CORS y FRONTEND_BASE_URL deben corresponder al despliegue
real; localhost y 127.0.0.1 son orígenes distintos para el navegador.
