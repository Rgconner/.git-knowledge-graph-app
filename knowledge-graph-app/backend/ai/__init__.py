"""
AI provider abstraction layer.

Public API::

    from ai import get_ai_provider

    provider = get_ai_provider()
"""
from ai.factory import get_ai_provider

__all__ = ["get_ai_provider"]
