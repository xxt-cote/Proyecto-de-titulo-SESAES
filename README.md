<div align="center">

# 🏥 SESAES
### Sistema de Agendamiento Estudiantil de Salud

**Computación Web · UTEM**

![Angular](https://img.shields.io/badge/Angular-DD0031?style=flat&logo=angular&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat&logo=fastapi&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat&logo=postgresql&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat&logo=supabase&logoColor=white)
![Render](https://img.shields.io/badge/Render-46E3B7?style=flat&logo=render&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=flat&logo=vercel&logoColor=white)
![Status](https://img.shields.io/badge/status-en%20desarrollo-yellow)

Plataforma web para la gestión de horas médicas del centro de salud estudiantil de UTEM.

</div>

---

## 📑 Contenido

- [Descripción general](#-descripción-general)
- [Estado del proyecto](#-estado-del-proyecto)
- [Demo / URLs desplegadas](#-demo--urls-desplegadas)
- [Arquitectura](#️-arquitectura)
- [Estructura del repositorio](#-estructura-del-repositorio)
- [Primeros pasos (desarrollo local)](#-primeros-pasos-desarrollo-local)
- [Despliegue en la nube](#️-despliegue-en-la-nube)
- [Flujo de trabajo con Git (Pull Requests)](#-flujo-de-trabajo-con-git-pull-requests)
- [Librerías y dependencias clave](#-librerías-y-dependencias-clave)
- [Roles del sistema](#-roles-del-sistema)
- [Notas para el equipo](#-notas-para-el-equipo)
- [Equipo](#-equipo)

---

## 📖 Descripción general

SESAES permite a estudiantes agendar atenciones médicas, a profesionales gestionar su agenda y atenciones, y a administradores supervisar el sistema completo — cada uno con su propio dashboard.

---

## 🚦 Estado del proyecto

| Módulo | Estado |
|---|---|
| Autenticación | ✅ Completo |
| Dashboard estudiante | ✅ Completo |
| Dashboard profesional | ✅ Completo |
| Dashboard administrador | ✅ Completo |
| Backend / API | ✅ Operativo |
| Base de datos | ✅ Operativa |
| Despliegue en la nube | ✅ Backend en Render, Frontend en Vercel, DB en Supabase |
| Diseño responsive | 🚧 Pendiente (solo desktop por ahora) |

---

## 🌐 Demo / URLs desplegadas

| Servicio | Proveedor | URL |
|---|---|---|
| Frontend | Vercel | [proyecto-de-titulo-sesaes.vercel.app](https://proyecto-de-titulo-sesaes.vercel.app/) |
| Backend / API | Render | [sesaes-backend.onrender.com](https://sesaes-backend.onrender.com) |
| Base de datos | Supabase | *(acceso interno vía panel de Supabase)* |

> ⏱️ **Nota sobre "cold start":** el backend en Render (plan gratuito) puede tardar unos segundos en responder si nadie lo usa por un rato, ya que el servidor "duerme" y despierta con la primera petición. Es normal, no es un error.

---

## 🏗️ Arquitectura

```
Estudiante / Profesional / Administrador
              │
              ▼
     Angular → frontend (Vercel, producción | localhost:4200, local)
              │
              ▼
     FastAPI → backend (Render, producción | localhost:8080, local)
              │
              ▼
     PostgreSQL → Supabase (producción) | sesaes_db local (desarrollo)
```

---

## 📂 Estructura del repositorio

```
Proyecto-de-titulo-SESAES/
├── backend/     → API FastAPI
├── frontend/    → Aplicación Angular
└── database/    → Script de estructura de la base de datos
```

---

## 🚀 Primeros pasos (desarrollo local)

### 1. Clonar el repositorio

```bash
git clone https://github.com/xxt-cote/Proyecto-de-titulo-SESAES.git
cd Proyecto-de-titulo-SESAES
```

> ⚠️ No inicialices git dentro de `frontend/` ni `backend/` — el repositorio ya está configurado en la raíz.

### 2. Configurar la base de datos

Tienes dos opciones:

**Opción A — PostgreSQL local (recomendado para desarrollo diario):**

```bash
psql -U postgres -d sesaes_db -f database/sesaes_db_v2.sql
```

> El script solo trae estructura (tablas, índices, triggers) — sin datos de usuarios. También puedes usar **Restore** desde pgAdmin apuntando a este archivo.

**Opción B — Conectarte directamente a Supabase:**

Pide acceso al proyecto de Supabase y usa la `DATABASE_URL` que te compartan en el `.env` (ver punto 3). No es necesario correr el script si te conectas directo a la nube, pero **ojo**: estarás compartiendo la misma base que producción, así que úsala con cuidado para pruebas.

### 3. Configurar el backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
```

Crea tu archivo de variables de entorno local:

```bash
copy .env.example .env        # Windows
```

Edita `.env` con tus propios valores:

| Variable | Descripción | Ejemplo (local) |
|---|---|---|
| `DATABASE_URL` | Cadena de conexión a PostgreSQL (local o Supabase) | `postgresql://postgres:TU_PASSWORD@localhost:5432/sesaes_db` |
| `CORS_ORIGINS` | Orígenes permitidos para el frontend | `http://localhost:4200` |

> ⚠️ Si al levantar el servidor obtienes `[WinError 10013]` en el puerto por defecto, es porque Windows suele reservar rangos de puertos para Hyper-V/WSL2/Docker. Verifica con `netsh interface ipv4 show excludedportrange protocol=tcp` y usa un puerto fuera de esos rangos (este proyecto ya está configurado para `8080`).

Levanta el servidor:

```bash
uvicorn app.main:app --reload --port 8080
```

📍 API disponible en `http://localhost:8080`

### 4. Configurar el frontend

En otra terminal:

```bash
cd frontend
npm install
ng serve
```

📍 App disponible en `http://localhost:4200`

> ✅ El backend se selecciona automáticamente: `frontend/src/app/config.ts` detecta si estás en `localhost` y apunta solo a `http://localhost:8080`; en cualquier otro dominio (Vercel) apunta directo a `https://sesaes-backend.onrender.com`. No necesitas configurar nada a mano para esto.

---

## ☁️ Despliegue en la nube

El proyecto está desplegado con el siguiente stack:

| Componente | Proveedor | Notas |
|---|---|---|
| Frontend (Angular) | **Vercel** | Build automático desde la rama `main` de `frontend/` |
| Backend (FastAPI) | **Render** | Web service, lee `DATABASE_URL` y `CORS_ORIGINS` desde variables de entorno del panel de Render |
| Base de datos (PostgreSQL) | **Supabase** | Reemplaza al PostgreSQL local en producción |

**Variables de entorno en Render (backend):**

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | Cadena de conexión entregada por Supabase (Settings → Database → Connection string) |
| `CORS_ORIGINS` | URL del frontend en Vercel: `https://proyecto-de-titulo-sesaes.vercel.app` |

**Variables de entorno en Vercel (frontend):**

No es necesario configurar nada en el panel de Vercel para la URL del backend: `frontend/src/app/config.ts` la resuelve automáticamente según el dominio (ver detalle en la sección de instalación del frontend, arriba). Si algún día se necesita apuntar a un backend distinto por ambiente, ese es el archivo a modificar.

> 💡 Si necesitas hacer un deploy manual o revisar logs de errores en producción, pide acceso a los paneles de Render y Vercel al jefe de proyecto.

---

## 🔀 Flujo de trabajo con Git (Pull Requests)

⚠️ **La rama `main` está protegida.** Nadie puede hacer push directo a `main` — todo cambio debe pasar por un Pull Request (PR) revisado y aprobado antes de mergearse.

**¿Por qué?** Porque `main` está conectada directo a Vercel, Render y Supabase. Un push directo ahí se va **inmediatamente a producción**, sin ningún filtro. Con este flujo, cada cambio se revisa antes de llegar a la app pública.

### Pasos para trabajar en tu parte:

1. **Actualiza tu rama local antes de empezar:**
   ```bash
   git checkout main
   git pull origin main
   ```

2. **Crea tu propia rama:**
   ```bash
   git checkout -b nombre-de-tu-cambio
   ```
   Ej: `git checkout -b fix-dashboard-admin`, `git checkout -b feature-reagendamiento`

3. **Trabaja y haz commits normalmente:**
   ```bash
   git add .
   git commit -m "Describe qué hiciste"
   git push origin nombre-de-tu-cambio
   ```

4. **Abre un Pull Request en GitHub:**
   Entra al repo → **Pull requests** → **New pull request** → selecciona tu rama contra `main` → escribe una descripción breve de qué cambiaste y por qué.

5. **Espera la revisión.**
   El PR queda pendiente de aprobación. Vercel genera automáticamente una URL de **preview** para que se pueda ver el cambio funcionando antes de aprobarlo, sin tocar producción.

6. **Una vez aprobado y mergeado**, el cambio se integra a `main` y ahí sí se actualizan automáticamente Vercel y Render.

> 📌 Si tu cambio requiere modificar el schema de la base de datos (tablas, columnas), avisa antes de mergear — hay que coordinar cómo se aplica ese cambio en Supabase, ya que no se actualiza solo con el código.

---

## 📊 Librerías y dependencias clave

**Frontend:**
- **Angular** (standalone components)
- **Chart.js** — gráficos del dashboard de administrador (estadísticas, disponibilidad, actividad reciente)

**Backend:**
- **FastAPI** + **SQLAlchemy** (ORM)
- **fpdf2 / ReportLab** — generación de comprobantes de cita en PDF
- **python-dotenv** — manejo de variables de entorno

> ⚠️ Los gráficos de Chart.js viven dentro de bloques `*ngIf` en el dashboard de administrador. Si navegas fuera y vuelves a entrar a esa sección, el gráfico se destruye y se debe reinicializar — esto ya está resuelto en el código (`.destroy()` + `setTimeout`), pero si agregas un gráfico nuevo, sigue el mismo patrón para evitar bugs de renderizado.

---

## 👥 Roles del sistema

| Rol | Descripción |
|---|---|
| 🎓 Estudiante | Agenda y gestiona sus horas médicas |
| 🩺 Profesional médico | Gestiona su agenda y atenciones |
| ⚙️ Administrador | Supervisa el sistema completo |

---

## 📝 Notas para el equipo

- 🔒 **Nunca subas tu archivo `.env`** — cada persona crea el suyo con su propia contraseña local de PostgreSQL o su propia connection string de Supabase.
- 🔄 Antes de trabajar cada día: `git pull origin main`.
- 🌿 Para cambios grandes, trabaja en una rama propia:
  ```bash
  git checkout -b nombre-de-tu-cambio
  ```
- 📌 Existe una duplicación conocida entre el schema `public` (vigente, usado por el backend) y un schema `sesaes` obsoleto del script original — ver documentación de Etapa 5. `database/sesaes_db_v2.sql` refleja únicamente el schema `public`.
- ☁️ Si trabajas contra la base de Supabase en vez de tu PostgreSQL local, recuerda que es la **misma base que producción** — evita crear/borrar datos de prueba ahí sin avisar.
- 🖥️ El diseño todavía es **solo desktop** (sin `@media queries`). Si agregas una vista nueva, no es necesario que la hagas responsive todavía — eso se aborda en una fase posterior.

---
