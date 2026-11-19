# Seguridad

## Alcance

SESAES maneja información personal y clínica. La versión integrada es un proyecto
en evolución; no hay una política de soporte por releases ni una certificación
de seguridad declarada. La rama activa y los cambios publicados se identifican
en CHANGELOG.md y PLAN_DE_MEJORAS.md.

## Reportar una vulnerabilidad

Utilizar un canal privado acordado con el equipo responsable.
Si el repositorio tiene habilitado el reporte privado de vulnerabilidades de
GitHub, puede utilizarse esa opción. Si no aparece, contactar privadamente al
mantenedor o a la contraparte institucional; no se inventa aquí un correo de soporte.

Incluir versión/commit, componente, impacto, pasos reproducibles con datos
ficticios y evidencia mínima. No publicar un exploit con datos reales ni abrir
un issue público que contenga pacientes, credenciales o tokens.

No se promete un plazo de respuesta que el equipo no haya acordado.

## Controles implementados

- JWT con secreto obligatorio y vencimiento.
- Hash bcrypt y política local de contraseñas.
- Límites de login por IP y bloqueo temporal por cuenta.
- Recuperación por token de un solo uso, hash y vencimiento; registro de correo
  sin enlace de recuperación.
- Permisos, alcance administrativo y comprobación de pertenencia.
- Concurrencia de agenda protegida con PostgreSQL.
- Instantáneas de documentos con huella y validación pública limitada.
- Eventos de auditoría de las operaciones que los implementan.

Esto no significa que cada lectura o cada inicio de sesión esté auditado.
El rol superadmin no concede acceso clínico universal.

## Responsabilidades de despliegue

Antes de usuarios reales, definir HTTPS, secretos, proxy confiable, correo,
cifrado de almacenamiento, backups y restauración, retención y accesos operativos.
Revisar cabeceras efectivamente servidas: un archivo Vercel no demuestra que se
aplique en cualquier hosting. Los ejemplos Compose son locales.

No hay verificación institucional de matrícula ni SSO conectado.
No existe garantía de invalidar todas las sesiones emitidas al restablecer
contraseña. La compatibilidad legacy de contraseñas debe revisarse y retirarse
tras migración controlada de cualquier instalación que aún la necesite.

## Si se expone un secreto

Avisar por el canal privado, rotar el secreto, revisar accesos y evaluar el
historial Git y los artefactos donde apareció. Borrar el último archivo no retira
un secreto de commits anteriores. Coordinar cualquier reescritura de historial
con el equipo; no ejecutar force push como solución automática.

Ver [operación](docs/OPERACION.md), [configuración](docs/CONFIGURACION.md) y
[pruebas](docs/PRUEBAS.md).
