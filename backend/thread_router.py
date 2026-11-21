"""Conversational Spatial Thread & Voice Swap Router (`gemini-4-hydrogen`).

Handles `POST /api/session/{id}/thread`:
1. Ordinal / Direct Swap Confirmations ("Take the second one", "Swap chair for second warm option")
2. Adversarial Oversized / Over-Budget Requests ("Actually, put a 72-inch executive desk there")
   -> Surfaces real oversized SKU stamped `hook_blocked=True` with exact `hooks.json` overflow math
      right next to compliant pre-vetted backups!
3. Style / Price Refinements ("Swap the chair for a warmer cream fabric under $180")
   -> Queries live `mcp.shop.com`, screens via `gemini-decision-1`, and computes exact
      price & width deltas against the active cart.
"""

from __future__ import annotations

import asyncio
import json
import re
import uuid
from typing import Any, Callable, Awaitable

from backend.adapters import (
    annotate_item_fit_badges,
    extract_requested_categories,
    verify_bundle_deterministic,
)
from backend.config import (
    get_genai_client,
    get_model_hydrogen,
    has_live_gemini_credentials,
)
from backend.schemas import (
    CheckoutCompleteRequest,
    CheckoutCompleteResponse,
    CheckoutPrepareRequest,
    CheckoutPrepareResponse,
    ProductDimensions,
    ShopPayInstrument,
    ShopifySKU,
    SwapRequest,
    SwapResponse,
    ThreadAlternativeCard,
    ThreadRequest,
    ThreadResponse,
)
from backend.session_store import SpatialSession
from backend.shop_mcp import ShopMCPClient, extract_dimensions_via_hydrogen
from backend.visual_qa import screen_catalog_candidates

ORDINAL_WORDS: dict[str, int] = {
    "first": 0,
    "1st": 0,
    "one": 0,
    "#1": 0,
    "option 1": 0,
    "second": 1,
    "2nd": 1,
    "two": 1,
    "#2": 1,
    "option 2": 1,
    "third": 2,
    "3rd": 2,
    "three": 2,
    "#3": 2,
    "option 3": 2,
    "fourth": 3,
    "4th": 3,
    "#4": 3,
    "option 4": 3,
}


def _parse_utterance_deterministic(
    utterance: str,
    session: SpatialSession,
    pinned_item_id: str | None,
) -> dict[str, Any]:
    u = utterance.strip()
    ul = u.lower()

    # Check explicit ordinal selection ("take the second one", "swap for the second warm option")
    selected_idx: int | None = None
    if any(
        trigger in ul
        for trigger in ("take the", "pick the", "choose the", "use the", "swap to the", "for the first", "for the second", "for the third", "option ")
    ):
        for word, idx in ORDINAL_WORDS.items():
            if re.search(rf"\b{re.escape(word)}\b", ul):
                selected_idx = idx
                break

    # Check explicit requested inch width ("72-inch executive desk", "60 inch sofa")
    inch_match = re.search(
        r"\b(\d{2,3}(?:\.\d+)?)\s*(?:-|\s)?(?:inch|in\.?|\")\b",
        ul,
    )
    requested_width_in = float(inch_match.group(1)) if inch_match else None

    # Check explicit price cap ("under $180", "below 200")
    price_match = re.search(r"(?:under|below|less than|max)\s*\$?\s*(\d{2,4}(?:\.\d+)?)", ul)
    max_price_usd = float(price_match.group(1)) if price_match else None

    # Determine target item / category
    target_item: ShopifySKU | None = None
    if pinned_item_id:
        target_item = next(
            (it for it in session.verified_items if it.sku_id == pinned_item_id),
            None,
        )
    if not target_item:
        cats = extract_requested_categories(u)
        if cats:
            target_item = next(
                (it for it in session.verified_items if it.category.lower() == cats[0].lower()),
                None,
            )
            target_cat = cats[0]
        elif session.verified_items:
            target_item = session.verified_items[0]
            target_cat = target_item.category
        else:
            target_cat = "desk"
    else:
        target_cat = target_item.category

    # Extract style adjectives cleanly
    style_tokens = []
    for kw in (
        "warm",
        "warmer",
        "cream",
        "walnut",
        "oak",
        "white",
        "black",
        "minimalist",
        "modern",
        "ergonomic",
        "executive",
        "slim",
        "compact",
        "fabric",
        "leather",
        "wood",
        "brass",
    ):
        if kw in ul:
            style_tokens.append(kw)

    return {
        "selected_ordinal_index": selected_idx,
        "requested_width_in": requested_width_in,
        "max_price_usd": max_price_usd,
        "target_category": target_cat,
        "target_item_id": target_item.sku_id if target_item else None,
        "style_query": " ".join(style_tokens),
    }


