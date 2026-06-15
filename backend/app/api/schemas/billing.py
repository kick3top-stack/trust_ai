from pydantic import BaseModel, Field


class CreditAdjustRequest(BaseModel):
    amount: int = Field(description="Credit delta (positive adds, negative removes)")
    reason: str = Field(min_length=1, max_length=500)


class CreateDisputeRequest(BaseModel):
    request_id: str
    reason: str = Field(min_length=10, max_length=2000)


class UpdateDisputeRequest(BaseModel):
    status: str = Field(min_length=1, max_length=32)
    resolution_note: str | None = Field(default=None, max_length=2000)
