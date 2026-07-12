"""Admin router — privileged operations for administrators.

All endpoints require an authenticated user with is_admin = 1.

Wipe endpoints:
    DELETE /admin/wipe/data   — deletes all graph data; preserves user accounts
    DELETE /admin/wipe/users  — deletes all non-admin user accounts and their data
    DELETE /admin/wipe/all    — deletes everything (all users and all data)
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from db.session import get_db
from models.models import (
    ActionItem,
    Document,
    Entity,
    EntityDocumentMention,
    NodeDisplay,
    Relationship,
    User,
    UserWeightHint,
    WatchSource,
    WatchedFile,
)
from routers.deps import AdminUser

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])


# ---------------------------------------------------------------------------
# Response schema
# ---------------------------------------------------------------------------


class WipeResult(BaseModel):
    """Summary of rows deleted by a wipe operation."""
    operation: str
    deleted: dict[str, int]


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _wipe_graph_data(db: Session) -> dict[str, int]:
    """Delete all graph/document data. User accounts are NOT touched."""
    counts: dict[str, int] = {}

    # Delete in dependency order so FK constraints are satisfied.
    counts["user_weight_hints"] = db.query(UserWeightHint).delete(synchronize_session=False)
    counts["node_display"] = db.query(NodeDisplay).delete(synchronize_session=False)
    counts["relationships"] = db.query(Relationship).delete(synchronize_session=False)
    counts["entity_document_mentions"] = db.query(EntityDocumentMention).delete(synchronize_session=False)
    counts["action_items"] = db.query(ActionItem).delete(synchronize_session=False)
    counts["entities"] = db.query(Entity).delete(synchronize_session=False)
    counts["watched_files"] = db.query(WatchedFile).delete(synchronize_session=False)
    counts["watch_sources"] = db.query(WatchSource).delete(synchronize_session=False)
    counts["documents"] = db.query(Document).delete(synchronize_session=False)

    return counts


def _wipe_non_admin_users(db: Session) -> dict[str, int]:
    """Delete all non-admin user accounts (and their data via cascade)."""
    # First wipe all graph data so FK references from non-admin users are gone.
    counts = _wipe_graph_data(db)

    # Now delete non-admin users.
    counts["users"] = db.query(User).filter(User.is_admin == 0).delete(synchronize_session=False)

    return counts


def _wipe_all(db: Session) -> dict[str, int]:
    """Delete every row in every table — full reset."""
    counts = _wipe_graph_data(db)

    # Delete ALL users including admins.
    counts["users"] = db.query(User).delete(synchronize_session=False)

    return counts


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.delete(
    "/wipe/data",
    response_model=WipeResult,
    status_code=status.HTTP_200_OK,
    summary="Wipe all graph data (preserve user accounts)",
)
def wipe_data(
    _admin: AdminUser,
    db: Session = Depends(get_db),
) -> WipeResult:
    """Delete all documents, entities, relationships, and derived graph data.
    User accounts are preserved. Watch sources and watched file records are also cleared.
    """
    logger.warning("Admin wipe/data triggered by user id=%s", _admin["id"])
    deleted = _wipe_graph_data(db)
    db.commit()
    logger.warning("Admin wipe/data complete: %s", deleted)
    return WipeResult(operation="wipe_data", deleted=deleted)


@router.delete(
    "/wipe/users",
    response_model=WipeResult,
    status_code=status.HTTP_200_OK,
    summary="Wipe all non-admin user accounts and their data",
)
def wipe_users(
    _admin: AdminUser,
    db: Session = Depends(get_db),
) -> WipeResult:
    """Delete all non-admin user accounts and all associated data.
    Admin accounts are preserved.
    """
    logger.warning("Admin wipe/users triggered by user id=%s", _admin["id"])
    deleted = _wipe_non_admin_users(db)
    db.commit()
    logger.warning("Admin wipe/users complete: %s", deleted)
    return WipeResult(operation="wipe_users", deleted=deleted)


@router.delete(
    "/wipe/all",
    response_model=WipeResult,
    status_code=status.HTTP_200_OK,
    summary="Wipe everything — all data and all users including admins",
)
def wipe_all(
    _admin: AdminUser,
    db: Session = Depends(get_db),
) -> WipeResult:
    """Full database reset. Deletes every row in every table including admin accounts.
    The caller will be signed out immediately after this operation completes.
    """
    logger.warning("Admin wipe/all triggered by user id=%s", _admin["id"])
    deleted = _wipe_all(db)
    db.commit()
    logger.warning("Admin wipe/all complete: %s", deleted)
    return WipeResult(operation="wipe_all", deleted=deleted)


# ---------------------------------------------------------------------------
# User management
# ---------------------------------------------------------------------------


@router.get(
    "/users",
    status_code=status.HTTP_200_OK,
    summary="List all user accounts",
)
def list_users(
    _admin: AdminUser,
    db: Session = Depends(get_db),
) -> list[dict]:
    """Return all registered users with their admin status."""
    users = db.query(User).order_by(User.created_at).all()
    return [
        {
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "is_admin": bool(u.is_admin),
            "created_at": u.created_at.isoformat() if u.created_at else None,
        }
        for u in users
    ]


@router.patch(
    "/users/{user_id}/admin",
    status_code=status.HTTP_200_OK,
    summary="Grant or revoke admin privileges for a user",
)
def set_admin(
    user_id: int,
    is_admin: bool,
    _admin: AdminUser,
    db: Session = Depends(get_db),
) -> dict:
    """Set or clear the is_admin flag for the given user."""
    from fastapi import HTTPException
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found.")
    user.is_admin = 1 if is_admin else 0
    db.commit()
    db.refresh(user)
    logger.info(
        "Admin id=%s set is_admin=%s for user id=%s (%s)",
        _admin["id"], is_admin, user.id, user.email,
    )
    return {"id": user.id, "email": user.email, "is_admin": bool(user.is_admin)}
