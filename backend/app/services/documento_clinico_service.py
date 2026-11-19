# -*- coding: utf-8 -*-
"""
SESAES — Emisión, verificación y renderizado de documentos clínicos
(receta médica y justificativo médico).

Reglas centrales:
  - Cada documento exige la capacidad clínica de la especialidad del
    profesional (EMITIR_RECETA / EMITIR_JUSTIFICATIVO). Sin capacidad -> 403
    ANTES de modificar nada (mismo criterio fail-closed de SA-11.3B).
  - Una atención tiene como máximo UNA receta y UN justificativo vigentes.
  - El folio es también el código de verificación: 12 caracteres aleatorios
    (criptográficamente seguros) sin caracteres ambiguos, no adivinable.
  - La huella SHA-256 cubre tipo + folio + cita + contenido; la validación
    pública la recalcula para detectar alteraciones.
  - El justificativo NUNCA incluye diagnóstico.
"""

from __future__ import annotations

import hashlib
import json
import os
import secrets
from datetime import date, datetime, timezone, timedelta
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.cita import Cita
from app.models.documento_clinico import (
    DocumentoClinico,
    ESTADO_ANULADO,
    ESTADO_VIGENTE,
    TIPO_JUSTIFICATIVO,
    TIPO_RECETA,
)
from app.models.profesional import Profesional
from app.models.usuario import Usuario
from app.rbac.clinical_capabilities import ClinicalCapability
from app.services.capacidades_por_defecto import capacidades_efectivas_profesional

# Sin 0, O, 1, I, L: se pueden leer y teclear sin confundirlos.
_ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
_PREFIJO = "SES"

_CAPACIDAD_POR_TIPO = {
    TIPO_RECETA: ClinicalCapability.EMITIR_RECETA,
    TIPO_JUSTIFICATIVO: ClinicalCapability.EMITIR_JUSTIFICATIVO,
}
_NOMBRE_TIPO = {
    TIPO_RECETA: "Receta médica",
    TIPO_JUSTIFICATIVO: "Justificativo médico",
}

_MESES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
    "agosto", "septiembre", "octubre", "noviembre", "diciembre",
]

NOMBRE_INSTITUCION = "Universidad Tecnológica Metropolitana"
NOMBRE_SERVICIO = "Servicio de Salud Estudiantil · SESAES"


# ══════════════════════════════════════
# Folio / huella
# ══════════════════════════════════════
def generar_folio(db: Session) -> str:
    """SES-XXXX-XXXX-XXXX, único en la tabla."""
    for _ in range(20):
        grupos = ["".join(secrets.choice(_ALFABETO) for _ in range(4)) for _ in range(3)]
        folio = f"{_PREFIJO}-" + "-".join(grupos)
        existe = db.query(DocumentoClinico.id).filter(DocumentoClinico.folio == folio).first()
        if not existe:
            return folio
    raise HTTPException(status_code=500, detail="No se pudo generar un folio único. Inténtalo nuevamente.")


def normalizar_codigo(crudo: str) -> str:
    """
    Acepta el código con o sin guiones, en minúsculas o con espacios, y lo
    devuelve en formato canónico. Si no calza el formato, lo devuelve limpio
    (la búsqueda simplemente no lo encontrará).
    """
    limpio = "".join(ch for ch in (crudo or "").upper() if ch.isalnum())
    if limpio.startswith(_PREFIJO) and len(limpio) == len(_PREFIJO) + 12:
        cuerpo = limpio[len(_PREFIJO):]
        return f"{_PREFIJO}-{cuerpo[0:4]}-{cuerpo[4:8]}-{cuerpo[8:12]}"
    return (crudo or "").strip().upper()


def calcular_huella(tipo: str, folio: str, cita_id: int, contenido: dict) -> str:
    base = json.dumps(
        {"tipo": tipo, "folio": folio, "cita_id": cita_id, "contenido": contenido},
        sort_keys=True, ensure_ascii=False, separators=(",", ":"),
    )
    return hashlib.sha256(base.encode("utf-8")).hexdigest()


def huella_es_valida(doc: DocumentoClinico) -> bool:
    esperada = calcular_huella(doc.tipo, doc.folio, doc.cita_id, doc.contenido)
    return secrets.compare_digest(esperada, doc.huella_sha256 or "")


