"""Automated Unit & API Contract Tests for Engineer B Deliverables."""

from __future__ import annotations

from io import BytesIO
from PIL import Image
from fastapi.testclient import TestClient

from backend.adapters import solve_combinatorial_bundle, verify_bundle_deterministic
from backend.main import app
from backend.schemas import (
    BoundingBox,
    ProductDimensions,
    ShopifySKU,
    SpatialZone,
)
from backend.shop_mcp import (
    extract_plain_description,
    normalize_price_to_cents_and_usd,
    parse_dimensions_labeled_deterministic,
)


def _make_sku(
    sku_id: str,
    category: str,
    price_cents: int,
    width_in: float | None,
    depth_in: float | None = 24.0,
) -> ShopifySKU:
    return ShopifySKU(
        sku_id=sku_id,
        gid=f"gid://shopify/Product/{sku_id}",
        selected_variant_id=f"var_{sku_id}",
        selected_variant_gid=f"gid://shopify/ProductVariant/{sku_id}",
        title=f'{width_in or ""} {category.title()}'.strip(),
        category=category,
        zone_id="zone_1",
        merchant_name="Test Merchant",
        shop_domain="test-merchant.myshopify.com",
        price_cents=price_cents,
        price_usd=round(price_cents / 100.0, 2),
        image_url="https://cdn.shopify.com/s/files/1/test.jpg",
        dimensions=ProductDimensions(
            width_in=width_in,
            depth_in=depth_in,
            height_in=29.5,
            dimensions_unverified=(width_in is None),
        ),
        verified_at="2026-11-21T16:00:00Z",
    )


def test_shopify_minor_unit_cents_normalization() -> None:
    assert normalize_price_to_cents_and_usd(12995) == (12995, 129.95)
    assert normalize_price_to_cents_and_usd({"amount": 21299, "currency": "USD"}) == (21299, 212.99)
    assert normalize_price_to_cents_and_usd("149.50") == (14950, 149.50)
    assert normalize_price_to_cents_and_usd("14950") == (14950, 149.50)


def test_nested_description_and_30h_regex_trap_guard() -> None:
    desc = extract_plain_description({"plain": "<p>Ergonomic frame, <b>30\"H</b> steel legs.</p>"})
    assert desc == 'Ergonomic frame, 30"H steel legs.'

    # Must NOT confuse 30"H for width!
    dims = parse_dimensions_labeled_deterministic("Modern Work Desk", desc)
    assert dims.height_in == 30.0
    assert dims.width_in is None
    assert dims.dimensions_unverified is True

    # Must extract true labeled W x D x H
    dims_full = parse_dimensions_labeled_deterministic(
        'Compact Standing Desk', 'Overall dimensions: 40"W x 24"D x 29.5"H solid oak.'
    )
    assert dims_full.width_in == 40.0
    assert dims_full.depth_in == 24.0
    assert dims_full.height_in == 29.5
    assert dims_full.dimensions_unverified is False


def test_verify_bundle_denies_oversized_and_auto_swaps() -> None:
    zone = SpatialZone(
        zone_id="zone_1",
        label="Zone 1 · Nook",
        target_categories=["desk", "chair"],
        bbox=BoundingBox(y_min=300, x_min=200, y_max=850, x_max=750),
        width_in=43.5,
        depth_in=60.0,
        usable_width_in=41.5,
    )
    desk_48 = _make_sku("d48", "desk", 22000, width_in=48.0, depth_in=24.0)
    desk_40 = _make_sku("d40", "desk", 19900, width_in=40.0, depth_in=24.0)
    chair_ok = _make_sku("c25", "chair", 16500, width_in=25.0, depth_in=24.0)

    deny_ev = verify_bundle_deterministic("s1", [zone], [desk_48, chair_ok], budget_usd=450.0)
    assert deny_ev.decision == "deny"
    assert "48.0\" desk exceeds 43.5\"" in deny_ev.reason

    bundle, trace, refusal = solve_combinatorial_bundle(
        session_id="s1",
        zones=[zone],
        candidates_by_category={"desk": [desk_48, desk_40], "chair": [chair_ok]},
        budget_usd=450.0,
    )
    assert refusal is None
    assert [it.sku_id for it in bundle] == ["d40", "c25"]
    assert trace[0].decision == "deny"
    assert trace[-1].decision == "allow"


