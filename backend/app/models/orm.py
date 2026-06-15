from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, LargeBinary, String, Uuid, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class UserModel(Base):
    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str] = mapped_column(String(128), nullable=False)
    role: Mapped[str] = mapped_column(String(32), nullable=False, default="user")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    credit_balance: Mapped[int] = mapped_column(Integer, default=1000, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class GenerationRequestModel(Base):
    __tablename__ = "generation_requests"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    user_id: Mapped[UUID | None] = mapped_column(Uuid, ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    credit_cost: Mapped[int] = mapped_column(Integer, nullable=False)
    generation_parameters: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    prompt_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    response_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    prompt_text: Mapped[str | None] = mapped_column(String(8192), nullable=True)
    response_text: Mapped[str | None] = mapped_column(String(65536), nullable=True)
    prompt_tokens: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    completion_tokens: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    model_name: Mapped[str] = mapped_column(String(128), nullable=False)
    model_version: Mapped[str] = mapped_column(String(64), nullable=False)
    model_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    seed: Mapped[int] = mapped_column(Integer, nullable=False)

    receipt: Mapped["ReceiptModel | None"] = relationship(back_populates="generation_request")


class CreditTransactionModel(Base):
    __tablename__ = "credit_transactions"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    user_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("users.id"), nullable=False, index=True)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    balance_after: Mapped[int] = mapped_column(Integer, nullable=False)
    txn_type: Mapped[str] = mapped_column(String(32), nullable=False)
    description: Mapped[str] = mapped_column(String(512), nullable=False)
    request_id: Mapped[UUID | None] = mapped_column(Uuid, ForeignKey("generation_requests.id"), nullable=True)
    actor_id: Mapped[UUID | None] = mapped_column(Uuid, ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class BatchModel(Base):
    __tablename__ = "batches"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    batch_number: Mapped[int] = mapped_column(Integer, unique=True, nullable=False)
    merkle_root: Mapped[str | None] = mapped_column(String(64), nullable=True)
    receipt_count: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="open")
    sealed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    receipts: Mapped[list["ReceiptModel"]] = relationship(back_populates="batch")
    signature: Mapped["BatchSignatureModel | None"] = relationship(back_populates="batch")


class ReceiptModel(Base):
    __tablename__ = "receipts"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    request_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("generation_requests.id"), unique=True)
    batch_id: Mapped[UUID | None] = mapped_column(Uuid, ForeignKey("batches.id"))
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    receipt_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    leaf_index: Mapped[int | None] = mapped_column(Integer, nullable=True)
    canonical_payload: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    generation_request: Mapped[GenerationRequestModel] = relationship(back_populates="receipt")
    batch: Mapped[BatchModel | None] = relationship(back_populates="receipts")


class BatchSignatureModel(Base):
    __tablename__ = "batch_signatures"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    batch_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("batches.id"), unique=True)
    signing_key_id: Mapped[str] = mapped_column(String(64), nullable=False)
    signature: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    merkle_root: Mapped[str] = mapped_column(String(64), nullable=False)
    signed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    batch: Mapped[BatchModel] = relationship(back_populates="signature")


class SigningKeyModel(Base):
    __tablename__ = "signing_keys"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    key_id: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    public_key: Mapped[str] = mapped_column(String(128), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    rotated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class VerificationLogModel(Base):
    __tablename__ = "verification_logs"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    receipt_id: Mapped[UUID | None] = mapped_column(Uuid, ForeignKey("receipts.id"))
    valid: Mapped[bool] = mapped_column(Boolean, nullable=False)
    failure_reason: Mapped[str | None] = mapped_column(String(512), nullable=True)
    verification_steps: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    verified_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class DisputeModel(Base):
    __tablename__ = "disputes"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    user_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("users.id"), nullable=False, index=True)
    request_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("generation_requests.id"), nullable=False, index=True)
    reason: Mapped[str] = mapped_column(String(2000), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="open")
    credit_cost: Mapped[int] = mapped_column(Integer, nullable=False)
    resolution_note: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    resolved_by: Mapped[UUID | None] = mapped_column(Uuid, ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
