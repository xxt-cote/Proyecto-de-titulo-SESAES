"""Seguridad de cuenta: recuperación y bloqueo temporal.

Revision ID: 8d2e4f6a901b
Revises: 253cae9c234a
"""
from alembic import op
import sqlalchemy as sa

revision = "8d2e4f6a901b"
down_revision = "253cae9c234a"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "restablecimiento_password",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("usuario_id", sa.Integer(), sa.ForeignKey("usuario.id"), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column("creado_en", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("expira_en", sa.DateTime(timezone=True), nullable=False),
        sa.Column("usado_en", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_restablecimiento_password_id", "restablecimiento_password", ["id"])
    op.create_index("ix_restablecimiento_password_usuario_id", "restablecimiento_password", ["usuario_id"])
    op.create_index("ix_restablecimiento_password_token_hash", "restablecimiento_password", ["token_hash"], unique=True)
    op.create_table(
        "intento_login",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("correo", sa.String(), nullable=False),
        sa.Column("fallidos", sa.Integer(), nullable=False),
        sa.Column("bloqueado_hasta", sa.DateTime(timezone=True), nullable=True),
        sa.Column("actualizado_en", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_intento_login_id", "intento_login", ["id"])
    op.create_index("ix_intento_login_correo", "intento_login", ["correo"], unique=True)


def downgrade():
    op.drop_index("ix_intento_login_correo", table_name="intento_login")
    op.drop_index("ix_intento_login_id", table_name="intento_login")
    op.drop_table("intento_login")
    op.drop_index("ix_restablecimiento_password_token_hash", table_name="restablecimiento_password")
    op.drop_index("ix_restablecimiento_password_usuario_id", table_name="restablecimiento_password")
    op.drop_index("ix_restablecimiento_password_id", table_name="restablecimiento_password")
    op.drop_table("restablecimiento_password")
