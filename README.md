# ClearBuy (Datum / Caliper)

**Verified Spatial Commerce Compiler** — Built for the Gemini 4 NYC Hackathon.

Snap a photo of any physical space and speak your furnishing goal + budget. ClearBuy calibrates real-world measurements with zero manual typing (`gemini-4-neon` universal multi-anchor geometry + `Depth-Anything-V2` EXIF fallback), queries live Shopify stores via `mcp.shop.com`, hard-blocks any bundle that violates 2D spatial topology, clearance, or budget via Managed Agents `.agents/hooks.json` (`verify_bundle.py`), renders exact Shopify SKUs with `gemini-nano-banana-2.1`, and audits rendered pixels in ~200 ms with `gemini-decision-1`.

## Repository Layout

- `.agents/` & `agents/` — Managed Agent charter (`AGENTS.md`), Shopify & spatial spec playbook (`SKILL.md`), `hooks.json` `pre_tool_execution` gate, and deterministic universal spatial/budget solver (`verify_bundle.py`).
- `backend/` — FastAPI SSE orchestrator, Two-Layer Scale Engine (`scale_engine.py` + `anchor_standards.json`), `gemini-4-hydrogen` structured `W × D × H` parser (`spec_parser.py`), Managed Agent runner (`managed_agent.py`), Shop MCP/UCP client, Nano Banana renderer, and Decisions API Visual QA.
- `frontend/` — Next.js 15 + Tailwind CSS Glass-Box Spatial Studio.
- `eval/` — 14-room NYU Depth V2 Kinect + `gemini-4-neon` (`low` vs `xhigh`) ablation benchmark.

## Quickstart (Engineer A Modules)

```bash
uv sync --python 3.12 --extra dev
uv run pytest tests/test_engineer_a.py -v
```
