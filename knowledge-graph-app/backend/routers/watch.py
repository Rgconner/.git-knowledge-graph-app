"""Watch router — manage file-watch sources and the approval/rejection inbox.

Endpoints
---------
POST   /watch/sources              Create a new WatchSource
GET    /watch/sources              List the caller's WatchSources
GET    /watch/sources/{id}         Get one source
PATCH  /watch/sources/{id}         Update source config
DELETE /watch/sources/{id}         Delete source (cascades to watched files)
POST   /watch/sources/{id}/scan    Trigger an immediate scan
GET    /watch/files                List WatchedFiles (filterable by source/status)
PATCH  /watch/files/{id}/review    Approve or reject a discovered file
POST   /watch/files/{id}/reingest  Re-approve a previously rejected/failed file
"""

from __future__ import annotations

import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Optional

import requests
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from db.session import get_db
from models.models import (
    Document,
    WatchSource,
    WatchedFile,
    WatchedFileStatus,
)
from models.schemas import (
    ScanResultSchema,
    WatchedFileReview,
    WatchedFileSchema,
    WatchSourceCreate,
    WatchSourceSchema,
    WatchSourceUpdate,
)
from routers.deps import CurrentUser
from services.extractor import extract_text
from services.pipeline import run_pipeline
from services.similarity import compute_fingerprint, fingerprint_to_json
from services.watcher import scan_source

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/watch", tags=["watch"])

GITHUB_API = "https://api.github.com"


# ---------------------------------------------------------------------------
# Helper — owner guard
# ---------------------------------------------------------------------------


def _get_source_or_404(source_id: int, user_id: int, db: Session) -> WatchSource:
    src = (
        db.query(WatchSource)
        .filter(WatchSource.id == source_id, WatchSource.owner_user_id == user_id)
        .first()
    )
    if src is None:
        raise HTTPException(status_code=404, detail="Watch source not found.")
    return src


# ---------------------------------------------------------------------------
# Watch Source CRUD
# ---------------------------------------------------------------------------


@router.post("/sources", response_model=WatchSourceSchema, status_code=201)
def create_source(
    body: WatchSourceCreate,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
) -> WatchSourceSchema:
    """Create a new watch source (filesystem path or GitHub repo)."""
    src = WatchSource(
        owner_user_id=current_user["id"],
        name=body.name,
        source_type=body.source_type,
        fs_path=body.fs_path,
        file_glob=body.file_glob or "**/*",
        github_repo=body.github_repo,
        github_branch=body.github_branch or "main",
        github_path=body.github_path or "",
        github_token=body.github_token,
        enabled=1 if body.enabled else 0,
    )
    db.add(src)
    db.commit()
    db.refresh(src)
    logger.info("Created watch source %d (%s) for user %d", src.id, src.name, current_user["id"])
    return WatchSourceSchema.model_validate(src)


@router.get("/sources", response_model=list[WatchSourceSchema])
def list_sources(
    current_user: CurrentUser,
    db: Session = Depends(get_db),
) -> list[WatchSourceSchema]:
    sources = (
        db.query(WatchSource)
        .filter(WatchSource.owner_user_id == current_user["id"])
        .order_by(WatchSource.created_at.desc())
        .all()
    )
    return [WatchSourceSchema.model_validate(s) for s in sources]


@router.get("/sources/{source_id}", response_model=WatchSourceSchema)
def get_source(
    source_id: int,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
) -> WatchSourceSchema:
    src = _get_source_or_404(source_id, current_user["id"], db)
    return WatchSourceSchema.model_validate(src)


@router.patch("/sources/{source_id}", response_model=WatchSourceSchema)
def update_source(
    source_id: int,
    body: WatchSourceUpdate,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
) -> WatchSourceSchema:
    src = _get_source_or_404(source_id, current_user["id"], db)
    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "enabled":
            setattr(src, field, 1 if value else 0)
        else:
            setattr(src, field, value)
    db.commit()
    db.refresh(src)
    return WatchSourceSchema.model_validate(src)


