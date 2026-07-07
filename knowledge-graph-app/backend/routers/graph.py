"""Graph API router — exposes the computed knowledge graph to the frontend.

Endpoints
---------
GET  /graph/team      — full shared team graph (all entities + relationships)
GET  /graph/personal  — current user's personal graph layer merged with team graph
POST /graph/hints     — submit a weight hint for a relationship, trigger re-score
"""

from __future__ import annotations

from typing import Annotated, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from db.session import get_db
from models.models import (
    ActionItem,
    Entity,
    EntityDocumentMention,
    NodeDisplay,
    Relationship,
    UserWeightHint,
    Document,
)
from models.schemas import Edge, GraphPayload, Node
from routers.deps import CurrentUser
from services.color_mapper import (
    action_item_status_to_color,
    heat_to_color,
    weight_to_size,
    weight_to_stroke,
)
from services.pipeline import run_pipeline

router = APIRouter(prefix="/graph", tags=["graph"])

# ---------------------------------------------------------------------------
# Request schema for POST /graph/hints
# ---------------------------------------------------------------------------


class HintRequest(BaseModel):
    relationship_id: int
    hint_weight: Optional[float] = None
    qualitative_hint: Optional[str] = None
    note: Optional[str] = None


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _build_entity_node(entity: Entity, display: Optional[NodeDisplay], layer: str) -> Node:
    """Construct a Node for a regular entity."""
    if display is not None:
        color = display.sentiment_color
        weight = display.display_weight
    else:
        color = "#999999"
        weight = 0.5

    return Node(
        id=entity.id,
        label=entity.canonical_name,
        type=entity.type.value,
        sentiment_color=color,
        size=weight_to_size(weight),
        layer=layer,
        status=None,
    )


def _build_action_item_node(action_item: ActionItem, layer: str) -> Node:
    """Construct a Node for an action item.

    Action item node IDs are offset by 1_000_000 to avoid collisions with
    entity node IDs (both use integer primary keys from separate tables).
    """
    return Node(
        id=action_item.id + 1_000_000,  # offset to avoid collision with entity IDs
        label=action_item.description[:60],
        type="action_item",
        sentiment_color=action_item_status_to_color(action_item.status.value),
        size=12.0,  # fixed medium size for action items
        layer=layer,
        status=action_item.status.value,
    )


def _build_edge(rel: Relationship) -> Edge:
    """Construct an Edge from a Relationship ORM row."""
    return Edge(
        id=rel.id,
        source=rel.entity_a_id,
        target=rel.entity_b_id,
        weight=weight_to_stroke(rel.base_weight),
        heat_score=rel.heat_score,
        heat_color=heat_to_color(rel.heat_score),
    )


# ---------------------------------------------------------------------------
# GET /graph/team
# ---------------------------------------------------------------------------


@router.get("/team", response_model=GraphPayload, summary="Full shared team graph")
def get_team_graph(db: Annotated[Session, Depends(get_db)]) -> GraphPayload:
    """Return the complete team graph — all entities, action items, and relationships.

    All entity nodes use layer="team".  Colors and sizes are pre-computed
    server-side so the frontend is a pure renderer.
    """
    # --- Entity nodes (joined with NodeDisplay cache) ---
    entities = db.query(Entity).all()
    display_map: dict[int, NodeDisplay] = {
        nd.entity_id: nd for nd in db.query(NodeDisplay).all()
    }

    nodes: list[Node] = [
        _build_entity_node(entity, display_map.get(entity.id), layer="team")
        for entity in entities
    ]

    # --- Action item nodes ---
    action_items = db.query(ActionItem).all()
    nodes.extend(_build_action_item_node(ai, layer="team") for ai in action_items)

    # --- Edges ---
    relationships = db.query(Relationship).all()
    edges: list[Edge] = [_build_edge(rel) for rel in relationships]

    return GraphPayload(nodes=nodes, edges=edges)


# ---------------------------------------------------------------------------
# GET /graph/personal
# ---------------------------------------------------------------------------


@router.get("/personal", response_model=GraphPayload, summary="Personal graph layer")
def get_personal_graph(
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> GraphPayload:
    """Return the graph filtered to the current user's personal documents.

    - Entities that appear in documents uploaded by the current user get
      layer="personal"; all other entities get layer="team".
    - Only relationships where at least one endpoint entity belongs to the
      user's personal set are included.
    - Action items from the user's documents get layer="personal"; others
      get layer="team".
    """
    user_id: int = current_user["id"]

    # IDs of documents uploaded by the current user
    user_doc_ids: set[int] = {
        doc_id
        for (doc_id,) in db.query(Document.id)
        .filter(Document.uploader_user_id == user_id)
        .all()
    }

    # Entity IDs that appear in at least one of the user's documents
    personal_entity_ids: set[int] = set()
    if user_doc_ids:
        personal_entity_ids = {
            entity_id
            for (entity_id,) in db.query(EntityDocumentMention.entity_id)
            .filter(EntityDocumentMention.document_id.in_(user_doc_ids))
            .all()
        }

    # --- Entity nodes ---
    entities = db.query(Entity).all()
    display_map: dict[int, NodeDisplay] = {
        nd.entity_id: nd for nd in db.query(NodeDisplay).all()
    }

    nodes: list[Node] = [
        _build_entity_node(
            entity,
            display_map.get(entity.id),
            layer="personal" if entity.id in personal_entity_ids else "team",
        )
        for entity in entities
    ]

    # --- Action item nodes ---
    action_items = db.query(ActionItem).all()
    nodes.extend(
        _build_action_item_node(
            ai,
            layer="personal" if ai.document_id in user_doc_ids else "team",
        )
        for ai in action_items
    )

    # --- Edges: only where at least one endpoint is in the personal set ---
    relationships = db.query(Relationship).all()
    edges: list[Edge] = [
        _build_edge(rel)
        for rel in relationships
        if rel.entity_a_id in personal_entity_ids or rel.entity_b_id in personal_entity_ids
    ]

    return GraphPayload(nodes=nodes, edges=edges)


# ---------------------------------------------------------------------------
# POST /graph/hints
# ---------------------------------------------------------------------------


@router.post("/hints", summary="Submit a weight hint and trigger re-score")
def post_hint(
    body: HintRequest,
    background_tasks: BackgroundTasks,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    """Write a user weight hint for a relationship and trigger an async re-score.

    At least one of ``hint_weight`` or ``qualitative_hint`` must be provided.
    The re-score is dispatched against the user's most recently processed
    document; returns HTTP 400 if the user has no documents.
    """
    # Validate: at least one hint field must be present
    if body.hint_weight is None and not body.qualitative_hint:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="At least one of hint_weight or qualitative_hint must be provided.",
        )

    user_id: int = current_user["id"]

    # Persist the hint
    hint = UserWeightHint(
        user_id=user_id,
        relationship_id=body.relationship_id,
        hint_weight=body.hint_weight,
        qualitative_hint=body.qualitative_hint,
        note=body.note,
    )
    db.add(hint)
    db.commit()
    db.refresh(hint)

    # Find the most recently processed document belonging to the current user
    latest_doc = (
        db.query(Document)
        .filter(
            Document.uploader_user_id == user_id,
            Document.processed_at.isnot(None),
        )
        .order_by(Document.processed_at.desc())
        .first()
    )

    if latest_doc is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No processed documents found for the current user; cannot trigger re-score.",
        )

    # Dispatch pipeline re-score as a background task
    background_tasks.add_task(run_pipeline, latest_doc.id)

    return {"status": "hint_saved", "hint_id": hint.id}
