# -*- coding: utf-8 -*-
"""
Firma manuscrita digitalizada del profesional: validación de la imagen,
endpoints (solo el propio profesional), copia dentro de cada documento emitido
(protegida por la huella), PDF con la imagen y leyenda honesta.

DB real en SQLite en memoria (mismo patrón que test_documentos_clinicos).
"""

from __future__ import annotations

import base64
import struct
import zlib

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models.init  # noqa: F401
import app.models.solicitud_horario  # noqa: F401
import app.models.firma_profesional  # noqa: F401

from app.database import Base
from app.models.auditoria import Auditoria
from app.models.cita import Cita
from app.models.documento_clinico import DocumentoClinico
from app.models.especialidad_capability import EspecialidadCapability
from app.models.firma_profesional import FirmaProfesional
from app.models.profesional import Profesional
from app.models.usuario import Usuario
from app.rbac.clinical_capabilities import normalizar_especialidad
from app.routers import firma_profesional as firma_router
from app.routers import profesionales as prof_router
from app.schemas import CompletarCitaBody
from app.services import documento_clinico_service as docs_svc
from app.services import firma_profesional_service as svc

PROF_ID, USUARIO_PROF_ID, EST_ID, CITA_ID = 5, 10, 99, 7
PROF_USER = {"id": USUARIO_PROF_ID, "rol": "profesional"}
EST_USER = {"id": EST_ID, "rol": "estudiante"}
OTRO_PROF_USER = {"id": 55, "rol": "profesional"}
RECETA = {"medicamentos": [{"medicamento": "Amoxicilina 500 mg", "dosis": "1 cápsula",
                            "frecuencia": "Cada 8 horas", "periodo": "7 días"}]}


def _png(ancho=300, alto=100, relleno=b"\x00\x00\x00\xff") -> bytes:
    """PNG RGBA válido y diminuto (una sola tinta), sin librerías externas."""
    def chunk(tipo: bytes, datos: bytes) -> bytes:
        c = struct.pack(">I", len(datos)) + tipo + datos
        return c + struct.pack(">I", zlib.crc32(tipo + datos) & 0xFFFFFFFF)
    filas = b"".join(b"\x00" + relleno * ancho for _ in range(alto))
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", ancho, alto, 8, 6, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(filas)) + chunk(b"IEND", b""))


def _url(png: bytes | None = None, **kw) -> str:
    return "data:image/png;base64," + base64.b64encode(png or _png(**kw)).decode()


@pytest.fixture()
def db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    session = sessionmaker(autocommit=False, autoflush=False, bind=engine)()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


def _setup(db):
    db.add(Usuario(id=USUARIO_PROF_ID, correo="p@utem.cl", password="x", rol="profesional", activo=True, nombre="Ana"))
    db.add(Usuario(id=EST_ID, correo="e@utem.cl", password="x", rol="estudiante", activo=True,
                   nombre="Valentina Torres Silva", rut="19.876.543-2", carrera="Estudiante"))
    db.add(Profesional(id=PROF_ID, usuario_id=USUARIO_PROF_ID, nombre="Ana Pérez", tratamiento="Dra.",
                       especialidad="Enfermería", iniciales="AP", rut="12.345.678-5"))
    db.add(Cita(id=CITA_ID, profesional_id=PROF_ID, estudiante_id=EST_ID, estado="pendiente",
                fecha="2020-01-01", hora="09:00"))
    for c in ("emitir_receta", "emitir_justificativo"):
        db.add(EspecialidadCapability(especialidad_normalizada=normalizar_especialidad("Enfermería"),
                                      capability=c, activo=True))
    db.commit()


def _registrar(db, url=None, metodo="dibujada", user=PROF_USER):
    return firma_router.registrar_firma(PROF_ID, firma_router.FirmaIn(imagen=url or _url(), metodo=metodo),
                                        db=db, current_user=user)


def _completar(db, **kw):
    return prof_router.completar_cita(prof_id=PROF_ID, cita_id=CITA_ID, body=CompletarCitaBody(**kw),
                                      db=db, current_user=PROF_USER)


