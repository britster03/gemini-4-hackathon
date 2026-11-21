"""ClearBuy (Datum) — FastAPI SSE Orchestrator (Engineer B).

Implements all 5 Frozen API Contracts (Blueprint Section 04, Page 17):
1. `POST /api/session/start` -> SSE stream (`scale_ready`, `catalog_ready`,
   `hook_event`, `cart_ready`, `render_ready`) + `GET /api/session/{id}/stream`
2. `POST /api/session/{id}/thread` -> Conversational voice/text spatial thread
3. `POST /api/session/{id}/swap` -> `verify_bundle` gate (422 on deny) + stateful
   Nano Banana 2.1 surgical swap + `gemini-decision-1` QA + UCP `update_checkout`
4. `PATCH /api/session/{id}/zone` -> Instantaneous CAD caliper drag override
5. `GET /api/benchmark` -> 14-room NYU Depth V2 Kinect + Gemini 4 ablation results
"""

from __future__ import annotations

import asyncio
import base64
import json
import os
import time
import uuid
from io import BytesIO
from typing import Any, AsyncIterator

from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image

from backend.adapters import (
    annotate_item_fit_badges,
    extract_requested_categories,
    run_scale_calibration,
    solve_combinatorial_bundle,
    verify_bundle_deterministic,
)
from backend.config import (
    EVAL_DATA_DIR,
    EVAL_RESULTS_PATH,
    get_model_decision,
    get_model_hydrogen,
    get_model_nano_banana,
    get_model_neon,
    get_shop_mcp_url,
    has_live_gemini_credentials,
)
from backend.renderer import (
    compute_hotspot_pins,
    render_initial_bundle,
    render_surgical_swap,
    render_targeted_repair,
)
from backend.schemas import (
    CartReadyEvent,
    CatalogReadyEvent,
    MCPCallTrace,
    RenderReadyEvent,
    RenderVersion,
    ShopifySKU,
    SpaceScope,
    SwapRequest,
    SwapResponse,
    ThreadRequest,
    ThreadResponse,
    ZoneOverrideRequest,
    ZoneOverrideResponse,
)
from backend.session_store import SpatialSession, get_session, put_session
from backend.shop_mcp import ShopMCPClient, extract_dimensions_via_hydrogen
from backend.thread_router import handle_thread_utterance
from backend.visual_qa import audit_rendered_room, screen_catalog_candidates

app = FastAPI(
    title="ClearBuy (Datum) — Verified Spatial Commerce Compiler API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Session-Id"],
)

EVAL_DATA_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/api/benchmark/assets", StaticFiles(directory=str(EVAL_DATA_DIR)), name="benchmark_assets")


def _sse_frame(event_name: str, data: dict[str, Any]) -> str:
    return f"event: {event_name}\ndata: {json.dumps(data)}\n\n"


def _normalize_image_bytes(raw_bytes: bytes) -> tuple[bytes, str]:
    """Ensure uploaded room image is clean RGB JPEG <= 1024px on the long edge."""
    img = Image.open(BytesIO(raw_bytes)).convert("RGB")
    if max(img.size) > 1024:
        img.thumbnail((1024, 1024))
    buf = BytesIO()
    img.save(buf, format="JPEG", quality=90)
    return buf.getvalue(), "image/jpeg"


