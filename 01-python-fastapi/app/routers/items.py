from typing import Annotated, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession
from app.auth import get_current_user
from app.database import get_db_session
from app.models import Item, User
from app.schemas import ItemCreate, ItemResponse

router = APIRouter(prefix="/api/items", tags=["Items"])


@router.get("", response_model=List[ItemResponse])
async def list_items(
    db_session: Annotated[AsyncSession, Depends(get_db_session)],
    skip: int = 0,
    limit: int = 50,
) -> List[Item]:
    try:
        query = select(Item).offset(skip).limit(limit)
        result = await db_session.execute(query)
        return list(result.scalars().all())
    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error retrieving items",
        )


@router.post("", response_model=ItemResponse, status_code=status.HTTP_201_CREATED)
async def create_item(
    item_in: ItemCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db_session: Annotated[AsyncSession, Depends(get_db_session)],
) -> Item:
    try:
        new_item = Item(
            title=item_in.title,
            description=item_in.description,
            owner_id=current_user.id,
        )
        db_session.add(new_item)
        await db_session.commit()
        await db_session.refresh(new_item)
        return new_item
    except SQLAlchemyError:
        await db_session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error saving item",
        )
