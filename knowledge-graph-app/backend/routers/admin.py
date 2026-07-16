"""Admin router — user management and admin-only operations.

All endpoints require the caller to be an admin (is_admin = 1).
Uses the AdminUser dependency from deps.py which raises HTTP 403 automatically.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from db.session import get_db
from models.models import User
from routers.deps import AdminUser

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class UserListItem(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    name: str
    email: str
    is_admin: bool


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/users", response_model=list[UserListItem])
def list_users(
    _admin: AdminUser,
    db: Session = Depends(get_db),
) -> list[UserListItem]:
    """List all registered users. Admin only."""
    users = db.query(User).order_by(User.created_at).all()
    return [UserListItem.model_validate(u) for u in users]


@router.patch("/users/{user_id}/make-admin", response_model=UserListItem)
def make_admin(
    user_id: int,
    _admin: AdminUser,
    db: Session = Depends(get_db),
) -> UserListItem:
    """Grant admin rights to a user. Admin only."""
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found.")
    user.is_admin = 1
    db.commit()
    db.refresh(user)
    logger.info("User %d granted admin by admin %d", user_id, _admin["id"])
    return UserListItem.model_validate(user)


@router.patch("/users/{user_id}/revoke-admin", response_model=UserListItem)
def revoke_admin(
    user_id: int,
    _admin: AdminUser,
    db: Session = Depends(get_db),
) -> UserListItem:
    """Revoke admin rights from a user. Admin only."""
    if user_id == _admin["id"]:
        raise HTTPException(
            status_code=400,
            detail="Cannot revoke your own admin rights.",
        )
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found.")
    user.is_admin = 0
    db.commit()
    db.refresh(user)
    logger.info("Admin rights revoked from user %d by admin %d", user_id, _admin["id"])
    return UserListItem.model_validate(user)
