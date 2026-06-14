from pydantic import BaseModel, Field


class GenerationParameters(BaseModel):
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    max_tokens: int = Field(default=128, ge=1, le=2048)
    top_p: float = Field(default=0.9, ge=0.0, le=1.0)
    seed: int = Field(default=42, ge=0)


class GenerateDemoRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=8192)
    parameters: GenerationParameters = Field(default_factory=GenerationParameters)


class GenerateDemoResponse(BaseModel):
    request_id: str
    response: str
    receipt: dict
    merkle_proof: dict | None
    root_signature: dict | None
    batch_id: str
    receipt_id: str
