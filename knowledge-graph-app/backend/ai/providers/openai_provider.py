"""
OpenAI concrete implementation of AIProvider.

Configuration (via environment variables):
  AI_API_KEY    — OpenAI API key (required)
  OPENAI_MODEL  — model name to use (default: gpt-4o)

Every chat completion uses JSON mode so responses are always structured
JSON objects — no free-form prose parsing.
"""
from __future__ import annotations

import json
import os
from typing import Any

from openai import OpenAI

from ai.provider import AIProvider
from ai.schemas import (
    ActionItemCandidate,
    EntityExtractionResult,
    ExtractedEntity,
    GraphScoreResult,
    RelationshipCandidate,
    _UpdatedRelationship,
)

_VALID_ENTITY_TYPES = {
    "person",
    "idea",
    "project",
    "keyword",
    "organization",
    "location",
    "date",
}


class OpenAIProvider(AIProvider):
    """AIProvider backed by the OpenAI chat-completions API."""

    def __init__(self) -> None:
        api_key = os.environ.get("AI_API_KEY")
        if not api_key:
            raise RuntimeError(
                "AI_API_KEY environment variable is not set. "
                "Set it to your OpenAI API key before starting the server."
            )
        self._client = OpenAI(api_key=api_key)
        self._model = os.environ.get("OPENAI_MODEL", "gpt-4o")

    # ------------------------------------------------------------------
    # Internal helper
    # ------------------------------------------------------------------

    def _chat_json(self, system: str, user: str) -> Any:
        """
        Call the chat-completions API and return a parsed JSON object.

        Does NOT use response_format — many self-hosted servers only support
        "text" or "json_schema" and reject "json_object".  Instead we instruct
        the model via the system prompt and extract the JSON from the response
        text ourselves, stripping any markdown code fences the model may add.
        """
        # Append a firm JSON-only instruction to the system prompt so the
        # model knows to return raw JSON regardless of its default behaviour.
        system_with_json_hint = (
            system
            + "\n\nIMPORTANT: Your entire response must be valid JSON only. "
            "Do not include markdown, code fences, explanations, or any text "
            "outside the JSON object."
        )

        response = self._client.chat.completions.create(
            model=self._model,
            messages=[
                {"role": "system", "content": system_with_json_hint},
                {"role": "user", "content": user},
            ],
        )

        raw = response.choices[0].message.content or ""

        # Strip markdown code fences if the model wrapped the JSON anyway
        # e.g. ```json\n{...}\n```  or  ```\n{...}\n```
        raw = raw.strip()
        if raw.startswith("```"):
            # Remove opening fence line and closing fence
            lines = raw.splitlines()
            # Drop first line (```json or ```) and last line (```)
            inner = lines[1:] if lines[-1].strip() == "```" else lines[1:]
            if inner and inner[-1].strip() == "```":
                inner = inner[:-1]
            raw = "\n".join(inner).strip()

        return json.loads(raw)

    # ------------------------------------------------------------------
    # AIProvider interface
    # ------------------------------------------------------------------

    def extract_entities(self, text: str) -> EntityExtractionResult:
        """
        Extract named entities from *text*.

        Expected JSON response shape::

            {
              "entities": [
                {
                  "canonical_name": "Alice Smith",
                  "type": "person",
                  "aliases": ["Alice", "Dr. Smith"]
                },
                ...
              ]
            }
        """
        system = (
            "You are an entity extraction engine. "
            "Extract every named entity from the supplied text. "
            "Return ONLY a JSON object with a single key 'entities' whose value is an array. "
            "Each element must have exactly these keys: "
            "  canonical_name (string) — the most complete, canonical form of the name; "
            "  type (string) — exactly one of: person, idea, project, keyword, organization, location, date; "
            "  aliases (array of strings) — alternative names or abbreviations; may be empty. "
            "Do not include any explanation outside the JSON object."
        )
        user = f"Extract all entities from the following text:\n\n{text}"

        data = self._chat_json(system, user)
        entities: list[ExtractedEntity] = []
        for item in data.get("entities", []):
            entity_type = item.get("type", "keyword")
            if entity_type not in _VALID_ENTITY_TYPES:
                entity_type = "keyword"
            entities.append(
                ExtractedEntity(
                    canonical_name=item["canonical_name"],
                    type=entity_type,
                    aliases=item.get("aliases", []),
                )
            )
        return EntityExtractionResult(entities=entities)

    def extract_action_items(
        self,
        text: str,
        known_entities: list[ExtractedEntity],
    ) -> list[ActionItemCandidate]:
        """
        Extract action items from *text*, resolving assignees against
        *known_entities* by canonical name.

        Expected JSON response shape::

            {
              "action_items": [
                {
                  "description": "Alice to schedule follow-up meeting",
                  "assignee_canonical_name": "Alice Smith",
                  "due_date": "2024-07-15"
                },
                ...
              ]
            }
        """
        entity_list_str = ", ".join(
            f'"{e.canonical_name}" ({e.type})' for e in known_entities
        ) or "none"

        system = (
            "You are an action-item extraction engine. "
            "Identify every action item, task, or to-do in the supplied text. "
            "Return ONLY a JSON object with a single key 'action_items' whose value is an array. "
            "Each element must have exactly these keys: "
            "  description (string) — full description of the task; "
            "  assignee_canonical_name (string or null) — canonical name of the person "
            "    responsible, chosen from the known entities list if possible, otherwise null; "
            "  due_date (string or null) — ISO-8601 date if mentioned, otherwise null. "
            "Do not include any explanation outside the JSON object."
        )
        user = (
            f"Known entities: {entity_list_str}\n\n"
            f"Extract all action items from the following text:\n\n{text}"
        )

        data = self._chat_json(system, user)
        results: list[ActionItemCandidate] = []
        for item in data.get("action_items", []):
            results.append(
                ActionItemCandidate(
                    description=item["description"],
                    assignee_canonical_name=item.get("assignee_canonical_name"),
                    due_date=item.get("due_date"),
                )
            )
        return results

    def infer_relationships(
        self,
        entities: list[ExtractedEntity],
        text: str,
    ) -> list[RelationshipCandidate]:
        """
        Infer relationships between *entities* from *text*.

        Expected JSON response shape::

            {
              "relationships": [
                {
                  "entity_a_canonical_name": "Alice Smith",
                  "entity_b_canonical_name": "Project Apollo",
                  "relationship_description": "leads the project",
                  "base_weight": 0.85
                },
                ...
              ]
            }
        """
        entity_list_str = "\n".join(
            f'- "{e.canonical_name}" (type: {e.type})' for e in entities
        )

        system = (
            "You are a relationship inference engine for a knowledge graph. "
            "Given a list of entities and source text, identify all meaningful relationships "
            "between pairs of entities. "
            "Return ONLY a JSON object with a single key 'relationships' whose value is an array. "
            "Each element must have exactly these keys: "
            "  entity_a_canonical_name (string) — canonical name of the first entity; "
            "  entity_b_canonical_name (string) — canonical name of the second entity; "
            "  relationship_description (string) — concise description of the relationship; "
            "  base_weight (number) — structural importance of the relationship, 0.0 (weak) to 1.0 (strong). "
            "Only include relationships that are explicitly supported by the text. "
            "Do not include any explanation outside the JSON object."
        )
        user = (
            f"Entities:\n{entity_list_str}\n\n"
            f"Source text:\n\n{text}"
        )

        data = self._chat_json(system, user)
        results: list[RelationshipCandidate] = []
        for item in data.get("relationships", []):
            weight = float(item.get("base_weight", 0.5))
            weight = max(0.0, min(1.0, weight))
            results.append(
                RelationshipCandidate(
                    entity_a_canonical_name=item["entity_a_canonical_name"],
                    entity_b_canonical_name=item["entity_b_canonical_name"],
                    relationship_description=item["relationship_description"],
                    base_weight=weight,
                )
            )
        return results

    def score_sentiment(self, entity_canonical_name: str, context: str) -> float:
        """
        Score sentiment toward *entity_canonical_name* within *context*.

        Expected JSON response shape::

            {"sentiment_score": 0.72}
        """
        system = (
            "You are a sentiment scoring engine. "
            "Score how the supplied text perceives or portrays the named entity. "
            "Return ONLY a JSON object with a single key 'sentiment_score' "
            "whose value is a number between -1.0 (strongly negative) and 1.0 (strongly positive). "
            "Use 0.0 for neutral or when the entity is mentioned without clear sentiment. "
            "Do not include any explanation outside the JSON object."
        )
        user = (
            f"Entity: {entity_canonical_name}\n\n"
            f"Context:\n\n{context}"
        )

        data = self._chat_json(system, user)
        score = float(data.get("sentiment_score", 0.0))
        return max(-1.0, min(1.0, score))

    def categorize_document(self, text: str) -> str:
        """
        Assign a short category label to *text*.

        Expected JSON response shape::

            {"category": "meeting notes"}
        """
        system = (
            "You are a document classification engine. "
            "Assign a concise category label to the supplied document. "
            "Examples of valid categories: meeting notes, project proposal, email, "
            "research paper, status update, decision log, technical specification, "
            "action plan, retrospective, interview transcript. "
            "Return ONLY a JSON object with a single key 'category' whose value is "
            "a short lowercase string (2–4 words maximum). "
            "Do not include any explanation outside the JSON object."
        )
        user = f"Categorize the following document:\n\n{text}"

        data = self._chat_json(system, user)
        return str(data.get("category", "uncategorized")).strip().lower()

    def rescore_graph(
        self,
        graph_snapshot: dict,
        user_hints: list,
    ) -> GraphScoreResult:
        """
        Re-score relationship weights for the entire graph.

        *graph_snapshot* is a dict in the shape::

            {
              "relationships": [
                {
                  "entity_a_canonical_name": "Alice Smith",
                  "entity_b_canonical_name": "Project Apollo",
                  "base_weight": 0.72   # numeric hints already pre-applied
                },
                ...
              ]
            }

        *user_hints* is a list of qualitative hint strings, e.g.::

            [
              "The relationship between Alice Smith and Project Apollo is more important than the data suggests.",
              "Bob Jones' involvement in Budget Review should be weighted down."
            ]

        Expected JSON response shape::

            {
              "updated_relationships": [
                {
                  "entity_a_canonical_name": "Alice Smith",
                  "entity_b_canonical_name": "Project Apollo",
                  "new_base_weight": 0.88
                },
                ...
              ]
            }
        """
        hints_block = (
            "\n".join(f"- {h}" for h in user_hints)
            if user_hints
            else "No qualitative hints provided."
        )

        system = (
            "You are a knowledge graph scoring engine. "
            "You will be given the current state of a knowledge graph (nodes connected by weighted relationships) "
            "together with qualitative user hints. "
            "Your task is to review every relationship and return a refined base_weight in [0.0, 1.0] for each one. "
            "Apply the qualitative user hints as natural-language context when adjusting weights — "
            "they reflect domain knowledge that the structural data may not capture. "
            "Return ONLY a JSON object with a single key 'updated_relationships' whose value is an array. "
            "Each element must have exactly these keys: "
            "  entity_a_canonical_name (string), "
            "  entity_b_canonical_name (string), "
            "  new_base_weight (number, 0.0–1.0). "
            "Every relationship present in the input MUST appear in the output. "
            "Do not include any explanation outside the JSON object."
        )
        user = (
            f"Current graph snapshot:\n{json.dumps(graph_snapshot, indent=2)}\n\n"
            f"Qualitative user hints:\n{hints_block}"
        )

        data = self._chat_json(system, user)
        updated: list[_UpdatedRelationship] = []
        for item in data.get("updated_relationships", []):
            weight = float(item.get("new_base_weight", 0.5))
            weight = max(0.0, min(1.0, weight))
            updated.append(
                _UpdatedRelationship(
                    entity_a_canonical_name=item["entity_a_canonical_name"],
                    entity_b_canonical_name=item["entity_b_canonical_name"],
                    new_base_weight=weight,
                )
            )
        return GraphScoreResult(updated_relationships=updated)