# ══════════════════════════════════════
# Helpers de presentación
# ══════════════════════════════════════
def nombre_profesional(prof: Profesional) -> str:
    nombre = (prof.nombre or "").strip()
    trat = (prof.tratamiento or "").strip()
    if trat and not nombre.lower().startswith(trat.lower()):
        return f"{trat} {nombre}".strip()
    return nombre


def enmascarar_nombre(nombre: Optional[str]) -> str:
    """'Valentina Torres Silva' -> 'Valentina T. S.' (validación pública)."""
    partes = (nombre or "").split()
    if not partes:
        return "—"
    return " ".join([partes[0]] + [f"{p[0].upper()}." for p in partes[1:]])


def fecha_larga(valor) -> str:
    """date | datetime | 'YYYY-MM-DD' -> '09 de octubre de 2026'."""
    if isinstance(valor, str):
        try:
            valor = datetime.strptime(valor[:10], "%Y-%m-%d")
        except ValueError:
            return valor
    return f"{valor.day:02d} de {_MESES[valor.month - 1]} de {valor.year}"


def fecha_corta(valor) -> str:
    if isinstance(valor, str):
        try:
            valor = datetime.strptime(valor[:10], "%Y-%m-%d")
        except ValueError:
            return valor
    return valor.strftime("%d/%m/%Y")


def a_hora_local(iso: str) -> datetime:
    """Los timestamps sin zona de columnas aware se interpretan como UTC."""
    from app.tiempo import ZONA_CENTRO
    dt = datetime.fromisoformat(iso)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(ZONA_CENTRO)


def url_validacion(folio: str) -> str:
    base = os.getenv("FRONTEND_BASE_URL", "http://localhost:4200").rstrip("/")
    return f"{base}/validar-documento?codigo={folio}"


# ══════════════════════════════════════
# Emisión
# ══════════════════════════════════════
def _exigir_capacidad(db: Session, prof: Profesional, tipo: str) -> None:
    capacidades = capacidades_efectivas_profesional(prof.especialidad, db)
    if _CAPACIDAD_POR_TIPO[tipo].value not in capacidades:
        etiqueta = "recetas" if tipo == TIPO_RECETA else "justificativos"
        raise HTTPException(
            status_code=403,
            detail=f"Tu especialidad no tiene la capacidad clínica para emitir {etiqueta}.",
        )


def _exigir_sin_vigente(db: Session, cita_id: int, tipo: str) -> None:
    existe = db.query(DocumentoClinico.id).filter(
        DocumentoClinico.cita_id == cita_id,
        DocumentoClinico.tipo == tipo,
        DocumentoClinico.estado == ESTADO_VIGENTE,
    ).first()
    if existe:
        raise HTTPException(
            status_code=409,
            detail=f"Esta atención ya tiene {'una receta' if tipo == TIPO_RECETA else 'un justificativo'} vigente. Anúlalo antes de emitir otro.",
        )


def validar_emision(db: Session, prof: Profesional, receta, justificativo, cita_id: int) -> None:
    """
    Todas las comprobaciones que pueden rechazar la emisión, SIN escribir
    nada. completar_cita las llama antes de tocar la cita.
    """
    if receta is not None:
        _exigir_capacidad(db, prof, TIPO_RECETA)
        from app.tiempo import ahora_local
        if receta.valida_hasta < ahora_local().date():
            raise HTTPException(status_code=400, detail='La fecha límite de uso de la receta no puede ser anterior a su emisión.')
        _exigir_sin_vigente(db, cita_id, TIPO_RECETA)
    if justificativo is not None:
        _exigir_capacidad(db, prof, TIPO_JUSTIFICATIVO)
        _exigir_sin_vigente(db, cita_id, TIPO_JUSTIFICATIVO)


def _base_contenido(cita: Cita, prof: Profesional, est: Usuario, ahora: datetime) -> dict:
    return {
        "version": 2,
        "emitido_en": ahora.replace(microsecond=0).isoformat(),
        "profesional": {
            "nombre": nombre_profesional(prof),
            "especialidad": prof.especialidad,
            "rut": prof.rut,
        },
        "estudiante": {
            "nombre": est.nombre,
            "rut": est.rut,
            "carrera": est.carrera,
        },
        "atencion": {"fecha": cita.fecha, "hora": cita.hora},
    }