async def _run_session_pipeline(session: SpatialSession) -> None:
    """Execute the full 5-stage verified pipeline while emitting live SSE frames."""
    try:
        session.emit_sse(
            "session_started",
            {
                "session_id": session.session_id,
                "prompt": session.prompt,
                "budget_usd": session.budget_usd,
                "scope": session.scope,
            },
        )

        primary_img_bytes, primary_mime = session.room_images[0]

        # ------------------------------------------------------------------
        # Stage 1: Zero-Measurement Scale Calibration (`scale_ready`)
        # ------------------------------------------------------------------
        scale_ev = await run_scale_calibration(
            session_id=session.session_id,
            image_bytes=primary_img_bytes,
            mime_type=primary_mime,
            prompt=session.prompt,
            scope=session.scope,
            exif_focal_mm=session.exif_focal_mm,
            thinking_level="xhigh",
        )
        session.scale = scale_ev
        session.emit_sse("scale_ready", scale_ev.model_dump())

        # ------------------------------------------------------------------
        # Stage 2: Live Shopify `mcp.shop.com` Discovery + Decisions Gate (`catalog_ready`)
        # ------------------------------------------------------------------
        t_cat = time.perf_counter()
        requested_categories = extract_requested_categories(
            session.prompt, scope=scale_ev.detected_scope
        )
        mcp = ShopMCPClient()

        search_tasks = [
            mcp.search_category(
                category=cat,
                style_hint="",
                max_price_usd=session.budget_usd,
                limit=8,
            )
            for cat in requested_categories
        ]
        raw_search_results = await asyncio.gather(*search_tasks)

        candidates_by_category: dict[str, list[ShopifySKU]] = {}
        mcp_traces: list[MCPCallTrace] = []
        stores_seen: set[str] = set()
        total_decisions_ms = 0

        for cat, (skus, trace) in zip(requested_categories, raw_search_results):
            mcp_traces.append(trace)
            for s in skus:
                stores_seen.add(s.shop_domain)
            # Extract structured W x D x H via `gemini-4-hydrogen` + screen via `gemini-decision-1`
            with_dims = await extract_dimensions_via_hydrogen(skus)
            screened, dec_ms = await screen_catalog_candidates(
                prompt=session.prompt,
                category=cat,
                candidates=with_dims,
            )
            total_decisions_ms = max(total_decisions_ms, dec_ms)
            candidates_by_category[cat] = annotate_item_fit_badges(scale_ev.zones, screened)

        session.candidates_by_category = candidates_by_category
        session.mcp_calls.extend(mcp_traces)

        catalog_ev = CatalogReadyEvent(
            session_id=session.session_id,
            queries_executed=requested_categories,
            stores_scanned=len(stores_seen),
            candidates_count=sum(len(v) for v in candidates_by_category.values()),
            mcp_calls=mcp_traces,
            candidates_by_category=candidates_by_category,
            decisions_gate_latency_ms=total_decisions_ms,
            elapsed_ms=int((time.perf_counter() - t_cat) * 1000),
        )
        session.catalog = catalog_ev
        session.emit_sse("catalog_ready", catalog_ev.model_dump())

        # ------------------------------------------------------------------
        # Stage 3: `hooks.json` Combinatorial Solver (`hook_event` DENY -> ALLOW)
        # ------------------------------------------------------------------
        verified_bundle, hook_events, refusal_reason = solve_combinatorial_bundle(
            session_id=session.session_id,
            zones=scale_ev.zones,
            candidates_by_category=candidates_by_category,
            budget_usd=session.budget_usd,
        )
        session.hook_events.extend(hook_events)
        for hev in hook_events:
            session.emit_sse("hook_event", hev.model_dump())

        if refusal_reason or not verified_bundle:
            refusal_cart = CartReadyEvent(
                session_id=session.session_id,
                status="safe_refusal",
                refusal_reason=refusal_reason or "No compliant bundle fits constraints.",
                verified_items=[],
                total_cents=0,
                total_usd=0.0,
                budget_usd=session.budget_usd,
                remaining_budget_usd=session.budget_usd,
                checkouts=[],
                mcp_calls=mcp_traces,
            )
            session.cart = refusal_cart
            session.emit_sse("cart_ready", refusal_cart.model_dump())
            session.mark_complete()
            return

        # ------------------------------------------------------------------
        # Stage 4: Live `get_product` Swatches + Per-Merchant UCP Checkouts (`cart_ready`)
        # ------------------------------------------------------------------
        t_cart = time.perf_counter()
        enrich_results = await asyncio.gather(
            *[mcp.enrich_product_variants(it) for it in verified_bundle]
        )
        enriched_items = annotate_item_fit_badges(
            scale_ev.zones, [r[0] for r in enrich_results]
        )
        variant_traces = [r[1] for r in enrich_results]
        session.mcp_calls.extend(variant_traces)

        # Re-verify exact price after live variant enrichment
        post_enrich_hook = verify_bundle_deterministic(
            session_id=session.session_id,
            zones=scale_ev.zones,
            proposed_items=enriched_items,
            budget_usd=session.budget_usd,
            attempt=len(session.hook_events) + 1,
        )
        if post_enrich_hook.decision == "deny":
            # Keep original search variant snapshot if enriched default variant jumped in price
            enriched_items = verified_bundle

        checkouts, ucp_traces = await mcp.create_or_update_merchant_checkouts(enriched_items)
        session.mcp_calls.extend(ucp_traces)
        session.verified_items = enriched_items
        session.checkouts = checkouts

        total_cents = sum(it.price_cents for it in enriched_items)
        total_usd = round(total_cents / 100.0, 2)
        cart_ev = CartReadyEvent(
            session_id=session.session_id,
            status="verified",
            verified_items=enriched_items,
            total_cents=total_cents,
            total_usd=total_usd,
            budget_usd=session.budget_usd,
            remaining_budget_usd=round(session.budget_usd - total_usd, 2),
            checkouts=checkouts,
            mcp_calls=variant_traces + ucp_traces,
            elapsed_ms=int((time.perf_counter() - t_cart) * 1000),
        )
        session.cart = cart_ev
        session.emit_sse("cart_ready", cart_ev.model_dump())

        # ------------------------------------------------------------------
        # Stage 5: Nano Banana 2.1 Render + `gemini-decision-1` QA (`render_ready`)
        # ------------------------------------------------------------------
        t_ren = time.perf_counter()
        render_bytes, render_mime, inter_id, sku_refs = await render_initial_bundle(
            room_image_bytes=primary_img_bytes,
            room_mime=primary_mime,
            zones=scale_ev.zones,
            verified_items=enriched_items,
            protected_anchors=scale_ev.protected_anchors,
        )

        qa_verdict = await audit_rendered_room(
            original_room_bytes=primary_img_bytes,
            original_mime=primary_mime,
            sku_images=sku_refs,
            rendered_room_bytes=render_bytes,
            rendered_mime=render_mime,
            was_repaired=False,
        )

        repaired = False
        repair_reason: str | None = None
        if qa_verdict.status == "failed" and qa_verdict.defect_summary:
            repair_reason = qa_verdict.defect_summary
            session.emit_sse(
                "qa_repairing",
                {
                    "session_id": session.session_id,
                    "defect_summary": repair_reason,
                    "message": f"Repairing render ({repair_reason})...",
                },
            )
            render_bytes, render_mime, inter_id = await render_targeted_repair(
                room_image_bytes=primary_img_bytes,
                failed_render_bytes=render_bytes,
                prior_interaction_id=inter_id,
                defect_summary=repair_reason,
            )
            repaired = True
            qa_verdict = await audit_rendered_room(
                original_room_bytes=primary_img_bytes,
                original_mime=primary_mime,
                sku_images=sku_refs,
                rendered_room_bytes=render_bytes,
                rendered_mime=render_mime,
                was_repaired=True,
            )

        b64_render = base64.b64encode(render_bytes).decode("utf-8")
        v1 = RenderVersion(
            version_id="v1",
            label="v1 · Initial Verified Layout",
            image_b64=b64_render,
            image_mime=render_mime,
            interaction_id=inter_id,
            decisions_qa=qa_verdict,
            repaired=repaired,
            active_sku_ids=[it.sku_id for it in enriched_items],
        )
        session.versions.append(v1)
        session.last_render_interaction_id = inter_id
        session.last_render_bytes = render_bytes

        pins = compute_hotspot_pins(scale_ev.zones, enriched_items)
        render_ev = RenderReadyEvent(
            session_id=session.session_id,
            version_id="v1",
            versions_available=["v1"],
            image_b64=b64_render,
            image_mime=render_mime,
            hotspot_pins=pins,
            decisions_qa=qa_verdict,
            repaired=repaired,
            repair_reason=repair_reason,
            elapsed_ms=int((time.perf_counter() - t_ren) * 1000),
        )
        session.emit_sse("render_ready", render_ev.model_dump())
    except Exception as exc:
        session.emit_sse(
            "session_error",
            {"session_id": session.session_id, "error": str(exc)},
        )
    finally:
        session.mark_complete()


