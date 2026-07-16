"""Document router — upload, check-duplicate, list, detail, and delete endpoints."""

import logging
from pathlib import Path
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile
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
)
from models.schemas import DocumentDetailSchema, DocumentSchema
from routers.deps import CurrentUser
from services.extractor import extract_text
from services.pipeline import run_pipeline
from services.similarity import compute_fingerprint, fingerprint_to_json, find_duplicates

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/documents", tags=["documents"])


# ---------------------------------------------------------------------------
# Duplicate check schemas
# ---------------------------------------------------------------------------


class DuplicateMatch(BaseModel):
    document_id: int
    filename: str
    similarity: float  # 0.0–1.0


class DuplicateCheckResponse(BaseModel):
    has_duplicates: bool
    matches: list[DuplicateMatch]


# ---------------------------------------------------------------------------
# Duplicate check endpoint
# ---------------------------------------------------------------------------


@router.post("/check-duplicate", response_model=DuplicateCheckResponse)
async def check_duplicate(
    file: UploadFile,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
    threshold: float = 0.90,
) -> DuplicateCheckResponse:
    """
    Check whether an uploaded file is highly similar to any existing document.

    The file is NOT stored — this is a read-only pre-upload check.
    Returns a list of existing documents whose similarity to the candidate
    meets or exceeds *threshold* (default 0.90 = 90%).
    """
    data = await file.read()
    filename = file.filename or "upload"

    try:
        candidate_text = extract_text(filename, data)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    # Load only the lightweight columns needed for duplicate detection.
    # raw_text is fetched only for legacy rows that lack a stored fingerprint.
    existing = db.query(
        Document.id,
        Document.filename,
        Document.raw_text,
        Document.fingerprint,
    ).all()
    existing_tuples = [
        (row.id, row.filename, row.raw_text, row.fingerprint)
        for row in existing
    ]

    matches = find_duplicates(candidate_text, existing_tuples, threshold=threshold)

    return DuplicateCheckResponse(
        has_duplicates=len(matches) > 0,
        matches=[DuplicateMatch(**m) for m in matches],
    )


# ---------------------------------------------------------------------------
# Upload endpoint
# ---------------------------------------------------------------------------


@router.post("/upload", response_model=DocumentSchema, status_code=201)
async def upload_document(
    file: UploadFile,
    background_tasks: BackgroundTasks,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
) -> DocumentSchema:
    """Accept a multipart file upload, extract text, persist, and queue pipeline."""
    data = await file.read()
    filename = file.filename or "upload"
    file_type = Path(filename).suffix.lower().lstrip(".") or "unknown"

    try:
        raw_text = extract_text(filename, data)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    doc = Document(
        uploader_user_id=current_user["id"],
        filename=filename,
        raw_text=raw_text,
        file_type=file_type,
        processed_at=None,
        fingerprint=fingerprint_to_json(compute_fingerprint(raw_text)),
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    background_tasks.add_task(run_pipeline, doc.id, db)

    return DocumentSchema.model_validate(doc)


@router.get("", response_model=list[DocumentSchema])
def list_documents(
    current_user: CurrentUser,
    db: Session = Depends(get_db),
) -> list[DocumentSchema]:
    """Return all documents uploaded by the current user."""
    docs = (
        db.query(Document)
        .filter(Document.uploader_user_id == current_user["id"])
        .order_by(Document.created_at.desc())
        .all()
    )
    return [DocumentSchema.model_validate(d) for d in docs]


@router.get("/{doc_id}", response_model=DocumentDetailSchema)
def get_document(
    doc_id: int,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
) -> DocumentDetailSchema:
    """Return document metadata and raw text; 404 if not found or not owned by caller."""
    doc = (
        db.query(Document)
        .filter(Document.id == doc_id, Document.uploader_user_id == current_user["id"])
        .first()
    )
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found.")
    return DocumentDetailSchema.model_validate(doc)


@router.delete("/{doc_id}", status_code=204, response_model=None)
def delete_document(
    doc_id: int,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
) -> None:
    """
    Delete a document and clean up all data derived from it.

    Cascade order:
      1. Delete action items belonging to the document.
      2. Delete entity_document_mentions for the document.
      3. Delete entities that are now mentioned in NO other document
         (orphan entities), along with their relationships and node_display rows.
      4. Delete the document itself.
    """
    doc = (
        db.query(Document)
        .filter(Document.id == doc_id, Document.uploader_user_id == current_user["id"])
        .first()
    )
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found.")

    # 1 — Remove action items
    db.query(ActionItem).filter(ActionItem.document_id == doc_id).delete(
        synchronize_session=False
    )

    # 2 — Collect entities mentioned in this document before we remove mentions
    mentioned_entity_ids = [
        row.entity_id
        for row in db.query(EntityDocumentMention.entity_id)
        .filter(EntityDocumentMention.document_id == doc_id)
        .all()
    ]

    # Remove mentions for this document
    db.query(EntityDocumentMention).filter(
        EntityDocumentMention.document_id == doc_id
    ).delete(synchronize_session=False)

    # 3 — Find orphan entities (no remaining mentions in any other document)
    orphan_ids = [
        eid
        for eid in mentioned_entity_ids
        if db.query(EntityDocumentMention)
        .filter(EntityDocumentMention.entity_id == eid)
        .count()
        == 0
    ]

    if orphan_ids:
        # Remove node_display cache rows for orphans
        db.query(NodeDisplay).filter(NodeDisplay.entity_id.in_(orphan_ids)).delete(
            synchronize_session=False
        )
        # Remove relationships where either endpoint is an orphan
        db.query(Relationship).filter(
            Relationship.entity_a_id.in_(orphan_ids)
            | Relationship.entity_b_id.in_(orphan_ids)
        ).delete(synchronize_session=False)
        # Remove the orphan entities themselves
        db.query(Entity).filter(Entity.id.in_(orphan_ids)).delete(
            synchronize_session=False
        )

    # 4 — Remove the document
    db.delete(doc)
    db.commit()

    logger.info(
        "Deleted document %d (%s); removed %d orphan entities.",
        doc_id,
        doc.filename,
        len(orphan_ids),
    )
