from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID, uuid4

import bcrypt
import jwt
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.services.credit_service import CreditService
from app.models.orm import UserModel

JWT_ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


def create_access_token(user_id: UUID, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=settings.trustai_jwt_expire_hours)
    payload = {"sub": str(user_id), "role": role, "exp": expire}
    return jwt.encode(payload, settings.trustai_jwt_secret, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, settings.trustai_jwt_secret, algorithms=[JWT_ALGORITHM])


def user_to_dict(user: UserModel) -> dict[str, Any]:
    return {
        "id": str(user.id),
        "email": user.email,
        "display_name": user.display_name,
        "role": user.role,
        "is_active": user.is_active,
        "credit_balance": user.credit_balance,
        "created_at": user.created_at.isoformat(),
        "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
    }


class AuthService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, user_id: UUID) -> UserModel | None:
        result = await self._session.execute(select(UserModel).where(UserModel.id == user_id))
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> UserModel | None:
        result = await self._session.execute(
            select(UserModel).where(func.lower(UserModel.email) == email.lower())
        )
        return result.scalar_one_or_none()

    async def register(self, *, email: str, password: str, display_name: str) -> UserModel:
        existing = await self.get_by_email(email)
        if existing:
            raise ValueError("Email already registered")
        if len(password) < 6:
            raise ValueError("Password must be at least 6 characters")

        user = UserModel(
            id=uuid4(),
            email=email.strip().lower(),
            password_hash=hash_password(password),
            display_name=display_name.strip() or email.split("@")[0],
            role="user",
            is_active=True,
            credit_balance=settings.trustai_default_credits,
        )
        self._session.add(user)
        await self._session.flush()
        await CreditService(self._session).record(
            user_id=user.id,
            amount=settings.trustai_default_credits,
            balance_after=user.credit_balance,
            txn_type="initial_grant",
            description="Welcome credits",
        )
        return user

    async def login(self, *, email: str, password: str) -> tuple[UserModel, str]:
        user = await self.get_by_email(email)
        if user is None or not verify_password(password, user.password_hash):
            raise ValueError("Invalid email or password")
        if not user.is_active:
            raise ValueError("Account is disabled")

        user.last_login_at = datetime.now(timezone.utc)
        await self._session.flush()
        token = create_access_token(user.id, user.role)
        return user, token

    async def update_profile(
        self,
        user: UserModel,
        *,
        display_name: str | None = None,
        password: str | None = None,
    ) -> UserModel:
        if display_name is not None:
            user.display_name = display_name.strip() or user.display_name
        if password is not None:
            if len(password) < 6:
                raise ValueError("Password must be at least 6 characters")
            user.password_hash = hash_password(password)
        await self._session.flush()
        return user

    async def list_users(self) -> list[UserModel]:
        result = await self._session.execute(
            select(UserModel).order_by(UserModel.created_at.desc())
        )
        return list(result.scalars().all())

    async def update_user_admin(
        self,
        user_id: UUID,
        *,
        role: str | None = None,
        is_active: bool | None = None,
        display_name: str | None = None,
        credit_balance: int | None = None,
        actor_id: UUID | None = None,
    ) -> UserModel | None:
        user = await self.get_by_id(user_id)
        if user is None:
            return None
        if role is not None:
            if role not in ("user", "admin"):
                raise ValueError("Role must be user or admin")
            user.role = role
        if is_active is not None:
            user.is_active = is_active
        if display_name is not None:
            user.display_name = display_name.strip() or user.display_name
        if credit_balance is not None:
            if credit_balance < 0:
                raise ValueError("Credit balance cannot be negative")
            delta = credit_balance - user.credit_balance
            if delta != 0:
                user.credit_balance = credit_balance
                await CreditService(self._session).record(
                    user_id=user.id,
                    amount=delta,
                    balance_after=user.credit_balance,
                    txn_type="admin_adjustment",
                    description="Admin balance update",
                    actor_id=actor_id,
                )
        await self._session.flush()
        return user

    async def adjust_user_credits(
        self,
        user_id: UUID,
        *,
        amount: int,
        reason: str,
        actor_id: UUID,
    ) -> UserModel:
        user = await self.get_by_id(user_id)
        if user is None:
            raise ValueError("User not found")
        new_balance = user.credit_balance + amount
        if new_balance < 0:
            raise ValueError("Credit balance cannot be negative")
        user.credit_balance = new_balance
        await CreditService(self._session).record(
            user_id=user.id,
            amount=amount,
            balance_after=user.credit_balance,
            txn_type="admin_adjustment",
            description=reason.strip(),
            actor_id=actor_id,
        )
        await self._session.flush()
        return user

    async def count_admins(self) -> int:
        result = await self._session.execute(
            select(func.count()).select_from(UserModel).where(
                UserModel.role == "admin",
                UserModel.is_active.is_(True),
            )
        )
        return int(result.scalar_one())

    async def deduct_credits(self, user_id: UUID, amount: int) -> UserModel:
        user = await self.get_by_id(user_id)
        if user is None:
            raise ValueError("User not found")
        if user.credit_balance < amount:
            raise ValueError("Insufficient credits")
        user.credit_balance -= amount
        await self._session.flush()
        return user

    async def ensure_bootstrap_admin(self) -> None:
        result = await self._session.execute(select(func.count()).select_from(UserModel))
        if int(result.scalar_one()) > 0:
            return

        admin = UserModel(
            id=uuid4(),
            email=settings.trustai_admin_email.strip().lower(),
            password_hash=hash_password(settings.trustai_admin_password),
            display_name=settings.trustai_admin_display_name,
            role="admin",
            is_active=True,
            credit_balance=settings.trustai_default_credits,
        )
        self._session.add(admin)
        await self._session.flush()