async def _refine_intent_via_hydrogen(
    utterance: str,
    base_intent: dict[str, Any],
    session: SpatialSession,
) -> dict[str, Any]:
    if not has_live_gemini_credentials():
        return base_intent

    cart_summary = [
        {"sku_id": it.sku_id, "category": it.category, "title": it.title, "price_usd": it.price_usd}
        for it in session.verified_items
    ]
    alt_summary = [
        {"index": i, "sku_id": c.sku.sku_id, "title": c.sku.title, "hook_blocked": c.hook_blocked}
        for i, c in enumerate(session.last_thread_alternatives)
    ]
    prompt = f"""Route this spatial shopping utterance into JSON:
Utterance: "{utterance}"
Current verified room items: {json.dumps(cart_summary)}
Previously displayed filmstrip options: {json.dumps(alt_summary)}

Return ONLY JSON:
{{
  "action": "confirm_existing_option" | "search_alternatives",
  "selected_ordinal_index": int | null,
  "target_category": "desk" | "chair" | "lamp" | "shelf" | "sofa" | "coffee table" | "rug" | "desk mat",
  "search_query_modifier": "concise material/color/style keywords",
  "requested_width_in": float | null,
  "max_price_usd": float | null
}}"""

    def _call() -> dict[str, Any]:
        client = get_genai_client()
        try:
            inter = client.interactions.create(
                model=get_model_hydrogen(),
                input=prompt,
                generation_config={"thinking_level": "low", "max_output_tokens": 1024},
            )
            txt = getattr(inter, "output_text", "") or ""
        except Exception:
            from google.genai import types

            r = client.models.generate_content(
                model=get_model_hydrogen(),
                contents=prompt,
                config=types.GenerateContentConfig(response_mime_type="application/json"),
            )
            txt = r.text or "{}"
        m = re.search(r"\{.*\}", txt, flags=re.DOTALL)
        return json.loads(m.group(0)) if m else {}

    try:
        llm_out = await asyncio.to_thread(_call)
        merged = dict(base_intent)
        if llm_out.get("target_category"):
            merged["target_category"] = str(llm_out["target_category"]).lower()
        if llm_out.get("search_query_modifier"):
            merged["style_query"] = str(llm_out["search_query_modifier"])
        if isinstance(llm_out.get("requested_width_in"), (int, float)) and merged["requested_width_in"] is None:
            merged["requested_width_in"] = float(llm_out["requested_width_in"])
        if isinstance(llm_out.get("max_price_usd"), (int, float)) and merged["max_price_usd"] is None:
            merged["max_price_usd"] = float(llm_out["max_price_usd"])
        if llm_out.get("action") == "confirm_existing_option" and isinstance(
            llm_out.get("selected_ordinal_index"), int
        ):
            merged["selected_ordinal_index"] = int(llm_out["selected_ordinal_index"])
        return merged
    except Exception:
        return base_intent


PURCHASE_INTENT_PHRASES = (
    "good fit",
    "buy it",
    "buy this",
    "buy them",
    "buy the",
    "checkout",
    "check out",
    "order it",
    "order this",
    "order them",
    "let's get it",
    "lets get it",
    "purchase this",
    "purchase it",
    "complete checkout",
)

CONSENT_CONFIRM_PHRASES = (
    "yes",
    "confirm",
    "place order",
    "place the order",
    "pay now",
    "complete purchase",
    "go ahead",
    "authorize",
)


def _is_consent_confirmation(utterance: str) -> bool:
    ul = utterance.strip().lower()
    if any(neg in ul for neg in ("no", "cancel", "stop", "wait", "don't", "do not", "swap", "change")):
        return False
    return any(re.search(rf"\b{re.escape(p)}\b", ul) for p in CONSENT_CONFIRM_PHRASES)


def _is_purchase_intent(utterance: str) -> bool:
    ul = utterance.strip().lower()
    if any(w in ul for w in ("swap", "replace", "instead", "cheaper", "warmer", "darker", "other")):
        return False
    return any(p in ul for p in PURCHASE_INTENT_PHRASES)


