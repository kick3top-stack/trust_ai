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

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_apply_migrations)
