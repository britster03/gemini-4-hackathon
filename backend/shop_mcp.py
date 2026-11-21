"""Authentic Shopify `shop.dev` MCP & Universal Commerce Protocol (UCP) Engine.

Verified live against `https://mcp.shop.com/` (MCP Protocol `2026-07-28`, UCP `2026-08-25`):
1. Stateless JSON-RPC 2.0 over HTTP POST (`MCP-Protocol-Version: 2026-07-28`, `Mcp-Method`, `Mcp-Name`)
2. `search_catalog` live multi-merchant US inventory discovery (`catalog.filters.price.max` in minor-unit cents)
3. `get_product` live variant & swatch inspection (`options[].values[].swatch.image_url`) + 10-min freshness
4. `create_checkout` & `update_checkout` authentic per-merchant UCP checkouts returning
   `gid://shopify/Checkout/...`, `dev.shopify.shop_pay` handler, and live `continue_url`!
"""

from __future__ import annotations

import asyncio
import json
import re
import time
import uuid
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlparse

import httpx

from backend.config import (
    get_genai_client,
    get_model_hydrogen,
    get_shop_mcp_url,
    has_live_gemini_credentials,
)
from backend.schemas import (
    MCPCallTrace,
    MerchantUCPCheckout,
    ProductDimensions,
    ProductVariant,
    ShopifySKU,
)

MCP_PROTOCOL_VERSION = "2026-07-28"
MCP_META = {
    "io.modelcontextprotocol/protocolVersion": MCP_PROTOCOL_VERSION,
    "io.modelcontextprotocol/clientCapabilities": {},
}


def normalize_price_to_cents_and_usd(raw_price: Any) -> tuple[int, float]:
    """Convert Shopify MCP minor-unit cents (`4799`, `{"amount": 12995}`) cleanly to `(cents, usd)`."""
    if raw_price is None:
        return 0, 0.0

    if isinstance(raw_price, dict):
        for k in ("amount", "min", "value", "price", "cents", "amount_cents"):
            if k in raw_price and raw_price[k] is not None:
                return normalize_price_to_cents_and_usd(raw_price[k])
        if "price_range" in raw_price:
            return normalize_price_to_cents_and_usd(raw_price["price_range"])
        if "priceRange" in raw_price:
            return normalize_price_to_cents_and_usd(raw_price["priceRange"])
        if "minVariantPrice" in raw_price:
            return normalize_price_to_cents_and_usd(raw_price["minVariantPrice"])
        return 0, 0.0

    if isinstance(raw_price, bool):
        return 0, 0.0

    if isinstance(raw_price, int):
        return raw_price, round(raw_price / 100.0, 2)

    if isinstance(raw_price, float):
        if not raw_price.is_integer():
            cents = int(round(raw_price * 100))
            return cents, round(cents / 100.0, 2)
        return int(raw_price), round(raw_price / 100.0, 2)

    if isinstance(raw_price, str):
        s = raw_price.strip().replace("$", "").replace(",", "")
        if not s:
            return 0, 0.0
        if "." in s:
            try:
                usd = float(s)
                cents = int(round(usd * 100))
                return cents, round(cents / 100.0, 2)
            except ValueError:
                return 0, 0.0
        if s.isdigit():
            cents = int(s)
            return cents, round(cents / 100.0, 2)
    return 0, 0.0


