"""Initial TrustAI schema."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "generation_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("credit_cost", sa.Integer(), nullable=False),
        sa.Column("generation_parameters", postgresql.JSONB(), nullable=False),
        sa.Column("prompt_hash", sa.String(64), nullable=False),
        sa.Column("response_hash", sa.String(64), nullable=False),
        sa.Column("model_name", sa.String(128), nullable=False),
        sa.Column("model_version", sa.String(64), nullable=False),
        sa.Column("model_hash", sa.String(64), nullable=False),
        sa.Column("seed", sa.Integer(), nullable=False),
    )
    op.create_table(
        "batches",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("batch_number", sa.Integer(), nullable=False, unique=True),
        sa.Column("merkle_root", sa.String(64), nullable=True),
        sa.Column("receipt_count", sa.Integer(), server_default="0"),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("sealed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_batches_status", "batches", ["status"])
    op.create_table(
        "receipts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("request_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("generation_requests.id"), unique=True),
        sa.Column("batch_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("batches.id")),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("receipt_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("leaf_index", sa.Integer(), nullable=True),
        sa.Column("canonical_payload", postgresql.JSONB(), nullable=False),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_receipts_receipt_hash", "receipts", ["receipt_hash"])
    op.create_index("ix_receipts_batch_id", "receipts", ["batch_id"])
    op.create_table(
        "batch_signatures",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("batch_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("batches.id"), unique=True),
        sa.Column("signing_key_id", sa.String(64), nullable=False),
        sa.Column("signature", sa.LargeBinary(), nullable=False),
        sa.Column("merkle_root", sa.String(64), nullable=False),
        sa.Column("signed_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "signing_keys",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("key_id", sa.String(64), nullable=False, unique=True),
        sa.Column("public_key", sa.String(128), nullable=False),
        sa.Column("active", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("rotated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_table(
        "verification_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("receipt_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("receipts.id"), nullable=True),
        sa.Column("valid", sa.Boolean(), nullable=False),
        sa.Column("failure_reason", sa.String(512), nullable=True),
        sa.Column("verification_steps", postgresql.JSONB(), nullable=True),
        sa.Column("verified_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("verification_logs")
    op.drop_table("signing_keys")
    op.drop_table("batch_signatures")
    op.drop_index("ix_receipts_batch_id", table_name="receipts")
    op.drop_index("ix_receipts_receipt_hash", table_name="receipts")
    op.drop_table("receipts")
    op.drop_index("ix_batches_status", table_name="batches")
    op.drop_table("batches")
    op.drop_table("generation_requests")
