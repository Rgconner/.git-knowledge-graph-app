"""Pydantic v2 response schemas for the Knowledge Graph API.

Covers every ORM table plus the GraphPayload (nodes + edges) consumed by the
frontend D3 canvas.  All schemas use ``model_config = ConfigDict(from_attributes=True)``
so they can be constructed directly from SQLAlchemy ORM instances.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from models.models import ActionItemStatus, EntityType


# ---------------------------------------------------------------------------
# Shared config mixin
# ---------------------------------------------------------------------------

_from_orm = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# User
# ---------------------------------------------------------------------------


class UserSchema(BaseModel):
    model_config = _from_orm

    id: int
    name: str
    email: str
    created_at: datetime


# ---------------------------------------------------------------------------
# Document
# ---------------------------------------------------------------------------


class DocumentSchema(BaseModel):
    model_config = _from_orm

    id: int
    uploader_user_id: int
    filename: str
    file_type: str
    created_at: datetime
    processed_at: Optional[datetime] = None
    ai_category: Optional[str] = None
    # raw_text intentionally omitted from list responses — use a detail endpoint


class DocumentDetailSchema(DocumentSchema):
    raw_text: str


# ---------------------------------------------------------------------------
# Entity
# ---------------------------------------------------------------------------


class EntitySchema(BaseModel):
    model_config = _from_orm

    id: int
    type: EntityType
    canonical_name: str
    created_at: datetime


# ---------------------------------------------------------------------------
# ActionItem
# ---------------------------------------------------------------------------


class ActionItemSchema(BaseModel):
    model_config = _from_orm

    id: int
    document_id: int
    description: str
    assignee_entity_id: Optional[int] = None
    status: ActionItemStatus
    due_date: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# EntityDocumentMention
# ---------------------------------------------------------------------------


class EntityDocumentMentionSchema(BaseModel):
    model_config = _from_orm

    entity_id: int
    document_id: int
    mention_count: int


# ---------------------------------------------------------------------------
# Relationship
# ---------------------------------------------------------------------------


class RelationshipSchema(BaseModel):
    model_config = _from_orm

    id: int
    entity_a_id: int
    entity_b_id: int
    base_weight: float
    heat_score: float
    sentiment_score: float  # -1.0 to 1.0
    last_updated: datetime


# ---------------------------------------------------------------------------
# UserWeightHint
# ---------------------------------------------------------------------------


class UserWeightHintSchema(BaseModel):
    model_config = _from_orm

    id: int
    user_id: int
    relationship_id: int
    hint_weight: Optional[float] = None
    qualitative_hint: Optional[str] = None
    note: Optional[str] = None
    created_at: datetime


# ---------------------------------------------------------------------------
# NodeDisplay
# ---------------------------------------------------------------------------


class NodeDisplaySchema(BaseModel):
    model_config = _from_orm

    entity_id: int
    sentiment_color: str  # hex string, e.g. "#4AD94A"
    display_weight: float
    last_computed: datetime


# ---------------------------------------------------------------------------
# Graph API payload schemas
# ---------------------------------------------------------------------------


class Node(BaseModel):
    """A single node in the knowledge graph — carries all visual encoding signals."""

    id: int
    label: str
    type: str  # EntityType value or "action_item"
    sentiment_color: str  # hex color
    size: float  # maps to SVG circle radius
    layer: str  # "team" | "personal"
    status: Optional[str] = None  # only set for action_item nodes


class Edge(BaseModel):
    """A single edge in the knowledge graph."""

    id: int
    source: int  # entity_a_id
    target: int  # entity_b_id
    weight: float  # maps to stroke-width
    heat_score: float  # 0.0–1.0 composite
    heat_color: str  # pre-computed hex color (blue → red)


class GraphPayload(BaseModel):
    """Full response body for GET /graph/team and GET /graph/personal."""

    nodes: list[Node]
    edges: list[Edge]
