import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.auth import router as auth_router, users_router
from app.api.routes.router import router
from app.config import settings
from app.database.repositories import BatchRepository
from app.database.session import async_session_factory, init_database
from app.crypto.ed25519 import sign
from app.crypto.key_manager import get_signing_keypair
from app.merkle.tree import merkle_root


async def _seal_expired_batches() -> None:
    """Background task: seal open batches older than seal interval."""
    while True:
        await asyncio.sleep(settings.trustai_batch_seal_seconds)
        try:
            async with async_session_factory() as session:
                repo = BatchRepository(session)
                batch = await repo.get_open_batch()
                if batch is None or batch.receipt_count == 0:
                    continue
                hashes = await repo.get_receipt_hashes_for_batch(batch.id)
                leaves = [bytes.fromhex(h) for h in hashes]
                root = merkle_root(leaves)
                keypair = get_signing_keypair()
                signature = sign(keypair.private_key, root)
                await repo.seal_batch(
                    batch_id=batch.id,
                    merkle_root=root.hex(),
                    signature=signature,
                    signing_key_id=keypair.key_id,
                )
                await repo.create_open_batch()
                await session.commit()
        except Exception:
            pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.uses_sqlite:
        await init_database()
        from app.services.auth_service import AuthService

        async with async_session_factory() as session:
            await AuthService(session).ensure_bootstrap_admin()
            await session.commit()
    seal_task = asyncio.create_task(_seal_expired_batches())
    yield
    seal_task.cancel()
    try:
        await seal_task
    except asyncio.CancelledError:
        pass


def create_app() -> FastAPI:
    app = FastAPI(
        title="TrustAI",
        description="Cryptographic execution receipts for AI generations",
        version="1.0.0",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(router, prefix="/api/v1")
    app.include_router(auth_router, prefix="/api/v1")
    app.include_router(users_router, prefix="/api/v1")
    return app


app = create_app()
