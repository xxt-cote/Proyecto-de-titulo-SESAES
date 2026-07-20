from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.correo_log import CorreoLog

router = APIRouter(prefix="/correos", tags=["correos"])


def simular_envio_correo(
    db: Session,
    destinatario: str,
    asunto: str,
    cuerpo: str,
    tipo: str = "info",
    referencia_id: int = None
):
    """
    Simula el envío de un correo guardándolo en la tabla correo_log.
    Cuando se tenga una cuenta Gmail real, aquí se reemplaza por el envío SMTP real.
    """
    log = CorreoLog(
        destinatario  = destinatario,
        asunto        = asunto,
        cuerpo        = cuerpo,
        enviado       = True,   # simulado como enviado
        tipo          = tipo,
        referencia_id = referencia_id
    )
    db.add(log)
    # No hace commit aquí — el caller lo hace


@router.get("")
def get_correos(db: Session = Depends(get_db)):
    """Lista los últimos 100 correos simulados — visible en el dashboard del admin."""
    correos = db.query(CorreoLog).order_by(CorreoLog.fecha.desc()).limit(100).all()
    return [
        {
            "id":            c.id,
            "destinatario":  c.destinatario,
            "asunto":        c.asunto,
            "cuerpo":        c.cuerpo,
            "enviado":       c.enviado,
            "fecha":         c.fecha.isoformat() if c.fecha else None,
            "tipo":          c.tipo,
            "referencia_id": c.referencia_id
        }
        for c in correos
    ]