# Operación, migraciones y respaldo

## 1. Responsabilidad de una instalación

El responsable técnico debe conocer qué entorno opera, dónde está PostgreSQL,
quién administra secretos y dónde se guardan los respaldos.
Las cuentas y datos de la máquina del equipo no forman parte de la entrega.

Consultar [CONFIGURACION](CONFIGURACION.md) antes de arrancar.
El manifiesto Compose es local; un despliegue real necesita su configuración
de red, HTTPS, correo, custodia de datos y acceso operativo.

## 2. Comprobación de servicio

```powershell
Invoke-RestMethod http://localhost:8080/health
```

La respuesta esperada es status=ok. Es un chequeo de vida; no sustituye una
prueba de acceso a datos, una reserva o el monitoreo de dependencias.

Revisar logs del proceso y, en Compose:

```powershell
docker compose --env-file .env.docker ps
docker compose --env-file .env.docker logs --tail 100 backend
```

No publicar logs que contengan identificadores o información de pacientes.

## 3. Actualizar una copia versionada

1. Confirmar revisión de código y base objetivo.
2. Guardar un respaldo y comprobar que puede leerse.
3. Probar la actualización sobre una restauración separada.
4. Programar una ventana si hay cambios incompatibles.
5. Aplicar código y revisión de esquema.
6. Comprobar salud, acceso y un recorrido autorizado de prueba.
7. Registrar resultado y responsable.

Desde backend con variables privadas configuradas:

```powershell
python -m alembic current
python -m alembic upgrade head
python -m alembic check
python -m scripts.auditar_esquema
```

Head actual: 8d2e4f6a901b. init_db ejecuta ese mismo historial.
No confundir el archivo de modelos con una migración automática de datos.

Una base con tablas SESAES pero sin revisión Alembic no se adopta a ciegas.
No resolverlo con stamp ni create_all sobre la base real. Preparar una
copia y un procedimiento de adopción revisado.

## 4. Crear una nueva revisión

Solo en desarrollo y sobre una base desechable en head:

```powershell
python -m alembic revision --autogenerate -m "descripcion_del_cambio"
```

Revisar el archivo a mano: índices parciales, nombres, CHECK, defaults,
restricciones, datos y reversibilidad. Autogenerate no garantiza equivalencia
completa. Agregar pruebas, aplicar upgrade, verificar check y probar downgrade
en una copia. No reescribir una revisión que ya está aplicada por otra persona.

## 5. Respaldar PostgreSQL local

Usar herramientas PostgreSQL compatibles con la versión del servidor.
Los siguientes comandos no se ejecutan como parte de abrir esta documentación.

En una terminal privada, ajustando host, usuario y base:

```powershell
$carpeta = Join-Path $env:USERPROFILE 'RespaldosSESAES'
New-Item -ItemType Directory -Path $carpeta -Force | Out-Null
$archivo = Join-Path $carpeta ("sesaes-" + (Get-Date -Format 'yyyyMMdd-HHmmss') + ".dump")
pg_dump -h localhost -U sesaes -W -d sesaes -F c -f $archivo
pg_restore --list $archivo
```

El resultado contiene datos sensibles si la base los tiene. Cifrar y custodiar
el respaldo fuera del repositorio. Listar el archivo no demuestra que una
restauración completa funcione: probarla en una base separada.

No escribir contraseñas reales en los argumentos o ejemplos.

## 6. Restaurar sin sobrescribir la base original

Crear una base nueva, propiedad del rol autorizado, y restaurar allí:

```powershell
createdb -h localhost -U postgres -O sesaes sesaes_restaurada
pg_restore --exit-on-error --no-owner -h localhost -U sesaes -W -d sesaes_restaurada $archivo
```

Configurar una instalación de prueba con la URL de sesaes_restaurada.
Comprobar datos, revisión de Alembic, cuentas y recorridos; no activar SMTP real
durante una práctica de recuperación.

Una restauración de producción necesita procedimiento, responsables y validación
institucional; no se debe sustituir la base activa solo porque estos comandos
terminaron sin error.

## 7. Respaldo en Compose sin corromper binarios

Crear el dump dentro del contenedor y copiarlo; evitar redirección binaria
con PowerShell antiguo:

```powershell
docker compose --env-file .env.docker exec db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f /tmp/sesaes-respaldo.dump'
docker compose --env-file .env.docker cp db:/tmp/sesaes-respaldo.dump $archivo
pg_restore --list $archivo
```

La última comprobación requiere el cliente PostgreSQL local. Custodiar la copia
y retirar el archivo temporal del contenedor mediante el procedimiento operativo.
No usar docker compose down -v como procedimiento de mantenimiento ordinario.

## 8. Reversión

Un downgrade puede destruir columnas y datos de la revisión retirada.
Antes de ejecutarlo, detener escrituras, respaldar y comprobar compatibilidad
del código que quedará funcionando.

Ejemplo solo para una copia de pruebas de la revisión actual:

```powershell
python -m alembic downgrade 253cae9c234a
```

Eso elimina las tablas nuevas de recuperación/bloqueo; no es una operación de
mantenimiento normal. Un respaldo y restauración pueden ser la alternativa
correcta cuando no existe downgrade seguro.

## 9. Correo, sesiones y permisos

- SMTP no se comprueba solo porque la pantalla de recuperación responda.
  Probar con un buzón autorizado y verificar recepción y vencimiento.
- Rotar JWT_SECRET_KEY implica que los JWT firmados con la clave anterior
  dejarán de validar tras aplicar la configuración. Coordinar el cambio.
- No entregar credenciales en el plan de mejoras ni en el changelog.
- Revisar accesos administrativos efectivos y especialidades; no usar superadmin
  como cuenta compartida de operación.
- La auditoría no se borra desde la aplicación. El backup de la base debe
  conservar la trazabilidad.

## 10. Pendientes de producción

Las políticas de retención, cifrado en reposo, restauración periódica,
monitoreo, integración académica y autorización institucional deben quedar
asignadas a responsables. El proyecto no proporciona por sí mismo esos servicios
operativos ni certifica el cumplimiento jurídico de un despliegue.
