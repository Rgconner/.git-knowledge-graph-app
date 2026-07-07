"""Action items router — list and status-update endpoints."""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from db.session import get_db
from models.models import ActionItem, ActionItemStatus, Document
from models.schemas import ActionItemSchema
from routers.deps import CurrentUser

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/action-items", tags=["action-items"])


class StatusUpdate(BaseModel):
    status: ActionItemStatus


@router.get("", response_model=list[ActionItemSchema])
def list_action_items(
    current_user: CurrentUser,
    status: Optional[ActionItemStatus] = None,
    db: Session = Depends(get_db),
) -> list[ActionItemSchema]:
    """Return action items for documents uploaded by the current user.

    Optionally filter by *status* (open | in_progress | closed).
    """
    query = (
        db.query(ActionItem)
        .join(Document, ActionItem.document_id == Document.id)
        .filter(Document.uploader_user_id == current_user["id"])
    )
    if status is not None:
        query = query.filter(ActionItem.status == status)

    items = query.order_by(ActionItem.created_at.desc()).all()
    return [ActionItemSchema.model_validate(item) for item in items]


@router.patch("/{item_id}/status", response_model=ActionItemSchema)
def update_action_item_status(
    item_id: int,
    body: StatusUpdate,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
) -> ActionItemSchema:
    """Update the status of an action item owned by the current user."""
    item = (
        db.query(ActionItem)
        .join(Document, ActionItem.document_id == Document.id)
        .filter(
            ActionItem.id == item_id,
            Document.uploader_user_id == current_user["id"],
        )
        .first()
    )
    if item is None:
        raise HTTPException(status_code=404, detail="Action item not found.")

    item.status = body.status
    db.commit()
    db.refresh(item)
    return ActionItemSchema.model_validate(item)