def _contenido_receta(cita, prof, est, receta, ahora) -> dict:
    c = _base_contenido(cita, prof, est, ahora)
    c["medicamentos"] = [m.model_dump() for m in receta.medicamentos]
    c["valida_hasta"] = receta.valida_hasta.isoformat()
    return c


def _contenido_justificativo(cita, prof, est, j, ahora) -> dict:
    c = _base_contenido(cita, prof, est, ahora)
    dias = None
    if j.reposo and j.reposo_desde and j.reposo_hasta:
        dias = (j.reposo_hasta - j.reposo_desde).days + 1
    c["atencion"].update({
        "modalidad": j.modalidad,
        "tipo_atencion": j.tipo_atencion,
        "motivo_consulta": j.motivo_consulta,
    })
    c["reposo"] = {
        "indicado": j.reposo,
        "desde": j.reposo_desde.isoformat() if j.reposo_desde else None,
        "hasta": j.reposo_hasta.isoformat() if j.reposo_hasta else None,
        "dias": dias,
    }
    c["restricciones"] = j.restricciones
    c["control_sugerido"] = j.control_sugerido.isoformat() if j.control_sugerido else None
    c["observaciones"] = j.observaciones
    return c


def emitir_documentos(
    db: Session, cita: Cita, prof: Profesional, est: Usuario, receta, justificativo,
) -> list[DocumentoClinico]:
    """
    Crea (db.add, sin commit) los documentos pedidos. Se asume que
    validar_emision() ya pasó. El commit lo hace quien llama, en la MISMA
    transacción que completa la cita: o se guarda todo, o no se guarda nada.
    """
    ahora = datetime.now(timezone.utc)
    emitidos: list[DocumentoClinico] = []

    pedidos = []
    if receta is not None:
        pedidos.append((TIPO_RECETA, _contenido_receta(cita, prof, est, receta, ahora)))
    if justificativo is not None:
        pedidos.append((TIPO_JUSTIFICATIVO, _contenido_justificativo(cita, prof, est, justificativo, ahora)))

    for tipo, contenido in pedidos:
        folio = generar_folio(db)
        doc = DocumentoClinico(
            tipo=tipo,
            folio=folio,
            cita_id=cita.id,
            profesional_id=prof.id,
            estudiante_id=est.id,
            contenido=contenido,
            huella_sha256=calcular_huella(tipo, folio, cita.id, contenido),
            estado=ESTADO_VIGENTE,
        )
        db.add(doc)
        db.flush()  # reserva el folio dentro de la transacción
        emitidos.append(doc)
    return emitidos


def anular_documento(doc: DocumentoClinico, motivo: str) -> None:
    if doc.estado == ESTADO_ANULADO:
        raise HTTPException(status_code=409, detail="El documento ya está anulado.")
    doc.estado = ESTADO_ANULADO
    doc.motivo_anulacion = motivo
    doc.anulado_en = datetime.now(timezone.utc)


def contar_documentos_del_dia(db: Session, profesional_id: int, ahora: datetime | None = None) -> dict:
    """
    Documentos VIGENTES que el profesional emitió HOY (día calendario de Chile).
    Alimenta el indicador "Documentos enviados hoy" del Inicio del profesional.
    """
    ahora = ahora or datetime.now(timezone.utc)
    hoy = ahora.astimezone(a_hora_local(ahora.isoformat()).tzinfo).date()
    # Margen de 2 días en UTC; el filtro exacto por día local se hace en Python.
    filas = (
        db.query(DocumentoClinico)
        .filter(
            DocumentoClinico.profesional_id == profesional_id,
            DocumentoClinico.estado == ESTADO_VIGENTE,
            DocumentoClinico.emitido_en >= ahora - timedelta(days=2),
        )
        .all()
    )
    recetas = justificativos = 0
    for d in filas:
        if a_hora_local(d.contenido["emitido_en"]).date() != hoy:
            continue
        if d.tipo == TIPO_RECETA:
            recetas += 1
        elif d.tipo == TIPO_JUSTIFICATIVO:
            justificativos += 1
    return {"fecha": hoy.isoformat(), "total": recetas + justificativos, "recetas": recetas, "justificativos": justificativos}


