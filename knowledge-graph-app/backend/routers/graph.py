"""Graph API router — exposes the computed knowledge graph to the frontend.

Endpoints
---------
GET  /graph/team       — full shared team graph (all entities + relationships)
GET  /graph/personal   — current user's personal graph layer merged with team graph
GET  /graph/documents  — document-level graph: each document is a node, edges are
                         shared entities between documents
POST /graph/hints      — submit a weight hint for a relationship, trigger re-score
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

    # Apply sentiment_override if the user has manually set one
    if entity.sentiment_override is not None:
        s = entity.sentiment_override
        if s > 0.2:
            color = "#4AD94A"
        elif s < -0.2:
            color = "#D94A4A"
        else:
            color = "#999999"

    # Use label_override if set, otherwise canonical_name
    label = entity.label_override or entity.canonical_name

    return Node(
        id=entity.id,
        label=label,
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
    # --- Entity nodes (joined with NodeDisplay cache) — exclude archived ---
    entities = db.query(Entity).filter(Entity.archived == 0).all()
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

    # --- Entity nodes --- exclude archived
    entities = db.query(Entity).filter(Entity.archived == 0).all()
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
# GET /graph/documents
# ---------------------------------------------------------------------------


@router.get("/documents", response_model=GraphPayload, summary="Document-level graph")
def get_document_graph(
    db: Annotated[Session, Depends(get_db)],
) -> GraphPayload:
    """Return a graph where every node is a document.

    Two document nodes are connected by an edge when they share one or more
    extracted entities.  Edge weight reflects the number and importance of
    shared entities; heat color reflects the recency of the more recent document.

    Node color encodes the document's AI sentiment (average sentiment of all
    entities extracted from it).  Node size encodes the number of distinct
    entities extracted from the document.
    """
    from collections import defaultdict
    import math

    # Load all documents
    documents = db.query(Document).all()
    if not documents:
        return GraphPayload(nodes=[], edges=[])

    doc_map = {doc.id: doc for doc in documents}

    # Build doc_id → set of entity_ids
    mentions = db.query(
        EntityDocumentMention.document_id,
        EntityDocumentMention.entity_id,
    ).all()

    doc_entities: dict[int, set[int]] = defaultdict(set)
    for doc_id, entity_id in mentions:
        doc_entities[doc_id].add(entity_id)

    # Build entity_id → avg sentiment from NodeDisplay cache
    display_map: dict[int, NodeDisplay] = {
        nd.entity_id: nd for nd in db.query(NodeDisplay).all()
    }

    # Compute per-document average sentiment (from entities with NodeDisplay)
    def _doc_avg_sentiment(doc_id: int) -> float:
        scores = [
            display_map[eid].display_weight  # display_weight is 0–1, sentiment_color encodes sign
            for eid in doc_entities.get(doc_id, set())
            if eid in display_map
        ]
        return sum(scores) / len(scores) if scores else 0.5

    # Compute per-document average sentiment color properly from sentiment_color hex
    def _doc_sentiment_color(doc_id: int) -> str:
        colors = [
            display_map[eid].sentiment_color
            for eid in doc_entities.get(doc_id, set())
            if eid in display_map
        ]
        if not colors:
            return "#999999"
        # Average RGB channels
        rs, gs, bs = [], [], []
        for hex_color in colors:
            c = hex_color.lstrip("#")
            if len(c) == 6:
                rs.append(int(c[0:2], 16))
                gs.append(int(c[2:4], 16))
                bs.append(int(c[4:6], 16))
        if not rs:
            return "#999999"
        r = int(sum(rs) / len(rs))
        g = int(sum(gs) / len(gs))
        b = int(sum(bs) / len(bs))
        return f"#{r:02x}{g:02x}{b:02x}"

    # Corpus date range for recency normalisation
    dates = [doc.created_at for doc in documents if doc.created_at]
    min_date = min(dates).timestamp() if dates else 0.0
    max_date = max(dates).timestamp() if dates else 1.0
    date_range = max(max_date - min_date, 1.0)

    # --- Build document nodes ---
    # Node ID space: use doc.id offset by 2_000_000 to avoid collisions with
    # entity node IDs (offset 1_000_000 is already used by action items).
    DOC_NODE_OFFSET = 2_000_000

    nodes: list[Node] = []
    for doc in documents:
        entity_count = len(doc_entities.get(doc.id, set()))
        # Size: log scale so documents with many entities don't dominate
        size = 12.0 + min(20.0, math.log1p(entity_count) * 5)
        nodes.append(
            Node(
                id=doc.id + DOC_NODE_OFFSET,
                label=doc.filename,
                type="document",
                sentiment_color=_doc_sentiment_color(doc.id),
                size=size,
                layer="team",
                status=doc.ai_category,     # reuse status slot to carry category
                document_id=doc.id,
                entity_count=entity_count,
                ai_category=doc.ai_category,
            )
        )

    # --- Build document-to-document edges via shared entities ---
    # For each pair of documents, compute:
    #   shared_weight = |shared entities| / max_possible_shared
    #   heat = recency of more recent document (normalised)
    doc_ids = list(doc_entities.keys())
    edges: list[Edge] = []
    edge_id = 1  # synthetic edge ids (no DB row)

    # Pre-compute max entity count for normalisation
    max_shared = 1

    # First pass: find all pairs with shared entities
    pairs: list[tuple[int, int, int]] = []  # (doc_a, doc_b, shared_count)
    for i, da in enumerate(doc_ids):
        for db_id in doc_ids[i + 1 :]:
            shared = doc_entities[da] & doc_entities[db_id]
            if shared:
                count = len(shared)
                if count > max_shared:
                    max_shared = count
                pairs.append((da, db_id, count))

    # Second pass: build edges with normalised weights
    for da, db_id, count in pairs:
        base_weight = count / max_shared          # 0.0–1.0
        stroke = weight_to_stroke(base_weight)

        # Heat: recency of the newer document
        da_ts = doc_map[da].created_at.timestamp() if doc_map[da].created_at else min_date
        db_ts = doc_map[db_id].created_at.timestamp() if doc_map[db_id].created_at else min_date
        recency = (max(da_ts, db_ts) - min_date) / date_range
        heat_color = heat_to_color(recency)

        edges.append(
            Edge(
                id=edge_id,
                source=da + DOC_NODE_OFFSET,
                target=db_id + DOC_NODE_OFFSET,
                weight=stroke,
                heat_score=recency,
                heat_color=heat_color,
            )
        )
        edge_id += 1

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
