"""In-Memory + Disk-Backed Session Store & SSE Pub/Sub State."""

from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass, field
from typing import Any

from backend.config import SESSIONS_DIR
from backend.schemas import (
    CartReadyEvent,
    CatalogReadyEvent,
    HookEvent,
    MCPCallTrace,
    MerchantUCPCheckout,
    RenderVersion,
    ScaleReadyEvent,
    SKUTabPanel,
    ShopifySKU,
    SpaceScope,
    ThreadAlternativeCard,
)


@dataclass
class SpatialSession:
    session_id: str
    prompt: str
    budget_usd: float
    scope: SpaceScope = "auto"
    exif_focal_mm: float | None = None
    room_images: list[tuple[bytes, str]] = field(default_factory=list)

    scale: ScaleReadyEvent | None = None
    catalog: CatalogReadyEvent | None = None
    candidates_by_category: dict[str, list[ShopifySKU]] = field(default_factory=dict)
    mcp_calls: list[MCPCallTrace] = field(default_factory=list)
    hook_events: list[HookEvent] = field(default_factory=list)
    verified_items: list[ShopifySKU] = field(default_factory=list)
    sku_tabs: list[SKUTabPanel] = field(default_factory=list)
    alternatives_by_sku: dict[str, list[ThreadAlternativeCard]] = field(default_factory=dict)
    checkouts: list[MerchantUCPCheckout] = field(default_factory=list)
    cart: CartReadyEvent | None = None

    versions: list[RenderVersion] = field(default_factory=list)
    last_render_interaction_id: str | None = None
    last_render_bytes: bytes | None = None
    last_thread_alternatives: list[ThreadAlternativeCard] = field(default_factory=list)

    pending_confirmation_token: str | None = None
    pending_checkout_ids: list[str] = field(default_factory=list)
    shop_pay_bearer_token: str | None = None
    shop_pay_token: str | None = None
    completed_orders: list[dict[str, Any]] = field(default_factory=list)

    sse_history: list[tuple[str, dict[str, Any]]] = field(default_factory=list)
    subscribers: list[asyncio.Queue[tuple[str, dict[str, Any]] | None]] = field(
        default_factory=list
    )
    completed: bool = False

    def emit_sse(self, event_name: str, payload: dict[str, Any]) -> None:
        self.sse_history.append((event_name, payload))
        for q in list(self.subscribers):
            q.put_nowait((event_name, payload))

    def mark_complete(self) -> None:
        self.completed = True
        for q in list(self.subscribers):
            q.put_nowait(None)
        self.save_metadata()

    def save_metadata(self) -> None:
        try:
            SESSIONS_DIR.mkdir(parents=True, exist_ok=True)
            out = {
                "session_id": self.session_id,
                "prompt": self.prompt,
                "budget_usd": self.budget_usd,
                "scope": self.scope,
                "scale": self.scale.model_dump() if self.scale else None,
                "hook_events": [h.model_dump() for h in self.hook_events],
                "verified_items": [i.model_dump() for i in self.verified_items],
                "checkouts": [c.model_dump() for c in self.checkouts],
                "completed_orders": self.completed_orders,
                "versions_available": [v.version_id for v in self.versions],
            }
            (SESSIONS_DIR / f"{self.session_id}.json").write_text(
                json.dumps(out, indent=2), encoding="utf-8"
            )
        except Exception:
            pass


_SESSIONS: dict[str, SpatialSession] = {}


def put_session(session: SpatialSession) -> None:
    _SESSIONS[session.session_id] = session


def get_session(session_id: str) -> SpatialSession | None:
    return _SESSIONS.get(session_id)
