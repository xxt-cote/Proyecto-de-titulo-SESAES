from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.init_db import init_db
from app.routers.auth import router as auth_router
from app.routers.profesionales import router as profesionales_router
from app.routers.citas import router as citas_router
from app.routers.horarios import router as horarios_router
from app.routers import estudiante
from app.routers.admin import router as admin_router
from app.routers.notificaciones import router as notificaciones_router
from app.routers.configuracion_centro import router as configuracion_centro_router
from app.routers.correos import router as correos_router
from app.routers.solicitudes_horario import router as solicitudes_horario_router
from app.routers.historial_clinico import router as historial_clinico_router

import os

app = FastAPI()

origins_env = os.getenv("CORS_ORIGINS", "http://localhost:4200")
origins = [o.strip() for o in origins_env.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    init_db()


app.include_router(auth_router)
app.include_router(profesionales_router)
app.include_router(citas_router)
app.include_router(horarios_router)
app.include_router(estudiante.router)
app.include_router(admin_router)
app.include_router(notificaciones_router)
app.include_router(configuracion_centro_router)
app.include_router(correos_router)
app.include_router(solicitudes_horario_router)
app.include_router(historial_clinico_router)

@app.get("/")
def home():
    return {"message": "SESAES funcionando 🚀"}