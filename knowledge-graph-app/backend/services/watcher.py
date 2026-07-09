"""Watcher service — scans filesystem paths and GitHub repositories for new files.

Each WatchSource is scanned independently.  When a new file is found it is
inserted into watched_files with status=pending so the user can approve or
reject it from the UI.  Files that have already been seen (by file_key) are
skipped silently.

Supported source types:
  filesystem  — walks the given fs_path with fnmatch glob filtering.
  github      — uses the GitHub REST API (no git clone required) to list
                tree entries under the configured path.

This module is intentionally side-effect free with respect to the AI pipeline;
it only creates WatchedFile rows.  The approval endpoint in the router drives
actual ingestion.
"""

from __future__ import annotations

import fnmatch
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import TYPE_CHECKING

import requests
from sqlalchemy.orm import Session

from models.models import WatchSource, WatchSourceType, WatchedFile, WatchedFileStatus

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)

# File extensions we are willing to ingest.
SUPPORTED_EXTENSIONS = {
    ".txt", ".md", ".pdf", ".docx", ".doc",
    ".eml", ".msg", ".pst", ".csv", ".rtf",
}


# ---------------------------------------------------------------------------
# Public entry-point
# ---------------------------------------------------------------------------


def scan_source(source: WatchSource, db: Session) -> dict:
    """
    Scan one WatchSource and insert newly-discovered files as WatchedFile rows.

    Returns a dict: {"new_files_found": int, "already_known": int, "errors": list[str]}
    """
    if source.source_type == WatchSourceType.filesystem:
        result = _scan_filesystem(source, db)
    elif source.source_type == WatchSourceType.github:
        result = _scan_github(source, db)
    else:
        result = {"new_files_found": 0, "already_known": 0, "errors": [f"Unknown source type: {source.source_type}"]}

    # Update last_scanned_at regardless of success/failure
    source.last_scanned_at = datetime.utcnow()
    db.commit()

    return result


# ---------------------------------------------------------------------------
# Filesystem scanner
# ---------------------------------------------------------------------------


def _scan_filesystem(source: WatchSource, db: Session) -> dict:
    errors: list[str] = []
    new_count = 0
    known_count = 0

    root = source.fs_path
    if not root or not os.path.isdir(root):
        return {
            "new_files_found": 0,
            "already_known": 0,
            "errors": [f"Path does not exist or is not a directory: {root}"],
        }

    glob_pattern = source.file_glob or "**/*"

    try:
        all_paths = list(Path(root).rglob("*"))
    except Exception as exc:
        return {"new_files_found": 0, "already_known": 0, "errors": [str(exc)]}

    for fpath in all_paths:
        if not fpath.is_file():
            continue
        if fpath.suffix.lower() not in SUPPORTED_EXTENSIONS:
            continue
        # Apply glob filter (match against the relative path string)
        rel = fpath.relative_to(root).as_posix()
        if not fnmatch.fnmatch(rel, glob_pattern) and not fnmatch.fnmatch(fpath.name, glob_pattern):
            # Also allow simple extension globs like "*.pdf"
            if not fnmatch.fnmatch(fpath.name, glob_pattern.lstrip("**/").lstrip("/")):
                continue

        file_key = str(fpath.resolve())
        existing = (
            db.query(WatchedFile)
            .filter(
                WatchedFile.source_id == source.id,
                WatchedFile.file_key == file_key,
            )
            .first()
        )
        if existing:
            known_count += 1
            continue

        try:
            size = fpath.stat().st_size
        except OSError:
            size = None

        wf = WatchedFile(
            source_id=source.id,
            file_key=file_key,
            filename=fpath.name,
            relative_path=rel,
            file_size_bytes=size,
            status=WatchedFileStatus.pending,
        )
        db.add(wf)
        new_count += 1

    try:
        db.flush()
    except Exception as exc:
        errors.append(f"DB flush error: {exc}")

    return {"new_files_found": new_count, "already_known": known_count, "errors": errors}


# ---------------------------------------------------------------------------
# GitHub scanner
# ---------------------------------------------------------------------------

GITHUB_API = "https://api.github.com"


def _scan_github(source: WatchSource, db: Session) -> dict:
    errors: list[str] = []
    new_count = 0
    known_count = 0

    repo = source.github_repo
    branch = source.github_branch or "main"
    sub_path = (source.github_path or "").strip("/")

    if not repo:
        return {"new_files_found": 0, "already_known": 0, "errors": ["github_repo is not set"]}

    headers: dict[str, str] = {"Accept": "application/vnd.github+json"}
    if source.github_token:
        headers["Authorization"] = f"Bearer {source.github_token}"

    # Get the tree (recursive) for the branch
    tree_url = f"{GITHUB_API}/repos/{repo}/git/trees/{branch}?recursive=1"
    try:
        resp = requests.get(tree_url, headers=headers, timeout=20)
        resp.raise_for_status()
        tree_data = resp.json()
    except Exception as exc:
        return {"new_files_found": 0, "already_known": 0, "errors": [f"GitHub API error: {exc}"]}

    if tree_data.get("truncated"):
        errors.append("GitHub tree response was truncated — large repos may have missing files.")

    for item in tree_data.get("tree", []):
        if item.get("type") != "blob":
            continue
        item_path: str = item.get("path", "")
        # Filter by sub-directory if configured
        if sub_path and not item_path.startswith(sub_path + "/") and item_path != sub_path:
            continue

        filename = item_path.split("/")[-1]
        ext = os.path.splitext(filename)[1].lower()
        if ext not in SUPPORTED_EXTENSIONS:
            continue

        # file_key = SHA of the blob (stable identifier across re-scans)
        file_key = item.get("sha", item_path)

        existing = (
            db.query(WatchedFile)
            .filter(
                WatchedFile.source_id == source.id,
                WatchedFile.file_key == file_key,
            )
            .first()
        )
        if existing:
            known_count += 1
            continue

        wf = WatchedFile(
            source_id=source.id,
            file_key=file_key,
            filename=filename,
            relative_path=item_path,
            file_size_bytes=item.get("size"),
            status=WatchedFileStatus.pending,
        )
        db.add(wf)
        new_count += 1

    try:
        db.flush()
    except Exception as exc:
        errors.append(f"DB flush error: {exc}")

    return {"new_files_found": new_count, "already_known": known_count, "errors": errors}
