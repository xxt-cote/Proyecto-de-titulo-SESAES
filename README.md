
<div align="center">

# 🏥 SESAES
### Sistema de Agendamiento Estudiantil de Salud

**Computación Web · UTEM**

![Angular](https://img.shields.io/badge/Angular-DD0031?style=flat&logo=angular&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat&logo=fastapi&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat&logo=postgresql&logoColor=white)
![Status](https://img.shields.io/badge/status-en%20desarrollo-yellow)

Plataforma web para la gestión de horas médicas del centro de salud estudiantil de UTEM.

</div>

---

## 📑 Contenido

- [Descripción general](#-descripción-general)
- [Estado del proyecto](#-estado-del-proyecto)
- [Arquitectura](#️-arquitectura)
- [Estructura del repositorio](#-estructura-del-repositorio)
- [Primeros pasos](#-primeros-pasos)
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
| Dashboard administrador | 🚧 En progreso |
| Backend / API | ✅ Operativo |
| Base de datos | ✅ Operativa |

---

## 🏗️ Arquitectura

```
Estudiante / Profesional / Administrador
              │
              ▼
     Angular → frontend (puerto 4200)
              │
              ▼
     FastAPI → backend (puerto 8080)
              │
              ▼
     PostgreSQL → sesaes_db
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

## 🚀 Primeros pasos

### 1. Clonar el repositorio

```bash
git clone https://github.com/xxt-cote/Proyecto-de-titulo-SESAES.git
cd Proyecto-de-titulo-SESAES
```

> ⚠️ No inicialices git dentro de `frontend/` ni `backend/` — el repositorio ya está configurado en la raíz.

### 2. Configurar la base de datos

Crea una base de datos en PostgreSQL llamada `sesaes_db` e importa la estructura:

```bash
psql -U postgres -d sesaes_db -f database/sesaes_db_v2.sql
```

> El script solo trae estructura (tablas, índices, triggers) — sin datos de usuarios. También puedes usar **Restore** desde pgAdmin apuntando a este archivo.

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

| Variable | Descripción | Ejemplo |
|---|---|---|
| `DATABASE_URL` | Cadena de conexión a tu PostgreSQL local | `postgresql://postgres:TU_PASSWORD@localhost:5432/sesaes_db` |

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

---

## 👥 Roles del sistema

| Rol | Descripción |
|---|---|
| 🎓 Estudiante | Agenda y gestiona sus horas médicas |
| 🩺 Profesional médico | Gestiona su agenda y atenciones |
| ⚙️ Administrador | Supervisa el sistema completo |

---

## 📝 Notas para el equipo

- 🔒 **Nunca subas tu archivo `.env`** — cada persona crea el suyo con su propia contraseña local de PostgreSQL.
- 🔄 Antes de trabajar cada día: `git pull origin main`.
- 🌿 Para cambios grandes, trabaja en una rama propia:
  ```bash
  git checkout -b nombre-de-tu-cambio
  ```
- 📌 Existe una duplicación conocida entre el schema `public` (vigente, usado por el backend) y un schema `sesaes` obsoleto del script original — ver documentación de Etapa 5. `database/sesaes_db_v2.sql` refleja únicamente el schema `public`.

---

## 🎓 Equipo

**Proyecto de título — Ingeniería en Informática, UTEM**