def test_fastapi_endpoints_health_zone_and_422_swap(monkeypatch) -> None:
    # Stub ShopMCPClient network calls for deterministic fast unit test
    from backend import shop_mcp

    async def _fake_search(self, category: str, style_hint: str = "", max_price_usd=None, limit: int = 8):
        from backend.schemas import MCPCallTrace

        if category == "desk":
            skus = [
                _make_sku("desk_48", "desk", 24000, 48.0),
                _make_sku("desk_40", "desk", 18995, 40.0),
            ]
        else:
            skus = [
                _make_sku("chair_1", "chair", 14900, 24.5),
                _make_sku("chair_2", "chair", 15900, 25.0),
            ]
        return skus, MCPCallTrace(
            call_id="c1",
            tool_name="search_catalog",
            endpoint="https://mcp.shop.com/",
            arguments={"query": category},
            latency_ms=42,
        )

    async def _fake_enrich(self, sku):
        from backend.schemas import MCPCallTrace

        return sku, MCPCallTrace(
            call_id="c2",
            tool_name="get_product",
            endpoint="https://mcp.shop.com/",
            arguments={"id": sku.gid},
            latency_ms=25,
        )

    monkeypatch.setattr(shop_mcp.ShopMCPClient, "search_category", _fake_search)
    monkeypatch.setattr(shop_mcp.ShopMCPClient, "enrich_product_variants", _fake_enrich)

    client = TestClient(app)
    r_health = client.get("/api/health")
    assert r_health.status_code == 200
    assert r_health.json()["status"] == "ok"

    img = Image.new("RGB", (640, 480), (220, 220, 220))
    buf = BytesIO()
    img.save(buf, format="JPEG")

    r_start = client.post(
        "/api/session/start",
        data={
            "prompt": "Put a compact standing desk and ergonomic chair under $450",
            "budget_usd": "450",
            "scope": "nook",
        },
        files=[("images", ("room.jpg", buf.getvalue(), "image/jpeg"))],
    )
    assert r_start.status_code == 200
    session_id = r_start.headers["x-session-id"]
    sse_body = r_start.text
    assert "event: scale_ready" in sse_body
    assert "event: catalog_ready" in sse_body
    assert "event: hook_event" in sse_body
    assert "event: cart_ready" in sse_body
    assert "event: render_ready" in sse_body

    # Attempting to swap to oversized 48" desk must return HTTP 422 with hook_deny!
    r_bad_swap = client.post(
        f"/api/session/{session_id}/swap",
        json={
            "zone_id": "zone_1",
            "target_item_id": "desk_40",
            "new_sku_id": "desk_48",
        },
    )
    assert r_bad_swap.status_code == 422
    assert r_bad_swap.json()["detail"]["hook_deny"]["decision"] == "deny"

    # Valid chair swap -> returns v2!
    r_good_swap = client.post(
        f"/api/session/{session_id}/swap",
        json={
            "zone_id": "zone_1",
            "target_item_id": "chair_1",
            "new_sku_id": "chair_2",
        },
    )
    assert r_good_swap.status_code == 200
    assert r_good_swap.json()["version_id"] == "v2"

    # Caliper drag override PATCH /zone
    r_zone = client.patch(
        f"/api/session/{session_id}/zone",
        json={"zone_id": "zone_1", "override_width_in": 52.0},
    )
    assert r_zone.status_code == 200
    assert r_zone.json()["updated_zone"]["usable_width_in"] == 50.0