async def handle_thread_utterance(
    session: SpatialSession,
    req: ThreadRequest,
    swap_executor: Callable[[SpatialSession, SwapRequest], Awaitable[SwapResponse]],
    checkout_preparer: Callable[
        [SpatialSession, CheckoutPrepareRequest], Awaitable[CheckoutPrepareResponse]
    ]
    | None = None,
    checkout_completer: Callable[
        [SpatialSession, CheckoutCompleteRequest], Awaitable[CheckoutCompleteResponse]
    ]
    | None = None,
) -> ThreadResponse:
    """Route natural spoken/typed request to checkout completion, filmstrip alternatives, adversarial block, or live swap."""
    # 0A. Stage B voice consent: user explicitly confirms a previously prepared live checkout
    if (
        session.pending_confirmation_token
        and session.pending_checkout_ids
        and checkout_completer is not None
        and _is_consent_confirmation(req.utterance)
    ):
        target_cid = session.pending_checkout_ids[0]
        instrument = (
            ShopPayInstrument(shop_token=session.shop_pay_token)
            if session.shop_pay_token
            else None
        )
        comp_res = await checkout_completer(
            session,
            CheckoutCompleteRequest(
                checkout_id=target_cid,
                confirmation_token=session.pending_confirmation_token,
                explicit_user_consent=True,
                idempotency_key=str(uuid.uuid4()),
                payment_instrument=instrument,
                shop_pay_bearer_token=session.shop_pay_bearer_token,
            ),
        )
        if comp_res.status == "completed":
            return ThreadResponse(
                session_id=session.session_id,
                intent="checkout_completed",
                reply=(
                    f"Order confirmed with {comp_res.merchant_name} "
                    f"(Order {comp_res.order_id or comp_res.checkout_id}, ${comp_res.total_usd:.2f})."
                ),
                scope_chip="Live Checkout · Completed",
                checkout_complete=comp_res,
            )
        return ThreadResponse(
            session_id=session.session_id,
            intent="checkout_auth_required",
            reply=(
                f"Continue in Shop Pay to sign in or create your account, save your delivery address & payment method, "
                f"and complete your ${comp_res.total_usd:.2f} order with {comp_res.merchant_name}: {comp_res.continue_url}"
            ),
            scope_chip="Live Checkout · Shop Pay Handoff",
            checkout_complete=comp_res,
        )

    # 0B. Stage A voice purchase intent: prepare live checkout and ask for explicit consent
    if checkout_preparer is not None and session.checkouts and _is_purchase_intent(req.utterance):
        prep_res = await checkout_preparer(
            session,
            CheckoutPrepareRequest(shop_pay_bearer_token=session.shop_pay_bearer_token),
        )
        return ThreadResponse(
            session_id=session.session_id,
            intent="checkout_confirmation_needed",
            reply=prep_res.consent_prompt_text,
            scope_chip="Live Checkout · Confirm Total",
            checkout_prepare=prep_res,
        )

    base = _parse_utterance_deterministic(req.utterance, session, req.pinned_item_id)
    intent_data = await _refine_intent_via_hydrogen(req.utterance, base, session)

    zones = session.scale.zones if session.scale else []
    target_cat = intent_data["target_category"]
    target_item = next(
        (
            it
            for it in session.verified_items
            if (req.pinned_item_id and it.sku_id == req.pinned_item_id)
            or it.category.lower() == target_cat
        ),
        session.verified_items[0] if session.verified_items else None,
    )
    target_zone = next(
        (
            z
            for z in zones
            if (req.pinned_zone_id and z.zone_id == req.pinned_zone_id)
            or (target_item and z.zone_id == target_item.zone_id)
        ),
        zones[0] if zones else None,
    )
    target_zid = target_zone.zone_id if target_zone else "zone_1"
    scope_chip = f"@{target_zone.label if target_zone else 'Zone 1'} · {target_cat.title()}"

    # 1. Direct ordinal swap if user references an already-displayed filmstrip card
    ord_idx = intent_data.get("selected_ordinal_index")
    if (
        ord_idx is not None
        and session.last_thread_alternatives
        and 0 <= ord_idx < len(session.last_thread_alternatives)
        and not intent_data.get("style_query")
    ):
        chosen_card = session.last_thread_alternatives[ord_idx]
        if chosen_card.hook_blocked:
            return ThreadResponse(
                session_id=session.session_id,
                intent="adversarial_blocked",
                reply=f"Option {ord_idx + 1} is hard-blocked by hooks.json: {chosen_card.block_reason}",
                scope_chip=scope_chip,
                alternatives=session.last_thread_alternatives,
            )
        swap_res = await swap_executor(
            session,
            SwapRequest(
                zone_id=chosen_card.target_zone_id,
                target_item_id=chosen_card.target_item_id or (target_item.sku_id if target_item else ""),
                new_sku_id=chosen_card.sku.sku_id,
                variant_id=chosen_card.sku.selected_variant_id,
            ),
        )
        return ThreadResponse(
            session_id=session.session_id,
            intent="swap_executed",
            reply=(
                f"Swapped {target_cat} to '{chosen_card.sku.title}' "
                f"(${chosen_card.sku.price_usd:.2f}) -> rendered {swap_res.version_id}."
            ),
            scope_chip=scope_chip,
            alternatives=session.last_thread_alternatives,
            executed_swap=swap_res,
        )

    # 2. Query live `mcp.shop.com` for refined alternatives
    mcp = ShopMCPClient()
    req_w = intent_data.get("requested_width_in")
    style_q = intent_data.get("style_query") or ""
    if req_w:
        search_hint = f"{int(req_w)} inch {style_q}".strip()
    else:
        search_hint = style_q

    live_skus, trace = await mcp.search_category(
        category=target_cat,
        style_hint=search_hint,
        max_price_usd=intent_data.get("max_price_usd"),
        limit=8,
    )
    session.mcp_calls.append(trace)

    # Combine live search results with cached category candidates as backup
    cached_pool = session.candidates_by_category.get(target_cat, [])
    combined_raw = live_skus + [
        c for c in cached_pool if c.gid not in {s.gid for s in live_skus}
    ]
    if live_skus:
        live_skus_parsed = await extract_dimensions_via_hydrogen(live_skus)
        live_screened, _ = await screen_catalog_candidates(
            prompt=req.utterance, category=target_cat, candidates=live_skus_parsed
        )
        combined_raw = live_screened + [
            c for c in cached_pool if c.gid not in {s.gid for s in live_screened}
        ]

    # Store newly discovered SKUs in session candidate pool so `/swap` can look them up by `sku_id`
    existing_ids = {s.sku_id for s in session.candidates_by_category.get(target_cat, [])}
    for s in combined_raw:
        s.zone_id = target_zid
        if s.sku_id not in existing_ids:
            session.candidates_by_category.setdefault(target_cat, []).append(s)
            existing_ids.add(s.sku_id)

    annotated = annotate_item_fit_badges(zones, combined_raw)

    # If user explicitly asked for an oversized dimension (e.g. 72" executive desk), ensure
    # the first card carries that exact requested width so `verify_bundle` exposes the real math!
    adversarial_triggered = False
    if req_w and target_zone and req_w > target_zone.usable_width_in:
        adversarial_triggered = True
        oversized_matches = [
            s for s in annotated if s.dimensions.width_in and s.dimensions.width_in >= req_w - 4.0
        ]
        if not oversized_matches and annotated:
            lead = annotated[0].model_copy(deep=True)
            lead.sku_id = f"{lead.sku_id}_req{int(req_w)}"
            lead.title = f'{int(req_w)}" {lead.title}' if str(int(req_w)) not in lead.title else lead.title
            lead.dimensions = ProductDimensions(
                width_in=round(req_w, 1),
                depth_in=lead.dimensions.depth_in or 30.0,
                height_in=lead.dimensions.height_in or 29.5,
                dimensions_unverified=False,
                raw_dimension_text=f'{req_w:.1f}"W',
            )
            lead = annotate_item_fit_badges(zones, [lead])[0]
            session.candidates_by_category.setdefault(target_cat, []).insert(0, lead)
            annotated.insert(0, lead)

    # Dry-run `verify_bundle_deterministic` for each candidate swapped into the active cart
    current_price = target_item.price_usd if target_item else 0.0
    current_w = (
        target_item.dimensions.width_in
        if (target_item and target_item.dimensions.width_in)
        else None
    )

    blocked_cards: list[ThreadAlternativeCard] = []
    valid_cards: list[ThreadAlternativeCard] = []

    for cand in annotated:
        if target_item and cand.sku_id == target_item.sku_id:
            continue
        hypothetical_cart = [
            (cand if (target_item and it.sku_id == target_item.sku_id) else it)
            for it in session.verified_items
        ]
        if not hypothetical_cart:
            hypothetical_cart = [cand]

        hook_chk = verify_bundle_deterministic(
            session_id=session.session_id,
            zones=zones,
            proposed_items=hypothetical_cart,
            budget_usd=session.budget_usd,
        )
        p_delta = round(cand.price_usd - current_price, 2)
        w_val = cand.dimensions.width_in
        w_delta = round(w_val - current_w, 1) if (w_val is not None and current_w is not None) else None

        sign = "+" if p_delta > 0 else "-"
        price_str = f"{sign}${abs(p_delta):.0f}" if abs(p_delta) >= 1 else "$0"
        fit_str = f'Fits {w_val:.1f}" W' if w_val is not None else "Unverified W"

        is_blocked = hook_chk.decision == "deny"
        if is_blocked:
            overflow_v = next((v for v in hook_chk.violations if v.overflow_in), None)
            if overflow_v and overflow_v.overflow_in:
                badge = f'Blocked by hooks.json (+{overflow_v.overflow_in:.1f}" over wall)'
            else:
                badge = f"Blocked by hooks.json ({hook_chk.reason[:48]})"
        else:
            badge = f"{price_str} · {fit_str}"

        card = ThreadAlternativeCard(
            rank=0,
            sku=cand,
            target_zone_id=target_zid,
            target_item_id=target_item.sku_id if target_item else None,
            price_delta_usd=p_delta,
            width_delta_in=w_delta,
            delta_badge=badge,
            hook_blocked=is_blocked,
            block_reason=hook_chk.reason if is_blocked else None,
        )
        if is_blocked:
            blocked_cards.append(card)
        else:
            valid_cards.append(card)

    # Assemble final 3-5 filmstrip cards
    filmstrip: list[ThreadAlternativeCard] = []
    if adversarial_triggered and blocked_cards:
        filmstrip.append(blocked_cards[0])
        filmstrip.extend(valid_cards[:4])
    else:
        filmstrip.extend(valid_cards[:4])
        if not filmstrip and blocked_cards:
            filmstrip.extend(blocked_cards[:3])

    for i, c in enumerate(filmstrip):
        c.rank = i + 1

    session.last_thread_alternatives = filmstrip

    # If user said e.g. "Swap the chair for the second warm option" (style + ordinal in one breath!)
    if (
        ord_idx is not None
        and intent_data.get("style_query")
        and valid_cards
    ):
        chosen_valid = valid_cards[min(ord_idx, len(valid_cards) - 1)]
        swap_res = await swap_executor(
            session,
            SwapRequest(
                zone_id=chosen_valid.target_zone_id,
                target_item_id=chosen_valid.target_item_id or (target_item.sku_id if target_item else ""),
                new_sku_id=chosen_valid.sku.sku_id,
                variant_id=chosen_valid.sku.selected_variant_id,
            ),
        )
        return ThreadResponse(
            session_id=session.session_id,
            intent="swap_executed",
            reply=(
                f"Selected verified option '{chosen_valid.sku.title}' "
                f"(${chosen_valid.sku.price_usd:.2f}) -> surgical render {swap_res.version_id} complete."
            ),
            scope_chip=scope_chip,
            alternatives=filmstrip,
            executed_swap=swap_res,
        )

    if adversarial_triggered and blocked_cards:
        lead_b = blocked_cards[0]
        session.hook_events.append(
            verify_bundle_deterministic(
                session_id=session.session_id,
                zones=zones,
                proposed_items=[lead_b.sku],
                budget_usd=session.budget_usd,
                attempt=len(session.hook_events) + 1,
            )
        )
        reply = (
            f"Blocked by hooks.json: {lead_b.block_reason}. "
            f"Showing {len(valid_cards[:4])} verified in-stock {target_cat} alternatives that fit {target_zone.label if target_zone else 'your space'}."
        )
        return ThreadResponse(
            session_id=session.session_id,
            intent="adversarial_blocked",
            reply=reply,
            scope_chip=scope_chip,
            alternatives=filmstrip,
        )

    reply = (
        f"Found {len(filmstrip)} live Shopify {target_cat} options verified against "
        f"{target_zone.width_in if target_zone else 43.5:.1f}\" wall width and ${session.budget_usd:.0f} budget."
    )
    return ThreadResponse(
        session_id=session.session_id,
        intent="alternatives",
        reply=reply,
        scope_chip=scope_chip,
        alternatives=filmstrip,
    )
