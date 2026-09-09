# Fase 1 — Auditoría de iconografía existente

Este documento **no implementa ningún reemplazo**. Es un inventario de los 72 SVG
inline y los emojis funcionales detectados en el código actual, con una propuesta
de icono de `@lucide/angular` para cada caso. La sustitución real se hará
progresivamente, dashboard por dashboard, en fases posteriores.

## 1. SVG inline (72 en total)

| Archivo | Cantidad |
|---|---|
| `dashboard-admin/dashboard-admin.html` | 21 |
| `dashboard-profesional/dashboard-profesional.html` | 19 |
| `dashboard-estudiante/dashboard-estudiante.html` | 19 |
| `login/login.html` | 13 |
| **Total** | **72** |

### Agrupados por propósito (según clase CSS / contexto)

| Categoría (clase CSS) | Dónde aparece | Propuesta Lucide |
|---|---|---|
| `.nav-item` (ítems de navegación del sidebar) | Admin (7), Profesional (7), Estudiante (5) | Uno distinto por sección: `LucideHouse` (Inicio), `LucideCalendarDays` (Agenda/Citas), `LucideUsers` / `LucideGraduationCap` (Pacientes/Estudiantes), `LucideStethoscope` (Profesionales), `LucideFileText` (Documentos), `LucideSettings` (Configuración/Perfil), `LucideCircleHelp` (Ayuda) — mapeo exacto se define al construir `navigationItems` de cada dashboard en Fase 2/3 |
| `.logout-btn` | Los 3 dashboards | `LucideLogOut` |
| `.btn-hamburguesa` | Los 3 dashboards | `LucideMenu` |
| `.topbar-buscador` / `.topbar-buscador-prof` / `.search-bar` | Admin, Profesional, Estudiante | `LucideSearch` |
| `.tema-toggle-btn` (par sol/luna condicional `*ngIf="!temaOscuro"` / `*ngIf="temaOscuro"`) | Admin, Profesional | `LucideSun` / `LucideMoon` |
| `.topbar-icon-btn` / `.topbar-icon-btn-est` | Admin, Profesional, Estudiante | `LucideBell` (notificaciones) — confirmar si hay más de un botón en este grupo antes de asignar íconos definitivos |
| `.stat-icon` (tarjetas KPI, 4 colores: blue/green/teal/orange) | Admin | Depende del KPI real que representa cada tarjeta — a definir junto con el componente `Card` variante `kpi` en Fase 2 |
| `.btn-nueva-cita-top` | Admin | `LucideCalendarPlus` |
| `.btn-imprimir` | Admin | `LucidePrinter` |
| `.btn-ojo-prof` (aparece 3 veces) | Profesional | `LucideEye` |
| `.fecha-selector-btn` / `.fecha-selector-chevron` | Estudiante | `LucideCalendarDays` / `LucideChevronDown` |
| `.detalle-item` (aparece 3 veces) | Estudiante | Genérico — depende del dato que acompaña cada ítem; revisar en Fase 3 |
| `.faq-chevron` | Estudiante | `LucideChevronDown` |
| `.brand-mark` / `.core-circle` | Login | Elemento de marca — probablemente no se reemplaza por un ícono de librería (es parte del logo) |
| `.feature-icon` (aparece 3 veces) | Login | Depende del texto de cada feature — revisar al migrar login |
| `.side-foot` / `.input-box` (aparece 2 veces) / `.toggle` / `.error-msg` / `.trust-line` | Login | `.input-box` probablemente `LucideMail` / `LucideLock` según el campo; `.toggle` (mostrar/ocultar contraseña) → `LucideEye` / `LucideEyeOff`; `.error-msg` → `LucideCircleAlert`; el resto son elementos de layout/confianza, no necesariamente iconos de estado |

Varias filas quedan como "a definir/revisar" a propósito — asignar el ícono
equivocado ahora sería peor que dejarlo pendiente hasta ver el HTML completo
(no solo la etiqueta `<svg>`) al migrar cada dashboard.

## 2. Emojis funcionales detectados

### 2.1 Especialidades médicas (Estudiante) — `iconosEspecialidad`, `dashboard-estudiante.ts`

| Especialidad | Emoji actual | Propuesta Lucide |
|---|---|---|
| Nutrición | 🥗 | `LucideSalad` |
| Odontología | 🦷 | *(sin equivalente exacto en Lucide — evaluar `LucideSmile` o un ícono custom)* |
| Kinesiología | 🦴 | *(sin equivalente exacto — evaluar `LucideActivity` o `LucideBicepsFlexed`)* |
| Medicina general | 🩺 | `LucideStethoscope` |
| Oftalmología | 👁️ | `LucideEye` |
| Rayos X | 🩻 | *(sin equivalente exacto — evaluar `LucideScan`)* |
| Psicología | 🧠 | `LucideBrain` |
| Enfermería | ❤️ | `LucideHeartPulse` |
| Fallback genérico | 🩺 | `LucideStethoscope` |

### 2.2 Disponibilidad del profesional — `getIconoEstadoProf()`, `dashboard-admin.ts`

| Estado | Emoji actual | Propuesta Lucide | Tono (Fase 1) |
|---|---|---|---|
| `activo` | ✅ | `LucideCircleCheck` | `success` |
| `licencia` | 🔴 | `LucideCircleAlert` o `LucideCircleMinus` | `danger` |
| `inasistencia` | ⚠️ | `LucideTriangleAlert` | `warning` |
| *(fallback)* | ⚪ | `LucideCircle` | `neutral` |

> Nota: el mapeo estado→icono→tono definitivo (incluyendo estos y los de
> `Cita`, `SolicitudHorario` y slots de agenda) se implementa en Fase 2 con
> `StatusBadge`, no aquí.

### 2.3 Otros emojis encontrados (uso decorativo o no confirmado como funcional)

Se detectaron además emojis de banderas (🇨🇱), y símbolos como 📅 📋 🔒 🕐 👥 📷
⚙ 🗑 ✎ repartidos en los tres dashboards, cuyo propósito exacto (decorativo vs.
funcional) debe confirmarse al abrir cada HTML durante la migración de cada
dashboard — no se proponen reemplazos todavía para evitar adivinar.
