"""Chat router — floating chat window backed by the configured AI provider.

POST /chat/message
    Accepts a conversation history and a new user message.
    Builds a context summary from the knowledge graph (entities,
    relationships, recent documents) and sends the full conversation
    to the LLM, returning a plain-text assistant response.

The endpoint is stateless — the client sends the full message history
on every request.  No chat sessions are stored server-side.
"""
from __future__ import annotations

import logging
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from db.session import get_db
from models.models import Document, Entity, EntityDocumentMention, Relationship
from routers.deps import CurrentUser
from ai.factory import get_ai_provider

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["chat"])

# ---------------------------------------------------------------------------
# Request / response schemas
# ---------------------------------------------------------------------------


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]   # full history including the new user message


class ChatResponse(BaseModel):
    reply: str


# ---------------------------------------------------------------------------
# Context builder
# ---------------------------------------------------------------------------


def _build_graph_context(db: Session, user_id: int) -> str:
    """
    Build a concise text summary of the knowledge graph to inject as
    system context for the chat LLM.

    Includes:
    - Document list (filename, category, upload date)
    - Top entities by type
    - Top relationships by base_weight
    """
    lines: list[str] = []

    # --- Documents ---
    docs = (
        db.query(Document)
        .order_by(Document.created_at.desc())
        .limit(30)
        .all()
    )
    if docs:
        lines.append("=== Uploaded Documents ===")
        for doc in docs:
            cat = doc.ai_category or "uncategorized"
            date = doc.created_at.strftime("%Y-%m-%d") if doc.created_at else "unknown date"
            lines.append(f"- {doc.filename} [{cat}] uploaded {date}")
        lines.append("")

    # --- Entities by type ---
    entities = db.query(Entity).all()
    by_type: dict[str, list[str]] = {}
    for e in entities:
        by_type.setdefault(e.type.value, []).append(e.canonical_name)

    if by_type:
        lines.append("=== Entities Extracted ===")
        for etype, names in sorted(by_type.items()):
            # Cap each type at 30 names to keep context size manageable
            sample = names[:30]
            lines.append(f"{etype.capitalize()}s: {', '.join(sample)}"
                         + (f" ... (+{len(names)-30} more)" if len(names) > 30 else ""))
        lines.append("")

    # --- Top relationships ---
    rels = (
        db.query(Relationship)
        .order_by(Relationship.base_weight.desc())
        .limit(40)
        .all()
    )
    if rels:
        # Build entity id→name map for the relationships we're showing
        entity_ids = {r.entity_a_id for r in rels} | {r.entity_b_id for r in rels}
        ent_map = {
            e.id: e.canonical_name
            for e in db.query(Entity).filter(Entity.id.in_(entity_ids)).all()
        }
        lines.append("=== Key Relationships (by strength) ===")
        for rel in rels:
            a = ent_map.get(rel.entity_a_id, f"entity#{rel.entity_a_id}")
            b = ent_map.get(rel.entity_b_id, f"entity#{rel.entity_b_id}")
            sentiment = ""
            if rel.sentiment_score > 0.2:
                sentiment = " [positive]"
            elif rel.sentiment_score < -0.2:
                sentiment = " [negative]"
            lines.append(
                f"- {a} ↔ {b}  "
                f"(strength: {rel.base_weight:.2f}, "
                f"heat: {rel.heat_score:.2f}{sentiment})"
            )
        lines.append("")

    if not lines:
        return "No documents or entities have been uploaded to the knowledge graph yet."

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------


@router.post("/message", response_model=ChatResponse)
def chat_message(
    body: ChatRequest,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
) -> ChatResponse:
    """
    Send a message to the AI with the knowledge graph as context.

    The client sends the full conversation history on every call.
    The server prepends a system prompt containing a summary of the
    current knowledge graph state so the AI can answer questions
    grounded in the uploaded documents.
    """
    if not body.messages:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="messages list cannot be empty.",
        )

    # Build graph context
    graph_context = _build_graph_context(db, current_user["id"])

    system_prompt = (
        "You are an intelligent assistant with access to a knowledge graph "
        "built from the user's uploaded documents. "
        "Use the graph context below to answer questions accurately and helpfully. "
        "If the answer cannot be found in the graph context, say so clearly — "
        "do not invent information. "
        "Respond in plain conversational text (not JSON). "
        "Be concise but thorough.\n\n"
        "KNOWLEDGE GRAPH CONTEXT:\n"
        f"{graph_context}"
    )

    try:
        provider = get_ai_provider()

        # Build messages list for the LLM: system + full history
        # Use the provider's internal OpenAI client directly for chat
        # (chat is free-form, not JSON-mode, so we call the client directly
        #  rather than going through _chat_json)
        messages = [{"role": "system", "content": system_prompt}]
        for msg in body.messages:
            messages.append({"role": msg.role, "content": msg.content})

        # All providers share _client and _model via OpenAIProvider base
        # Access the underlying OpenAI client directly
        client = getattr(provider, "_client", None)
        model = getattr(provider, "_model", None)
        max_tokens = getattr(provider, "_max_tokens", 8192)

        if client is None or model is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="AI provider is not configured or does not support chat.",
            )

        response = client.chat.completions.create(
            model=model,
            max_tokens=max_tokens,
            messages=messages,
        )

        reply = response.choices[0].message.content or ""
        return ChatResponse(reply=reply.strip())

    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Chat endpoint error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI chat failed: {exc}",
        ) from exc
