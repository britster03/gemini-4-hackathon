"""Centralized Google GenAI SDK (>= 3.2.0) client & model guards for ClearBuy."""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from backend.config import (
    get_gemini_api_key,
    get_genai_client as _config_get_genai_client,
    reload_env,
)

# Models strictly standardized across ClearBuy (Gemini 4 + Frontier Stack)
MODEL_NEON = "gemini-4-neon"
MODEL_HYDROGEN = "gemini-4-hydrogen"
MODEL_CARBON = "gemini-4-carbon"
MODEL_ARGON = "gemini-4-argon"
MODEL_NANO_BANANA = "gemini-nano-banana-2.1"
MODEL_DECISION = "gemini-decision-1"
MODEL_TRANSCRIBE = "gemini-3.5-transcribe"
MODEL_TTS_LITE = "gemini-3.8-flash-lite-tts"
MANAGED_AGENT_ID = "antigravity-preview-09-2026"

_RETIRED_MODEL_PREFIXES = (
    "gemini-2.5",
    "gemini-2.0",
    "gemini-1.5",
    "gemini-1.0",
    "gemini-3.1-flash-image",
)


def assert_supported_model(model_name: str) -> str:
    """Hard guard preventing accidental calls to retired Vertex/Developer API models."""
    normalized = (model_name or "").strip()
    for prefix in _RETIRED_MODEL_PREFIXES:
        if normalized.startswith(prefix):
            raise ValueError(
                f"Model '{normalized}' is retired/deprecated. "
                f"Use '{MODEL_NEON}', '{MODEL_HYDROGEN}', '{MODEL_NANO_BANANA}', or '{MODEL_DECISION}'."
            )
    return normalized


def load_env() -> None:
    """Load .env.local / .env via shared backend.config."""
    reload_env()


def get_genai_client(api_version: str = "v1beta", api_key: str | None = None):
    """Delegate to shared backend.config client factory."""
    if api_key:
        from google import genai

        return genai.Client(api_key=api_key, http_options={"api_version": api_version})
    return _config_get_genai_client(api_version=api_version)

