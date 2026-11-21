"""Centralized Google GenAI SDK (>= 3.2.0) client & model guards for ClearBuy."""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from google import genai

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
    """Load .env.local / .env from workspace root or parent directories."""
    repo_root = Path(__file__).resolve().parent.parent
    for candidate in (
        repo_root / ".env.local",
        repo_root / ".env",
        Path.cwd() / ".env.local",
        Path.cwd() / ".env",
    ):
        if candidate.exists():
            load_dotenv(dotenv_path=candidate, override=False)


@lru_cache(maxsize=4)
def get_genai_client(api_version: str = "v1beta", api_key: Optional[str] = None) -> genai.Client:
    """Return a cached google-genai Client configured for v1beta (Managed Agents + Decisions + Interactions) or v1."""
    load_env()
    use_vertex = os.getenv("GOOGLE_GENAI_USE_VERTEXAI", "").lower() in ("1", "true", "yes")
    if use_vertex:
        project = os.getenv("GOOGLE_CLOUD_PROJECT") or os.getenv("GCLOUD_PROJECT")
        location = os.getenv("GOOGLE_CLOUD_LOCATION", "global")
        return genai.Client(
            vertexai=True,
            project=project,
            location=location,
            http_options={"api_version": api_version},
        )

    resolved_key = (
        api_key
        or os.getenv("GEMINI_API_KEY")
        or os.getenv("GOOGLE_API_KEY")
    )
    if not resolved_key:
        raise RuntimeError(
            "Missing GEMINI_API_KEY. Set GEMINI_API_KEY in .env.local or environment."
        )
    return genai.Client(
        api_key=resolved_key,
        http_options={"api_version": api_version},
    )
