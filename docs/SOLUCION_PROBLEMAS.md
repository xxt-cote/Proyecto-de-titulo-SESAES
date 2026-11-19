# Solución de problemas

| Síntoma                                    | Qué revisar                                                    | Acción recomendada                                                          |
| ------------------------------------------ | -------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Backend no arranca y menciona JWT          | JWT_SECRET_KEY ausente o de ejemplo                            | Generar secreto propio y reiniciar                                          |
| No conecta a PostgreSQL                    | Servicio, host, puerto, rol, contraseña y nombre de base       | Verificar la conexión privada y la base objetivo                            |
| Mensaje de base sin revisión Alembic       | Se apunta a una base antigua sin historial                     | Usar base nueva o adopción revisada sobre una copia                         |
| Login dice que no conecta                  | API caída, URL de build o CORS                                 | Revisar /health, NG_APP_API_URL y origen del navegador                      |
| Cuenta bloqueada                           | Intentos fallidos por cuenta o IP                              | Esperar el plazo o usar recuperación autorizada                             |
| Recuperación responde pero no llega correo | Cuenta/estado, SMTP, límites o spam                            | Revisar un buzón de pruebas y transporte, sin revelar existencia de cuentas |
| Admin no ve módulos                        | Acceso efectivo sin configurar                                 | Superadmin configura perfil, permisos y alcance                             |
| Profesional no puede entrar                | Cuenta y vínculo Usuario–Profesional                           | Revisar alta, estado y resolver Profesional.id                              |
| Alumno no ve días disponibles              | Sin bloques aprobados, sin horas, cierres o estado profesional | Revisar semana aprobada y disponibilidad real                               |
| Solicitud enviada no cambia calendario     | Todavía pendiente                                              | Esperar resolución administrativa                                           |
| Cambiar horario no mueve las citas         | Las reservas existentes no se reprograman automáticamente      | Revisar agenda y coordinar las citas afectadas                              |
| Sobrecupo deshabilitado                    | Falta permiso, profesional o capacidad                         | Revisar agenda.gestionar, agenda.sobrecupo y alcance                        |
| Reserva falla tras elegir una hora         | Otra transacción pudo ocuparla                                 | Actualizar disponibilidad; no repetir a ciegas                              |
| PDF auténtico pero no cubre ausencia       | Fecha consultada fuera del reposo                              | Consultar la fecha correcta; no modificar el documento                      |
| Receta antigua sin vigencia definida       | La instantánea no tiene fecha límite                           | No inferir vigencia; consultar al emisor                                    |
| Cámara QR no abre                          | Permiso del navegador, contexto y despliegue                   | Usar código manual y revisar permisos sin desactivar seguridad global       |
| Angular no instala                         | Node incompatible o CDN de SheetJS inaccesible                 | Verificar versiones y conectividad                                          |
| Avisos CSS en build                        | Tamaño de estilos de admin/profesional                         | Revisar presupuestos; no son por sí solos errores de compilación            |
| Docker no encuentra el engine              | Docker Desktop detenido o motor Linux no disponible            | Iniciar el motor por el procedimiento del equipo                            |
| Compose cambió contraseña y no conecta     | Volumen ya inicializado con otra clave                         | Restaurar configuración o cambiar contraseña de forma administrativa        |
| Sigue apareciendo una URL antigua          | NG_APP_API_URL es de compilación                               | Reconstruir el frontend con la variable correcta                            |

## Qué informar al soporte

Indicar fecha, pantalla, rol, acción y mensaje observado. Compartir únicamente
identificadores de prueba o datos mínimos por un canal autorizado.
No adjuntar contraseñas, Bearer tokens, enlaces de recuperación, dumps ni
contenido clínico en un issue público.

No resolver problemas borrando la base, haciendo stamp sin revisión,
activando el seed en una base real o concediendo superadmin a cualquier cuenta.
