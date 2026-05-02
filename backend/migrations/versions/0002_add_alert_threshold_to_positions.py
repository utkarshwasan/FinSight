# revision identifiers, used by Alembic.
revision = "0002"
down_revision = "138777129abd"
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


def upgrade() -> None:
    op.add_column("positions", sa.Column("alert_threshold", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("positions", "alert_threshold")