async def _stream_session_events(session: SpatialSession) -> AsyncIterator[str]:
    q: asyncio.Queue[tuple[str, dict[str, Any]] | None] = asyncio.Queue()
    # Subscribe BEFORE snapshotting history so zero events can drop across yields
    session.subscribers.append(q)
    try:
        snapshot = list(session.sse_history)
        already_done = session.completed
        for ev_name, payload in snapshot:
            yield _sse_frame(ev_name, payload)
        if already_done:
            yield _sse_frame("complete", {"session_id": session.session_id})
            return

        while True:
            item = await q.get()
            if item is None:
                yield _sse_frame("complete", {"session_id": session.session_id})
                break
            ev_name, payload = item
            yield _sse_frame(ev_name, payload)
    finally:
        if q in session.subscribers:
            session.subscribers.remove(q)


@app.get("/api/health")
async def health_check() -> dict[str, Any]:
    return {
        "status": "ok",
        "service": "clearbuy-spatial-compiler",
        "gemini_credentials_ready": has_live_gemini_credentials(),
        "models": {
            "scale_neon": get_model_neon(),
            "router_hydrogen": get_model_hydrogen(),
            "renderer_nano_banana": get_model_nano_banana(),
            "policy_decisions": get_model_decision(),
        },
        "shop_mcp_endpoint": get_shop_mcp_url(),
        "benchmark_results_present": EVAL_RESULTS_PATH.exists(),
    }


