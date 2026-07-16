"""Node editing router — right-click context menu actions on graph nodes.

Endpoints
---------
PATCH  /nodes/{entity_id}          Edit label, entity type, or sentiment override
DELETE /nodes/{entity_id}          Move entity to graveyard (soft-delete)
GET    /nodes/graveyard            List all archived (graveyarded) entities
POST   /nodes/{entity_id}/restore  Restore an entity from the graveyard

All mutations are soft — data is never permanently deleted here.  The graveyard
is a hidden view that surfaces archived entities for optional restoration.

Graph queries in graph.py already filter out archived=1 entities; changes here
take effect on the next graph fetch.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from db.session import get_db
from models.models import Entity, EntityType, NodeDisplay
from routers.deps import CurrentUser
from services.color_mapper import weight_to_size

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/nodes", tags=["nodes"])

# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

VALID_ENTITY_TYPES = {e.value for e in EntityType}


class NodeEditRequest(BaseModel):
    """Body for PATCH /nodes/{entity_id}"""
    label_override: Optional[str] = None       # new display label (None = clear override)
    entity_type: Optional[str] = None          # change the entity type
    sentiment_override: Optional[float] = None # -1.0 to 1.0 (None = clear override)
    clear_label: bool = False                  # if True, remove label_override
    clear_sentiment: bool = False              # if True, remove sentiment_override


class ArchiveRequest(BaseModel):
    """Body for DELETE /nodes/{entity_id}"""
    note: Optional[str] = None                 # optional reason for archiving


class NodeResponse(BaseModel):
    """Lightweight response for node operations."""
    id: int
    canonical_name: str
    label_override: Optional[str]
    display_label: str                         # label_override if set, else canonical_name
    entity_type: str
    archived: bool
    archived_at: Optional[datetime]
    archive_note: Optional[str]
    sentiment_override: Optional[float]
    sentiment_color: Optional[str]


def _to_response(entity: Entity, db: Session) -> NodeResponse:
    display = db.get(NodeDisplay, entity.id)
    color = display.sentiment_color if display else "#999999"

    # Apply sentiment_override to color if set
    if entity.sentiment_override is not None:
        s = entity.sentiment_override
        if s > 0.2:
            color = "#4AD94A"
        elif s < -0.2:
            color = "#D94A4A"
        else:
            color = "#999999"

    display_label = entity.label_override or entity.canonical_name

    return NodeResponse(
        id=entity.id,
        canonical_name=entity.canonical_name,
        label_override=entity.label_override,
        display_label=display_label,
        entity_type=entity.type.value,
        archived=bool(entity.archived),
        archived_at=entity.archived_at,
        archive_note=entity.archive_note,
        sentiment_override=entity.sentiment_override,
        sentiment_color=color,
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_entity_or_404(entity_id: int, db: Session) -> Entity:
    entity = db.get(Entity, entity_id)
    if entity is None:
        raise HTTPException(status_code=404, detail="Entity not found.")
    return entity


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.patch("/{entity_id}", response_model=NodeResponse)
def edit_node(
    entity_id: int,
    body: NodeEditRequest,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
) -> NodeResponse:
    """
    Edit a graph node's display label, entity type, or sentiment.

    - **label_override**: sets a display name without changing the canonical name
      used internally for deduplication.  Pass `clear_label=true` to remove.
    - **entity_type**: change the type (person/idea/project/keyword/organization/
      location/date).
    - **sentiment_override**: pin the sentiment score shown for this node.
      Pass `clear_sentiment=true` to revert to AI-computed sentiment.
    """
    entity = _get_entity_or_404(entity_id, db)

    if body.clear_label:
        entity.label_override = None
    elif body.label_override is not None:
        label = body.label_override.strip()
        if not label:
            raise HTTPException(status_code=422, detail="label_override cannot be empty.")
        entity.label_override = label

    if body.entity_type is not None:
        if body.entity_type not in VALID_ENTITY_TYPES:
            raise HTTPException(
                status_code=422,
                detail=f"Invalid entity_type '{body.entity_type}'. "
                       f"Valid values: {sorted(VALID_ENTITY_TYPES)}",
            )
        entity.type = EntityType(body.entity_type)

    if body.clear_sentiment:
        entity.sentiment_override = None
    elif body.sentiment_override is not None:
        s = body.sentiment_override
        if not (-1.0 <= s <= 1.0):
            raise HTTPException(status_code=422, detail="sentiment_override must be in [-1.0, 1.0].")
        entity.sentiment_override = s
        # Also update NodeDisplay color immediately so next graph fetch reflects it
        display = db.get(NodeDisplay, entity_id)
        if display:
            if s > 0.2:
                display.sentiment_color = "#4AD94A"
            elif s < -0.2:
                display.sentiment_color = "#D94A4A"
            else:
                display.sentiment_color = "#999999"
            display.last_computed = datetime.now(timezone.utc)

    db.commit()
    db.refresh(entity)
    logger.info(
        "User %d edited node %d (%s): type=%s label=%s sentiment=%s",
        current_user["id"], entity_id, entity.canonical_name,
        body.entity_type, body.label_override, body.sentiment_override,
    )
    return _to_response(entity, db)


@router.delete("/{entity_id}", response_model=NodeResponse)
def archive_node(
    entity_id: int,
    body: ArchiveRequest,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
) -> NodeResponse:
    """
    Move a node to the graveyard (soft-delete).

    The entity is marked archived=1 and hidden from all graph views.
    It is NOT deleted from the database — use GET /nodes/graveyard to
    view archived nodes and POST /nodes/{id}/restore to bring one back.
    """
    entity = _get_entity_or_404(entity_id, db)
    if entity.archived:
        raise HTTPException(status_code=409, detail="Entity is already archived.")

    entity.archived = 1
    entity.archived_at = datetime.now(timezone.utc)
    entity.archive_note = body.note

    db.commit()
    db.refresh(entity)
    logger.info(
        "User %d archived node %d (%s). Note: %s",
        current_user["id"], entity_id, entity.canonical_name, body.note,
    )
    return _to_response(entity, db)


@router.get("/graveyard", response_model=list[NodeResponse])
def get_graveyard(
    current_user: CurrentUser,
    db: Session = Depends(get_db),
) -> list[NodeResponse]:
    """Return all archived (graveyarded) entities, newest first."""
    entities = (
        db.query(Entity)
        .filter(Entity.archived == 1)
        .order_by(Entity.archived_at.desc())
        .all()
    )
    return [_to_response(e, db) for e in entities]


@router.post("/{entity_id}/restore", response_model=NodeResponse)
def restore_node(
    entity_id: int,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
) -> NodeResponse:
    """Restore an archived entity back to the active graph."""
    entity = _get_entity_or_404(entity_id, db)
    if not entity.archived:
        raise HTTPException(status_code=409, detail="Entity is not archived.")

    entity.archived = 0
    entity.archived_at = None
    entity.archive_note = None

    db.commit()
    db.refresh(entity)
    logger.info(
        "User %d restored node %d (%s) from graveyard.",
        current_user["id"], entity_id, entity.canonical_name,
    )
    return _to_response(entity, db)
