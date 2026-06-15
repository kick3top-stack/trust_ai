from pathlib import Path

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parents[2]


def _resolve_path(path: str) -> str:
    p = Path(path)
    if p.is_absolute():
        return str(p.resolve())
    return str((PROJECT_ROOT / p).resolve())


def _resolve_sqlite_url(url: str) -> str:
    if not url.startswith("sqlite"):
        return url
    prefix = "sqlite+aiosqlite:///"
    if not url.startswith(prefix):
        return url
    db_path = url[len(prefix) :]
    path = Path(db_path)
    if not path.is_absolute():
        path = (PROJECT_ROOT / db_path).resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    return f"{prefix}{path.as_posix()}"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(PROJECT_ROOT / ".env"),
        extra="ignore",
    )

    database_url: str = "sqlite+aiosqlite:///./data/trustai.db"
    trustai_model_path: str = "models/Qwen2.5-Coder-0.5B-Instruct-Q8_0.gguf"
    trustai_signing_key_path: str = "secrets/signing_key.pem"
    trustai_signing_key_id: str = "trustai-signing-v1"
    trustai_batch_size: int = 1
    trustai_batch_seal_seconds: int = 300
    trustai_credit_rate: float = 0.01
    trustai_cors_origins: str = "http://localhost:3000"
    trustai_inference_backend: str = "lmstudio"
    trustai_lmstudio_url: str = "http://localhost:1234/v1"
    trustai_jwt_secret: str = "change-me-in-production"
    trustai_jwt_expire_hours: int = 24
    trustai_admin_email: str = "admin@trustai.local"
    trustai_admin_password: str = "admin123"
    trustai_admin_display_name: str = "Administrator"
    trustai_default_credits: int = 1000

    @model_validator(mode="after")
    def resolve_paths(self) -> "Settings":
        self.database_url = _resolve_sqlite_url(self.database_url)
        self.trustai_model_path = _resolve_path(self.trustai_model_path)
        self.trustai_signing_key_path = _resolve_path(self.trustai_signing_key_path)
        return self

    @property
    def uses_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.trustai_cors_origins.split(",") if o.strip()]


settings = Settings()
