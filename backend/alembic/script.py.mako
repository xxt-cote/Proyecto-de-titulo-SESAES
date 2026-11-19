"""${message}

Revision ID: ${up_revision}
Revisión anterior: ${down_revision | comma,n}
Fecha de generación: ${create_date}

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
${imports if imports else ""}

# Identificadores del historial Alembic.
revision: str = ${repr(up_revision)}
down_revision: Union[str, Sequence[str], None] = ${repr(down_revision)}
branch_labels: Union[str, Sequence[str], None] = ${repr(branch_labels)}
depends_on: Union[str, Sequence[str], None] = ${repr(depends_on)}


def upgrade() -> None:
    """Aplicar la revisión."""
    ${upgrades if upgrades else "pass"}


def downgrade() -> None:
    """Revertir la revisión."""
    ${downgrades if downgrades else "pass"}
