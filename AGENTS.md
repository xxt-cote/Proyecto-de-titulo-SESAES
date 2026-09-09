# AGENTS.md — SESAES Development Guide

## ⚙️ Entornos de desarrollo

| Componente | Comando | Puerto |
|---|---|---|
| Backend (FastAPI) | `uvicorn app.main:app --reload --port 8080` | `http://localhost:8080` |
| Frontend (Angular) | `ng serve` (o `npm start`) | `http://localhost:4200` |
| PostgreSQL | Local en `sesaes_db` | `localhost:5432` |

> **Importante:** el frontend (`src/app/config.ts`) apunta a `http://localhost:8080` cuando la hostname es `localhost`. Siempre Levanta el backend en el **8080**, no en el 8000 por defecto.

## 🔧 Comandos por área

### Backend (`backend/`)

```bash
cd backend
python -m venv venv          # una vez
venv\Scripts\activate         # Windows
pip install -r requirements.txt

# Desarrollo
uvicorn app.main:app --reload --port 8080

# Tests
pytest tests/                   # si installaste test deps; pytest no está en requirements.txt todavía

# Lint/typecheck (si están instalados)
ruff check app/                 # linter rápido (instalar: pip install ruff)
mypy app/                       # tipado estático (instalar: pip install mypy)
```

### Frontend (`frontend/`)

```bash
cd frontend
npm install                   # una vez

# Desarrollo
ng serve                      # http://localhost:4200

# Tests (Jest/Karma vía Angular)
npm test                      # ng test

# Build de producción
npm run build                 # ng build

# Typecheck (TypeScript)
npx tsc --noEmit              # verifica tipos sin compilar
```

## 🗄️ Base de datos

- **Local:** `postgresql://postgres:2412Navidad@localhost:5432/sesaes_db` (en `.env`)
- **Script de esquema:** `database/sesaes_db_v2.sql` — `psql -U postgres -d sesaes_db -f database/sesaes_db_v2.sql`
- **Seed:** `init_db()` corre automáticamente en startup (`main.py:52`). Siempre que la tabla `usuario` y/o `profesional` estén vacías, inserta datos base.

## 🔑 Credenciales seed

| Rol | Correo | Contraseña |
|---|---|---|
| Estudiante | `maria.gonzalez@utem.cl` | `est123` |
| Profesional | `ana.martinez@utem.cl` | `prof123` |
| Admin | `admin@utem.cl` | `admin123` |

## 📋 Checklist rápido antes de PR

- [ ] `npm test` frontend verde (o `ng test`)
- [ ] `npm run build` frontend exitoso
- [ ] Backend: login 3 roles probado manualmente
- [ ] `git diff --name-status` confirma que no se modificó otro dashboard accidentalmente
- [ ] Sin `.env` ni secretos commiteados
