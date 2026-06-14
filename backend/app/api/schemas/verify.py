from pydantic import BaseModel


class VerifyRequest(BaseModel):
    receipt: dict
    merkle_proof: dict | None = None
    root_signature: dict | None = None


class VerifyResponse(BaseModel):
    valid: bool
    checks: dict[str, bool]
    reason: str | None = None
    receipt_hash: str | None = None
    merkle_root: str | None = None
    batch_number: int | None = None
    signed_at: str | None = None
    signing_key_id: str | None = None
