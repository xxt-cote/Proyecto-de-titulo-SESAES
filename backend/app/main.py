from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.requests import Request
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from app.rate_limiter import limiter
from app.init_db import init_db
from app.routers.auth import router as auth_router
from app.routers.profesionales import router as profesionales_router
from app.routers.citas import router as citas_router
from app.routers.horarios import router as horarios_router
from app.routers import estudiante
from app.routers.admin import router as admin_router
from app.routers.admin_inicio import router as admin_inicio_router
from app.routers.notificaciones import router as notificaciones_router
from app.routers.configuracion_centro import router as configuracion_centro_router
from app.routers.correos import router as correos_router
from app.routers.solicitudes_horario import router as solicitudes_horario_router
from app.routers.historial_clinico import router as historial_clinico_router
from app.routers.agenda import router as agenda_router
from app.routers.usuarios import router as usuarios_router
from app.routers.capacidades_clinicas import router as capacidades_clinicas_router
from app.routers.documentos_clinicos import router as documentos_clinicos_router
from app.routers.firma_profesional import router as firma_profesional_router
from app.routers.recuperar_password import router as recuperar_password_router
from app.routers.admin_capacidades_clinicas import router as admin_capacidades_clinicas_router

import os
from contextlib import asynccontextmanager

from app import tiempo

# Antes que nada: la hora del servidor debe ser la de Chile (ver app/tiempo.py).
tiempo.fijar_zona_horaria()

# SESAES_ENV=production desactiva la documentación pública de la API
# (/docs, /redoc, /openapi.json), que revela todos los endpoints.
_EN_PRODUCCION = os.getenv("SESAES_ENV", "development").strip().lower() == "production"


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    yield


app = FastAPI(
    lifespan=lifespan,
    docs_url=None if _EN_PRODUCCION else "/docs",
    redoc_url=None if _EN_PRODUCCION else "/redoc",
    openapi_url=None if _EN_PRODUCCION else "/openapi.json",
)

# Rate limiting — protege endpoints sensibles (login) de intentos masivos
# de fuerza bruta. El límite específico se define en cada endpoint con el
# decorador @limiter.limit(...) (ver auth.py). La instancia 'limiter' vive
# en app/rate_limiter.py para evitar imports circulares con los routers.
app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    # Mismo formato {"detail": "..."} que usa el resto de la API (FastAPI's
    # HTTPException), para que el frontend no necesite un caso especial.
    return JSONResponse(
        status_code=429,
        content={"detail": "Demasiados intentos. Espera un minuto e inténtalo de nuevo."}
    )

origins_env = os.getenv("CORS_ORIGINS", "http://localhost:4200")
origins = [o.strip() for o in origins_env.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


app.include_router(auth_router)
app.include_router(profesionales_router)
app.include_router(citas_router)
app.include_router(horarios_router)
app.include_router(estudiante.router)
app.include_router(admin_router)
app.include_router(admin_inicio_router)  # Inicio institucional SUPERADMIN
app.include_router(notificaciones_router)
app.include_router(configuracion_centro_router)
app.include_router(correos_router)
app.include_router(solicitudes_horario_router)
app.include_router(historial_clinico_router)
app.include_router(agenda_router)
app.include_router(usuarios_router)
app.include_router(capacidades_clinicas_router)  # SA-11.2
app.include_router(admin_capacidades_clinicas_router)  # administración de capacidades por especialidad
app.include_router(recuperar_password_router)  # olvidé mi contraseña (público)
app.include_router(firma_profesional_router)  # firma manuscrita digitalizada del profesional
app.include_router(documentos_clinicos_router)  # recetas, justificativos y validación pública

@app.get("/")
def home():
    return {"message": "SESAES funcionando 🚀"}


@app.get("/health")
def health():
    """Chequeo de vida para el monitoreo (Render / UptimeRobot). No toca la base."""
    return {"status": "ok"}