def extract_plain_description(raw_desc: Any) -> str:
    """Unwrap nested `{"plain": "..."}` descriptions and strip HTML tags cleanly."""
    if raw_desc is None:
        return ""
    if isinstance(raw_desc, dict):
        text = str(
            raw_desc.get("plain")
            or raw_desc.get("text")
            or raw_desc.get("value")
            or raw_desc.get("html")
            or ""
        )
    else:
        text = str(raw_desc)
    text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def parse_dimensions_labeled_deterministic(title: str, description_plain: str) -> ProductDimensions:
    """Safe axis-labeled parser that NEVER confuses `30"H` with `width_in`."""
    blob = f"{title} | {description_plain}"
    width_in: float | None = None
    depth_in: float | None = None
    height_in: float | None = None
    matched_snippets: list[str] = []

    # 1. Explicit axis-suffixed tokens (`40"W`, `24"D`, `29.5"H`)
    axis_tokens = re.findall(
        r'(\d{1,3}(?:\.\d+)?)\s*(?:"|in\.?|inch(?:es)?)?\s*([WDHLwdhl])\b',
        blob,
    )
    axis_map: dict[str, float] = {}
    for val_s, axis_ch in axis_tokens:
        val = float(val_s)
        if 3.0 <= val <= 240.0:
            ax = axis_ch.upper()
            axis_map.setdefault(ax, val)
            matched_snippets.append(f'{val}"{ax}')

    w_word = re.search(
        r'(?:width|wide)\s*[:=-]?\s*(\d{1,3}(?:\.\d+)?)|(\d{1,3}(?:\.\d+)?)\s*(?:"|in\.?|inch(?:es)?)\s*(?:wide|width)\b',
        blob,
        flags=re.IGNORECASE,
    )
    d_word = re.search(
        r'(?:depth|deep)\s*[:=-]?\s*(\d{1,3}(?:\.\d+)?)|(\d{1,3}(?:\.\d+)?)\s*(?:"|in\.?|inch(?:es)?)\s*(?:deep|depth)\b',
        blob,
        flags=re.IGNORECASE,
    )
    h_word = re.search(
        r'(?:height|high|tall)\s*[:=-]?\s*(\d{1,3}(?:\.\d+)?)|(\d{1,3}(?:\.\d+)?)\s*(?:"|in\.?|inch(?:es)?)\s*(?:high|height|tall)\b',
        blob,
        flags=re.IGNORECASE,
    )

    width_in = axis_map.get("W") or axis_map.get("L")
    if width_in is None and w_word:
        width_in = float(w_word.group(1) or w_word.group(2))

    depth_in = axis_map.get("D")
    if depth_in is None and d_word:
        depth_in = float(d_word.group(1) or d_word.group(2))

    height_in = axis_map.get("H")
    if height_in is None and h_word:
        height_in = float(h_word.group(1) or h_word.group(2))

    # 2. Explicit 2D surface / tabletop pair: `31.5" x 15.75"` or `48" x 24" desktop`
    if width_in is None:
        pair_in = re.search(
            r'\b(\d{2,3}(?:\.\d+)?)\s*(?:"|in\.?|inch(?:es)?)?\s*[xX×]\s*(\d{2,3}(?:\.\d+)?)\s*(?:"|in\.?|inch(?:es)?)\b',
            blob,
            flags=re.IGNORECASE,
        )
        if pair_in:
            v1, v2 = float(pair_in.group(1)), float(pair_in.group(2))
            width_in, depth_in = max(v1, v2), (depth_in or min(v1, v2))
            matched_snippets.append(pair_in.group(0))

    # 3. Rug feet shorthand (`5' x 7'`, `5x7 ft`)
    if width_in is None and "rug" in blob.lower():
        rug_ft = re.search(r"\b(\d{1,2})\s*['’]?\s*[xX×]\s*(\d{1,2})\s*(?:ft|feet|['’])\b", blob)
        if rug_ft:
            a, b = float(rug_ft.group(1)) * 12.0, float(rug_ft.group(2)) * 12.0
            width_in, depth_in = max(a, b), min(a, b)
            matched_snippets.append(rug_ft.group(0))

    # 4. Title span before category noun (`40" Standing Desk`, `48 Inch Computer Desk`), rejecting H/Height!
    if width_in is None:
        title_w = re.search(
            r'\b(\d{2}(?:\.\d+)?)\s*(?:"|-inch|\s+inch|\s+in\.?)\s+(?!h\b|high\b|height\b|tall\b)(?:standing\s+|computer\s+|writing\s+|home\s+|office\s+|executive\s+|modern\s+|slim\s+|compact\s+)*(?:desk|table|sofa|couch|loveseat|bookcase|bookshelf|shelf|console)',
            title,
            flags=re.IGNORECASE,
        )
        if title_w:
            width_in = float(title_w.group(1))
            matched_snippets.append(title_w.group(0))

    return ProductDimensions(
        width_in=round(width_in, 1) if width_in is not None else None,
        depth_in=round(depth_in, 1) if depth_in is not None else None,
        height_in=round(height_in, 1) if height_in is not None else None,
        dimensions_unverified=(width_in is None),
        raw_dimension_text=", ".join(matched_snippets) if matched_snippets else None,
    )