@app.post("/api/session/start")
async def start_session(
    images: list[UploadFile] = File(..., description="1-3 room photos (1024px JPEG/PNG)"),
    prompt: str = Form(..., description="Spoken/typed room goal"),
    budget_usd: float = Form(450.0, description="Strict maximum USD budget"),
    exif_focal_mm: float | None = Form(None, description="Optional 35mm-equivalent EXIF focal length"),
    scope: SpaceScope = Form("auto"),
    mode: str = Query("sse", description="'sse' streams events directly; 'async' returns JSON + stream_url"),
) -> Any:
    if not images:
        raise HTTPException(status_code=400, detail="At least 1 room image is required.")

    normalized_imgs: list[tuple[bytes, str]] = []
    for up in images[:3]:
        raw = await up.read()
        if not raw:
            continue
        normalized_imgs.append(_normalize_image_bytes(raw))

    if not normalized_imgs:
        raise HTTPException(status_code=400, detail="Uploaded image files were empty.")

    session_id = f"sess_{uuid.uuid4().hex[:10]}"
    session = SpatialSession(
        session_id=session_id,
        prompt=prompt,
        budget_usd=budget_usd,
        scope=scope,
        exif_focal_mm=exif_focal_mm,
        room_images=normalized_imgs,
    )
    put_session(session)
    asyncio.create_task(_run_session_pipeline(session))

    if mode == "async":
        return {
            "session_id": session_id,
            "stream_url": f"/api/session/{session_id}/stream",
        }

    return StreamingResponse(
        _stream_session_events(session),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "X-Session-Id": session_id,
        },
    )


@app.get("/api/session/{session_id}/stream")
async def stream_session(session_id: str) -> StreamingResponse:
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found.")
    return StreamingResponse(
        _stream_session_events(session),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Session-Id": session_id,
        },
    )


@app.get("/api/session/{session_id}")
async def get_session_snapshot(session_id: str) -> dict[str, Any]:
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found.")
    return {
        "session_id": session.session_id,
        "completed": session.completed,
        "prompt": session.prompt,
        "budget_usd": session.budget_usd,
        "scale": session.scale.model_dump() if session.scale else None,
        "hook_events": [h.model_dump() for h in session.hook_events],
        "cart": session.cart.model_dump() if session.cart else None,
        "versions": [
            {
                "version_id": v.version_id,
                "label": v.label,
                "decisions_qa": v.decisions_qa.model_dump(),
                "repaired": v.repaired,
            }
            for v in session.versions
        ],
    }


def _lookup_candidate_sku(session: SpatialSession, sku_id: str) -> ShopifySKU | None:
    for skus in session.candidates_by_category.values():
        for s in skus:
            if s.sku_id == sku_id or s.gid == sku_id:
                return s.model_copy(deep=True)
    for card in session.last_thread_alternatives:
        if card.sku.sku_id == sku_id or card.sku.gid == sku_id:
            return card.sku.model_copy(deep=True)
    for it in session.verified_items:
        if it.sku_id == sku_id or it.gid == sku_id:
            return it.model_copy(deep=True)
    return None


