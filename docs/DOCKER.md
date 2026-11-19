# Instalación local con Docker Compose

## 1. Alcance y estado de validación

La configuración incluye PostgreSQL, FastAPI y Angular compilado servido por
Nginx. Está destinada a desarrollo y demostración local. No configura HTTPS,
respaldo automático, un dominio público ni secretos de una infraestructura real.

**Estado de esta ronda:** los archivos fueron revisados contra los comandos y
rutas del proyecto. El motor Docker no estaba activo, por lo que no se ejecutaron
build ni arranque de contenedores. La validación automática de Compose quedó
pendiente por indisponibilidad del sistema de aprobación. No se presenta este
flujo como una instalación Docker ya probada. La alternativa local y las pruebas
de aplicación están en [INSTALACION](INSTALACION.md) y [PRUEBAS](PRUEBAS.md).

## 2. Requisitos y archivos

- Docker Engine/Docker Desktop iniciado, usando contenedores Linux.
- Docker Compose v2.
- Puertos locales 4200 y 8080 disponibles.
- Internet para descargar imágenes, paquetes Python/Node, SheetJS y recursos
  externos del frontend.
- PowerShell 7 para los ejemplos de entrada oculta. También puede adaptar las
  variables de entorno a su terminal.

```powershell
docker version
docker compose version
```

Archivos: compose.yaml, backend/Dockerfile, frontend/Dockerfile,
frontend/nginx.conf y los dos .dockerignore. La plantilla pública es
.env.docker.example. No se utiliza la base PostgreSQL instalada en la máquina.

## 3. Preparar secretos

Desde la raíz del repositorio:

```powershell
Copy-Item .env.docker.example .env.docker
```

Edite .env.docker. Reemplace POSTGRES_PASSWORD y JWT_SECRET_KEY por dos secretos
distintos. Para generar un valor hexadecimal, si dispone de Python:

```powershell
python -c "import secrets; print(secrets.token_hex(32))"
```

Use una contraseña PostgreSQL hexadecimal con esta plantilla: no contiene
caracteres que deban codificarse en la URL. No deje los marcadores de ejemplo.
El secreto JWT inseguro impedirá arrancar la aplicación.

.env.docker está ignorado por Git. Nunca lo incluya en capturas o PR.

## 4. Crear y arrancar

```powershell
docker compose --env-file .env.docker config --quiet
docker compose --env-file .env.docker up -d --build
docker compose --env-file .env.docker ps
docker compose --env-file .env.docker logs --tail 80 backend
```

PostgreSQL debe estar healthy antes del backend. FastAPI aplica upgrade head
al iniciar y su healthcheck habilita el frontend. Se crea el esquema, no cuentas.

| Servicio      | Dirección                    |
| ------------- | ---------------------------- |
| Angular       | http://localhost:4200        |
| API           | http://localhost:8080        |
| Salud API     | http://localhost:8080/health |
| Swagger local | http://localhost:8080/docs   |

La base es accesible internamente como db:5432; no se publica su puerto en el host.
Los puertos HTTP se vinculan a 127.0.0.1. Abra el navegador con localhost para
coincidir con CORS y los enlaces configurados.

## 5. Cuentas iniciales

Elija una de las dos alternativas. El seed se omite si ya existe algún usuario.

### A. Entorno sin datos demo

```powershell
$env:SUPERADMIN_BOOTSTRAP_EMAIL = 'superadmin@utem.cl'
$env:SUPERADMIN_BOOTSTRAP_NAME = 'Superadministrador SESAES'
$env:SUPERADMIN_BOOTSTRAP_PASSWORD = Read-Host -MaskInput 'Contraseña nueva del superadmin'
docker compose --env-file .env.docker run --rm -e SUPERADMIN_BOOTSTRAP_EMAIL -e SUPERADMIN_BOOTSTRAP_NAME -e SUPERADMIN_BOOTSTRAP_PASSWORD backend python -m app.init_db --superadmin
Remove-Item Env:SUPERADMIN_BOOTSTRAP_PASSWORD
```

Siga [INSTALACION](INSTALACION.md) para altas reales y aprobación de bloques.

### B. Demostración en una base sin usuarios

Ejecutar **antes del bootstrap** de la alternativa A:

```powershell
$env:SEED_DEMO_PASSWORD = Read-Host -MaskInput 'Contraseña nueva de las cuentas demo'
docker compose --env-file .env.docker run --rm -e SEED_DEMO_DATA=true -e SEED_DEMO_PASSWORD backend python -m app.init_db
Remove-Item Env:SEED_DEMO_PASSWORD
```

Después ejecute el bootstrap de A. El seed crea once cuentas ficticias,
seis profesionales de 60 minutos y 90 bloques; no crea el superadmin.
Configure los permisos efectivos del admin demo desde el superadmin.
Las claves solo son las indicadas por el instalador; no hay una contraseña
publicada para utilizarlas.

## 6. Configuración y mantenimiento local

Compose no usa backend/.env; entrega las variables al contenedor.
Si configura SMTP en .env.docker, recree el backend para aplicar los cambios:

```powershell
docker compose --env-file .env.docker up -d backend
```

La URL de API se incorpora al build de Angular. Para otro dominio, adaptar
build args, CORS, FRONTEND_BASE_URL y el despliegue; no basta reiniciar Nginx.

Comprobar revisión del esquema:

```powershell
docker compose --env-file .env.docker run --rm backend python -m alembic current
docker compose --env-file .env.docker run --rm backend python -m alembic check
```

No ejecutar varios inicializadores/seed simultáneamente.

## 7. Detener y conservar datos

```powershell
docker compose --env-file .env.docker down
```

El volumen postgres_data conserva la base entre arranques.
No añadir -v a este comando salvo que se quiera eliminar de forma deliberada
esa base y exista un respaldo verificado.

Cambiar POSTGRES_PASSWORD en el archivo después de inicializar el volumen no
cambia por sí mismo la contraseña dentro de PostgreSQL.

Para respaldo y recuperación, ver [OPERACION](OPERACION.md). No reutilice este
volumen local como una base institucional productiva.
