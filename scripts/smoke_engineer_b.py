"""Live End-to-End Smoke Verification for Engineer B (`mcp.shop.com` + Gemini 4 Suite)."""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.config import get_gemini_api_key, has_live_gemini_credentials
from backend.shop_mcp import ShopMCPClient


async def main() -> None:
    print("=== 1. Testing Live Shopify `https://mcp.shop.com/` JSON-RPC ===")
    mcp = ShopMCPClient()
    skus, trace = await mcp.search_category("standing desk", max_price_usd=350.0, limit=5)
    print(
        f"  tool={trace.tool_name} status={trace.status} latency={trace.latency_ms}ms "
        f"returned={len(skus)} SKUs"
    )
    if skus:
        lead = skus[0]
        print(
            f"  sample SKU: '{lead.title}' | ${lead.price_usd:.2f} ({lead.price_cents} cents) "
            f"| merchant={lead.merchant_name} | gid={lead.gid}"
        )
        enriched, vtrace = await mcp.enrich_product_variants(lead)
        print(
            f"  get_product status={vtrace.status} variants={len(enriched.variants)} "
            f"fresh_ts={enriched.verified_at}"
        )
        checkouts, _ = await mcp.create_or_update_merchant_checkouts([enriched])
        print(f"  UCP checkout URL: {checkouts[0].continue_url}")

    print("\n=== 2. Checking Gemini 4 API Credentials in `.env.local` ===")
    if not has_live_gemini_credentials():
        print(
            "  [ACTION NEEDED] GEMINI_API_KEY in `.env.local` is still placeholder.\n"
            "  Paste your real Gemini API key into `.env.local` and re-run:\n"
            "    uv run python scripts/smoke_engineer_b.py"
        )
        return

    print(f"  GEMINI_API_KEY detected (prefix: {str(get_gemini_api_key())[:8]}...)")
    from backend.shop_mcp import extract_dimensions_via_hydrogen
    from backend.visual_qa import screen_catalog_candidates

    if skus:
        parsed = await extract_dimensions_via_hydrogen(skus[:3])
        screened, ms = await screen_catalog_candidates(
            prompt="Compact standing desk for apartment nook under $350",
            category="desk",
            candidates=parsed,
        )
        print(
            f"  gemini-4-hydrogen + gemini-decision-1 catalog gate: "
            f"{len(screened)} passed in {ms}ms"
        )
        print("  parsed dims sample:", json.dumps(screened[0].dimensions.model_dump()))


if __name__ == "__main__":
    asyncio.run(main())