def resumen_documento(doc: DocumentoClinico) -> dict:
    return {
        "id": doc.id,
        "tipo": doc.tipo,
        "nombre_tipo": _NOMBRE_TIPO.get(doc.tipo, doc.tipo),
        "folio": doc.folio,
        "estado": doc.estado,
        "emitido_en": doc.contenido.get("emitido_en") if isinstance(doc.contenido, dict) else None,
    }


def documentos_por_citas(db: Session, cita_ids: list[int]) -> dict[int, list[dict]]:
    """Una sola consulta: {cita_id: [resumen, ...]} para listados."""
    if not cita_ids:
        return {}
    filas = (
        db.query(DocumentoClinico)
        .filter(DocumentoClinico.cita_id.in_(cita_ids))
        .order_by(DocumentoClinico.id)
        .all()
    )
    out: dict[int, list[dict]] = {}
    for d in filas:
        out.setdefault(d.cita_id, []).append(resumen_documento(d))
    return out


# ══════════════════════════════════════
# Validación pública
# ══════════════════════════════════════
def verificar_periodo_uso(doc: DocumentoClinico, fecha_consulta: date | None = None, *, ahora: datetime | None = None) -> dict:
    """Autenticidad no implica cobertura de una ausencia ni autorización de entrega."""
    c = doc.contenido
    if doc.tipo == TIPO_JUSTIFICATIVO:
        reposo = c.get("reposo") or {}
        desde = reposo.get("desde") if reposo.get("indicado") else c["atencion"]["fecha"]
        hasta = reposo.get("hasta") if reposo.get("indicado") else desde
        base = {"desde": desde, "hasta": hasta,
                "fecha_consultada": fecha_consulta.isoformat() if fecha_consulta else None}
        if not desde or not hasta:
            return {**base, "estado": "sin_periodo", "apto_para_uso": None,
                    "mensaje": "No hay un período definido para comprobar la ausencia."}
        if fecha_consulta is None:
            return {**base, "estado": "requiere_fecha", "apto_para_uso": None,
                    "mensaje": "Consulta la fecha de la ausencia para comprobar si está cubierta; la fecha de presentación puede ser posterior."}
        cubre = desde <= fecha_consulta.isoformat() <= hasta
        return {**base, "estado": "cubierto" if cubre else "fuera_de_periodo",
                "apto_para_uso": cubre,
                "mensaje": "La fecha consultada está cubierta." if cubre else "La fecha consultada no está cubierta por este justificativo."}
    # Una fecha elegida por el visitante NO cambia la vigencia actual de una receta.
    actual = ahora or datetime.now(timezone.utc)
    hoy = a_hora_local(actual.isoformat()).date().isoformat()
    desde = a_hora_local(c["emitido_en"]).date().isoformat()
    hasta = c.get("valida_hasta")
    base = {"desde": desde, "hasta": hasta, "fecha_consultada": hoy}
    if not hasta:
        return {**base, "estado": "sin_vigencia_definida", "apto_para_uso": None,
                "mensaje": "Documento antiguo sin fecha límite de uso registrada. Su autenticidad no confirma vigencia para dispensación."}
    vigente = desde <= hoy <= hasta
    estado = "vigente" if vigente else ("vencida" if hoy > hasta else "aun_no_vigente")
    return {**base, "estado": estado, "apto_para_uso": vigente,
            "mensaje": ("Dentro del período de uso indicado por el profesional." if vigente else
                        "Fuera del período de uso indicado por el profesional.") +
                       " Esta consulta no registra entregas ni autoriza repeticiones."}


