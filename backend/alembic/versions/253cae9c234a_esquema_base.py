"""esquema base

Revision ID: 253cae9c234a
Revisión anterior: 
Fecha de generación: 2026-11-15 21:37:23.309468

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# Identificadores del historial Alembic.
revision: str = '253cae9c234a'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Crear el esquema base completo."""
    # Generada contra PostgreSQL vacío y revisada contra los modelos.
    op.create_table('configuracion_centro',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('nombre_centro', sa.String(), nullable=True),
    sa.Column('direccion', sa.String(), nullable=True),
    sa.Column('telefono', sa.String(), nullable=True),
    sa.Column('correo_contacto', sa.String(), nullable=True),
    sa.Column('horario_atencion', sa.String(), nullable=True),
    sa.Column('foto_admin_url', sa.String(), nullable=True),
    sa.Column('nombre_admin', sa.String(), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_configuracion_centro_id'), 'configuracion_centro', ['id'], unique=False)
    op.create_table('configuracion_sistema',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('duracion_turno_min', sa.Integer(), nullable=True),
    sa.Column('agendamiento_por_pacientes', sa.Boolean(), nullable=True),
    sa.Column('cancelacion_instantanea', sa.Boolean(), nullable=True),
    sa.Column('sobreturnos_habilitados', sa.Boolean(), nullable=True),
    sa.Column('cupos_por_turno', sa.Integer(), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_configuracion_sistema_id'), 'configuracion_sistema', ['id'], unique=False)
    op.create_table('correo_log',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('destinatario', sa.String(), nullable=True),
    sa.Column('asunto', sa.String(), nullable=True),
    sa.Column('cuerpo', sa.String(), nullable=True),
    sa.Column('enviado', sa.Boolean(), nullable=True),
    sa.Column('error_envio', sa.String(), nullable=True),
    sa.Column('fecha', sa.DateTime(), server_default=sa.func.now(), nullable=True),
    sa.Column('tipo', sa.String(), nullable=True),
    sa.Column('referencia_id', sa.Integer(), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_correo_log_id'), 'correo_log', ['id'], unique=False)
    op.create_table('especialidad_capability',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('especialidad_normalizada', sa.String(), nullable=False),
    sa.Column('capability', sa.String(), nullable=False),
    sa.Column('activo', sa.Boolean(), nullable=False),
    sa.Column('creado_en', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('especialidad_normalizada', 'capability', name='uq_especialidad_capability_regla')
    )
    op.create_index(op.f('ix_especialidad_capability_especialidad_normalizada'), 'especialidad_capability', ['especialidad_normalizada'], unique=False)
    op.create_index(op.f('ix_especialidad_capability_id'), 'especialidad_capability', ['id'], unique=False)
    op.create_table('historial_plantilla_pregunta',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('profesional_id', sa.Integer(), nullable=True),
    sa.Column('especialidad', sa.String(), nullable=False),
    sa.Column('etiqueta', sa.String(), nullable=False),
    sa.Column('tipo', sa.String(), nullable=True),
    sa.Column('orden', sa.Integer(), nullable=True),
    sa.Column('activa', sa.Boolean(), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_historial_plantilla_pregunta_especialidad'), 'historial_plantilla_pregunta', ['especialidad'], unique=False)
    op.create_index(op.f('ix_historial_plantilla_pregunta_id'), 'historial_plantilla_pregunta', ['id'], unique=False)
    op.create_index(op.f('ix_historial_plantilla_pregunta_profesional_id'), 'historial_plantilla_pregunta', ['profesional_id'], unique=False)
    op.create_table('usuario',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('correo', sa.String(), nullable=True),
    sa.Column('correo_secundario', sa.String(), nullable=True),
    sa.Column('password', sa.String(), nullable=True),
    sa.Column('rol', sa.String(), nullable=True),
    sa.Column('nombre', sa.String(), nullable=True),
    sa.Column('telefono', sa.String(), nullable=True),
    sa.Column('foto_url', sa.String(), nullable=True),
    sa.Column('tema_oscuro', sa.Boolean(), nullable=True),
    sa.Column('carrera', sa.String(), nullable=True),
    sa.Column('rut', sa.String(), nullable=True),
    sa.Column('activo', sa.Boolean(), nullable=True),
    sa.Column('debe_cambiar_password', sa.Boolean(), nullable=True),
    sa.Column('fecha_creacion', sa.DateTime(), server_default=sa.func.now(), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_usuario_correo'), 'usuario', ['correo'], unique=True)
    op.create_index(op.f('ix_usuario_id'), 'usuario', ['id'], unique=False)
    op.create_table('acceso_administrativo',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('usuario_id', sa.Integer(), nullable=False),
    sa.Column('perfil', sa.String(length=64), nullable=False),
    sa.Column('tipo_alcance', sa.String(length=32), nullable=False),
    sa.CheckConstraint("(perfil IN ('administrador_general', 'secretaria_general') AND tipo_alcance = 'institucional') OR (perfil IN ('administrador_especialidad', 'secretaria_especialidad') AND tipo_alcance = 'especialidades')", name='ck_acceso_administrativo_perfil_alcance'),
    sa.CheckConstraint("perfil IN ('administrador_general', 'administrador_especialidad', 'secretaria_general', 'secretaria_especialidad')", name='ck_acceso_administrativo_perfil'),
    sa.CheckConstraint("tipo_alcance IN ('institucional', 'especialidades')", name='ck_acceso_administrativo_tipo_alcance'),
    sa.ForeignKeyConstraint(['usuario_id'], ['usuario.id'], ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('usuario_id', name='uq_acceso_administrativo_usuario')
    )
    op.create_table('auditoria',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('usuario_id', sa.Integer(), nullable=True),
    sa.Column('actor_rol', sa.String(), nullable=True),
    sa.Column('accion', sa.String(), nullable=True),
    sa.Column('resultado', sa.String(), server_default='exito', nullable=False),
    sa.Column('detalle', sa.String(), nullable=True),
    sa.Column('entidad', sa.String(), nullable=True),
    sa.Column('entidad_id', sa.Integer(), nullable=True),
    sa.Column('fecha', sa.DateTime(), server_default=sa.func.now(), nullable=True),
    sa.ForeignKeyConstraint(['usuario_id'], ['usuario.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_auditoria_entidad_entidad_id_fecha', 'auditoria', ['entidad', 'entidad_id', 'fecha'], unique=False)
    op.create_index(op.f('ix_auditoria_id'), 'auditoria', ['id'], unique=False)
    op.create_table('dia_cerrado',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('fecha', sa.String(), nullable=False),
    sa.Column('motivo', sa.String(), nullable=True),
    sa.Column('creado_por', sa.Integer(), nullable=True),
    sa.Column('fecha_creacion', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
    sa.ForeignKeyConstraint(['creado_por'], ['usuario.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_dia_cerrado_fecha'), 'dia_cerrado', ['fecha'], unique=True)
    op.create_index(op.f('ix_dia_cerrado_id'), 'dia_cerrado', ['id'], unique=False)
    op.create_table('notificacion',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('usuario_id', sa.Integer(), nullable=True),
    sa.Column('mensaje', sa.String(), nullable=True),
    sa.Column('tipo', sa.String(), nullable=True),
    sa.Column('leida', sa.Boolean(), nullable=True),
    sa.Column('fecha_creacion', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['usuario_id'], ['usuario.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_notificacion_id'), 'notificacion', ['id'], unique=False)
    op.create_table('profesional',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('nombre', sa.String(), nullable=True),
    sa.Column('tratamiento', sa.String(), nullable=True),
    sa.Column('color_identificador', sa.String(), nullable=True),
    sa.Column('especialidad', sa.String(), nullable=True),
    sa.Column('iniciales', sa.String(length=5), nullable=True),
    sa.Column('descripcion', sa.String(), nullable=True),
    sa.Column('usuario_id', sa.Integer(), nullable=True),
    sa.Column('duracion_min', sa.Integer(), nullable=True),
    sa.Column('estado', sa.String(), nullable=True),
    sa.Column('correo', sa.String(), nullable=True),
    sa.Column('rut', sa.String(), nullable=True),
    sa.Column('foto_url', sa.String(), nullable=True),
    sa.Column('hora_almuerzo_inicio', sa.String(), nullable=True),
    sa.Column('hora_almuerzo_fin', sa.String(), nullable=True),
    sa.Column('horario_inicio', sa.String(), nullable=True),
    sa.Column('horario_fin', sa.String(), nullable=True),
    sa.ForeignKeyConstraint(['usuario_id'], ['usuario.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_profesional_id'), 'profesional', ['id'], unique=False)
    op.create_table('acceso_admin_especialidad',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('acceso_admin_id', sa.Integer(), nullable=False),
    sa.Column('especialidad', sa.String(length=160), nullable=False),
    sa.Column('especialidad_normalizada', sa.String(length=160), nullable=False),
    sa.CheckConstraint('length(trim(especialidad)) > 0', name='ck_acceso_admin_especialidad_nombre_no_vacio'),
    sa.CheckConstraint('length(trim(especialidad_normalizada)) > 0', name='ck_acceso_admin_especialidad_normalizada_no_vacia'),
    sa.ForeignKeyConstraint(['acceso_admin_id'], ['acceso_administrativo.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('acceso_admin_id', 'especialidad_normalizada', name='uq_acceso_admin_especialidad_normalizada')
    )
    op.create_table('acceso_admin_permiso',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('acceso_admin_id', sa.Integer(), nullable=False),
    sa.Column('permiso', sa.String(length=96), nullable=False),
    sa.CheckConstraint("permiso IN ('usuarios.ver', 'usuarios.gestionar', 'profesionales.ver', 'profesionales.gestionar', 'agenda.ver', 'agenda.gestionar', 'agenda.sobrecupo', 'reportes.ver')", name='ck_acceso_admin_permiso_valido'),
    sa.ForeignKeyConstraint(['acceso_admin_id'], ['acceso_administrativo.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('acceso_admin_id', 'permiso', name='uq_acceso_admin_permiso')
    )
    op.create_table('bloque_horario_semanal',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('profesional_id', sa.Integer(), nullable=False),
    sa.Column('dia_semana', sa.Integer(), nullable=False),
    sa.Column('hora_inicio', sa.String(), nullable=False),
    sa.Column('hora_fin', sa.String(), nullable=False),
    sa.Column('tipo', sa.String(), nullable=False),
    sa.ForeignKeyConstraint(['profesional_id'], ['profesional.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_bloque_horario_semanal_id'), 'bloque_horario_semanal', ['id'], unique=False)
    op.create_index(op.f('ix_bloque_horario_semanal_profesional_id'), 'bloque_horario_semanal', ['profesional_id'], unique=False)
    op.create_table('cita',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('estudiante_id', sa.Integer(), nullable=True),
    sa.Column('profesional_id', sa.Integer(), nullable=True),
    sa.Column('fecha', sa.String(), nullable=True),
    sa.Column('hora', sa.String(), nullable=True),
    sa.Column('estado', sa.String(), nullable=True),
    sa.Column('observaciones', sa.String(), nullable=True),
    sa.Column('urgente', sa.Boolean(), nullable=True),
    sa.Column('cancelada_por_admin', sa.Boolean(), nullable=True),
    sa.Column('motivo_cancelacion', sa.String(), nullable=True),
    sa.Column('medicamento', sa.String(), nullable=True),
    sa.Column('observaciones_atencion', sa.String(), nullable=True),
    sa.Column('sobrecupo', sa.Boolean(), nullable=True),
    sa.Column('creado_por_usuario_id', sa.Integer(), nullable=True),
    sa.Column('creado_por_rol', sa.String(), nullable=True),
    sa.Column('creado_por_perfil', sa.String(), nullable=True),
    sa.Column('fecha_creacion', sa.DateTime(), server_default=sa.func.now(), nullable=True),
    sa.ForeignKeyConstraint(['creado_por_usuario_id'], ['usuario.id'], ),
    sa.ForeignKeyConstraint(['estudiante_id'], ['usuario.id'], ),
    sa.ForeignKeyConstraint(['profesional_id'], ['profesional.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_cita_creado_por_usuario_id'), 'cita', ['creado_por_usuario_id'], unique=False)
    op.create_index(op.f('ix_cita_id'), 'cita', ['id'], unique=False)
    op.create_index('ix_cita_profesional_fecha_estado', 'cita', ['profesional_id', 'fecha', 'estado'], unique=False)
    op.create_table('cuestionario_config',
    sa.Column('profesional_id', sa.Integer(), nullable=False),
    sa.Column('enviar_por_defecto', sa.Boolean(), nullable=False),
    sa.ForeignKeyConstraint(['profesional_id'], ['profesional.id'], ),
    sa.PrimaryKeyConstraint('profesional_id')
    )
    op.create_table('cuestionario_envio',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('profesional_id', sa.Integer(), nullable=False),
    sa.Column('estudiante_id', sa.Integer(), nullable=False),
    sa.Column('solicitado', sa.Boolean(), nullable=False),
    sa.Column('decidido_en', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
    sa.ForeignKeyConstraint(['estudiante_id'], ['usuario.id'], ),
    sa.ForeignKeyConstraint(['profesional_id'], ['profesional.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('profesional_id', 'estudiante_id', name='uq_cuestionario_envio_par')
    )
    op.create_index(op.f('ix_cuestionario_envio_estudiante_id'), 'cuestionario_envio', ['estudiante_id'], unique=False)
    op.create_index(op.f('ix_cuestionario_envio_id'), 'cuestionario_envio', ['id'], unique=False)
    op.create_index(op.f('ix_cuestionario_envio_profesional_id'), 'cuestionario_envio', ['profesional_id'], unique=False)
    op.create_table('firma_profesional',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('profesional_id', sa.Integer(), nullable=False),
    sa.Column('imagen', sa.Text(), nullable=False),
    sa.Column('metodo', sa.String(), nullable=False),
    sa.Column('actualizada_en', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
    sa.ForeignKeyConstraint(['profesional_id'], ['profesional.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_firma_profesional_id'), 'firma_profesional', ['id'], unique=False)
    op.create_index(op.f('ix_firma_profesional_profesional_id'), 'firma_profesional', ['profesional_id'], unique=True)
    op.create_table('historial_estado_profesional',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('profesional_id', sa.Integer(), nullable=True),
    sa.Column('estado_anterior', sa.String(), nullable=True),
    sa.Column('estado_nuevo', sa.String(), nullable=True),
    sa.Column('motivo', sa.String(), nullable=True),
    sa.Column('fecha', sa.DateTime(), nullable=True),
    sa.Column('registrado_por', sa.Integer(), nullable=True),
    sa.ForeignKeyConstraint(['profesional_id'], ['profesional.id'], ),
    sa.ForeignKeyConstraint(['registrado_por'], ['usuario.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_historial_estado_profesional_id'), 'historial_estado_profesional', ['id'], unique=False)
    op.create_table('historial_paciente',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('profesional_id', sa.Integer(), nullable=False),
    sa.Column('estudiante_id', sa.Integer(), nullable=False),
    sa.Column('respuestas', sa.JSON(), nullable=True),
    sa.Column('completado_por', sa.String(), nullable=True),
    sa.Column('revisado_por_profesional', sa.Boolean(), nullable=False),
    sa.Column('fecha_creacion', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
    sa.Column('fecha_modificacion', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
    sa.ForeignKeyConstraint(['estudiante_id'], ['usuario.id'], ),
    sa.ForeignKeyConstraint(['profesional_id'], ['profesional.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('profesional_id', 'estudiante_id', name='uq_historial_paciente_par')
    )
    op.create_index(op.f('ix_historial_paciente_estudiante_id'), 'historial_paciente', ['estudiante_id'], unique=False)
    op.create_index(op.f('ix_historial_paciente_id'), 'historial_paciente', ['id'], unique=False)
    op.create_index(op.f('ix_historial_paciente_profesional_id'), 'historial_paciente', ['profesional_id'], unique=False)
    op.create_table('horario_disponible',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('profesional_id', sa.Integer(), nullable=True),
    sa.Column('dia_nombre', sa.String(), nullable=True),
    sa.Column('dia_num', sa.Integer(), nullable=True),
    sa.Column('fecha', sa.String(), nullable=True),
    sa.Column('hora', sa.String(), nullable=True),
    sa.Column('estado', sa.String(), nullable=True),
    sa.ForeignKeyConstraint(['profesional_id'], ['profesional.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_horario_disponible_id'), 'horario_disponible', ['id'], unique=False)
    op.create_table('solicitud_horario',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('profesional_id', sa.Integer(), nullable=False),
    sa.Column('tipo', sa.String(), nullable=False),
    sa.Column('hora_inicio', sa.String(), nullable=False),
    sa.Column('hora_fin', sa.String(), nullable=False),
    sa.Column('estado', sa.String(), nullable=True),
    sa.Column('motivo_rechazo', sa.String(), nullable=True),
    sa.Column('fecha_solicitud', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
    sa.Column('fecha_resolucion', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['profesional_id'], ['profesional.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_solicitud_horario_id'), 'solicitud_horario', ['id'], unique=False)
    op.create_table('cita_sobrecupo',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('cita_id', sa.Integer(), nullable=False),
    sa.Column('motivo', sa.String(), nullable=True),
    sa.Column('fecha_creacion', sa.DateTime(), server_default=sa.func.now(), nullable=False),
    sa.Column('estado_revision', sa.String(), nullable=True),
    sa.ForeignKeyConstraint(['cita_id'], ['cita.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('cita_id')
    )
    op.create_index(op.f('ix_cita_sobrecupo_id'), 'cita_sobrecupo', ['id'], unique=False)
    op.create_table('documento_clinico',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('tipo', sa.String(), nullable=False),
    sa.Column('folio', sa.String(), nullable=False),
    sa.Column('cita_id', sa.Integer(), nullable=False),
    sa.Column('profesional_id', sa.Integer(), nullable=False),
    sa.Column('estudiante_id', sa.Integer(), nullable=False),
    sa.Column('contenido', sa.JSON(), nullable=False),
    sa.Column('huella_sha256', sa.String(length=64), nullable=False),
    sa.Column('estado', sa.String(), nullable=False),
    sa.Column('motivo_anulacion', sa.String(), nullable=True),
    sa.Column('emitido_en', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
    sa.Column('anulado_en', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['cita_id'], ['cita.id'], ),
    sa.ForeignKeyConstraint(['estudiante_id'], ['usuario.id'], ),
    sa.ForeignKeyConstraint(['profesional_id'], ['profesional.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_documento_clinico_cita_id'), 'documento_clinico', ['cita_id'], unique=False)
    op.create_index(op.f('ix_documento_clinico_estudiante_id'), 'documento_clinico', ['estudiante_id'], unique=False)
    op.create_index(op.f('ix_documento_clinico_folio'), 'documento_clinico', ['folio'], unique=True)
    op.create_index(op.f('ix_documento_clinico_id'), 'documento_clinico', ['id'], unique=False)
    op.create_index(op.f('ix_documento_clinico_profesional_id'), 'documento_clinico', ['profesional_id'], unique=False)
    op.create_table('solicitud_horario_bloques',
    sa.Column('solicitud_id', sa.Integer(), nullable=False),
    sa.Column('bloques_json', sa.Text(), nullable=False),
    sa.ForeignKeyConstraint(['solicitud_id'], ['solicitud_horario.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('solicitud_id')
    )
    op.create_table('cita_sobrecupo_conflicto',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('cita_sobrecupo_id', sa.Integer(), nullable=False),
    sa.Column('codigo', sa.String(), nullable=False),
    sa.ForeignKeyConstraint(['cita_sobrecupo_id'], ['cita_sobrecupo.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_cita_sobrecupo_conflicto_cita_sobrecupo_id'), 'cita_sobrecupo_conflicto', ['cita_sobrecupo_id'], unique=False)
    op.create_index(op.f('ix_cita_sobrecupo_conflicto_id'), 'cita_sobrecupo_conflicto', ['id'], unique=False)
    # Fin de la revisión base.


def downgrade() -> None:
    """Retirar las tablas en orden inverso de dependencias."""
    # Generada contra PostgreSQL vacío y revisada contra los modelos.
    op.drop_index(op.f('ix_cita_sobrecupo_conflicto_id'), table_name='cita_sobrecupo_conflicto')
    op.drop_index(op.f('ix_cita_sobrecupo_conflicto_cita_sobrecupo_id'), table_name='cita_sobrecupo_conflicto')
    op.drop_table('cita_sobrecupo_conflicto')
    op.drop_table('solicitud_horario_bloques')
    op.drop_index(op.f('ix_documento_clinico_profesional_id'), table_name='documento_clinico')
    op.drop_index(op.f('ix_documento_clinico_id'), table_name='documento_clinico')
    op.drop_index(op.f('ix_documento_clinico_folio'), table_name='documento_clinico')
    op.drop_index(op.f('ix_documento_clinico_estudiante_id'), table_name='documento_clinico')
    op.drop_index(op.f('ix_documento_clinico_cita_id'), table_name='documento_clinico')
    op.drop_table('documento_clinico')
    op.drop_index(op.f('ix_cita_sobrecupo_id'), table_name='cita_sobrecupo')
    op.drop_table('cita_sobrecupo')
    op.drop_index(op.f('ix_solicitud_horario_id'), table_name='solicitud_horario')
    op.drop_table('solicitud_horario')
    op.drop_index(op.f('ix_horario_disponible_id'), table_name='horario_disponible')
    op.drop_table('horario_disponible')
    op.drop_index(op.f('ix_historial_paciente_profesional_id'), table_name='historial_paciente')
    op.drop_index(op.f('ix_historial_paciente_id'), table_name='historial_paciente')
    op.drop_index(op.f('ix_historial_paciente_estudiante_id'), table_name='historial_paciente')
    op.drop_table('historial_paciente')
    op.drop_index(op.f('ix_historial_estado_profesional_id'), table_name='historial_estado_profesional')
    op.drop_table('historial_estado_profesional')
    op.drop_index(op.f('ix_firma_profesional_profesional_id'), table_name='firma_profesional')
    op.drop_index(op.f('ix_firma_profesional_id'), table_name='firma_profesional')
    op.drop_table('firma_profesional')
    op.drop_index(op.f('ix_cuestionario_envio_profesional_id'), table_name='cuestionario_envio')
    op.drop_index(op.f('ix_cuestionario_envio_id'), table_name='cuestionario_envio')
    op.drop_index(op.f('ix_cuestionario_envio_estudiante_id'), table_name='cuestionario_envio')
    op.drop_table('cuestionario_envio')
    op.drop_table('cuestionario_config')
    op.drop_index('ix_cita_profesional_fecha_estado', table_name='cita')
    op.drop_index(op.f('ix_cita_id'), table_name='cita')
    op.drop_index(op.f('ix_cita_creado_por_usuario_id'), table_name='cita')
    op.drop_table('cita')
    op.drop_index(op.f('ix_bloque_horario_semanal_profesional_id'), table_name='bloque_horario_semanal')
    op.drop_index(op.f('ix_bloque_horario_semanal_id'), table_name='bloque_horario_semanal')
    op.drop_table('bloque_horario_semanal')
    op.drop_table('acceso_admin_permiso')
    op.drop_table('acceso_admin_especialidad')
    op.drop_index(op.f('ix_profesional_id'), table_name='profesional')
    op.drop_table('profesional')
    op.drop_index(op.f('ix_notificacion_id'), table_name='notificacion')
    op.drop_table('notificacion')
    op.drop_index(op.f('ix_dia_cerrado_id'), table_name='dia_cerrado')
    op.drop_index(op.f('ix_dia_cerrado_fecha'), table_name='dia_cerrado')
    op.drop_table('dia_cerrado')
    op.drop_index(op.f('ix_auditoria_id'), table_name='auditoria')
    op.drop_index('ix_auditoria_entidad_entidad_id_fecha', table_name='auditoria')
    op.drop_table('auditoria')
    op.drop_table('acceso_administrativo')
    op.drop_index(op.f('ix_usuario_id'), table_name='usuario')
    op.drop_index(op.f('ix_usuario_correo'), table_name='usuario')
    op.drop_table('usuario')
    op.drop_index(op.f('ix_historial_plantilla_pregunta_profesional_id'), table_name='historial_plantilla_pregunta')
    op.drop_index(op.f('ix_historial_plantilla_pregunta_id'), table_name='historial_plantilla_pregunta')
    op.drop_index(op.f('ix_historial_plantilla_pregunta_especialidad'), table_name='historial_plantilla_pregunta')
    op.drop_table('historial_plantilla_pregunta')
    op.drop_index(op.f('ix_especialidad_capability_id'), table_name='especialidad_capability')
    op.drop_index(op.f('ix_especialidad_capability_especialidad_normalizada'), table_name='especialidad_capability')
    op.drop_table('especialidad_capability')
    op.drop_index(op.f('ix_correo_log_id'), table_name='correo_log')
    op.drop_table('correo_log')
    op.drop_index(op.f('ix_configuracion_sistema_id'), table_name='configuracion_sistema')
    op.drop_table('configuracion_sistema')
    op.drop_index(op.f('ix_configuracion_centro_id'), table_name='configuracion_centro')
    op.drop_table('configuracion_centro')
    # Fin de la revisión base.
