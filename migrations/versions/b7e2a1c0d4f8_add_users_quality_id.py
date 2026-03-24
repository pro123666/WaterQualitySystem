"""add quality_id to users

Revision ID: b7e2a1c0d4f8
Revises: 46382ed40ac4
Create Date: 2026-03-21

"""
from alembic import op
import sqlalchemy as sa


revision = 'b7e2a1c0d4f8'
down_revision = '46382ed40ac4'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('quality_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            batch_op.f('fk_users_quality_id_quality'),
            'quality',
            ['quality_id'],
            ['id'],
            ondelete='SET NULL',
        )


def downgrade():
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_constraint(
            batch_op.f('fk_users_quality_id_quality'),
            type_='foreignkey',
        )
        batch_op.drop_column('quality_id')
