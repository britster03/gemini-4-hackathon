# ClearBuy (Datum / Caliper) — Verified Spatial Commerce Compiler

Gemini 4 NYC Hackathon · Verified Spatial Commerce Compiler (`Next.js 15` + `FastAPI SSE` + `Google GenAI SDK` + `Managed Agents hooks.json` + `Shopify Shop MCP / UCP`).

## Quickstart

1. Copy `.env.example` to `.env.local` and paste your `GEMINI_API_KEY`:
   ```bash
   cp .env.example .env.local
   ```
2. Sync Python 3.12 virtual environment via `uv` (add `--extra depth` for local `Depth-Anything-V2-Metric-Indoor-Small`):
   ```bash
   uv sync --extra dev --extra depth --python 3.12
   ```
3. Run full Engineer A + Engineer B test suite:
   ```bash
   uv run pytest tests/ -v
   ```
4. Start FastAPI SSE server on `http://localhost:8000`:
   ```bash
   uv run uvicorn backend.main:app --reload --port 8000
   ```

---

## Connected Architecture (Engineer A + Engineer B Integrated)

- **Engineer A (`backend/scale_engine.py`, `backend/anchor_standards.json`, `backend/spec_parser.py`, `backend/managed_agent.py`, `.agents/hooks.json`, `.agents/verify_bundle.py`)**:
  - **Universal Two-Layer Scale Engine**: Layer 1 `gemini-4-neon` Two-Tier Reference Anchors + Weighted Cross-Anchor Skew Check (`>15%` foreshortening flag) + 3D Depth-Ratio Plane Correction (`Z_zone / Z_anchor`), seamlessly paired with Layer 2 `Depth-Anything-V2-Metric-Indoor-Small-hf` + rotation-invariant EXIF pinhole geometry (`5.34"` MAE on unseen NYU Kinect rooms; `0.1"` on clean wall-outlet nooks).
  - **Universal Spatial Guardrail (`.agents/hooks.json` + `verify_bundle.py`)**: Deterministic 2D spatial topology (`floor_anchor`, `underlay` rugs, `paired_tuck` seating/tables, `surface_top` lamps/mats, `wall_mount` art/mirrors), `ProtectedAnchor` preservation, SHA-256 constraint tamper protection, and strict minor-unit cents->USD budget enforcement inside Google's `antigravity-preview-09-2026` Managed Agents sandbox and FastAPI.
  - **Structured `W×D×H` Spec Parser (`spec_parser.py`)**: `gemini-4-hydrogen` batch spec extraction + `gemini-decision-1` Catalog Gate + voice/video helpers.
- **Engineer B (`backend/main.py`, `backend/adapters.py`, `backend/shop_mcp.py`, `backend/renderer.py`, `backend/visual_qa.py`, `backend/thread_router.py`, `eval/`)**:
  - **FastAPI SSE Orchestrator** (`POST /api/session/start`, `GET /api/session/{id}/stream`, `POST /thread`, `POST /swap`, `PATCH /zone`, `GET /api/benchmark`).
  - **Live Shopify Shop MCP (`2026-07-28`) & UCP (`2026-08-25`)** (`search_catalog`, `get_product` variants, per-merchant `create_checkout` / `update_checkout` with Shop Pay `continue_url`).
  - **Exact-SKU Render & Pixel Lie-Detector** (`gemini-nano-banana-2.1` + `gemini-decision-1` 4-rubric Visual QA + 1× auto-repair) & 14-room NYU Depth V2 Kinect + Gemini 4 ablation benchmark.