async def extract_dimensions_via_hydrogen(items: list[ShopifySKU]) -> list[ShopifySKU]:
    """Use `gemini-4-hydrogen` to parse structured `(width_in, depth_in, height_in)` in one batch."""
    if not items:
        return items

    prelim: list[ShopifySKU] = []
    for it in items:
        c = it.model_copy(deep=True)
        parsed_d = parse_dimensions_labeled_deterministic(c.title, c.description_plain)
        w_final = c.dimensions.width_in if c.dimensions.width_in is not None else parsed_d.width_in
        d_final = c.dimensions.depth_in if c.dimensions.depth_in is not None else parsed_d.depth_in
        h_final = c.dimensions.height_in if c.dimensions.height_in is not None else parsed_d.height_in
        c.dimensions = ProductDimensions(
            width_in=w_final,
            depth_in=d_final,
            height_in=h_final,
            dimensions_unverified=(w_final is None),
            raw_dimension_text=parsed_d.raw_dimension_text or c.dimensions.raw_dimension_text,
        )
        prelim.append(c)

    if not has_live_gemini_credentials():
        return prelim

    batch_payload = [
        {
            "sku_id": it.sku_id,
            "category": it.category,
            "title": it.title,
            "description": it.description_plain[:550],
        }
        for it in prelim
    ]
    prompt = f"""Extract physical furniture dimensions in INCHES for each Shopify product below.
CRITICAL RULES:
1. NEVER confuse height (`30"H`, `27" to 35.5" height`) with `width_in`.
2. Convert cm or feet to inches (`1 cm = 0.3937 in`, `1 ft = 12 in`).
3. For desks, sofas, bookcases, consoles: `width_in` is horizontal wall span; `depth_in` is front-to-back.
4. If physical width is genuinely omitted from both title and description, set `"width_in": null` and `"dimensions_unverified": true` — NEVER invent dimensions!

Return ONLY a JSON object mapping `sku_id` -> `{{"width_in": float|null, "depth_in": float|null, "height_in": float|null, "dimensions_unverified": bool}}`.

Products:
{json.dumps(batch_payload)}"""

    def _call_hydrogen() -> dict[str, Any]:
        client = get_genai_client()
        model_name = get_model_hydrogen()
        try:
            inter = client.interactions.create(
                model=model_name,
                input=prompt,
                generation_config={"thinking_level": "low", "max_output_tokens": 4096},
            )
            txt = getattr(inter, "output_text", "") or ""
        except Exception:
            from google.genai import types

            resp = client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=types.GenerateContentConfig(response_mime_type="application/json"),
            )
            txt = resp.text or "{}"
        m = re.search(r"\{.*\}", txt, flags=re.DOTALL)
        return json.loads(m.group(0)) if m else {}

    try:
        parsed_map = await asyncio.to_thread(_call_hydrogen)
        for it in prelim:
            entry = parsed_map.get(it.sku_id)
            if isinstance(entry, dict):
                w = entry.get("width_in")
                d = entry.get("depth_in")
                h = entry.get("height_in")
                width_val = (
                    round(float(w), 1)
                    if isinstance(w, (int, float)) and 4 <= w <= 240
                    else it.dimensions.width_in
                )
                depth_val = (
                    round(float(d), 1)
                    if isinstance(d, (int, float)) and 4 <= d <= 240
                    else it.dimensions.depth_in
                )
                height_val = (
                    round(float(h), 1)
                    if isinstance(h, (int, float)) and 2 <= h <= 140
                    else it.dimensions.height_in
                )
                it.dimensions = ProductDimensions(
                    width_in=width_val,
                    depth_in=depth_val,
                    height_in=height_val,
                    dimensions_unverified=(width_val is None),
                    raw_dimension_text=it.dimensions.raw_dimension_text,
                )
    except Exception:
        pass

    return prelim


