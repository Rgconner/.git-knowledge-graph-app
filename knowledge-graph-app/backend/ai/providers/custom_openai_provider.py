"""
Custom / self-hosted OpenAI-compatible provider.

Use this when your AI backend exposes an OpenAI-compatible chat-completions
API at a custom URL, e.g.:

    https://my-server:8080/api/v1
    http://localhost:11434/api/v1    (Ollama)
    https://bam-api.res.ibm.com/v1  (IBM BAM)

Configuration (via environment variables):
  AI_BASE_URL   — full base URL of the API endpoint (required)
                  e.g. https://my-llm-server:8080/api/v1
  AI_API_KEY    — API key / bearer token (required; use any non-empty string
                  for servers that don't require authentication)
  AI_MODEL      — model name to request (required; must match a model name
                  the server recognises, e.g. "llama3", "mistral", "granite")

Every chat completion uses JSON mode so responses are always structured
JSON objects — no free-form prose parsing.
"""
from __future__ import annotations

import os

from openai import OpenAI

from ai.providers.openai_provider import OpenAIProvider


class CustomOpenAIProvider(OpenAIProvider):
    """
    AIProvider that targets any OpenAI-compatible HTTP endpoint.

    Inherits all prompt logic from OpenAIProvider — only the client
    construction and model selection differ.
    """

    def __init__(self) -> None:
        base_url = os.environ.get("AI_BASE_URL", "").strip()
        if not base_url:
            raise RuntimeError(
                "AI_BASE_URL environment variable is not set. "
                "Set it to the base URL of your OpenAI-compatible API endpoint, "
                "e.g. https://my-server:8080/api/v1"
            )

        api_key = os.environ.get("AI_API_KEY", "").strip()
        if not api_key:
            raise RuntimeError(
                "AI_API_KEY environment variable is not set. "
                "Set it to your API key or any non-empty string if the server "
                "does not require authentication."
            )

        model = os.environ.get("AI_MODEL", "").strip()
        if not model:
            raise RuntimeError(
                "AI_MODEL environment variable is not set. "
                "Set it to the model name your server expects, "
                "e.g. 'llama3', 'mistral', 'granite-13b-chat'."
            )

        # Bypass OpenAIProvider.__init__ and set attributes directly so we
        # can pass base_url to the OpenAI client.
        self._client = OpenAI(api_key=api_key, base_url=base_url)
        self._model = model
        self._max_tokens = int(os.environ.get("AI_MAX_TOKENS", "4096"))
