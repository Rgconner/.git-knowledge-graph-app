"""
AI provider factory.

Usage::

    from ai.factory import get_ai_provider

    provider = get_ai_provider()
    result = provider.extract_entities(text)

Configuration (via environment variable):
  AI_PROVIDER — one of "openai" (default), "anthropic", "watsonx"

The provider instance is cached at module level (singleton) so the client
is constructed only once per process.
"""
from __future__ import annotations

import os

from ai.provider import AIProvider

_provider_instance: AIProvider | None = None


def get_ai_provider() -> AIProvider:
    """
    Return the configured AIProvider singleton.

    Reads the ``AI_PROVIDER`` environment variable (default: ``"openai"``)
    and constructs the appropriate provider on first call.  Subsequent
    calls return the cached instance.

    Raises:
        ValueError: if ``AI_PROVIDER`` is set to an unrecognised value.
    """
    global _provider_instance
    if _provider_instance is not None:
        return _provider_instance

    provider_name = os.environ.get("AI_PROVIDER", "openai").strip().lower()

    if provider_name == "openai":
        from ai.providers.openai_provider import OpenAIProvider
        _provider_instance = OpenAIProvider()
    elif provider_name == "anthropic":
        from ai.providers.anthropic_provider import AnthropicProvider
        _provider_instance = AnthropicProvider()
    elif provider_name == "watsonx":
        from ai.providers.watsonx_provider import WatsonxProvider
        _provider_instance = WatsonxProvider()
    else:
        raise ValueError(
            f"Unknown AI_PROVIDER value: '{provider_name}'. "
            "Supported values are: 'openai', 'anthropic', 'watsonx'."
        )

    return _provider_instance