def validar_publicamente(db: Session, codigo: str, fecha_consulta: date | None = None, *, ahora: datetime | None = None) -> dict:
    """
    Resultado seguro para mostrar SIN sesión. Solo expone tipo, profesional,
    fecha de emisión y nombre del estudiante enmascarado — nunca el
    contenido clínico.
    """
    doc = db.query(DocumentoClinico).filter(
        DocumentoClinico.folio == normalizar_codigo(codigo)
    ).first()
    if not doc:
        return {"valido": False, "estado": "no_encontrado"}

    if not huella_es_valida(doc):
        return {"valido": False, "estado": "modificado"}

    c = doc.contenido
    base = {
        "tipo": _NOMBRE_TIPO.get(doc.tipo, doc.tipo),
        "emitido_por": c["profesional"]["nombre"],
        "fecha_emision": a_hora_local(c["emitido_en"]).date().isoformat(),
        "estudiante": enmascarar_nombre(c["estudiante"]["nombre"]),
    }
    if doc.estado == ESTADO_ANULADO:
        return {"valido": False, "estado": "anulado", **base}
    return {"valido": True, "estado": "vigente", **base,
            "verificacion_uso": verificar_periodo_uso(doc, fecha_consulta, ahora=ahora)}


# ══════════════════════════════════════
# PDF
# ══════════════════════════════════════
_VERDE = (15, 118, 110)
_GRIS = (100, 116, 139)
_TINTA = (15, 23, 42)
_FONDO = (241, 245, 249)
_LOGO_PATH = os.path.join(os.path.dirname(__file__), "..", "static", "temporal.jpg")


def _l1(texto) -> str:
    """Las fuentes base de fpdf2 son latin-1: reemplaza lo que no cabe."""
    if texto is None:
        return ""
    return (
        str(texto)
        .replace("\u2013", "-").replace("\u2014", "-").replace("\u2026", "...")
        .replace("\u201c", '"').replace("\u201d", '"').replace("\u2019", "'")
        .encode("latin-1", "replace").decode("latin-1")
    )


def _dibujar_qr(pdf, texto: str, x: float, y: float, lado: float) -> None:
    import segno

    matriz = [list(fila) for fila in segno.make(texto, error="m", micro=False).matrix]
    n = len(matriz)
    borde = 2
    modulo = lado / (n + 2 * borde)
    pdf.set_fill_color(255, 255, 255)
    pdf.rect(x, y, lado, lado, style="F")
    pdf.set_fill_color(*_TINTA)
    for r, fila in enumerate(matriz):
        for c, v in enumerate(fila):
            if v:
                pdf.rect(x + (c + borde) * modulo, y + (r + borde) * modulo, modulo + 0.01, modulo + 0.01, style="F")


def _caja_dos_columnas(pdf, titulo_izq, lineas_izq, titulo_der, lineas_der):
    y0 = pdf.get_y()
    ancho = (pdf.w - pdf.l_margin - pdf.r_margin - 4) / 2
    alto = 8 + 5.5 * max(len(lineas_izq), len(lineas_der)) + 3
    for i, (titulo, lineas) in enumerate(((titulo_izq, lineas_izq), (titulo_der, lineas_der))):
        x = pdf.l_margin + i * (ancho + 4)
        pdf.set_draw_color(226, 232, 240)
        pdf.set_fill_color(255, 255, 255)
        pdf.rect(x, y0, ancho, alto, style="DF")
        pdf.set_xy(x + 3, y0 + 2)
        pdf.set_font("Helvetica", "B", 7)
        pdf.set_text_color(*_GRIS)
        pdf.cell(ancho - 6, 4, _l1(titulo.upper()))
        yy = y0 + 7
        for j, (texto, negrita) in enumerate(lineas):
            pdf.set_xy(x + 3, yy)
            pdf.set_font("Helvetica", "B" if negrita else "", 9 if negrita else 8)
            pdf.set_text_color(*(_TINTA if negrita else _GRIS))
            pdf.cell(ancho - 6, 5, _l1(texto))
            yy += 5.5
    pdf.set_xy(pdf.l_margin, y0 + alto + 5)


def _campo(pdf, x, y, ancho, etiqueta, valor):
    pdf.set_xy(x, y)
    pdf.set_font("Helvetica", "", 7)
    pdf.set_text_color(*_GRIS)
    pdf.cell(ancho, 4, _l1(etiqueta))
    pdf.set_xy(x, y + 4)
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(*_TINTA)
    pdf.cell(ancho, 5, _l1(valor if valor not in (None, "") else "—"))


