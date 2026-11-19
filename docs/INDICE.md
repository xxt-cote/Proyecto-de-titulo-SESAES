# Documentación de SESAES

Guía de la versión integrada del equipo, actualizada el 19 de noviembre de 2026.
Está escrita para quien recibe el proyecto sin conocer las conversaciones de desarrollo.

## Por dónde empezar

| Necesidad                                                               | Documento                                                 |
| ----------------------------------------------------------------------- | --------------------------------------------------------- |
| Entender el proyecto en pocos minutos                                   | [README](../README.md)                                    |
| Instalar una base vacía y levantar la aplicación                        | [Instalación](INSTALACION.md)                             |
| Levantar la pila con contenedores locales                               | [Docker](DOCKER.md)                                       |
| Utilizar la aplicación como estudiante, profesional, admin o superadmin | [Manual de usuario](MANUAL_USUARIO.md)                    |
| Comprender componentes, decisiones y límites                            | [Arquitectura](ARQUITECTURA.md)                           |
| Ver arquitectura, relaciones y secuencias                               | [Diagramas Mermaid](DIAGRAMAS.md)                         |
| Consultar tablas, columnas, relaciones e índices                        | [Modelo de datos](MODELO_DATOS.md)                        |
| Integrar un cliente con la API                                          | [API](API.md)                                             |
| Configurar variables sin exponer secretos                               | [Configuración](CONFIGURACION.md)                         |
| Ejecutar pruebas y conocer la evidencia disponible                      | [Pruebas](PRUEBAS.md)                                     |
| Mantener, respaldar y recuperar una instalación                         | [Operación](OPERACION.md)                                 |
| Preparar una integración con sistemas de la universidad                 | [Integración institucional](INTEGRACION_INSTITUCIONAL.md) |
| Resolver errores habituales                                             | [Solución de problemas](SOLUCION_PROBLEMAS.md)            |
| Contribuir al repositorio                                               | [CONTRIBUTING](../CONTRIBUTING.md)                        |
| Comunicar una vulnerabilidad                                            | [SECURITY](../SECURITY.md)                                |
| Ver cambios funcionales de la versión                                   | [CHANGELOG](../CHANGELOG.md)                              |
| Consultar decisiones e historial del equipo                             | [Plan de mejoras](../PLAN_DE_MEJORAS.md)                  |
| Consultar estado de licencia                                            | [LICENSE](../LICENSE)                                     |

## Lectura según responsabilidad

**Persona usuaria:** manual, acceso al sistema y ayuda ante errores. No necesita SQL ni comandos de instalación.

**Responsable técnico:** instalación, configuración, operación y pruebas. Debe utilizar una base propia; no se entrega la base local del equipo.

**Desarrollador que continuará el proyecto:** arquitectura, modelo, API, integración institucional y contribución. Antes de cambiar una regla, revisar el plan de mejoras.

**Evaluador del proyecto:** README, diagramas, manual y pruebas. Las capacidades propuestas y las limitaciones están separadas de lo implementado.

## Cómo interpretar el estado

- **Implementado:** existe en la versión descrita. No significa que se haya certificado para producción.
- **Verificado:** se especifica qué prueba o comprobación se ejecutó.
- **Pendiente:** necesita implementación, infraestructura o una decisión institucional.
- **Histórico:** describe una ronda anterior; puede haber sido reemplazado por una decisión posterior.

Las guías actuales de esta carpeta describen cómo utilizar la versión integrada.
El plan conserva antecedentes de ambos integrantes y no debe borrarse.
