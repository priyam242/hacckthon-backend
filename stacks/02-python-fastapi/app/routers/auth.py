from datetime import timedelta
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import or_, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession
from app.auth import create_access_token, get_current_user, get_password_hash, verify_password
from app.config import settings
from app.database import get_db_session
from app.models import User
from app.schemas import LoginRequest, Token, UserCreate, UserResponse

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def signup(
    user_in: UserCreate,
    db_session: Annotated[AsyncSession, Depends(get_db_session)],
) -> User:
    try:
        final_username = user_in.username or user_in.email.split("@")[0]
        # Check existing user
        query = select(User).where(
            or_(User.email == user_in.email, User.username == final_username)
        )
        result = await db_session.execute(query)
        existing_user = result.scalar_one_or_none()

        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="User with this email or username already exists",
            )

        new_user = User(
            email=user_in.email,
            username=final_username,
            hashed_password=get_password_hash(user_in.password),
        )
        db_session.add(new_user)
        await db_session.commit()
        await db_session.refresh(new_user)
        return new_user
    except HTTPException:
        raise
    except SQLAlchemyError:
        await db_session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database transaction error during user registration",
        )


@router.post("/login", response_model=Token)
async def login(
    login_data: LoginRequest,
    db_session: Annotated[AsyncSession, Depends(get_db_session)],
) -> Token:
    try:
        ident = login_data.identifier
        if not ident:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Email or username is required",
            )

        query = select(User).where(
            or_(
                User.email == ident,
                User.username == ident,
            )
        )
        result = await db_session.execute(query)
        user = result.scalar_one_or_none()

        if not user or not verify_password(login_data.password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )

        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.id, "username": user.username},
            expires_delta=access_token_expires,
        )
        return Token(
            access_token=access_token,
            accessToken=access_token,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )
    except HTTPException:
        raise
    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error during authentication",
        )


@router.post("/token", response_model=Token)
async def login_for_access_token(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db_session: Annotated[AsyncSession, Depends(get_db_session)],
) -> Token:
    """Swagger UI OAuth2 password flow endpoint"""
    return await login(
        login_data=LoginRequest(
            username_or_email=form_data.username, password=form_data.password
        ),
        db_session=db_session,
    )


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    return current_user

