"""
Anthropic stub implementation of AIProvider.

Not yet implemented — all methods raise NotImplementedError.
Switch to this provider by setting AI_PROVIDER=anthropic.
"""
from __future__ import annotations

from ai.provider import AIProvider
from ai.schemas import (
    ActionItemCandidate,
    EntityExtractionResult,
    ExtractedEntity,
    GraphScoreResult,
    RelationshipCandidate,
)


class AnthropicProvider(AIProvider):
    """Stub AIProvider for Anthropic Claude — not yet implemented."""

    def extract_entities(self, text: str) -> EntityExtractionResult:
        raise NotImplementedError("AnthropicProvider not yet implemented")

    def extract_action_items(
        self,
        text: str,
        known_entities: list[ExtractedEntity],
    ) -> list[ActionItemCandidate]:
        raise NotImplementedError("AnthropicProvider not yet implemented")

    def infer_relationships(
        self,
        entities: list[ExtractedEntity],
        text: str,
    ) -> list[RelationshipCandidate]:
        raise NotImplementedError("AnthropicProvider not yet implemented")

    def score_sentiment(self, entity_canonical_name: str, context: str) -> float:
        raise NotImplementedError("AnthropicProvider not yet implemented")

    def categorize_document(self, text: str) -> str:
        raise NotImplementedError("AnthropicProvider not yet implemented")

    def rescore_graph(
        self,
        graph_snapshot: dict,
        user_hints: list,
    ) -> GraphScoreResult:
        raise NotImplementedError("AnthropicProvider not yet implemented")
