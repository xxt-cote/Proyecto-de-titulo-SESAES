# -*- coding: utf-8 -*-
"""
SESAES — Firma manuscrita digitalizada del profesional (Mi perfil).

  GET    /profesional/{prof_id}/firma   estado y vista previa de su firma
  PUT    /profesional/{prof_id}/firma   registra o reemplaza su firma
  DELETE /profesional/{prof_id}/firma   la elimina (los documentos ya emitidos no cambian)

Solo el propio profesional (permiso + ownership, como al anular un documento).
La imagen nunca se escribe en la auditoría.
"""

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auditoria import registrar_evento_auditoria
from app.auth_dependencies import get_current_user
from app.database import get_db
from app.rbac.permissions import Permission
from app.routers.profesionales import _exigir_permiso_y_ownership_propio
from app.services import firma_profesional_service as svc

router = APIRouter(tags=["firma-profesional"])


class FirmaIn(BaseModel):
    imagen: str
    metodo: Literal["dibujada", "escrita", "subida"]


def _respuesta(fila) -> dict:
    if fila is None:
        return {"tiene_firma": False, "metodo": None, "actualizada_en": None, "imagen": None}
    return {
        "tiene_firma": True,
        "metodo": fila.metodo,
        "actualizada_en": fila.actualizada_en.isoformat() if fila.actualizada_en else None,
        "imagen": fila.imagen,
    }


@router.get("/profesional/{prof_id}/firma")
def ver_firma(prof_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    _exigir_permiso_y_ownership_propio(current_user, prof_id, db, Permission.ATENCIONES_REGISTRAR)
    return _respuesta(svc.obtener(db, prof_id))


@router.put("/profesional/{prof_id}/firma")
def registrar_firma(prof_id: int, body: FirmaIn, db: Session = Depends(get_db),
                    current_user: dict = Depends(get_current_user)):
    _exigir_permiso_y_ownership_propio(current_user, prof_id, db, Permission.ATENCIONES_REGISTRAR)
    try:
        fila = svc.guardar(db, prof_id, body.imagen, body.metodo)
    except svc.FirmaInvalida as e:
        raise HTTPException(status_code=422, detail=str(e))
    registrar_evento_auditoria(
        db, current_user, "Profesional registró su firma",
        entidad="firma_profesional", entidad_id=prof_id, detalle=f"método: {body.metodo}",
    )
    db.commit()
    db.refresh(fila)
    return _respuesta(fila)


@router.delete("/profesional/{prof_id}/firma")
def eliminar_firma(prof_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    _exigir_permiso_y_ownership_propio(current_user, prof_id, db, Permission.ATENCIONES_REGISTRAR)
    if svc.eliminar(db, prof_id):
        registrar_evento_auditoria(
            db, current_user, "Profesional eliminó su firma",
            entidad="firma_profesional", entidad_id=prof_id, detalle="",
        )
    db.commit()
    return _respuesta(None)
