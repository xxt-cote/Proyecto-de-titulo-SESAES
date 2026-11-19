# Historial de cambios

Este archivo resume cambios relevantes para quienes usan o mantienen SESAES.
El detalle de decisiones y verificaciones permanece en PLAN_DE_MEJORAS.md.
No se asigna una versión de release que todavía no ha sido publicada.

## Sin publicar — documentación de entrega, 19-11-2026

### Añadido

- Índice, manual de cuatro roles, arquitectura, diagramas Mermaid y modelo físico.
- Guías actuales de instalación, API, configuración, operación, pruebas y
  continuación de la integración institucional.
- SECURITY.md, CONTRIBUTING.md y estado explícito de licencia pendiente.
- Configuración Compose local con PostgreSQL, FastAPI y frontend en Nginx;
  ejecución en contenedores pendiente de validar.

### Actualizado

- README con rutas de lectura, inicio rápido y badges verificables o explícitos.
- Plan de mejoras como historial central y registro de documentación.
- Cobertura identificada como no medida; no se inventan porcentajes.

## Integración del equipo — 19-11-2026

Referencia local de integración: commit 194d3c5, construido desde main 854a727.
La publicación y fusión se determinan en GitHub; esta entrada no certifica
por sí misma que el Pull Request esté fusionado.

### Añadido o conservado

- Recuperación de contraseña por enlace y bloqueo temporal por cuenta.
- Workflows de CI/CodeQL y compatibilidad del storage de pruebas.
- Revisión 8d2e4f6a901b para las dos tablas de seguridad, conservando la base
  253cae9c234a.
- Aviso de medicamentos de control legal en formulario y PDF.

### Integrado

- Agenda por bloques aprobados, sobrecupos con motivo y permisos explícitos.
- Cobertura de justificativos y vigencia de recetas.
- Zona America/Santiago y compatibilidad de arranque POSIX.
- Calendario institucional compartido y mejoras de interfaz.

### Corregido durante la validación

- Conservación de search_path al configurar timezone PostgreSQL.
- Fixtures de concurrencia con bloques aprobados y fecha canónica reproducible.

### Verificado en esa ronda

- Backend: 1.691 aprobadas, 8 omitidas y 20 subtests aprobados.
- PostgreSQL: 52 aprobadas.
- Frontend: 1.007 aprobadas en 55 archivos; build correcto con dos avisos CSS.

## Antecedentes locales — 15 a 19-11-2026

- Instalación sin dump ni datos reales y evolución con Alembic.
- Seed demo de once cuentas, seis profesionales de 60 minutos y 90 bloques.
- Limpieza de ayuda profesional y filtros/acciones administrativas duplicados.
- Cabeceras coherentes, notificaciones accesibles y mejoras móviles.
- Emisiones nuevas sin firma gráfica, conservando identificación, folio,
  barras, QR y compatibilidad de documentos históricos.

Los antecedentes completos y los aportes de ambos integrantes se conservan en
el plan; no deben confundirse con un release productivo certificado.
