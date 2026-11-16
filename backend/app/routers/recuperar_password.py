# -*- coding: utf-8 -*-
"""
SESAES — Recuperar contraseña (público, sin sesión).

  POST /recuperar-password   {correo}                -> siempre la misma respuesta
  POST /restablecer-password {token, nueva_password} -> cambia la contraseña con el enlace

Ver services/recuperar_password_service.py para las reglas de seguridad.
"""

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.rate_limiter import limiter
from app.services import recuperar_password_service as svc

router = APIRouter(tags=["recuperar-password"])

MENSAJE_SOLICITUD = (
    "Si el correo está registrado, te enviamos un enlace para restablecer tu contraseña. "
    "Revisa tu bandeja de entrada y la carpeta de spam."
)


class SolicitudIn(BaseModel):
    correo: str


class RestablecerIn(BaseModel):
    token: str
    nueva_password: str


@router.post("/recuperar-password")
@limiter.limit("5/hour")
def recuperar_password(request: Request, body: SolicitudIn, db: Session = Depends(get_db)):
    svc.solicitar(db, body.correo)
    return {"message": MENSAJE_SOLICITUD}


@router.post("/restablecer-password")
@limiter.limit("10/hour")
def restablecer_password(request: Request, body: RestablecerIn, db: Session = Depends(get_db)):
    svc.restablecer(db, body.token, body.nueva_password)
    return {"message": "Tu contraseña fue actualizada. Ya puedes iniciar sesión."}