@router.delete("/sources/{source_id}", status_code=204, response_model=None)
def delete_source(
    source_id: int,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
) -> None:
    src = _get_source_or_404(source_id, current_user["id"], db)
    db.delete(src)   # cascade deletes watched_files via ORM relationship
    db.commit()
    logger.info("Deleted watch source %d", source_id)


# ---------------------------------------------------------------------------
# Scan trigger
# ---------------------------------------------------------------------------


@router.post("/sources/{source_id}/scan", response_model=ScanResultSchema)
def trigger_scan(
    source_id: int,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
) -> ScanResultSchema:
    """Immediately scan a source for new files and populate the pending inbox."""
    src = _get_source_or_404(source_id, current_user["id"], db)
    result = scan_source(src, db)
    return ScanResultSchema(
        source_id=source_id,
        new_files_found=result["new_files_found"],
        already_known=result["already_known"],
        errors=result["errors"],
    )


# ---------------------------------------------------------------------------
# Watched Files — listing
# ---------------------------------------------------------------------------


@router.get("/files", response_model=list[WatchedFileSchema])
def list_watched_files(
    current_user: CurrentUser,
    db: Session = Depends(get_db),
    source_id: Optional[int] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
) -> list[WatchedFileSchema]:
    """
    List watched files belonging to the current user's sources.

    Query params:
      source_id  — filter to a specific source
      status     — filter by status (pending | approved | rejected | ingesting | failed)
    """
    # Get the user's source IDs
    user_source_ids = [
        row.id
        for row in db.query(WatchSource.id)
        .filter(WatchSource.owner_user_id == current_user["id"])
        .all()
    ]
    if not user_source_ids:
        return []

    q = db.query(WatchedFile).filter(WatchedFile.source_id.in_(user_source_ids))

    if source_id is not None:
        if source_id not in user_source_ids:
            raise HTTPException(status_code=404, detail="Watch source not found.")
        q = q.filter(WatchedFile.source_id == source_id)

    if status_filter:
        try:
            s = WatchedFileStatus(status_filter)
        except ValueError:
            raise HTTPException(status_code=422, detail=f"Invalid status: {status_filter}")
        q = q.filter(WatchedFile.status == s)

    files = q.order_by(WatchedFile.discovered_at.desc()).all()
    return [WatchedFileSchema.model_validate(f) for f in files]


# ---------------------------------------------------------------------------
# Review endpoint — approve or reject
# ---------------------------------------------------------------------------


def _ingest_watched_file(wf_id: int, db: Session) -> None:
    """
    Background task: read the file bytes, run the AI pipeline, update status.

    For filesystem sources: read the file from disk.
    For GitHub sources: download the raw blob via the GitHub API.
    """
    wf = db.query(WatchedFile).filter(WatchedFile.id == wf_id).first()
    if wf is None:
        return

    source = db.query(WatchSource).filter(WatchSource.id == wf.source_id).first()
    if source is None:
        return

    wf.status = WatchedFileStatus.ingesting
    db.commit()

    try:
        raw_bytes: bytes

        if source.source_type.value == "filesystem":
            raw_bytes = Path(wf.file_key).read_bytes()

        elif source.source_type.value == "github":
            repo = source.github_repo
            blob_sha = wf.file_key
            headers: dict[str, str] = {
                "Accept": "application/vnd.github.raw+json",
            }
            if source.github_token:
                headers["Authorization"] = f"Bearer {source.github_token}"
            url = f"{GITHUB_API}/repos/{repo}/git/blobs/{blob_sha}"
            resp = requests.get(url, headers=headers, timeout=30)
            resp.raise_for_status()
            raw_bytes = resp.content
        else:
            raise ValueError(f"Unsupported source type: {source.source_type}")

        raw_text = extract_text(wf.filename, raw_bytes)
        file_type = Path(wf.filename).suffix.lower().lstrip(".") or "unknown"

        # Create the Document record (with fingerprint for fast duplicate checks)
        doc = Document(
            uploader_user_id=source.owner_user_id,
            filename=wf.filename,
            raw_text=raw_text,
            file_type=file_type,
            processed_at=None,
            fingerprint=fingerprint_to_json(compute_fingerprint(raw_text)),
        )
        db.add(doc)
        db.flush()  # get doc.id

        # Link the watched file to the document
        wf.document_id = doc.id
        wf.status = WatchedFileStatus.approved
        wf.reviewed_at = datetime.utcnow()
        db.commit()
        db.refresh(doc)

        # Run AI pipeline synchronously (already in background task)
        run_pipeline(doc.id, db)

    except Exception as exc:
        logger.error("Failed to ingest watched file %d: %s", wf_id, exc)
        wf = db.query(WatchedFile).filter(WatchedFile.id == wf_id).first()
        if wf:
            wf.status = WatchedFileStatus.failed
            wf.review_note = (wf.review_note or "") + f"\n[ingest error] {exc}"
            db.commit()


