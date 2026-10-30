"""Initial normalized synthetic workflow schema."""
from alembic import op
from app.db import Base
revision='001_initial'
down_revision=None
branch_labels=None
depends_on=None
def upgrade():Base.metadata.create_all(op.get_bind())
def downgrade():raise RuntimeError('Destructive downgrade disabled; preserve original evidence and audit records.')
