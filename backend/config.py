"""Environment & Google GenAI SDK Client Configuration.

Loads `.env.local` (preferred) and `.env` from the repository root and provides
singleton factories for the Google GenAI SDK (`google-genai >= 3.2`):
- Standard client (`interactions.create`, `models.generate_content`)
- Decisions API client (`http_options={"api_version": "v1beta"}` -> `decisions.create`)
"""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from google import genai

REPO_ROOT = Path(__file__).resolve().parent.parent
SESSIONS_DIR = REPO_ROOT / "backend" / ".sessions"
EVAL_RESULTS_PATH = REPO_ROOT / "eval" / "results.json"
EVAL_DATA_DIR = REPO_ROOT / "eval" / "data"

PLACEHOLDER_KEY = "PASTE_YOUR_GEMINI_API_KEY_HERE"


def reload_env() -> None:
    """Reload `.env.local` and `.env` so runtime key edits take effect immediately."""
    env_file = REPO_ROOT / ".env"
    env_local = REPO_ROOT / ".env.local"
    if env_file.exists():
        load_dotenv(env_file, override=False)
    if env_local.exists():
        load_dotenv(env_local, override=True)


reload_env()


def get_gemini_api_key() -> str | None:
    """Return a configured Gemini API key, or None if still set to placeholder."""
    reload_env()
    key = (os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or "").strip()
    if not key or key == PLACEHOLDER_KEY:
        return None
    return key


def use_vertex_ai() -> bool:
    return os.getenv("GOOGLE_GENAI_USE_VERTEXAI", "false").strip().lower() in {
        "1",
        "true",
        "yes",
    }


def has_live_gemini_credentials() -> bool:
    return bool(get_gemini_api_key()) or (
        use_vertex_ai() and bool(os.getenv("GOOGLE_CLOUD_PROJECT"))
    )


def get_model_neon() -> str:
    return os.getenv("GEMINI_MODEL_NEON", "gemini-4-neon")


def get_model_hydrogen() -> str:
    return os.getenv("GEMINI_MODEL_HYDROGEN", "gemini-4-hydrogen")


def get_model_nano_banana() -> str:
    return os.getenv("GEMINI_MODEL_NANO_BANANA", "gemini-nano-banana-2.1")


def get_model_decision() -> str:
    return os.getenv("GEMINI_MODEL_DECISION", "gemini-decision-1")


def get_shop_mcp_url() -> str:
    return os.getenv("SHOP_MCP_URL", "https://mcp.shop.com/")


def get_ucp_agent_profile_url() -> str:
    return os.getenv(
        "UCP_AGENT_PROFILE_URL",
        "https://shopify.dev/ucp/agent-profiles/examples/2026-08-25/valid-with-capabilities.json",
    )


def get_shop_mcp_bearer_token() -> str | None:
    reload_env()
    tok = (os.getenv("SHOP_MCP_BEARER_TOKEN") or "").strip()
    return tok or None


@lru_cache(maxsize=4)
def _build_client(api_key: str | None, api_version: str | None, vertex: bool) -> genai.Client:
    kwargs: dict = {}
    if api_version:
        kwargs["http_options"] = {"api_version": api_version}
    if vertex and not api_key:
        kwargs["vertexai"] = True
        kwargs["project"] = os.getenv("GOOGLE_CLOUD_PROJECT")
        kwargs["location"] = os.getenv("GOOGLE_CLOUD_LOCATION", "global")
    elif api_key:
        kwargs["api_key"] = api_key
    return genai.Client(**kwargs)


def get_genai_client(api_version: str | None = None) -> genai.Client:
    """Return configured Google GenAI client (reloads `.env.local` if key changed)."""
    api_key = get_gemini_api_key()
    vertex = use_vertex_ai()
    if not api_key and not vertex:
        raise RuntimeError(
            "GEMINI_API_KEY is not set yet. Open `.env.local` in the workspace root, "
            "replace PASTE_YOUR_GEMINI_API_KEY_HERE with your Gemini API key, and save."
        )
    return _build_client(api_key, api_version, vertex)


def get_decisions_client() -> genai.Client:
    """Return `v1beta` Google GenAI client required by `gemini-decision-1`."""
    api_key = get_gemini_api_key()
    if api_key:
        return _build_client(api_key, "v1beta", False)
    return get_genai_client(api_version="v1beta")
