"""SQLAlchemy ORM models for the Knowledge Graph application."""

import enum
from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import relationship

from db.session import Base


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------


class EntityType(str, enum.Enum):
    person = "person"
    idea = "idea"
    project = "project"
    keyword = "keyword"
    organization = "organization"
    location = "location"
    date = "date"


class ActionItemStatus(str, enum.Enum):
    open = "open"
    in_progress = "in_progress"
    closed = "closed"


# ---------------------------------------------------------------------------
# Tables
# ---------------------------------------------------------------------------


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=func.now(), nullable=False)

    documents = relationship("Document", back_populates="uploader")
    weight_hints = relationship("UserWeightHint", back_populates="user")


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    uploader_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    filename = Column(String(512), nullable=False)
    raw_text = Column(Text, nullable=False)
    file_type = Column(String(64), nullable=False)
    created_at = Column(DateTime, default=func.now(), nullable=False)
    processed_at = Column(DateTime, nullable=True)
    ai_category = Column(String(255), nullable=True)

    uploader = relationship("User", back_populates="documents")
    action_items = relationship("ActionItem", back_populates="document")
    entity_mentions = relationship("EntityDocumentMention", back_populates="document")


class Entity(Base):
    __tablename__ = "entities"

    id = Column(Integer, primary_key=True, index=True)
    type = Column(Enum(EntityType), nullable=False, index=True)
    canonical_name = Column(String(512), unique=True, nullable=False, index=True)
    created_at = Column(DateTime, default=func.now(), nullable=False)

    action_items_assigned = relationship(
        "ActionItem", back_populates="assignee_entity", foreign_keys="ActionItem.assignee_entity_id"
    )
    document_mentions = relationship("EntityDocumentMention", back_populates="entity")
    relationships_as_a = relationship(
        "Relationship", back_populates="entity_a", foreign_keys="Relationship.entity_a_id"
    )
    relationships_as_b = relationship(
        "Relationship", back_populates="entity_b", foreign_keys="Relationship.entity_b_id"
    )
    node_display = relationship("NodeDisplay", back_populates="entity", uselist=False)


class ActionItem(Base):
    __tablename__ = "action_items"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False, index=True)
    description = Column(Text, nullable=False)
    assignee_entity_id = Column(Integer, ForeignKey("entities.id"), nullable=True, index=True)
    status = Column(Enum(ActionItemStatus), default=ActionItemStatus.open, nullable=False)
    due_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)

    document = relationship("Document", back_populates="action_items")
    assignee_entity = relationship(
        "Entity", back_populates="action_items_assigned", foreign_keys=[assignee_entity_id]
    )


class EntityDocumentMention(Base):
    """Composite-PK join table tracking how many times an entity appears in a document."""

    __tablename__ = "entity_document_mentions"
    __table_args__ = (UniqueConstraint("entity_id", "document_id", name="uq_entity_document"),)

    entity_id = Column(Integer, ForeignKey("entities.id"), primary_key=True)
    document_id = Column(Integer, ForeignKey("documents.id"), primary_key=True)
    mention_count = Column(Integer, default=1, nullable=False)

    entity = relationship("Entity", back_populates="document_mentions")
    document = relationship("Document", back_populates="entity_mentions")


class Relationship(Base):
    __tablename__ = "relationships"

    id = Column(Integer, primary_key=True, index=True)
    entity_a_id = Column(Integer, ForeignKey("entities.id"), nullable=False, index=True)
    entity_b_id = Column(Integer, ForeignKey("entities.id"), nullable=False, index=True)
    base_weight = Column(Float, nullable=False, default=1.0)
    heat_score = Column(Float, nullable=False, default=0.0)
    sentiment_score = Column(Float, nullable=False, default=0.0)  # -1.0 to 1.0
    last_updated = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)

    entity_a = relationship("Entity", back_populates="relationships_as_a", foreign_keys=[entity_a_id])
    entity_b = relationship("Entity", back_populates="relationships_as_b", foreign_keys=[entity_b_id])
    weight_hints = relationship("UserWeightHint", back_populates="relationship")


class UserWeightHint(Base):
    __tablename__ = "user_weight_hints"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    relationship_id = Column(Integer, ForeignKey("relationships.id"), nullable=False, index=True)
    hint_weight = Column(Float, nullable=True)
    qualitative_hint = Column(Text, nullable=True)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=func.now(), nullable=False)

    user = relationship("User", back_populates="weight_hints")
    relationship = relationship("Relationship", back_populates="weight_hints")


class NodeDisplay(Base):
    """Computed display cache rebuilt on every graph re-score."""

    __tablename__ = "node_display"

    entity_id = Column(Integer, ForeignKey("entities.id"), primary_key=True)
    sentiment_color = Column(String(7), nullable=False, default="#999999")  # hex, e.g. #4AD94A
    display_weight = Column(Float, nullable=False, default=1.0)
    last_computed = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)

    entity = relationship("Entity", back_populates="node_display")
