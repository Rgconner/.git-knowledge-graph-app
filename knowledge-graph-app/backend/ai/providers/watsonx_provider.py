"""
IBM watsonx stub implementation of AIProvider.

Not yet implemented — all methods raise NotImplementedError.
Switch to this provider by setting AI_PROVIDER=watsonx.
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


class WatsonxProvider(AIProvider):
    """Stub AIProvider for IBM watsonx — not yet implemented."""

    def extract_entities(self, text: str) -> EntityExtractionResult:
        raise NotImplementedError("WatsonxProvider not yet implemented")

    def extract_action_items(
        self,
        text: str,
        known_entities: list[ExtractedEntity],
    ) -> list[ActionItemCandidate]:
        raise NotImplementedError("WatsonxProvider not yet implemented")

    def infer_relationships(
        self,
        entities: list[ExtractedEntity],
        text: str,
    ) -> list[RelationshipCandidate]:
        raise NotImplementedError("WatsonxProvider not yet implemented")

    def score_sentiment(self, entity_canonical_name: str, context: str) -> float:
        raise NotImplementedError("WatsonxProvider not yet implemented")

    def categorize_document(self, text: str) -> str:
        raise NotImplementedError("WatsonxProvider not yet implemented")

    def rescore_graph(
        self,
        graph_snapshot: dict,
        user_hints: list,
    ) -> GraphScoreResult:
        raise NotImplementedError("WatsonxProvider not yet implemented")