async def execute_session_swap(session: SpatialSession, req: SwapRequest) -> SwapResponse:
    """Core `hooks.json` -> stateful Nano Banana surgical swap -> Decisions QA -> UCP update flow."""
    zones = session.scale.zones if session.scale else []
    target_item = next(
        (it for it in session.verified_items if it.sku_id == req.target_item_id),
        session.verified_items[0] if session.verified_items else None,
    )
    if not target_item:
        raise HTTPException(status_code=404, detail=f"Target item '{req.target_item_id}' not in active cart.")

    new_sku = _lookup_candidate_sku(session, req.new_sku_id)
    if not new_sku:
        raise HTTPException(status_code=404, detail=f"Candidate SKU '{req.new_sku_id}' not found in session.")

    new_sku.zone_id = req.zone_id or target_item.zone_id

    # Apply requested variant swatch if specified
    if req.variant_id:
        matched_v = next(
            (v for v in new_sku.variants if v.variant_id == req.variant_id or v.gid == req.variant_id),
            None,
        )
        if matched_v:
            new_sku.selected_variant_id = matched_v.variant_id
            new_sku.selected_variant_gid = matched_v.gid
            new_sku.price_cents = matched_v.price_cents
            new_sku.price_usd = matched_v.price_usd
            if matched_v.image_url:
                new_sku.image_url = matched_v.image_url

    proposed_cart = [
        (new_sku if it.sku_id == target_item.sku_id else it)
        for it in session.verified_items
    ]

    # 1. Hard `verify_bundle.py` / `hooks.json` gate BEFORE rendering or checkout update!
    hook_ev = verify_bundle_deterministic(
        session_id=session.session_id,
        zones=zones,
        proposed_items=proposed_cart,
        budget_usd=session.budget_usd,
        attempt=len(session.hook_events) + 1,
    )
    session.hook_events.append(hook_ev)
    session.emit_sse("hook_event", hook_ev.model_dump())

    if hook_ev.decision == "deny":
        raise HTTPException(
            status_code=422,
            detail={
                "message": hook_ev.reason,
                "hook_deny": hook_ev.model_dump(),
            },
        )

    # 2. Enrich variant swatches via `get_product` + update per-merchant UCP checkouts
    mcp = ShopMCPClient()
    new_sku_enriched, v_trace = await mcp.enrich_product_variants(new_sku)
    session.mcp_calls.append(v_trace)
    if req.variant_id:
        mv = next(
            (v for v in new_sku_enriched.variants if v.variant_id == req.variant_id or v.gid == req.variant_id),
            None,
        )
        if mv:
            new_sku_enriched.selected_variant_id = mv.variant_id
            new_sku_enriched.selected_variant_gid = mv.gid
            new_sku_enriched.price_cents = mv.price_cents
            new_sku_enriched.price_usd = mv.price_usd

    updated_cart = annotate_item_fit_badges(
        zones,
        [
            (new_sku_enriched if it.sku_id == target_item.sku_id else it)
            for it in session.verified_items
        ],
    )
    updated_checkouts, ucp_traces = await mcp.create_or_update_merchant_checkouts(
        verified_items=updated_cart,
        existing_checkouts=session.checkouts,
    )
    session.mcp_calls.extend(ucp_traces)

    # 3. Stateful Nano Banana 2.1 surgical swap + `gemini-decision-1` QA
    t_swap = time.perf_counter()
    orig_room_bytes, orig_mime = session.room_images[0]
    prior_bytes = session.last_render_bytes or orig_room_bytes
    zone_obj = next((z for z in zones if z.zone_id == new_sku_enriched.zone_id), zones[0] if zones else None)

    swap_bytes, swap_mime, new_inter_id, new_refs = await render_surgical_swap(
        room_image_bytes=orig_room_bytes,
        prior_render_bytes=prior_bytes,
        prior_interaction_id=session.last_render_interaction_id,
        target_item=target_item,
        new_sku=new_sku_enriched,
        zone=zone_obj,
    )

    qa_verdict = await audit_rendered_room(
        original_room_bytes=orig_room_bytes,
        original_mime=orig_mime,
        sku_images=new_refs,
        rendered_room_bytes=swap_bytes,
        rendered_mime=swap_mime,
        was_repaired=False,
    )

    repaired = False
    repair_reason: str | None = None
    if qa_verdict.status == "failed" and qa_verdict.defect_summary:
        repair_reason = qa_verdict.defect_summary
        swap_bytes, swap_mime, new_inter_id = await render_targeted_repair(
            room_image_bytes=orig_room_bytes,
            failed_render_bytes=swap_bytes,
            prior_interaction_id=new_inter_id,
            defect_summary=repair_reason,
        )
        repaired = True
        qa_verdict = await audit_rendered_room(
            original_room_bytes=orig_room_bytes,
            original_mime=orig_mime,
            sku_images=new_refs,
            rendered_room_bytes=swap_bytes,
            rendered_mime=swap_mime,
            was_repaired=True,
        )

    version_id = f"v{len(session.versions) + 1}"
    b64_swap = base64.b64encode(swap_bytes).decode("utf-8")
    ver = RenderVersion(
        version_id=version_id,
        label=f"{version_id} · Swapped {new_sku_enriched.category} -> {new_sku_enriched.title[:28]}",
        image_b64=b64_swap,
        image_mime=swap_mime,
        interaction_id=new_inter_id,
        decisions_qa=qa_verdict,
        repaired=repaired,
        active_sku_ids=[it.sku_id for it in updated_cart],
    )
    session.versions.append(ver)
    session.last_render_interaction_id = new_inter_id
    session.last_render_bytes = swap_bytes
    session.verified_items = updated_cart
    session.checkouts = updated_checkouts
    session.save_metadata()

    versions_avail = [v.version_id for v in session.versions]
    render_ev = RenderReadyEvent(
        session_id=session.session_id,
        version_id=version_id,
        versions_available=versions_avail,
        image_b64=b64_swap,
        image_mime=swap_mime,
        hotspot_pins=compute_hotspot_pins(zones, updated_cart),
        decisions_qa=qa_verdict,
        repaired=repaired,
        repair_reason=repair_reason,
        elapsed_ms=int((time.perf_counter() - t_swap) * 1000),
    )
    session.emit_sse("render_ready", render_ev.model_dump())

    total_usd = round(sum(it.price_cents for it in updated_cart) / 100.0, 2)
    swapped_final = next(
        (it for it in updated_cart if it.sku_id == new_sku_enriched.sku_id),
        new_sku_enriched,
    )
    return SwapResponse(
        session_id=session.session_id,
        version_id=version_id,
        versions_available=versions_avail,
        swapped_item=swapped_final,
        verified_items=updated_cart,
        total_usd=total_usd,
        budget_usd=session.budget_usd,
        checkouts=updated_checkouts,
        hook_event=hook_ev,
        render=render_ev,
    )


