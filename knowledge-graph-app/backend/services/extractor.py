"""Text extraction service.

Accepts a filename and raw bytes, returns a clean UTF-8 string.
Supported formats: .txt, .md (UTF-8 decode), .docx (python-docx), .pdf (pypdf).
Any other extension is attempted as UTF-8; raises ValueError on failure.
"""

import io
from pathlib import Path


def extract_text(filename: str, data: bytes) -> str:
    """Return plain text extracted from *data* based on *filename* extension.

    Args:
        filename: Original filename (used to detect format via extension).
        data: Raw file bytes.

    Returns:
        A clean UTF-8 string.

    Raises:
        ValueError: If the file type is unsupported and cannot be decoded as UTF-8.
    """
    suffix = Path(filename).suffix.lower()

    if suffix in (".txt", ".md"):
        return data.decode("utf-8")

    if suffix == ".docx":
        import docx  # python-docx

        doc = docx.Document(io.BytesIO(data))
        return "\n".join(para.text for para in doc.paragraphs)

    if suffix == ".pdf":
        from pypdf import PdfReader

        reader = PdfReader(io.BytesIO(data))
        pages = [page.extract_text() or "" for page in reader.pages]
        return "\n".join(pages)

    # Fallback: attempt UTF-8 decode for unknown types.
    try:
        return data.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise ValueError(
            f"Unsupported file type '{suffix}' and content is not valid UTF-8."
        ) from exc