def _titulo_seccion(pdf, texto):
    pdf.set_fill_color(*_FONDO)
    pdf.set_text_color(*_VERDE)
    pdf.set_font("Helvetica", "B", 8)
    pdf.cell(0, 7, "  " + _l1(texto.upper()), ln=True, fill=True)
    pdf.ln(2)


def renderizar_pdf(doc: DocumentoClinico) -> bytes:
    from fpdf import FPDF

    c = doc.contenido
    es_receta = doc.tipo == TIPO_RECETA
    titulo = _NOMBRE_TIPO.get(doc.tipo, doc.tipo)

    pdf = FPDF()
    pdf.set_auto_page_break(auto=False)
    pdf.add_page()
    pdf.set_margins(15, 15, 15)
    ancho_util = pdf.w - 30

    # Franja superior + encabezado
    pdf.set_fill_color(*_VERDE)
    pdf.rect(0, 0, pdf.w, 3, style="F")
    pdf.set_xy(15, 10)
    if os.path.exists(_LOGO_PATH):
        pdf.image(_LOGO_PATH, x=15, y=9, w=16)
    pdf.set_xy(35, 10)
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(*_TINTA)
    pdf.cell(100, 5, _l1(NOMBRE_INSTITUCION), ln=True)
    pdf.set_x(35)
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(*_GRIS)
    pdf.cell(100, 5, _l1(NOMBRE_SERVICIO))
    pdf.set_xy(pdf.w - 15 - 60, 10)
    pdf.set_font("Helvetica", "", 7)
    pdf.cell(60, 4, "FOLIO", align="R", ln=True)
    pdf.set_xy(pdf.w - 15 - 60, 14)
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(*_TINTA)
    pdf.cell(60, 5, doc.folio, align="R")

    pdf.set_xy(15, 32)
    pdf.set_font("Helvetica", "B", 20)
    pdf.set_text_color(*_VERDE)
    pdf.cell(100, 9, _l1(titulo))
    pdf.set_xy(pdf.w - 15 - 90, 36)
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(*_GRIS)
    emitido_local = a_hora_local(c["emitido_en"])
    pdf.cell(90, 5, _l1("Emitido el " + fecha_larga(emitido_local)), align="R")
    pdf.set_xy(15, 48)

    prof, est, at = c["profesional"], c["estudiante"], c["atencion"]
    _caja_dos_columnas(
        pdf,
        "Profesional",
        [(prof["nombre"], True), (prof.get("especialidad") or "", False), (f"RUN {prof['rut']}" if prof.get("rut") else "", False)],
        "Estudiante",
        [(est["nombre"] or "", True), (f"RUT {est['rut']}" if est.get("rut") else "", False), (est.get("carrera") or "", False)],
    )

    if es_receta:
        pdf.set_font("Helvetica", "B", 9)
        pdf.set_text_color(*_TINTA)
        limite = c.get("valida_hasta")
        pdf.multi_cell(0, 5, _l1("Fecha limite de uso (inclusive): " + (fecha_corta(limite) if limite else "no registrada en este documento antiguo")), new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "", 7)
        pdf.set_text_color(*_GRIS)
        pdf.multi_cell(0, 4, _l1("La duracion del tratamiento es independiente. La verificacion no registra entregas ni autoriza repeticiones."), new_x="LMARGIN", new_y="NEXT")
        pdf.ln(3)
        pdf.set_font("Helvetica", "B", 8)
        pdf.set_text_color(*_VERDE)
        pdf.cell(0, 6, "RP (PRESCRIPCIÓN)", ln=True)
        for m in c["medicamentos"]:
            col = ancho_util / 4
            valores = [("Dosis", m["dosis"]), ("Vía", m["via"]),
                       ("Frecuencia", m["frecuencia"]), ("Periodo", m["periodo"])]
            extra = []
            if m.get("cantidad"):
                extra.append(f"Cantidad: {m['cantidad']}")
            if m.get("marca"):
                extra.append(f"Alternativa comercial: {m['marca']}")
            if m.get("indicacion"):
                extra.append(f"Indicación: {m['indicacion']}")
            texto_extra = "  |  ".join(extra)
            pdf.set_font("Helvetica", "B", 10)
            alto_titulo = max(8, pdf.multi_cell(ancho_util - 6, 5, _l1(m["medicamento"]), dry_run=True, output="HEIGHT") + 3)
            pdf.set_font("Helvetica", "B", 9)
            alto_valores = max(pdf.multi_cell(col - 6, 5, _l1(v), dry_run=True, output="HEIGHT") for _, v in valores)
            pdf.set_font("Helvetica", "", 8)
            alto_extra = pdf.multi_cell(ancho_util - 6, 4, _l1(texto_extra), dry_run=True, output="HEIGHT") if texto_extra else 0
            alto = alto_titulo + 4 + alto_valores + 5 + (alto_extra + 3 if texto_extra else 0)
            y0 = pdf.get_y()
            if y0 + alto > 215:
                pdf.set_xy(15, y0)
                pdf.set_font("Helvetica", "I", 8)
                pdf.set_text_color(*_GRIS)
                pdf.cell(ancho_util, 5, "Continúa en la página siguiente", align="R")
                pdf.add_page()
                pdf.set_fill_color(*_VERDE)
                pdf.rect(0, 0, pdf.w, 3, style="F")
                pdf.set_xy(15, 12)
                pdf.set_font("Helvetica", "B", 8)
                pdf.cell(0, 6, _l1("RP (continuación) - Folio " + doc.folio), new_x="LMARGIN", new_y="NEXT", align="L")
                y0 = pdf.get_y()
            pdf.set_draw_color(226, 232, 240)
            pdf.rect(15, y0, ancho_util, alto)
            pdf.set_fill_color(*_FONDO)
            pdf.rect(15, y0, ancho_util, alto_titulo, style="DF")
            pdf.set_xy(18, y0 + 1.5)
            pdf.set_font("Helvetica", "B", 10)
            pdf.set_text_color(*_TINTA)
            pdf.multi_cell(ancho_util - 6, 5, _l1(m["medicamento"]), new_x="LMARGIN", new_y="NEXT", align="L")
            for indice, (etiqueta, valor) in enumerate(valores):
                x = 18 + indice * col
                y = y0 + alto_titulo + 2
                pdf.set_xy(x, y)
                pdf.set_font("Helvetica", "", 7)
                pdf.set_text_color(*_GRIS)
                pdf.cell(col - 6, 4, _l1(etiqueta))
                pdf.set_xy(x, y + 4)
                pdf.set_font("Helvetica", "B", 9)
                pdf.set_text_color(*_TINTA)
                pdf.multi_cell(col - 6, 5, _l1(valor), new_x="LMARGIN", new_y="NEXT", align="L")
            if texto_extra:
                pdf.set_xy(18, y0 + alto_titulo + 4 + alto_valores + 5)
                pdf.set_font("Helvetica", "", 8)
                pdf.set_text_color(*_GRIS)
                pdf.multi_cell(ancho_util - 6, 4, _l1(texto_extra), new_x="LMARGIN", new_y="NEXT", align="L")
            pdf.set_xy(15, y0 + alto + 4)

    else:
        pdf.set_font("Helvetica", "", 9)
        pdf.set_text_color(*_TINTA)
        pdf.multi_cell(0, 5, _l1("Se certifica que el/la estudiante individualizado/a fue atendido/a en este servicio, según el siguiente detalle:"))
        pdf.ln(3)
        _titulo_seccion(pdf, "Datos de la atención")
        y = pdf.get_y()
        col = ancho_util / 3
        _campo(pdf, 18, y, col, "Fecha", fecha_corta(at["fecha"]))
        _campo(pdf, 18 + col, y, col, "Hora", at["hora"])
        _campo(pdf, 18 + 2 * col, y, col, "Modalidad", at.get("modalidad"))
        _campo(pdf, 18, y + 11, col, "Especialidad", prof.get("especialidad"))
        _campo(pdf, 18 + col, y + 11, col, "Tipo de atención", at.get("tipo_atencion"))
        _campo(pdf, 18 + 2 * col, y + 11, col, "Motivo de consulta", at.get("motivo_consulta"))
        pdf.set_xy(15, y + 26)

        _titulo_seccion(pdf, "Reposo e indicaciones")
        y = pdf.get_y()
        r = c["reposo"]
        _campo(pdf, 18, y, col, "Reposo", "Si" if r["indicado"] else "No")
        if r["indicado"]:
            _campo(pdf, 18 + col, y, col, "Desde - hasta", f"{fecha_corta(r['desde'])} - {fecha_corta(r['hasta'])}")
            _campo(pdf, 18 + 2 * col, y, col, "Días", str(r["dias"]))
        _campo(pdf, 18, y + 11, ancho_util, "Restricciones de actividad", c.get("restricciones") or "Sin restricciones")
        _campo(pdf, 18, y + 22, ancho_util, "Control sugerido", fecha_corta(c["control_sugerido"]) if c.get("control_sugerido") else "No requiere")
        pdf.set_xy(15, y + 36)

        if c.get("observaciones"):
            pdf.set_font("Helvetica", "B", 7)
            pdf.set_text_color(*_GRIS)
            pdf.cell(0, 5, "OBSERVACIONES DEL PROFESIONAL", ln=True)
            pdf.set_font("Helvetica", "", 9)
            pdf.set_text_color(*_TINTA)
            pdf.multi_cell(0, 5, _l1(c["observaciones"]))
            pdf.ln(2)
        pdf.set_font("Helvetica", "I", 7)
        pdf.set_text_color(*_GRIS)
        pdf.multi_cell(0, 4, _l1("Diagnóstico: no incluido. Este documento justifica la inasistencia del estudiante en la fecha indicada y no constituye licencia médica."))

    # El folio aleatorio existente es el identificador único: barras y QR lo reutilizan.
    # No se dibuja firma ni línea para firmar, incluso en documentos históricos.
    pdf.set_fill_color(0, 0, 0)
    texto_barras = "*" + doc.folio + "*"
    ancho_barra = 1.0
    ancho_codigo = len(texto_barras) * (16 / 3) * ancho_barra
    pdf.code39(texto_barras, (pdf.w - ancho_codigo) / 2, 229, w=ancho_barra, h=10)
    pdf.set_xy(15, 241)
    pdf.set_font("Helvetica", "B", 8)
    pdf.set_text_color(*_TINTA)
    pdf.cell(ancho_util, 4, doc.folio, align="C")
    pdf.set_xy(15, 246)
    pdf.set_font("Helvetica", "", 7)
    pdf.cell(ancho_util, 4, _l1("Emitido por " + prof["nombre"] + " - " + emitido_local.strftime("%d/%m/%Y %H:%M")), align="C")

    # Verificación + QR
    y_ver = 252
    pdf.set_draw_color(226, 232, 240)
    pdf.rect(15, y_ver, ancho_util, 30)
    _dibujar_qr(pdf, url_validacion(doc.folio), 18, y_ver + 2, 26)
    pdf.set_xy(48, y_ver + 4)
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(*_TINTA)
    pdf.cell(0, 5, "Verifica la autenticidad de este documento", ln=True)
    pdf.set_x(48)
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(*_GRIS)
    pdf.multi_cell(ancho_util - 36, 4, _l1(f"Escanea el QR o ingresa el código {doc.folio} en la pantalla de validación de SESAES."))
    pdf.set_x(48)
    h = doc.huella_sha256
    pdf.cell(0, 4, f"Huella SHA-256: {h[:4]}...{h[-4:]}")

    # Aviso normativo: SESAES no sustituye el formato oficial de los medicamentos de
    # control legal (estupefacientes y psicotrópicos: receta retenida o receta cheque).
    if es_receta:
        pdf.set_xy(15, 284)
        pdf.set_font("Helvetica", "I", 7)
        pdf.set_text_color(*_GRIS)
        pdf.cell(ancho_util, 3.5, _l1("No válido para estupefacientes ni psicotrópicos (receta retenida o receta cheque): requieren su formato oficial."), align="C")

    if doc.estado == ESTADO_ANULADO:
        with pdf.rotation(40, pdf.w / 2, 140):
            pdf.set_font("Helvetica", "B", 56)
            pdf.set_text_color(220, 38, 38)
            pdf.set_xy(20, 128)
            pdf.cell(pdf.w - 40, 20, "ANULADO", align="C")

    return bytes(pdf.output())