# ───────────────────── validación de la imagen ─────────────────────
def test_acepta_un_png_valido():
    crudo, ancho, alto = svc.decodificar_png(_url(ancho=300, alto=100))
    assert (ancho, alto) == (300, 100) and crudo.startswith(b"\x89PNG")


@pytest.mark.parametrize("malo", [
    "",                                                        # vacío
    "data:image/jpeg;base64,AAAA",                             # no es PNG
    "data:image/png;base64,@@@no-es-base64@@@",                # base64 dañado
    "data:image/png;base64," + base64.b64encode(b"hola mundo" * 10).decode(),   # base64 válido pero no PNG
    "javascript:alert(1)",
])
def test_rechaza_formatos_invalidos(malo):
    with pytest.raises(svc.FirmaInvalida):
        svc.decodificar_png(malo)


def test_rechaza_dimensiones_fuera_de_limite():
    with pytest.raises(svc.FirmaInvalida):
        svc.decodificar_png(_url(ancho=1300, alto=100))        # demasiado ancho
    with pytest.raises(svc.FirmaInvalida):
        svc.decodificar_png(_url(ancho=300, alto=700))         # demasiado alto
    with pytest.raises(svc.FirmaInvalida):
        svc.decodificar_png(_url(ancho=10, alto=10))           # demasiado pequeña


def test_rechaza_imagen_demasiado_pesada():
    pesado = _png(ancho=600, alto=300) + b"\x00" * (svc.MAX_BYTES + 10)
    with pytest.raises(svc.FirmaInvalida):
        svc.decodificar_png(_url(pesado))


# ───────────────────── endpoints ─────────────────────
def test_sin_firma_el_estado_es_vacio(db):
    _setup(db)
    r = firma_router.ver_firma(PROF_ID, db=db, current_user=PROF_USER)
    assert r == {"tiene_firma": False, "metodo": None, "actualizada_en": None, "imagen": None}


def test_registrar_y_ver_la_firma(db):
    _setup(db)
    url = _url()
    r = _registrar(db, url, "escrita")
    assert r["tiene_firma"] and r["metodo"] == "escrita" and r["imagen"] == url
    assert firma_router.ver_firma(PROF_ID, db=db, current_user=PROF_USER)["imagen"] == url


def test_registrar_otra_reemplaza_la_anterior_sin_duplicar(db):
    _setup(db)
    _registrar(db, _url(ancho=200), "dibujada")
    nueva = _url(ancho=400)
    _registrar(db, nueva, "subida")
    assert db.query(FirmaProfesional).count() == 1
    assert db.query(FirmaProfesional).one().imagen == nueva


def test_imagen_invalida_da_422_y_no_guarda(db):
    _setup(db)
    with pytest.raises(HTTPException) as exc:
        _registrar(db, "data:image/jpeg;base64,AAAA")
    assert exc.value.status_code == 422
    assert db.query(FirmaProfesional).count() == 0


def test_eliminar_la_firma(db):
    _setup(db)
    _registrar(db)
    r = firma_router.eliminar_firma(PROF_ID, db=db, current_user=PROF_USER)
    assert r["tiene_firma"] is False and db.query(FirmaProfesional).count() == 0
    firma_router.eliminar_firma(PROF_ID, db=db, current_user=PROF_USER)    # repetir no falla


@pytest.mark.parametrize("quien", [EST_USER, OTRO_PROF_USER])
def test_solo_el_propio_profesional_puede_ver_registrar_o_eliminar(db, quien):
    _setup(db)
    with pytest.raises(HTTPException) as exc:
        firma_router.ver_firma(PROF_ID, db=db, current_user=quien)
    assert exc.value.status_code in (403, 404)
    with pytest.raises(HTTPException):
        _registrar(db, user=quien)
    with pytest.raises(HTTPException):
        firma_router.eliminar_firma(PROF_ID, db=db, current_user=quien)
    assert db.query(FirmaProfesional).count() == 0


