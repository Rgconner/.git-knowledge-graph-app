"""
Shared result dataclasses for the AI provider layer.

All AI provider implementations return these types so that callers
are decoupled from any particular SDK or model.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class ExtractedEntity:
    """A single entity extracted from a document."""

    canonical_name: str
    # One of: person, idea, project, keyword, organization, location, date
    type: str
    aliases: list[str] = field(default_factory=list)


@dataclass
class ActionItemCandidate:
    """An action item candidate extracted from a document."""

    description: str
    assignee_canonical_name: Optional[str] = None
    due_date: Optional[str] = None  # ISO-8601 string or free-text date


@dataclass
class RelationshipCandidate:
    """A directed (or undirected) relationship between two entities."""

    entity_a_canonical_name: str
    entity_b_canonical_name: str
    relationship_description: str
    base_weight: float  # 0.0–1.0


@dataclass
class EntityExtractionResult:
    """Container returned by AIProvider.extract_entities()."""

    entities: list[ExtractedEntity]


@dataclass
class _UpdatedRelationship:
    """One row inside a GraphScoreResult."""

    entity_a_canonical_name: str
    entity_b_canonical_name: str
    new_base_weight: float  # 0.0–1.0


@dataclass
class GraphScoreResult:
    """Container returned by AIProvider.rescore_graph()."""

    updated_relationships: list[_UpdatedRelationship]
