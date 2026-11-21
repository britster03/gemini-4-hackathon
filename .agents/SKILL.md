---
name: spatial-commerce
description: Playbook for querying live Shopify Shop MCP inventory, normalizing minor-unit cent prices, extracting structured WxDxH dimensions without height-vs-width confusion, and committing verified cart proposals.
---

# Shopify Shop MCP & Spatial Spec Playbook

## 1. Price Normalization (Minor Units -> USD)
- `shop.dev` / `mcp.shop.com` returns prices in **integer minor units (cents)** (e.g., `12995` = `$129.95`).
- Always compute `price_usd = round(int(price_cents) / 100.0, 2)` and include both `price_cents` and `price_usd` in `/workspace/cart_proposal.json`.

## 2. Dimension Parsing (`W × D × H`)
- Merchant `description` fields may be nested dicts (`{"plain": "..."}`) or plain strings.
- Never confuse vertical height (`30"H`, `Seat Height 19"`) with horizontal width (`width_in`).
- Convert metric dimensions (`120 cm` -> `47.24 in`, divide cm by `2.54`) before writing `width_in`, `depth_in`, `height_in`.
- Prefer SKUs with verified physical dimensions (`dimensions_unverified: false`) for all `floor_anchor` items.

## 3. `/workspace/cart_proposal.json` Schema
```json
{
  "budget_usd": 450.0,
  "rationale": "Selected 40 in compact desk + ergonomic mesh chair + warm task lamp fitting Z1 (41.5 in usable width) with $42.05 budget headroom.",
  "items": [
    {
      "item_id": "item_1",
      "zone_id": "Z1",
      "sku_id": "gid://shopify/Product/8123456789",
      "variant_id": "gid://shopify/ProductVariant/44123456789",
      "title": "Compact 40-Inch Standing Desk",
      "merchant_name": "Branch Furniture",
      "price_cents": 21900,
      "price_usd": 219.0,
      "width_in": 40.0,
      "depth_in": 24.0,
      "height_in": 29.5,
      "dimensions_unverified": false,
      "placement_mode": "floor_anchor",
      "category": "desk",
      "image_url": "https://cdn.shopify.com/...",
      "product_url": "https://..."
    }
  ]
}
```