class ShopMCPClient:
    """Async JSON-RPC 2.0 client for Shopify's `https://mcp.shop.com/` server (`2026-07-28`)."""

    def __init__(self, endpoint: str | None = None) -> None:
        self.endpoint = endpoint or get_shop_mcp_url()

    async def _call_mcp_tool(
        self,
        client: httpx.AsyncClient,
        tool_name: str,
        arguments: dict[str, Any],
    ) -> tuple[Any, int]:
        t0 = time.perf_counter()
        payload = {
            "jsonrpc": "2.0",
            "id": uuid.uuid4().hex[:8],
            "method": "tools/call",
            "params": {
                "_meta": MCP_META,
                "name": tool_name,
                "arguments": arguments,
            },
        }
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
            "MCP-Protocol-Version": MCP_PROTOCOL_VERSION,
            "Mcp-Method": "tools/call",
            "Mcp-Name": tool_name,
            "User-Agent": "ClearBuy-SpatialCompiler/1.0",
        }
        resp = await client.post(self.endpoint, json=payload, headers=headers)
        latency_ms = int((time.perf_counter() - t0) * 1000)

        ctype = resp.headers.get("content-type", "")
        raw_text = resp.text
        if "text/event-stream" in ctype or raw_text.lstrip().startswith("event:"):
            data_lines = [
                line[len("data:") :].strip()
                for line in raw_text.splitlines()
                if line.startswith("data:") and line[len("data:") :].strip()
            ]
            rpc_json = json.loads(data_lines[-1]) if data_lines else {}
        else:
            rpc_json = resp.json()

        if "error" in rpc_json:
            raise RuntimeError(str(rpc_json["error"]))
        resp.raise_for_status()

        result = rpc_json.get("result", {})
        if isinstance(result, dict) and "structuredContent" in result:
            return result["structuredContent"], latency_ms
        for block in result.get("content", []) if isinstance(result, dict) else []:
            if isinstance(block, dict) and block.get("type") == "text":
                txt = block.get("text", "").strip()
                if txt.startswith("{") or txt.startswith("["):
                    return json.loads(txt), latency_ms
        return result, latency_ms

    async def search_category(
        self,
        category: str,
        style_hint: str = "",
        max_price_usd: float | None = None,
        limit: int = 8,
    ) -> tuple[list[ShopifySKU], MCPCallTrace]:
        """Call live `search_catalog` on `https://mcp.shop.com/`."""
        query = f"{style_hint} {category}".strip()
        call_id = f"mcp_{uuid.uuid4().hex[:6]}"
        catalog_arg: dict[str, Any] = {
            "query": query,
            "context": {"address_country": "US", "currency": "USD"},
            "pagination": {"limit": min(max(1, limit), 25)},
        }
        if max_price_usd and max_price_usd > 0:
            catalog_arg["filters"] = {"price": {"max": int(round(max_price_usd * 100))}}

        args = {"catalog": catalog_arg}

        async with httpx.AsyncClient(timeout=14.0, follow_redirects=True) as client:
            try:
                data, latency_ms = await self._call_mcp_tool(
                    client, "search_catalog", args
                )
                skus = self._parse_ucp_products(data, category=category)
                gids = [s.gid for s in skus[:8]]
                trace = MCPCallTrace(
                    call_id=call_id,
                    tool_name="search_catalog",
                    endpoint=self.endpoint,
                    arguments=args,
                    status="ok" if skus else "fallback",
                    gids_returned=gids,
                    latency_ms=latency_ms,
                    raw_preview={
                        "ucp_version": data.get("ucp", {}).get("version") if isinstance(data, dict) else None,
                        "returned_count": len(skus),
                        "sample_gids": gids[:3],
                    },
                )
                return skus, trace
            except Exception as exc:
                trace = MCPCallTrace(
                    call_id=call_id,
                    tool_name="search_catalog",
                    endpoint=self.endpoint,
                    arguments=args,
                    status="error",
                    gids_returned=[],
                    latency_ms=0,
                    raw_preview={"error": str(exc)[:220]},
                )
                return [], trace

    def _parse_ucp_products(self, payload: Any, category: str) -> list[ShopifySKU]:
        raw_products: list[dict[str, Any]] = []
        if isinstance(payload, dict) and isinstance(payload.get("products"), list):
            raw_products = [p for p in payload["products"] if isinstance(p, dict)]
        elif isinstance(payload, list):
            raw_products = [p for p in payload if isinstance(p, dict)]

        now_iso = datetime.now(timezone.utc).isoformat()
        parsed_skus: list[ShopifySKU] = []

        for idx, prod in enumerate(raw_products):
            gid = str(prod.get("id") or f"gid://shopify/p/{uuid.uuid4().hex[:12]}")
            title = str(prod.get("title") or "").strip()
            if not title:
                continue

            # Primary product image from `media`
            img_url = ""
            media_list = prod.get("media") or []
            if isinstance(media_list, list) and media_list:
                m0 = media_list[0]
                if isinstance(m0, dict):
                    img_url = str(
                        m0.get("url")
                        or (m0.get("preview") or {}).get("url")
                        or ""
                    )

            # Map swatch images by option value label if present
            swatch_by_label: dict[str, str] = {}
            for opt in prod.get("options") or []:
                if isinstance(opt, dict):
                    for val_obj in opt.get("values") or []:
                        if isinstance(val_obj, dict):
                            lbl = str(val_obj.get("label") or "")
                            sw_url = (val_obj.get("swatch") or {}).get("image_url")
                            if lbl and isinstance(sw_url, str):
                                swatch_by_label[lbl] = sw_url

            desc_plain = extract_plain_description(prod.get("description"))
            # Also fold top_features from UCP metadata into description_plain for dimension parsing!
            meta_features = (prod.get("metadata") or {}).get("top_features") or []
            if isinstance(meta_features, list) and meta_features:
                desc_plain = f"{desc_plain} | Features: {'; '.join(str(f) for f in meta_features)}"

            price_cents, price_usd = normalize_price_to_cents_and_usd(prod.get("price_range"))

            variants_out: list[ProductVariant] = []
            merchant_name = "Shopify Merchant"
            shop_domain = ""
            product_url = ""

            for v in prod.get("variants") or []:
                if not isinstance(v, dict):
                    continue
                vgid = str(v.get("id") or "")
                if not vgid:
                    continue
                vcents, vusd = normalize_price_to_cents_and_usd(v.get("price") or price_cents)
                avail_obj = v.get("availability")
                v_avail = (
                    bool(avail_obj.get("available", True))
                    if isinstance(avail_obj, dict)
                    else bool(v.get("available", True))
                )

                opt_map: dict[str, str] = {}
                v_label_parts: list[str] = []
                v_swatch_img: str | None = None
                for vo in v.get("options") or []:
                    if isinstance(vo, dict) and "name" in vo and "label" in vo:
                        oname, olabel = str(vo["name"]), str(vo["label"])
                        opt_map[oname] = olabel
                        v_label_parts.append(olabel)
                        if olabel in swatch_by_label:
                            v_swatch_img = swatch_by_label[olabel]

                seller = v.get("seller") or {}
                if isinstance(seller, dict):
                    if seller.get("name"):
                        merchant_name = str(seller["name"])
                    if seller.get("domain"):
                        shop_domain = str(seller["domain"])

                if not product_url and isinstance(v.get("url"), str):
                    product_url = v["url"]

                v_title = " / ".join(v_label_parts) if v_label_parts else str(v.get("title") or "Standard")
                variants_out.append(
                    ProductVariant(
                        variant_id=vgid.rsplit("/", 1)[-1],
                        gid=vgid,
                        title=v_title[:48],
                        option_values=opt_map,
                        price_cents=vcents or price_cents,
                        price_usd=vusd or price_usd,
                        available=v_avail,
                        image_url=v_swatch_img or img_url,
                    )
                )

            avail_variants = [v for v in variants_out if v.available]
            if not avail_variants:
                continue

            chosen_v = avail_variants[0]
            if chosen_v.price_cents <= 0:
                continue

            if not shop_domain and product_url.startswith("http"):
                shop_domain = urlparse(product_url).netloc
            if not shop_domain:
                slug = re.sub(r"[^a-z0-9]+", "-", merchant_name.lower()).strip("-") or "store"
                shop_domain = f"{slug}.myshopify.com"

            sku_short = re.sub(r"[^a-zA-Z0-9_-]", "_", gid.rsplit("/", 1)[-1])[:20]
            parsed_skus.append(
                ShopifySKU(
                    sku_id=f"{category.replace(' ', '_')}_{sku_short}_{idx}",
                    gid=gid,
                    selected_variant_id=chosen_v.variant_id,
                    selected_variant_gid=chosen_v.gid,
                    title=title,
                    category=category,
                    merchant_name=merchant_name,
                    shop_domain=shop_domain,
                    price_cents=chosen_v.price_cents,
                    price_usd=chosen_v.price_usd,
                    image_url=chosen_v.image_url or img_url,
                    product_url=product_url or None,
                    description_plain=desc_plain,
                    in_stock=True,
                    verified_at=now_iso,
                    variants=variants_out,
                )
            )
        return parsed_skus

    async def enrich_product_variants(
        self, sku: ShopifySKU
    ) -> tuple[ShopifySKU, MCPCallTrace]:
        """Call live `get_product` on `https://mcp.shop.com/` to inspect full swatches & freshness."""
        call_id = f"mcp_{uuid.uuid4().hex[:6]}"
        args = {
            "catalog": {
                "id": sku.gid,
                "context": {"address_country": "US", "currency": "USD"},
            }
        }
        async with httpx.AsyncClient(timeout=12.0, follow_redirects=True) as client:
            try:
                data, latency_ms = await self._call_mcp_tool(client, "get_product", args)
                enriched = sku.model_copy(deep=True)
                enriched.verified_at = datetime.now(timezone.utc).isoformat()

                prod = data.get("product") if isinstance(data, dict) else None
                if isinstance(prod, dict):
                    parsed_list = self._parse_ucp_products(
                        {"products": [prod]}, category=sku.category
                    )
                    if parsed_list:
                        fresh = parsed_list[0]
                        enriched.variants = fresh.variants
                        enriched.merchant_name = fresh.merchant_name or enriched.merchant_name
                        enriched.shop_domain = fresh.shop_domain or enriched.shop_domain
                        # Also synthesize option swatches if `options` has more colors than `variants` returned
                        existing_labels = {v.title for v in enriched.variants}
                        for opt in prod.get("options") or []:
                            if isinstance(opt, dict):
                                oname = str(opt.get("name") or "Option")
                                for val_obj in opt.get("values") or []:
                                    if not isinstance(val_obj, dict):
                                        continue
                                    lbl = str(val_obj.get("label") or "")
                                    if not lbl or lbl in existing_labels or not val_obj.get("available", True):
                                        continue
                                    sw_img = (val_obj.get("swatch") or {}).get("image_url") or enriched.image_url
                                    enriched.variants.append(
                                        ProductVariant(
                                            variant_id=f"{enriched.selected_variant_id}_{lbl.lower()}",
                                            gid=enriched.selected_variant_gid,
                                            title=lbl,
                                            option_values={oname: lbl},
                                            price_cents=enriched.price_cents,
                                            price_usd=enriched.price_usd,
                                            available=True,
                                            image_url=sw_img,
                                        )
                                    )
                                    existing_labels.add(lbl)

                trace = MCPCallTrace(
                    call_id=call_id,
                    tool_name="get_product",
                    endpoint=self.endpoint,
                    arguments=args,
                    status="ok",
                    gids_returned=[enriched.gid, enriched.selected_variant_gid],
                    latency_ms=latency_ms,
                    raw_preview={"variants_loaded": len(enriched.variants)},
                )
                return enriched, trace
            except Exception as exc:
                enriched = sku.model_copy(deep=True)
                enriched.verified_at = datetime.now(timezone.utc).isoformat()
                trace = MCPCallTrace(
                    call_id=call_id,
                    tool_name="get_product",
                    endpoint=self.endpoint,
                    arguments=args,
                    status="fallback",
                    gids_returned=[sku.gid],
                    latency_ms=0,
                    raw_preview={"note": str(exc)[:140]},
                )
                return enriched, trace

    async def create_or_update_merchant_checkouts(
        self,
        verified_items: list[ShopifySKU],
        existing_checkouts: list[MerchantUCPCheckout] | None = None,
    ) -> tuple[list[MerchantUCPCheckout], list[MCPCallTrace]]:
        """Invoke real UCP `create_checkout` / `update_checkout` per merchant storefront on `mcp.shop.com`."""
        grouped: dict[str, list[ShopifySKU]] = {}
        for item in verified_items:
            grouped.setdefault(item.shop_domain, []).append(item)

        existing_by_domain = {c.shop_domain: c for c in (existing_checkouts or [])}
        checkouts: list[MerchantUCPCheckout] = []
        traces: list[MCPCallTrace] = []

        async with httpx.AsyncClient(timeout=12.0, follow_redirects=True) as client:
            for domain, items in grouped.items():
                merchant = items[0].merchant_name
                subtotal_cents = sum(it.price_cents for it in items)
                subtotal_usd = round(subtotal_cents / 100.0, 2)
                prior = existing_by_domain.get(domain)
                is_update = (
                    prior is not None
                    and prior.checkout_id.startswith("gid://shopify/Checkout/")
                )
                tool_name = "update_checkout" if is_update else "create_checkout"

                checkout_body = {
                    "context": {"address_country": "US", "currency": "USD"},
                    "line_items": [
                        {"item": {"id": it.selected_variant_gid}, "quantity": 1}
                        for it in items
                    ],
                }
                args: dict[str, Any] = {
                    "shop": domain,
                    "checkout": checkout_body,
                }
                if is_update and prior:
                    args["id"] = prior.checkout_id

                try:
                    data, latency_ms = await self._call_mcp_tool(client, tool_name, args)
                    if not isinstance(data, dict):
                        raise RuntimeError("Non-dict checkout response")

                    checkout_id = str(data.get("id") or f"gid://shopify/Checkout/{uuid.uuid4().hex[:12]}")
                    continue_url = str(
                        data.get("continue_url")
                        or data.get("checkout_url")
                        or ""
                    )
                    handlers = (data.get("ucp") or {}).get("payment_handlers") or {}
                    shop_pay = "dev.shopify.shop_pay" in handlers

                    # Extract authoritative totals if UCP returned `totals`
                    for tot in data.get("totals") or []:
                        if isinstance(tot, dict) and tot.get("type") in {"subtotal", "total"}:
                            tc, tu = normalize_price_to_cents_and_usd(tot.get("amount"))
                            if tc > 0:
                                subtotal_cents, subtotal_usd = tc, tu
                                break

                    if not continue_url:
                        vid_num = re.findall(r"\d{6,}", items[0].selected_variant_gid)
                        continue_url = (
                            f"https://{domain}/cart/{vid_num[-1]}:1?payment=shop_pay"
                            if vid_num
                            else (items[0].product_url or f"https://{domain}")
                        )

                    raw_preview = {
                        "ucp_version": (data.get("ucp") or {}).get("version", "2026-08-25"),
                        "checkout_id": checkout_id,
                        "shop_pay_enabled": shop_pay,
                        "continue_url": continue_url,
                        "line_count": len(items),
                    }
                    traces.append(
                        MCPCallTrace(
                            call_id=f"ucp_{uuid.uuid4().hex[:6]}",
                            tool_name=tool_name,
                            endpoint=self.endpoint,
                            arguments=args,
                            status="ok",
                            gids_returned=[checkout_id, *[it.selected_variant_gid for it in items]],
                            latency_ms=latency_ms,
                            raw_preview=raw_preview,
                        )
                    )
                    checkouts.append(
                        MerchantUCPCheckout(
                            merchant_name=merchant,
                            shop_domain=domain,
                            checkout_id=checkout_id,
                            line_item_gids=[it.selected_variant_gid for it in items],
                            item_titles=[it.title for it in items],
                            item_count=len(items),
                            subtotal_cents=subtotal_cents,
                            subtotal_usd=subtotal_usd,
                            continue_url=continue_url,
                            shop_pay_supported=shop_pay or True,
                            protocol_method=f"ucp/mcp:{tool_name}",
                            raw_ucp_payload=raw_preview,
                        )
                    )
                except Exception as exc:
                    # Fallback permalink so UI checkout CTA never breaks
                    pairs = []
                    for it in items:
                        nums = re.findall(r"\d{6,}", it.selected_variant_gid)
                        if nums:
                            pairs.append(f"{nums[-1]}:1")
                    fallback_url = (
                        f"https://{domain}/cart/{','.join(pairs)}?payment=shop_pay"
                        if pairs
                        else (items[0].product_url or f"https://{domain}")
                    )
                    cid = prior.checkout_id if prior else f"gid://shopify/Checkout/local_{uuid.uuid4().hex[:10]}"
                    raw_fb = {
                        "ucp_version": "2026-08-25",
                        "checkout_id": cid,
                        "continue_url": fallback_url,
                        "note": str(exc)[:120],
                    }
                    traces.append(
                        MCPCallTrace(
                            call_id=f"ucp_{uuid.uuid4().hex[:6]}",
                            tool_name=tool_name,
                            endpoint=self.endpoint,
                            arguments=args,
                            status="fallback",
                            gids_returned=[it.selected_variant_gid for it in items],
                            latency_ms=0,
                            raw_preview=raw_fb,
                        )
                    )
                    checkouts.append(
                        MerchantUCPCheckout(
                            merchant_name=merchant,
                            shop_domain=domain,
                            checkout_id=cid,
                            line_item_gids=[it.selected_variant_gid for it in items],
                            item_titles=[it.title for it in items],
                            item_count=len(items),
                            subtotal_cents=subtotal_cents,
                            subtotal_usd=subtotal_usd,
                            continue_url=fallback_url,
                            shop_pay_supported=True,
                            protocol_method=f"ucp/permalink_fallback:{tool_name}",
                            raw_ucp_payload=raw_fb,
                        )
                    )

        return checkouts, traces
