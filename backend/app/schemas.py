from pydantic import BaseModel
from typing import Optional
from datetime import datetime


# ══════════════════════════════════════
# CITAS
# ══════════════════════════════════════

class CitaCreate(BaseModel):
    estudiante_id:  int
    profesional_id: int
    fecha:          str            # YYYY-MM-DD
    hora:           str            # HH:MM AM/PM
    observaciones:  Optional[str] = None
    urgente:        Optional[bool] = False


# ══════════════════════════════════════
# ESTUDIANTE
# ══════════════════════════════════════

class EstudianteOut(BaseModel):
    id:          int
    correo:      str
    rol:         str
    nombre:      Optional[str]  = None
    telefono:    Optional[str]  = None
    foto_url:    Optional[str]  = None
    tema_oscuro: Optional[bool] = False
    carrera:     Optional[str]  = None
    rut:         Optional[str]  = None

    class Config:
        from_attributes = True


class EstudianteUpdate(BaseModel):
    nombre:      Optional[str]  = None
    telefono:    Optional[str]  = None
    foto_url:    Optional[str]  = None
    tema_oscuro: Optional[bool] = None
    carrera:     Optional[str]  = None
    rut:         Optional[str]  = None


# ══════════════════════════════════════
# PROFESIONAL
# ══════════════════════════════════════

class ProfesionalCreate(BaseModel):
    nombre:       str
    especialidad: str
    iniciales:    Optional[str] = None
    descripcion:  Optional[str] = None
    duracion_min: Optional[int] = 45
    correo:       Optional[str] = None
    rut:          Optional[str] = None
    password:     Optional[str] = "prof123"  # contraseña por defecto


class ProfesionalUpdate(BaseModel):
    nombre:       Optional[str] = None
    especialidad: Optional[str] = None
    iniciales:    Optional[str] = None
    descripcion:  Optional[str] = None
    duracion_min: Optional[int] = None
    correo:       Optional[str] = None
    rut:          Optional[str] = None
    estado:       Optional[str] = None
    hora_almuerzo_inicio: Optional[str] = None 

class ProfesionalOut(BaseModel):
    id:           int
    nombre:       str
    especialidad: str
    iniciales:    Optional[str] = None
    descripcion:  Optional[str] = None
    duracion_min: int
    estado:       Optional[str] = "activo"
    correo:       Optional[str] = None
    rut:          Optional[str] = None
    usuario_id:   Optional[int] = None
    hora_almuerzo_inicio: Optional[str] = None  
    hora_almuerzo_fin:    Optional[str] = None
    class Config:
        from_attributes = True


# ══════════════════════════════════════
# NOTIFICACIONES
# ══════════════════════════════════════

class NotificacionOut(BaseModel):
    id:             int
    usuario_id:     int
    mensaje:        str
    tipo:           str
    leida:          bool
    fecha_creacion: Optional[datetime] = None

    class Config:
        from_attributes = True


# ══════════════════════════════════════
# CONFIGURACIÓN DEL SISTEMA
# ══════════════════════════════════════

class ConfiguracionOut(BaseModel):
    id:                         int
    duracion_turno_min:         int
    agendamiento_por_pacientes: bool
    cancelacion_instantanea:    bool
    sobreturnos_habilitados:    bool
    cupos_por_turno:            int

    class Config:
        from_attributes = True


class ConfiguracionUpdate(BaseModel):
    duracion_turno_min:         Optional[int]  = None
    agendamiento_por_pacientes: Optional[bool] = None
    cancelacion_instantanea:    Optional[bool] = None
    sobreturnos_habilitados:    Optional[bool] = None
    cupos_por_turno:            Optional[int]  = None


# ══════════════════════════════════════
# AUDITORÍA
# ══════════════════════════════════════

class AuditoriaOut(BaseModel):
    id:         int
    usuario_id: Optional[int] = None
    accion:     str
    detalle:    Optional[str] = None
    entidad:    Optional[str] = None
    entidad_id: Optional[int] = None
    fecha:      Optional[datetime] = None

    class Config:
        from_attributes = True


# ══════════════════════════════════════
# CONFIGURACIÓN DEL CENTRO SESAES
# ══════════════════════════════════════

class ConfiguracionCentroOut(BaseModel):
    id:               int
    nombre_centro:    str
    direccion:        str
    telefono:         Optional[str] = None
    correo_contacto:  Optional[str] = None
    horario_atencion: str
    foto_admin_url:   Optional[str] = None
    nombre_admin:     str

    class Config:
        from_attributes = True


class ConfiguracionCentroUpdate(BaseModel):
    nombre_centro:    Optional[str] = None
    direccion:        Optional[str] = None
    telefono:         Optional[str] = None
    correo_contacto:  Optional[str] = None
    horario_atencion: Optional[str] = None
    foto_admin_url:   Optional[str] = None
    nombre_admin:     Optional[str] = None


# ══════════════════════════════════════
# HISTORIAL DE ESTADOS DEL PROFESIONAL
# ══════════════════════════════════════

class HistorialEstadoOut(BaseModel):
    id:              int
    profesional_id:  int
    estado_anterior: Optional[str] = None
    estado_nuevo:    str
    motivo:          Optional[str] = None
    fecha:           Optional[datetime] = None
    registrado_por:  Optional[int] = None

    class Config:
        from_attributes = True