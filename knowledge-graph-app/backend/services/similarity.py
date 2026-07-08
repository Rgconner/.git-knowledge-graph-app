"""
Document similarity service.

Uses difflib.SequenceMatcher to compute a similarity ratio between two texts.
SequenceMatcher is available in the Python stdlib — no extra dependencies.

The ratio is computed on a normalised, whitespace-collapsed version of each
text so that minor formatting differences (extra spaces, different line
endings) do not artificially lower the score.
"""
from __future__ import annotations

import re
from difflib import SequenceMatcher


def _normalise(text: str) -> str:
    """Collapse all whitespace to single spaces and lowercase for comparison."""
    return re.sub(r"\s+", " ", text).strip().lower()


def similarity_ratio(a: str, b: str) -> float:
    """
    Return a similarity ratio in [0.0, 1.0] between two text strings.

    Uses SequenceMatcher with autojunk=False so short documents are not
    penalised by the junk heuristic.

    1.0 = identical, 0.0 = completely different.
    """
    na, nb = _normalise(a), _normalise(b)
    if not na and not nb:
        return 1.0
    if not na or not nb:
        return 0.0
    return SequenceMatcher(None, na, nb, autojunk=False).ratio()


def find_duplicates(
    candidate_text: str,
    existing_docs: list[tuple[int, str, str]],
    threshold: float = 0.90,
) -> list[dict]:
    """
    Compare *candidate_text* against a list of existing documents.

    Args:
        candidate_text: Raw text of the file being uploaded.
        existing_docs:  List of (document_id, filename, raw_text) tuples.
        threshold:      Minimum ratio to consider a duplicate (default 0.90).

    Returns:
        List of dicts sorted by similarity descending, each with keys:
            document_id, filename, similarity  (float, 0.0–1.0)
        Only documents at or above *threshold* are included.
    """
    results = []
    for doc_id, filename, raw_text in existing_docs:
        ratio = similarity_ratio(candidate_text, raw_text)
        if ratio >= threshold:
            results.append(
                {
                    "document_id": doc_id,
                    "filename": filename,
                    "similarity": round(ratio, 4),
                }
            )
    results.sort(key=lambda x: x["similarity"], reverse=True)
    return results
