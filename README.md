# ClearBuy (Datum) — Verified Spatial Commerce Compiler

Gemini 4 NYC Hackathon · Verified Spatial Commerce Compiler (`Next.js 15` + `FastAPI SSE` + `Google GenAI SDK` + `Shopify Shop MCP / UCP`).

## Quickstart

1. Copy `.env.example` to `.env.local` and paste your `GEMINI_API_KEY`:
   ```bash
   cp .env.example .env.local
   ```
2. Sync Python 3.12 virtual environment via `uv`:
   ```bash
   uv sync --extra dev --python 3.12
   ```
3. Run unit & contract tests (`4/4` pass in `0.26s`):
   ```bash
   uv run pytest tests/ -v
   ```
4. Start FastAPI SSE server on `http://localhost:8000`:
   ```bash
   uv run uvicorn backend.main:app --reload --port 8000
   ```

---

## Summary of Changes & Plug-In Guide for Engineer A

Engineer B's entire backend, live Shopify MCP/UCP engine, Nano Banana 2.1 renderer, Decisions API QA gate, and 14-room NYU Depth V2 benchmark are now merged into `main`.

`backend/adapters.py` already includes **automatic plug-in hooks** for Engineer A's files — as soon as you drop your files in, the FastAPI pipeline (`POST /api/session/start`, `POST /swap`, `PATCH /zone`, and `eval/run_eval.py`) automatically calls your code instead of the built-in fallback:

1. **Scale Engine (`backend/scale_engine.py` or `scale_engine.py`)**:
   - Expose `calibrate_space(session_id, image_bytes, prompt, scope="auto", exif_focal_mm=None)` (sync or `async`).
   - Return either a `ScaleReadyEvent` instance (from `backend.schemas`) or a `dict` matching `ScaleReadyEvent.model_fields` (`detected_scope`, `calibration_layer`, `calibration_summary`, `primary_anchor`, `anchors_detected`, `cross_anchor_skew_pct`, `zones`, `protected_anchors`).
2. **Guardrail Solver (`agents/verify_bundle.py` & `agents/hooks.json`)**:
   - `backend/adapters.py` (`verify_bundle_deterministic`) automatically invokes `agents/verify_bundle.py` via stdin JSON:
     ```json
     {
       "budget_usd": 450.0,
       "zones": [...],
       "items": [...]
     }
     ```
   - Print JSON to stdout: `{"decision": "allow" | "deny", "reason": "..."}`.
3. **Shared Config & Gemini Clients (`backend/config.py`)**:
   - Import `get_genai_client()`, `get_model_neon()`, and `get_model_hydrogen()` from `backend.config` so all modules share `.env.local` and `google-genai==3.6.1`.

---

## Frozen API Endpoints (`backend/main.py`)
- `POST /api/session/start` — Multipart upload (`images`, `prompt`, `budget_usd`, `exif_focal_mm`, `scope`) streaming SSE events (`scale_ready`, `catalog_ready`, `hook_event`, `cart_ready`, `render_ready`).
- `GET /api/session/{id}/stream` — Replay/live SSE subscription (`EventSource` compatible).
- `POST /api/session/{id}/thread` — Conversational voice/text router (`gemini-4-hydrogen`) returning pre-vetted Shopify alternatives with deltas or `hooks.json` block cards.
- `POST /api/session/{id}/swap` — Hard `verify_bundle` gate (`422` on violation) + stateful `gemini-nano-banana-2.1` surgical swap + `gemini-decision-1` QA + UCP `update_checkout`.
- `PATCH /api/session/{id}/zone` — CAD caliper drag override with instant fit recalculation.
- `GET /api/benchmark` — 14-room NYU Depth V2 Kinect + Gemini 4 thinking-level ablation metrics.
