from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas.auth import (
    AdminUpdateUserRequest,
    AuthResponse,
    LoginRequest,
    RegisterRequest,
    UpdateProfileRequest,
    UserResponse,
)
from app.database.session import get_session
from app.dependencies import get_current_user, require_admin
from app.models.orm import UserModel
from app.services.auth_service import AuthService, create_access_token, user_to_dict

router = APIRouter(prefix="/auth", tags=["auth"])
users_router = APIRouter(prefix="/users", tags=["users"])


@router.post("/register", response_model=AuthResponse)
async def register(
    body: RegisterRequest,
    session: AsyncSession = Depends(get_session),
) -> AuthResponse:
    service = AuthService(session)
    try:
        user = await service.register(
            email=body.email,
            password=body.password,
            display_name=body.display_name,
        )
        token = create_access_token(user.id, user.role)
        await session.commit()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return AuthResponse(access_token=token, user=user_to_dict(user))


@router.post("/login", response_model=AuthResponse)
async def login(
    body: LoginRequest,
    session: AsyncSession = Depends(get_session),
) -> AuthResponse:
    service = AuthService(session)
    try:
        user, token = await service.login(email=body.email, password=body.password)
        await session.commit()
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    return AuthResponse(access_token=token, user=user_to_dict(user))


@router.get("/me", response_model=UserResponse)
async def get_me(user: UserModel = Depends(get_current_user)) -> UserResponse:
    return UserResponse(**user_to_dict(user))


@router.patch("/me", response_model=UserResponse)
async def update_me(
    body: UpdateProfileRequest,
    user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> UserResponse:
    service = AuthService(session)
    try:
        updated = await service.update_profile(
            user,
            display_name=body.display_name,
            password=body.password,
        )
        await session.commit()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return UserResponse(**user_to_dict(updated))


@users_router.get("", response_model=list[UserResponse])
async def list_users(
    _: UserModel = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> list[UserResponse]:
    service = AuthService(session)
    users = await service.list_users()
    return [UserResponse(**user_to_dict(u)) for u in users]


@users_router.patch("/{user_id}", response_model=UserResponse)
async def admin_update_user(
    user_id: UUID,
    body: AdminUpdateUserRequest,
    admin: UserModel = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> UserResponse:
    if user_id == admin.id and body.is_active is False:
        raise HTTPException(status_code=400, detail="Cannot disable your own account")
    if user_id == admin.id and body.role == "user":
        raise HTTPException(status_code=400, detail="Cannot demote your own admin account")

    service = AuthService(session)
    target = await service.get_by_id(user_id)
    if target is None:
        raise HTTPException(status_code=404, detail="User not found")

    if target.role == "admin" and target.is_active:
        demoting = body.role == "user" or body.is_active is False
        if demoting:
            admins = await service.count_admins()
            if admins <= 1:
                raise HTTPException(status_code=400, detail="Cannot remove the last active admin")

    try:
        updated = await service.update_user_admin(
            user_id,
            role=body.role,
            is_active=body.is_active,
            display_name=body.display_name,
            credit_balance=body.credit_balance,
            actor_id=admin.id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if updated is None:
        raise HTTPException(status_code=404, detail="User not found")

    await session.commit()
    return UserResponse(**user_to_dict(updated))
