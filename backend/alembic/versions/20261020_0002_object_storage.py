"""Move document files to object storage: storage_path -> storage_key

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-20

Files previously lived on a local volume at /data/uploads/{owner_id}/{id}.pdf. They now live in
MinIO under users/{owner_id}/documents/{id}.pdf. This migration rewrites the column; copying the
existing files into the bucket is a separate step (see README, "Upgrading from local uploads").
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column("documents", "storage_path", new_column_name="storage_key")
    op.execute(
        "UPDATE documents SET storage_key = 'users/' || owner_id || '/documents/' || id || '.pdf'"
    )


def downgrade() -> None:
    op.alter_column("documents", "storage_key", new_column_name="storage_path")
    op.execute(
        "UPDATE documents SET storage_path = '/data/uploads/' || owner_id || '/' || id || '.pdf'"
    )
