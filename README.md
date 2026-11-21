# ClearBuy (Datum) — Verified Spatial Commerce Compiler

Gemini 4 NYC Hackathon · Verified Spatial Commerce Compiler (`Next.js 15` + `FastAPI SSE` + `Google GenAI SDK` + `Shopify Shop MCP / UCP`).

## Quickstart (Backend — Engineer B)

1. Copy `.env.example` to `.env.local` and set `GEMINI_API_KEY`:
   ```bash
   cp .env.example .env.local
   ```
2. Install Python 3.12 environment via `uv`:
   ```bash
   uv sync --extra dev --python 3.12
   ```
3. Run unit & contract tests:
   ```bash
   uv run pytest tests/ -v
   ```
4. Verify live Shopify `mcp.shop.com` + Gemini 4 suite:
   ```bash
   uv run python scripts/smoke_engineer_b.py
   ```
5. Start FastAPI SSE server on `http://localhost:8000`:
   ```bash
   uv run uvicorn backend.main:app --reload --port 8000
   ```

## Frozen API Endpoints (`backend/main.py`)
- `POST /api/session/start` — Multipart upload (`images`, `prompt`, `budget_usd`, `exif_focal_mm`, `scope`) streaming SSE events (`scale_ready`, `catalog_ready`, `hook_event`, `cart_ready`, `render_ready`).
- `GET /api/session/{id}/stream` — Replay/live SSE subscription (`EventSource` compatible).
- `POST /api/session/{id}/thread` — Conversational voice/text router (`gemini-4-hydrogen`) returning pre-vetted Shopify alternatives with deltas or `hooks.json` block cards.
- `POST /api/session/{id}/swap` — Hard `verify_bundle` gate (`422` on violation) + stateful `gemini-nano-banana-2.1` surgical swap + `gemini-decision-1` QA + UCP `update_checkout`.
- `PATCH /api/session/{id}/zone` — CAD caliper drag override with instant fit recalculation.
- `GET /api/benchmark` — 14-room NYU Depth V2 Kinect + Gemini 4 thinking-level ablation metrics.
