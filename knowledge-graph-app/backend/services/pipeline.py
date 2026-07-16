"""AI processing pipeline.

run_pipeline(document_id, db) is the single entry-point called as a
BackgroundTask after every document upload.  It executes nine ordered steps:

    1.  Entity extraction & upsert
    2.  Action-item extraction & creation
    3.  Mention logging (entity_document_mentions)
    4.  Relationship inference & upsert
    5.  Sentiment scoring → NodeDisplay upsert
    6.  Document categorisation
    7.  Heat-score computation across all relationships
    8.  Full-graph re-score with user weight hints
    9.  Mark document processed_at = utcnow()

Any exception is caught, logged, and the document is marked as
"processing_error" so it never stays stuck in a pending state.
"""

from __future__ import annotations

import logging
import traceback
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from ai.factory import get_ai_provider
from ai.schemas import ExtractedEntity
from models.models import (
    ActionItem,
    ActionItemStatus,
    Document,
    Entity,
    EntityDocumentMention,
    EntityType,
    NodeDisplay,
    Relationship,
    UserWeightHint,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Sentiment colour mapping
# ---------------------------------------------------------------------------

_SENTIMENT_RED = "#D94A4A"
_SENTIMENT_GREEN = "#4AD94A"
_SENTIMENT_GREY = "#999999"

_SENTIMENT_TYPES = {
    EntityType.person,
    EntityType.idea,
    EntityType.project,
    EntityType.organization,
}

# Entity types whose sentinel keyword nodes are created for action-item links
_ACTION_ITEM_ENTITY_TYPE = EntityType.keyword


# ---------------------------------------------------------------------------
# Public entry-point
# ---------------------------------------------------------------------------


def run_pipeline(document_id: int, db: Session) -> None:
    """Execute the full AI processing pipeline for *document_id*.

    All DB operations are performed on the supplied *db* session.  The
    session is committed once at the very end (step 9), or once in the
    error handler.
    """
    try:
        _run(document_id, db)
    except Exception:
        logger.error(
            "Pipeline failed for document %d:\n%s",
            document_id,
            traceback.format_exc(),
        )
        _mark_error(document_id, db)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _mark_error(document_id: int, db: Session) -> None:
    doc = db.get(Document, document_id)
    if doc is not None:
        doc.processed_at = datetime.now(timezone.utc)
        doc.ai_category = "processing_error"
        try:
            db.commit()
        except Exception:
            db.rollback()
            logger.error("Could not commit error state for document %d", document_id)


def _run(document_id: int, db: Session) -> None:
    provider = get_ai_provider()

    # ------------------------------------------------------------------
    # Step 1 — Entity extraction & upsert
    # ------------------------------------------------------------------
    logger.info("[pipeline] step 1 — entity extraction (doc %d)", document_id)

    doc = db.get(Document, document_id)
    if doc is None:
        raise ValueError(f"Document {document_id} not found")

    raw_text = doc.raw_text
    extraction_result = provider.extract_entities(raw_text)
    extracted_entities: list[ExtractedEntity] = extraction_result.entities

    # Map canonical_name → DB entity id for use in later steps
    entity_id_map: dict[str, int] = {}

    for ee in extracted_entities:
        canonical = ee.canonical_name.strip()
        try:
            entity_type = EntityType(ee.type.lower())
        except ValueError:
            logger.warning(
                "[pipeline] unknown entity type '%s' for '%s', defaulting to keyword",
                ee.type,
                canonical,
            )
            entity_type = EntityType.keyword

        existing = (
            db.query(Entity)
            .filter(Entity.canonical_name == canonical)
            .first()
        )
        if existing is None:
            entity = Entity(canonical_name=canonical, type=entity_type)
            db.add(entity)
            db.flush()  # populate entity.id without full commit
            entity_id_map[canonical] = entity.id
            logger.debug("[pipeline] created entity '%s' (id %d)", canonical, entity.id)
        else:
            entity_id_map[canonical] = existing.id
            logger.debug("[pipeline] found existing entity '%s' (id %d)", canonical, existing.id)

    logger.info("[pipeline] step 1 complete — %d entities", len(entity_id_map))

    # ------------------------------------------------------------------
    # Step 2 — Action-item extraction & creation
    # ------------------------------------------------------------------
    logger.info("[pipeline] step 2 — action-item extraction (doc %d)", document_id)

    action_candidates = provider.extract_action_items(raw_text, extracted_entities)
    created_action_items: list[ActionItem] = []

    for candidate in action_candidates:
        assignee_id: Optional[int] = None
        if candidate.assignee_canonical_name:
            assignee_id = entity_id_map.get(candidate.assignee_canonical_name.strip())

        due_date: Optional[datetime] = None
        if candidate.due_date:
            try:
                due_date = datetime.fromisoformat(candidate.due_date)
            except ValueError:
                logger.debug(
                    "[pipeline] could not parse due_date '%s', storing as None",
                    candidate.due_date,
                )

        action_item = ActionItem(
            document_id=document_id,
            description=candidate.description,
            assignee_entity_id=assignee_id,
            status=ActionItemStatus.open,
            due_date=due_date,
        )
        db.add(action_item)
        db.flush()
        created_action_items.append(action_item)

    logger.info("[pipeline] step 2 complete — %d action items", len(created_action_items))

    # ------------------------------------------------------------------
    # Step 3 — Mention logging
    # ------------------------------------------------------------------
    logger.info("[pipeline] step 3 — mention logging (doc %d)", document_id)

    for canonical, eid in entity_id_map.items():
        mention = (
            db.query(EntityDocumentMention)
            .filter(
                EntityDocumentMention.entity_id == eid,
                EntityDocumentMention.document_id == document_id,
            )
            .first()
        )
        if mention is None:
            db.add(EntityDocumentMention(entity_id=eid, document_id=document_id, mention_count=1))
        else:
            mention.mention_count += 1

    logger.info("[pipeline] step 3 complete")

    # ------------------------------------------------------------------
    # Step 4 — Relationship inference & upsert
    # ------------------------------------------------------------------
    logger.info("[pipeline] step 4 — relationship inference (doc %d)", document_id)

    rel_candidates = provider.infer_relationships(extracted_entities, raw_text)

    for rc in rel_candidates:
        # Guard: LLM occasionally returns null for one of the entity names
        if not rc.entity_a_canonical_name or not rc.entity_b_canonical_name:
            logger.debug(
                "[pipeline] skipping relationship — null entity name: a=%r b=%r",
                rc.entity_a_canonical_name,
                rc.entity_b_canonical_name,
            )
            continue
        id_a = entity_id_map.get(rc.entity_a_canonical_name.strip())
        id_b = entity_id_map.get(rc.entity_b_canonical_name.strip())
        if id_a is None or id_b is None:
            logger.debug(
                "[pipeline] skipping relationship — unknown entity in ('%s', '%s')",
                rc.entity_a_canonical_name,
                rc.entity_b_canonical_name,
            )
            continue
        _upsert_relationship(db, id_a, id_b, rc.base_weight)

    # Action-item sentinel relationships
    # For each created action item that has an assignee entity, create a
    # keyword-type sentinel entity "ACTION_ITEM:{id}" and link it to the
    # assignee entity via the relationships table.
    for ai_row in created_action_items:
        if ai_row.assignee_entity_id is None:
            continue
        sentinel_name = f"ACTION_ITEM:{ai_row.id}"
        sentinel = (
            db.query(Entity)
            .filter(Entity.canonical_name == sentinel_name)
            .first()
        )
        if sentinel is None:
            sentinel = Entity(
                canonical_name=sentinel_name,
                type=_ACTION_ITEM_ENTITY_TYPE,
            )
            db.add(sentinel)
            db.flush()
        _upsert_relationship(db, sentinel.id, ai_row.assignee_entity_id, 1.0)

    logger.info("[pipeline] step 4 complete")

    # ------------------------------------------------------------------
    # Step 5 — Sentiment scoring → NodeDisplay upsert
    # ------------------------------------------------------------------
    logger.info("[pipeline] step 5 — sentiment scoring (doc %d)", document_id)

    for ee in extracted_entities:
        canonical = ee.canonical_name.strip()
        try:
            entity_type = EntityType(ee.type.lower())
        except ValueError:
            continue
        if entity_type not in _SENTIMENT_TYPES:
            continue

        eid = entity_id_map.get(canonical)
        if eid is None:
            continue

        score = provider.score_sentiment(canonical, raw_text)
        if score < -0.2:
            color = _SENTIMENT_RED
        elif score > 0.2:
            color = _SENTIMENT_GREEN
        else:
            color = _SENTIMENT_GREY

        node_display = db.get(NodeDisplay, eid)
        if node_display is None:
            db.add(NodeDisplay(entity_id=eid, sentiment_color=color, display_weight=1.0))
        else:
            node_display.sentiment_color = color
            node_display.last_computed = datetime.now(timezone.utc)

    logger.info("[pipeline] step 5 complete")

    # ------------------------------------------------------------------
    # Step 6 — Document categorisation + AI name generation
    # ------------------------------------------------------------------
    logger.info("[pipeline] step 6 — document categorisation + naming (doc %d)", document_id)

    ai_category = provider.categorize_document(raw_text)
    doc.ai_category = ai_category

    # Generate a descriptive name from the document content.
    # Store the user-supplied name in original_filename (if not already set)
    # then overwrite filename with the AI-generated descriptive name.
    try:
        ai_name = provider.generate_document_name(raw_text)
        if ai_name and ai_name != "Untitled Document":
            # Preserve the extension from the original filename
            import os as _os
            _, ext = _os.path.splitext(doc.filename)
            # Only save original_filename once — don't overwrite if already set
            if not doc.original_filename:
                doc.original_filename = doc.filename
            doc.filename = ai_name + ext
            logger.info(
                "[pipeline] renamed doc %d: '%s' → '%s'",
                document_id, doc.original_filename, doc.filename,
            )
    except Exception as name_exc:
        logger.warning("[pipeline] name generation failed for doc %d: %s", document_id, name_exc)

    logger.info("[pipeline] step 6 complete — category: %s", ai_category)

    # ------------------------------------------------------------------
    # Step 7 — Heat-score computation
    # ------------------------------------------------------------------
    logger.info("[pipeline] step 7 — heat score computation (doc %d)", document_id)

    _recompute_heat_scores(db)

    logger.info("[pipeline] step 7 complete")

    # ------------------------------------------------------------------
    # Step 8 — Full graph re-score with user weight hints
    # ------------------------------------------------------------------
    logger.info("[pipeline] step 8 — full graph re-score (doc %d)", document_id)

    _rescore_graph(db, provider)

    logger.info("[pipeline] step 8 complete")

    # ------------------------------------------------------------------
    # Step 9 — Mark document processed
    # ------------------------------------------------------------------
    logger.info("[pipeline] step 9 — marking document %d processed", document_id)

    doc.processed_at = datetime.now(timezone.utc)
    db.commit()

    logger.info("[pipeline] finished for document %d", document_id)


# ---------------------------------------------------------------------------
# Relationship upsert helper
# ---------------------------------------------------------------------------


def _upsert_relationship(db: Session, id_a: int, id_b: int, new_weight: float) -> Relationship:
    """Insert or average-update a relationship between two entity IDs."""
    existing = (
        db.query(Relationship)
        .filter(
            (
                (Relationship.entity_a_id == id_a) & (Relationship.entity_b_id == id_b)
            ) | (
                (Relationship.entity_a_id == id_b) & (Relationship.entity_b_id == id_a)
            )
        )
        .first()
    )
    if existing is None:
        rel = Relationship(entity_a_id=id_a, entity_b_id=id_b, base_weight=new_weight)
        db.add(rel)
        db.flush()
        return rel
    else:
        existing.base_weight = (existing.base_weight + new_weight) / 2.0
        return existing


# ---------------------------------------------------------------------------
# Heat-score computation
# ---------------------------------------------------------------------------


def _recompute_heat_scores(db: Session) -> None:
    """Recompute heat_score for every relationship in the DB.

    heat_score = 0.5 * recency_score + 0.5 * frequency_score

    recency_score  — age of the most recent document that mentions both
                     entity_a AND entity_b, normalised to [0, 1] across the
                     full document corpus date range.
    frequency_score — count of documents that mention both entities,
                      normalised against the maximum such count across all
                      relationships.
    """
    all_relationships: list[Relationship] = db.query(Relationship).all()
    if not all_relationships:
        return

    # Corpus date range (all documents)
    all_docs: list[Document] = db.query(Document).all()
    if not all_docs:
        return

    doc_dates = [d.created_at for d in all_docs if d.created_at is not None]
    if not doc_dates:
        return

    min_date = min(doc_dates)
    max_date = max(doc_dates)
    date_range_secs = (max_date - min_date).total_seconds()

    # For each relationship, gather (recency, frequency) raw values
    rel_data: list[tuple[Relationship, float, int]] = []  # (rel, latest_secs_offset, doc_count)

    for rel in all_relationships:
        # Documents that mention entity_a
        docs_a = set(
            row.document_id
            for row in db.query(EntityDocumentMention)
            .filter(EntityDocumentMention.entity_id == rel.entity_a_id)
            .all()
        )
        # Documents that mention entity_b
        docs_b = set(
            row.document_id
            for row in db.query(EntityDocumentMention)
            .filter(EntityDocumentMention.entity_id == rel.entity_b_id)
            .all()
        )
        common_doc_ids = docs_a & docs_b
        doc_count = len(common_doc_ids)

        if doc_count == 0:
            rel_data.append((rel, 0.0, 0))
            continue

        # Most recent document among shared docs
        common_docs = [d for d in all_docs if d.id in common_doc_ids and d.created_at is not None]
        if not common_docs:
            rel_data.append((rel, 0.0, 0))
            continue

        latest_date = max(d.created_at for d in common_docs)
        latest_offset = (latest_date - min_date).total_seconds()
        rel_data.append((rel, latest_offset, doc_count))

    # Normalise frequency against max co-occurrence count
    max_doc_count = max((d for _, _, d in rel_data), default=1)
    if max_doc_count == 0:
        max_doc_count = 1

    for rel, latest_offset, doc_count in rel_data:
        if date_range_secs > 0:
            recency_score = latest_offset / date_range_secs
        else:
            recency_score = 1.0  # only one distinct date in corpus

        frequency_score = doc_count / max_doc_count

        rel.heat_score = 0.5 * recency_score + 0.5 * frequency_score


# ---------------------------------------------------------------------------
# Full graph re-score
# ---------------------------------------------------------------------------


def _rescore_graph(db: Session, provider) -> None:  # noqa: ANN001
    """Apply user weight hints then call provider.rescore_graph()."""
    all_relationships: list[Relationship] = db.query(Relationship).all()
    if not all_relationships:
        return

    # Collect all qualitative hints (across all users, all relationships)
    qualitative_hints: list[str] = []
    all_hints: list[UserWeightHint] = db.query(UserWeightHint).all()

    # Build a lookup: relationship_id → list[UserWeightHint]
    hints_by_rel: dict[int, list[UserWeightHint]] = {}
    for hint in all_hints:
        hints_by_rel.setdefault(hint.relationship_id, []).append(hint)
        if hint.qualitative_hint:
            rel = db.get(Relationship, hint.relationship_id)
            if rel is not None and rel.entity_a is not None and rel.entity_b is not None:
                qualitative_hints.append(
                    f"The relationship between {rel.entity_a.canonical_name} "
                    f"and {rel.entity_b.canonical_name}: {hint.qualitative_hint}"
                )

    # Build graph snapshot with numeric hint_weight pre-applied to base_weight
    snapshot_rels = []
    for rel in all_relationships:
        if rel.entity_a is None or rel.entity_b is None:
            continue
        effective_weight = rel.base_weight
        for hint in hints_by_rel.get(rel.id, []):
            if hint.hint_weight is not None:
                effective_weight = max(0.0, min(1.0, effective_weight * hint.hint_weight))
        snapshot_rels.append(
            {
                "entity_a_canonical_name": rel.entity_a.canonical_name,
                "entity_b_canonical_name": rel.entity_b.canonical_name,
                "base_weight": effective_weight,
            }
        )

    graph_snapshot = {"relationships": snapshot_rels}

    result = provider.rescore_graph(graph_snapshot, qualitative_hints)

    # Apply updated weights back to the DB
    # Build a lookup: (canonical_a, canonical_b) → Relationship (both directions)
    rel_lookup: dict[tuple[str, str], Relationship] = {}
    for rel in all_relationships:
        if rel.entity_a is None or rel.entity_b is None:
            continue
        key_fwd = (rel.entity_a.canonical_name, rel.entity_b.canonical_name)
        key_rev = (rel.entity_b.canonical_name, rel.entity_a.canonical_name)
        rel_lookup[key_fwd] = rel
        rel_lookup[key_rev] = rel

    for updated in result.updated_relationships:
        key = (updated.entity_a_canonical_name, updated.entity_b_canonical_name)
        rel = rel_lookup.get(key)
        if rel is not None:
            rel.base_weight = max(0.0, min(1.0, updated.new_base_weight))
        else:
            logger.debug(
                "[pipeline] rescore_graph returned unknown relationship ('%s', '%s') — skipping",
                updated.entity_a_canonical_name,
                updated.entity_b_canonical_name,
            )
