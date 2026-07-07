"""Document router — upload, list, and detail endpoints."""

import logging
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, HTTPException, UploadFile
from sqlalchemy.orm import Session
from fastapi import Depends

from db.session import get_db
from models.models import Document
from models.schemas import DocumentDetailSchema, DocumentSchema
from routers.deps import CurrentUser
from services.extractor import extract_text
from services.pipeline import run_pipeline

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/documents", tags=["documents"])


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
