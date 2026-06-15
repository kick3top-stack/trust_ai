from collections.abc import AsyncGenerator
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings

_connect_args = {}
if settings.uses_sqlite:
    db_path = settings.database_url.split("///", 1)[-1]
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)

engine = create_async_engine(settings.database_url, echo=False, connect_args=_connect_args)
async_session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        yield session


async def init_database() -> None:
    from sqlalchemy import inspect, text

    from app.models.orm import Base

    def _apply_migrations(sync_conn) -> None:
        insp = inspect(sync_conn)
        if insp.has_table("generation_requests"):
            cols = {c["name"] for c in insp.get_columns("generation_requests")}
            if "user_id" not in cols:
                sync_conn.execute(text("ALTER TABLE generation_requests ADD COLUMN user_id CHAR(36)"))
            if "prompt_text" not in cols:
                sync_conn.execute(text("ALTER TABLE generation_requests ADD COLUMN prompt_text VARCHAR(8192)"))
            if "response_text" not in cols:
                sync_conn.execute(text("ALTER TABLE generation_requests ADD COLUMN response_text VARCHAR(65536)"))
            if "prompt_tokens" not in cols:
                sync_conn.execute(
                    text("ALTER TABLE generation_requests ADD COLUMN prompt_tokens INTEGER NOT NULL DEFAULT 0")
                )
            if "completion_tokens" not in cols:
                sync_conn.execute(
                    text("ALTER TABLE generation_requests ADD COLUMN completion_tokens INTEGER NOT NULL DEFAULT 0")
                )
        if insp.has_table("users"):
            cols = {c["name"] for c in insp.get_columns("users")}
            if "credit_balance" not in cols:
                sync_conn.execute(
                    text("ALTER TABLE users ADD COLUMN credit_balance INTEGER NOT NULL DEFAULT 1000")
                )
                sync_conn.execute(text("UPDATE users SET credit_balance = 1000 WHERE credit_balance IS NULL"))

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_apply_migrations)
