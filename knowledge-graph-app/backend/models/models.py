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


class WatchSourceType(str, enum.Enum):
    filesystem = "filesystem"
    github = "github"


class WatchedFileStatus(str, enum.Enum):
    pending = "pending"      # discovered, awaiting user decision
    approved = "approved"    # user approved — ingested into the graph
    rejected = "rejected"    # user rejected — will not be ingested
    ingesting = "ingesting"  # currently running through the pipeline
    failed = "failed"        # pipeline error after approval


# ---------------------------------------------------------------------------
# Tables
# ---------------------------------------------------------------------------


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_admin = Column(Integer, default=0, nullable=False)  # 0 = regular, 1 = admin
    created_at = Column(DateTime, default=func.now(), nullable=False)

    documents = relationship("Document", back_populates="uploader")
    weight_hints = relationship("UserWeightHint", back_populates="user")


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    uploader_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    filename = Column(String(512), nullable=False)
    # The original filename as supplied by the user/file system before any
    # AI-generated rename is applied.  NULL for documents uploaded before
    # this column was added (legacy rows).
    original_filename = Column(String(512), nullable=True)
    raw_text = Column(Text, nullable=False)
    file_type = Column(String(64), nullable=False)
    created_at = Column(DateTime, default=func.now(), nullable=False)
    processed_at = Column(DateTime, nullable=True)
    ai_category = Column(String(255), nullable=True)
    # MinHash fingerprint stored as compact JSON (list of 128 ints, ~1.5 KB).
    # NULL on legacy rows — the duplicate check falls back to computing on-the-fly.
    fingerprint = Column(Text, nullable=True)

    uploader = relationship("User", back_populates="documents")
    action_items = relationship("ActionItem", back_populates="document")
    entity_mentions = relationship("EntityDocumentMention", back_populates="document")


class Entity(Base):
    __tablename__ = "entities"

    id = Column(Integer, primary_key=True, index=True)
    type = Column(Enum(EntityType), nullable=False, index=True)
    canonical_name = Column(String(512), unique=True, nullable=False, index=True)
    created_at = Column(DateTime, default=func.now(), nullable=False)
    # Graveyard / archival fields — archived entities are hidden from the graph
    # but kept in the DB so they can be restored.
    archived = Column(Integer, default=0, nullable=False)   # 0=active, 1=archived
    archived_at = Column(DateTime, nullable=True)
    archive_note = Column(Text, nullable=True)
    # Manual overrides applied by the user via the right-click menu
    label_override = Column(String(512), nullable=True)     # replaces canonical_name in display
    sentiment_override = Column(Float, nullable=True)       # -1.0 to 1.0; None = use AI value

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


# ---------------------------------------------------------------------------
# Watch Sources & Watched Files
# ---------------------------------------------------------------------------


class WatchSource(Base):
    """A filesystem path or GitHub repo that is polled for new documents."""

    __tablename__ = "watch_sources"

    id = Column(Integer, primary_key=True, index=True)
    owner_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)                  # human label
    source_type = Column(Enum(WatchSourceType), nullable=False)

    # Filesystem fields
    fs_path = Column(String(1024), nullable=True)               # absolute path
    file_glob = Column(String(255), nullable=True, default="**/*")  # glob pattern

    # GitHub fields
    github_repo = Column(String(512), nullable=True)            # owner/repo
    github_branch = Column(String(255), nullable=True, default="main")
    github_path = Column(String(512), nullable=True, default="")  # sub-directory
    github_token = Column(String(512), nullable=True)           # PAT (stored encrypted in prod)

    # Polling
    enabled = Column(Integer, default=1, nullable=False)        # 0/1 bool
    last_scanned_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)

    owner = relationship("User", backref="watch_sources")
    watched_files = relationship(
        "WatchedFile", back_populates="source", cascade="all, delete-orphan"
    )


class WatchedFile(Base):
    """A single file discovered by a WatchSource, awaiting approval/rejection."""

    __tablename__ = "watched_files"

    id = Column(Integer, primary_key=True, index=True)
    source_id = Column(Integer, ForeignKey("watch_sources.id"), nullable=False, index=True)
    # Unique identity key — filesystem absolute path OR GitHub blob SHA
    file_key = Column(String(1024), nullable=False)
    filename = Column(String(512), nullable=False)
    relative_path = Column(String(1024), nullable=True)         # path within source root/repo
    file_size_bytes = Column(Integer, nullable=True)
    status = Column(
        Enum(WatchedFileStatus),
        default=WatchedFileStatus.pending,
        nullable=False,
        index=True,
    )
    # Set once the file is approved and ingested
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=True)
    # Human notes / reason for rejection (optional)
    review_note = Column(Text, nullable=True)
    discovered_at = Column(DateTime, default=func.now(), nullable=False)
    reviewed_at = Column(DateTime, nullable=True)

    source = relationship("WatchSource", back_populates="watched_files")
    document = relationship("Document", backref="watched_file_entry")