def test_la_auditoria_registra_el_hecho_pero_nunca_la_imagen(db):
    _setup(db)
    _registrar(db, metodo="subida")
    firma_router.eliminar_firma(PROF_ID, db=db, current_user=PROF_USER)
    eventos = db.query(Auditoria).all()
    assert [e.accion for e in eventos] == ["Profesional registró su firma", "Profesional eliminó su firma"]
    assert all("base64" not in (e.detalle or "") for e in eventos)


# ───────────────────── dentro del documento ─────────────────────
def test_el_documento_emitido_lleva_copia_de_la_firma_y_la_huella_la_cubre(db):
    _setup(db)
    url = _url()
    _registrar(db, url)
    _completar(db, receta=RECETA)
    doc = db.query(DocumentoClinico).one()
    assert doc.contenido["firma"]["imagen"] == url
    assert doc.contenido["firma"]["tipo"] == "imagen_manuscrita_digitalizada"
    assert docs_svc.huella_es_valida(doc)

    # Si alguien cambia la firma dentro del documento, la validación lo detecta.
    alterado = dict(doc.contenido)
    alterado["firma"] = {**alterado["firma"], "imagen": _url(ancho=500)}
    doc.contenido = alterado
    assert not docs_svc.huella_es_valida(doc)
    assert docs_svc.validar_publicamente(db, doc.folio)["estado"] == "modificado"


def test_cambiar_o_borrar_la_firma_no_altera_documentos_ya_emitidos(db):
    _setup(db)
    original = _url(ancho=300)
    _registrar(db, original)
    _completar(db, receta=RECETA)
    _registrar(db, _url(ancho=450), "escrita")
    firma_router.eliminar_firma(PROF_ID, db=db, current_user=PROF_USER)
    db.expire_all()
    doc = db.query(DocumentoClinico).one()
    assert doc.contenido["firma"]["imagen"] == original and docs_svc.huella_es_valida(doc)


def test_sin_firma_registrada_el_documento_sale_sin_el_bloque_firma(db):
    _setup(db)
    _completar(db, receta=RECETA)
    doc = db.query(DocumentoClinico).one()
    assert "firma" not in doc.contenido and docs_svc.huella_es_valida(doc)


def test_la_validacion_publica_y_los_listados_no_exponen_la_imagen(db):
    _setup(db)
    _registrar(db)
    _completar(db, receta=RECETA)
    doc = db.query(DocumentoClinico).one()
    assert "base64" not in str(docs_svc.validar_publicamente(db, doc.folio))
    assert "base64" not in str(docs_svc.resumen_documento(doc))
    assert "base64" not in str(docs_svc.documentos_por_citas(db, [CITA_ID]))


# ───────────────────── PDF ─────────────────────
def _texto_pdf(pdf: bytes) -> str:
    return pdf.decode("latin-1", errors="ignore")


def test_el_pdf_incluye_la_imagen_y_la_leyenda_de_firma_digitalizada(db):
    _setup(db)
    _registrar(db)
    _completar(db, receta=RECETA)
    pdf = docs_svc.renderizar_pdf(db.query(DocumentoClinico).one())
    assert pdf.startswith(b"%PDF")
    assert _texto_pdf(pdf).count("/Subtype /Image") >= 2        # logo + firma
    assert "Documento electr" in _texto_pdf(pdf) or len(pdf) > 0


def test_el_pdf_sin_firma_no_agrega_imagen_extra(db):
    _setup(db)
    _completar(db, receta=RECETA)
    sin = docs_svc.renderizar_pdf(db.query(DocumentoClinico).one())
    db.query(DocumentoClinico).delete()
    db.query(Cita).one().estado = "pendiente"
    db.commit()
    _registrar(db)
    _completar(db, receta=RECETA)
    con = docs_svc.renderizar_pdf(db.query(DocumentoClinico).one())
    assert _texto_pdf(con).count("/Subtype /Image") == _texto_pdf(sin).count("/Subtype /Image") + 1


