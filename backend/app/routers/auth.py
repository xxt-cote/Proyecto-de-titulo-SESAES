from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.models.usuario import Usuario

router = APIRouter()


class LoginRequest(BaseModel):
    correo: str
    password: str


@router.post("/login")
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(Usuario).filter(Usuario.correo == data.correo).first()

    if not user:
        raise HTTPException(status_code=401, detail="Usuario no existe")

    if user.password != data.password:
        raise HTTPException(status_code=401, detail="Contraseña incorrecta")

    if user.activo is False:
        raise HTTPException(status_code=403, detail="Esta cuenta ha sido desactivada. Contacta al administrador.")

    return {
        "message": "Login correcto",
        "rol":     user.rol,
        "id":      user.id,
        "nombre":  user.nombre,
        "foto_url": user.foto_url,
        "correo":  user.correo
    }