@router.patch("/files/{file_id}/review", response_model=WatchedFileSchema)
def review_file(
    file_id: int,
    body: WatchedFileReview,
    current_user: CurrentUser,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> WatchedFileSchema:
    """
    Approve or reject a pending (or previously reviewed) watched file.

    - **approved**: the file will be downloaded/read and ingested into the
      knowledge graph as a Document.  Ingestion runs in the background.
    - **rejected**: the file is marked rejected and will not be ingested.
      The decision is stored and can be reversed by calling this endpoint
      again with status=approved.
    """
    # Guard: file must belong to a source owned by this user
    user_source_ids = [
        row.id
        for row in db.query(WatchSource.id)
        .filter(WatchSource.owner_user_id == current_user["id"])
        .all()
    ]
    wf = (
        db.query(WatchedFile)
        .filter(
            WatchedFile.id == file_id,
            WatchedFile.source_id.in_(user_source_ids),
        )
        .first()
    )
    if wf is None:
        raise HTTPException(status_code=404, detail="Watched file not found.")

    if body.status == WatchedFileStatus.ingesting:
        raise HTTPException(
            status_code=422,
            detail="Cannot manually set status to 'ingesting'.",
        )

    # If re-approving a file that already has a document, skip re-ingestion
    if body.status == WatchedFileStatus.approved and wf.document_id is not None:
        wf.status = WatchedFileStatus.approved
        wf.review_note = body.review_note
        wf.reviewed_at = datetime.utcnow()
        db.commit()
        db.refresh(wf)
        return WatchedFileSchema.model_validate(wf)

    wf.status = body.status
    wf.review_note = body.review_note
    wf.reviewed_at = datetime.utcnow()
    db.commit()
    db.refresh(wf)

    if body.status == WatchedFileStatus.approved:
        background_tasks.add_task(_ingest_watched_file, wf.id, db)

    logger.info(
        "User %d reviewed watched file %d (%s) → %s",
        current_user["id"],
        wf.id,
        wf.filename,
        body.status.value,
    )
    return WatchedFileSchema.model_validate(wf)


@router.post("/files/{file_id}/reingest", response_model=WatchedFileSchema)
def reingest_file(
    file_id: int,
    current_user: CurrentUser,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> WatchedFileSchema:
    """Re-trigger ingestion for a failed or previously rejected file."""
    user_source_ids = [
        row.id
        for row in db.query(WatchSource.id)
        .filter(WatchSource.owner_user_id == current_user["id"])
        .all()
    ]
    wf = (
        db.query(WatchedFile)
        .filter(
            WatchedFile.id == file_id,
            WatchedFile.source_id.in_(user_source_ids),
        )
        .first()
    )
    if wf is None:
        raise HTTPException(status_code=404, detail="Watched file not found.")

    if wf.status not in (WatchedFileStatus.failed, WatchedFileStatus.rejected):
        raise HTTPException(
            status_code=422,
            detail=f"Can only re-ingest files with status 'failed' or 'rejected' (current: {wf.status.value}).",
        )

    # Clear any previously linked document so a fresh one is created
    wf.document_id = None
    wf.review_note = None
    wf.status = WatchedFileStatus.pending
    db.commit()
    db.refresh(wf)

    # Immediately approve
    wf.status = WatchedFileStatus.ingesting
    wf.reviewed_at = datetime.utcnow()
    db.commit()

    background_tasks.add_task(_ingest_watched_file, wf.id, db)
    db.refresh(wf)
    return WatchedFileSchema.model_validate(wf)