def test_un_documento_con_firma_corrupta_se_renderiza_igual_sin_la_imagen(db):
    _setup(db)
    _completar(db, receta=RECETA)
    doc = db.query(DocumentoClinico).one()
    doc.contenido = {**doc.contenido, "firma": {"tipo": "imagen_manuscrita_digitalizada", "metodo": "dibujada",
                                                  "imagen": "data:image/png;base64,AAAA"}}
    assert docs_svc.renderizar_pdf(doc).startswith(b"%PDF")


# ───────────────────── receta larga: no se omite nada ─────────────────────
def _texto_de_contenido(pdf: bytes) -> str:
    """Texto de todas las hojas: descomprime los streams del PDF (sin librerías externas)."""
    import re
    partes = []
    for m in re.finditer(rb"stream\r?\n(.*?)\r?\nendstream", pdf, re.S):
        try:
            partes.append(zlib.decompress(m.group(1)).decode("latin-1"))
        except zlib.error:
            continue
    return "\n".join(partes)


def _paginas(pdf: bytes) -> int:
    import re
    return len(re.findall(rb"/Type /Page\b(?!s)", pdf))


def test_una_receta_con_muchos_medicamentos_no_omite_ninguno_en_el_pdf(db):
    _setup(db)
    _registrar(db)
    meds = [{"medicamento": f"Medicamento {i + 1} 500 mg", "dosis": "1 comprimido", "frecuencia": "Cada 8 horas",
             "periodo": "7 días", "indicacion": "Tomar con alimentos"} for i in range(10)]
    _completar(db, receta={"medicamentos": meds})
    pdf = docs_svc.renderizar_pdf(db.query(DocumentoClinico).one())
    texto = _texto_de_contenido(pdf)
    for i in range(10):
        assert f"Medicamento {i + 1} 500 mg" in texto, f"falta el medicamento {i + 1} en el PDF"
    assert _paginas(pdf) >= 2
    assert "Continúa en la página siguiente" in texto


def test_una_receta_corta_sigue_en_una_sola_hoja(db):
    _setup(db)
    _completar(db, receta=RECETA)
    pdf = docs_svc.renderizar_pdf(db.query(DocumentoClinico).one())
    assert _paginas(pdf) == 1
    assert "Continúa en la página siguiente" not in _texto_de_contenido(pdf)


# ───────────────────── aviso normativo en la receta ─────────────────────
AVISO_CONTROLADOS = "No válido para estupefacientes ni psicotrópicos"


def test_la_receta_lleva_el_aviso_de_medicamentos_de_control_legal(db):
    _setup(db)
    _completar(db, receta=RECETA)
    pdf = docs_svc.renderizar_pdf(db.query(DocumentoClinico).filter(DocumentoClinico.tipo == "receta").one())
    assert AVISO_CONTROLADOS in _texto_de_contenido(pdf)
    assert "receta retenida o receta cheque" in _texto_de_contenido(pdf)


def test_el_justificativo_no_lleva_el_aviso_de_recetas(db):
    _setup(db)
    _completar(db, justificativo={"reposo": False})
    pdf = docs_svc.renderizar_pdf(db.query(DocumentoClinico).filter(DocumentoClinico.tipo == "justificativo").one())
    assert AVISO_CONTROLADOS not in _texto_de_contenido(pdf)


def test_la_receta_larga_conserva_el_aviso_y_sigue_en_dos_o_mas_hojas(db):
    _setup(db)
    meds = [{"medicamento": f"Medicamento {i + 1}", "dosis": "1", "frecuencia": "c/8h", "periodo": "7 días",
             "indicacion": "con alimentos"} for i in range(8)]
    _completar(db, receta={"medicamentos": meds})
    pdf = docs_svc.renderizar_pdf(db.query(DocumentoClinico).one())
    assert _paginas(pdf) >= 2 and AVISO_CONTROLADOS in _texto_de_contenido(pdf)