@app.post("/api/session/{session_id}/swap", response_model=SwapResponse)
async def swap_session_item(session_id: str, req: SwapRequest) -> SwapResponse:
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found.")
    return await execute_session_swap(session, req)


@app.post("/api/session/{session_id}/thread", response_model=ThreadResponse)
async def post_session_thread(session_id: str, req: ThreadRequest) -> ThreadResponse:
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found.")
    return await handle_thread_utterance(session, req, execute_session_swap)


@app.patch("/api/session/{session_id}/zone", response_model=ZoneOverrideResponse)
async def patch_session_zone(
    session_id: str, req: ZoneOverrideRequest
) -> ZoneOverrideResponse:
    session = get_session(session_id)
    if not session or not session.scale:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' scale state not found.")

    target_zone = next(
        (z for z in session.scale.zones if z.zone_id == req.zone_id),
        session.scale.zones[0] if session.scale.zones else None,
    )
    if not target_zone:
        raise HTTPException(status_code=404, detail=f"Zone '{req.zone_id}' not found.")

    target_zone.width_in = round(req.override_width_in, 1)
    if req.override_depth_in is not None:
        target_zone.depth_in = round(req.override_depth_in, 1)
    target_zone.usable_width_in = round(
        max(8.0, target_zone.width_in - target_zone.wall_margin_in), 1
    )
    target_zone.overridden_by_user = True
    target_zone.confidence_tier = "high"
    target_zone.tolerance_in = 0.5

    hook_ev = verify_bundle_deterministic(
        session_id=session.session_id,
        zones=session.scale.zones,
        proposed_items=session.verified_items,
        budget_usd=session.budget_usd,
        attempt=len(session.hook_events) + 1,
    )
    session.hook_events.append(hook_ev)
    session.verified_items = annotate_item_fit_badges(
        session.scale.zones, session.verified_items
    )
    session.save_metadata()

    return ZoneOverrideResponse(
        session_id=session.session_id,
        updated_zone=target_zone,
        zones=session.scale.zones,
        hook_event=hook_ev,
        verified_items=session.verified_items,
        all_items_still_fit=(hook_ev.decision == "allow"),
    )


@app.get("/api/benchmark")
async def get_benchmark_results() -> JSONResponse:
    if EVAL_RESULTS_PATH.exists():
        data = json.loads(EVAL_RESULTS_PATH.read_text(encoding="utf-8"))
        return JSONResponse(content=data)
    return JSONResponse(
        status_code=200,
        content={
            "status": "pending_live_eval",
            "rooms_tested": 0,
            "message": "Run `uv run python eval/run_eval.py` after adding GEMINI_API_KEY in `.env.local`.",
        },
    )
