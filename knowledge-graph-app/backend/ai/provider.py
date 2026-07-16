"""
Abstract base class for all AI provider implementations.

Every method must be implemented by a concrete provider. Callers should
obtain a provider instance through ai.factory.get_ai_provider() and only
interact with this interface.
"""
from __future__ import annotations

from abc import ABC, abstractmethod

from ai.schemas import (
    ActionItemCandidate,
    EntityExtractionResult,
    ExtractedEntity,
    GraphScoreResult,
    RelationshipCandidate,
)


class AIProvider(ABC):
    """Provider-agnostic interface for all LLM operations."""

    @abstractmethod
    def extract_entities(self, text: str) -> EntityExtractionResult:
        """
        Extract all named entities from *text*.

        Returns an EntityExtractionResult whose ``entities`` list contains
        every person, idea, project, keyword, organization, location, and
        date mentioned in the text.
        """

    @abstractmethod
    def extract_action_items(
        self,
        text: str,
        known_entities: list[ExtractedEntity],
    ) -> list[ActionItemCandidate]:
        """
        Extract action items from *text*, linking them to *known_entities*
        by canonical name where possible.
        """

    @abstractmethod
    def infer_relationships(
        self,
        entities: list[ExtractedEntity],
        text: str,
    ) -> list[RelationshipCandidate]:
        """
        Infer relationships between *entities* based on the source *text*.

        Returns a list of RelationshipCandidate objects, each with a
        base_weight in the range [0.0, 1.0].
        """

    @abstractmethod
    def score_sentiment(self, entity_canonical_name: str, context: str) -> float:
        """
        Score the sentiment toward *entity_canonical_name* given *context*.

        Returns a float in [-1.0, 1.0]:
          -1.0 = strongly negative
           0.0 = neutral
          +1.0 = strongly positive
        """

    @abstractmethod
    def categorize_document(self, text: str) -> str:
        """
        Assign a short category label to a document given its *text*.

        Example return values: "meeting notes", "project proposal", "email".
        """

    @abstractmethod
    def generate_document_name(self, text: str) -> str:
        """
        Generate a concise, descriptive filename (without extension) for a
        document based on its content.

        The name should:
          - Be 3–8 words maximum, title-cased
          - Capture the subject/topic of the document
          - Be suitable as an actual filename (no special characters)
          - Examples: "Q3 Budget Review Meeting", "Project Apollo Kickoff",
            "Alice Smith Onboarding Plan", "Weekly Status Update 2024-07"
        """

    @abstractmethod
    def rescore_graph(
        self,
        graph_snapshot: dict,
        user_hints: list,
    ) -> GraphScoreResult:
        """
        Re-score all relationship weights in *graph_snapshot* taking
        *user_hints* into account.

        *graph_snapshot* already has numeric ``hint_weight`` multipliers
        pre-applied to each relationship's ``base_weight``.  Qualitative
        hints are passed in *user_hints* as natural-language strings so the
        model can incorporate them as prompt context.

        Returns a GraphScoreResult with updated base_weight values for every
        relationship in the snapshot.
        """
