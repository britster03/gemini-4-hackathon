import type {
  BenchmarkData,
  CartReadyEvent,
  CatalogReadyEvent,
  HookEvent,
  RenderReadyEvent,
  ScaleReadyEvent,
  SpaceScope,
  SwapResponse,
  ThreadResponse,
  VerifiedCartItem,
  ZoneOverrideResponse,
} from "@/types/clearbuy";
import {
  buildMockPipelinePayloads,
  DEMO_PRESETS,
  MOCK_ADVERSARIAL_DESK_ALTERNATIVES,
  MOCK_BENCHMARK_DATA,
  MOCK_CHAIR_ALTERNATIVES,
} from "./mockData";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export const DEFAULT_USE_MOCK =
  (process.env.NEXT_PUBLIC_USE_MOCK_SSE ?? "true") !== "false";

export interface SessionStreamCallbacks {
  onSessionCreated?: (sessionId: string) => void;
  onScaleReady: (data: ScaleReadyEvent) => void;
  onCatalogReady: (data: CatalogReadyEvent) => void;
  onHookEvent: (data: HookEvent) => void;
  onCartReady: (data: CartReadyEvent) => void;
  onRenderReady: (data: RenderReadyEvent) => void;
  onError: (message: string) => void;
}

export interface StartSessionParams {
  images: File[];
  exifFocalMm: number | null;
  prompt: string;
  budgetUsd: number;
  scope: SpaceScope;
  useMock: boolean;
  mockPresetId?: string | null;
  fallbackPreviewUrl?: string;
}

/**
 * Starts a ClearBuy/Datum session via POST multipart/form-data -> SSE stream.
 * Native EventSource only supports GET, so we parse the SSE ReadableStream via fetch().
 */
export async function startSessionStream(
  params: StartSessionParams,
  callbacks: SessionStreamCallbacks,
  signal?: AbortSignal
): Promise<void> {
  if (params.useMock) {
    return runMockSessionStream(params, callbacks, signal);
  }

  try {
    const formData = new FormData();
    params.images.forEach((img) => formData.append("images", img));
    if (params.exifFocalMm !== null) {
      formData.append("exif_focal_mm", String(params.exifFocalMm));
    }
    formData.append("prompt", params.prompt);
    formData.append("budget_usd", String(params.budgetUsd));
    formData.append("scope", params.scope);

    const response = await fetch(`${API_BASE_URL}/api/session/start`, {
      method: "POST",
      body: formData,
      signal,
    });

    if (!response.ok || !response.body) {
      throw new Error(`Session start failed (${response.status})`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() ?? "";

      for (const chunk of chunks) {
        const lines = chunk.split("\n");
        let eventName = "message";
        const dataLines: string[] = [];

        for (const line of lines) {
          if (line.startsWith("event:")) {
            eventName = line.slice(6).trim();
          } else if (line.startsWith("data:")) {
            dataLines.push(line.slice(5).trim());
          }
        }

        if (dataLines.length === 0) continue;
        const parsed = JSON.parse(dataLines.join("\n"));

        switch (eventName) {
          case "session_created":
            callbacks.onSessionCreated?.(parsed.session_id);
            break;
          case "scale_ready":
            if (parsed.session_id) callbacks.onSessionCreated?.(parsed.session_id);
            callbacks.onScaleReady(parsed as ScaleReadyEvent);
            break;
          case "catalog_ready":
            callbacks.onCatalogReady(parsed as CatalogReadyEvent);
            break;
          case "hook_event":
            callbacks.onHookEvent(parsed as HookEvent);
            break;
          case "cart_ready":
            callbacks.onCartReady(parsed as CartReadyEvent);
            break;
          case "render_ready":
            callbacks.onRenderReady(parsed as RenderReadyEvent);
            break;
          case "error":
            callbacks.onError(parsed.message || "Pipeline error");
            break;
        }
      }
    }
  } catch (err) {
    if ((err as Error).name === "AbortError") return;
    callbacks.onError((err as Error).message || "Unable to connect to FastAPI SSE stream");
  }
}

async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(id);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });
}

async function runMockSessionStream(
  params: StartSessionParams,
  callbacks: SessionStreamCallbacks,
  signal?: AbortSignal
): Promise<void> {
  try {
    const sessionId = `mock_${Date.now().toString(36)}`;
    callbacks.onSessionCreated?.(sessionId);

    const preset =
      DEMO_PRESETS.find((p) => p.id === params.mockPresetId) || DEMO_PRESETS[0];
    const payloads = buildMockPipelinePayloads({
      sessionId,
      scope: params.scope === "auto" ? preset.scope : params.scope,
      budgetUsd: params.budgetUsd,
      exifFocalMm: params.exifFocalMm ?? preset.exif_focal_mm,
      renderedImageUrl: preset.rendered_image_url,
    });

    await sleep(1100, signal);
    callbacks.onScaleReady(payloads.scale);

    await sleep(900, signal);
    callbacks.onCatalogReady(payloads.catalog);

    await sleep(900, signal);
    callbacks.onHookEvent(payloads.hook);

    await sleep(700, signal);
    callbacks.onCartReady(payloads.cart);

    await sleep(1400, signal);
    callbacks.onRenderReady(payloads.render);
  } catch (err) {
    if ((err as Error).name === "AbortError") return;
    callbacks.onError((err as Error).message);
  }
}

export async function sendThreadUtterance(params: {
  sessionId: string;
  utterance: string;
  pinnedZoneId?: string | null;
  pinnedItemId?: string | null;
  useMock: boolean;
}): Promise<ThreadResponse> {
  if (params.useMock) {
    await sleep(650);
    const lower = params.utterance.toLowerCase();
    const isAdversarial =
      lower.includes("72") || lower.includes("executive") || lower.includes("huge");

    if (isAdversarial) {
      return {
        reply:
          'hooks.json blocked the 72" Executive Desk (+28.5" over your 43.5" Zone 1 wall). Here are verified walnut/oak desks that physically fit:',
        alternatives: MOCK_ADVERSARIAL_DESK_ALTERNATIVES,
      };
    }

    return {
      reply:
        "Found 3 pre-vetted warm cream Shopify chairs under $180 that fit Zone 1 with full 24\" pull-out clearance:",
      alternatives: MOCK_CHAIR_ALTERNATIVES,
    };
  }

  const res = await fetch(`${API_BASE_URL}/api/session/${params.sessionId}/thread`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      utterance: params.utterance,
      pinned_zone_id: params.pinnedZoneId ?? undefined,
      pinned_item_id: params.pinnedItemId ?? undefined,
    }),
  });
  if (!res.ok) throw new Error(`Thread request failed (${res.status})`);
  return res.json();
}

export async function executeSurgicalSwap(params: {
  sessionId: string;
  zoneId: string;
  targetItemId: string;
  newSkuId: string;
  variantId?: string;
  useMock: boolean;
  currentItems?: VerifiedCartItem[];
  nextVersionNumber?: number;
  mockPresetId?: string | null;
}): Promise<SwapResponse> {
  if (params.useMock) {
    await sleep(1100);
    if (params.newSkuId === "exec-desk-72") {
      return {
        allowed: false,
        hook_deny_reason:
          'verify_bundle.py DENY: 72.0" Executive Desk exceeds 41.5" usable width in Zone 1 (+28.5" overflow).',
      };
    }

    const preset =
      DEMO_PRESETS.find((p) => p.id === params.mockPresetId) || DEMO_PRESETS[0];
    const alt =
      [...MOCK_CHAIR_ALTERNATIVES, ...MOCK_ADVERSARIAL_DESK_ALTERNATIVES].find(
        (a) => a.sku_id === params.newSkuId
      ) || MOCK_CHAIR_ALTERNATIVES[0];

    const existing = params.currentItems?.find((i) => i.item_id === params.targetItemId);
    const updatedItem: VerifiedCartItem = {
      ...(existing ?? {
        item_id: params.targetItemId,
        pin_number: 2,
        zone_id: params.zoneId,
        category: "Chair",
        zone_width_in: 43.5,
        depth_in: 24,
        height_in: 36,
        selected_variant_id: "var-cream",
        variants: [],
        pin_position: { x: 436, y: 635 },
      }),
      sku_id: alt.sku_id,
      shopify_gid: alt.shopify_gid,
      title: alt.title,
      merchant: alt.merchant,
      price_usd: alt.price_usd,
      width_in: alt.width_in ?? 24.5,
      fit_state: "verified",
      fit_label: `Verified Fit · ${(alt.width_in ?? 24.5).toFixed(1)}" ≤ 43.5"`,
      image_url: alt.image_url,
      stock_verified_at: Date.now(),
    };

    const nextItems = (params.currentItems ?? []).map((i) =>
      i.item_id === params.targetItemId ? updatedItem : i
    );
    const updatedTotal = nextItems.reduce((sum, i) => sum + i.price_usd, 0);

    return {
      allowed: true,
      updated_item: updatedItem,
      updated_total_usd: Math.round(updatedTotal * 100) / 100,
      new_version: {
        version_id: `v${params.nextVersionNumber ?? 2}`,
        label: `Swapped → ${alt.title}`,
        image_url: preset.rendered_v2_image_url,
        decisions_qa: {
          no_clipping: true,
          room_preserved: true,
          scale_honest: true,
          sku_fidelity: 3,
          confidence_band: "high_pass",
          latency_ms: 176,
          output_tokens: 0,
          repaired: false,
        },
        created_at: Date.now(),
      },
    };
  }

  const res = await fetch(`${API_BASE_URL}/api/session/${params.sessionId}/swap`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      zone_id: params.zoneId,
      target_item_id: params.targetItemId,
      new_sku_id: params.newSkuId,
      variant_id: params.variantId,
    }),
  });

  if (res.status === 422) {
    const errPayload = await res.json();
    return {
      allowed: false,
      hook_deny_reason: errPayload.reason || errPayload.detail || "Blocked by hooks.json",
    };
  }

  if (!res.ok) throw new Error(`Swap failed (${res.status})`);
  return res.json();
}

export async function patchZoneOverride(params: {
  sessionId: string;
  zoneId: string;
  overrideWidthIn: number;
  overrideDepthIn: number;
  useMock: boolean;
  currentItems?: VerifiedCartItem[];
}): Promise<ZoneOverrideResponse> {
  if (params.useMock) {
    await sleep(120);
    const usable = Math.max(0, params.overrideWidthIn - 2.0);
    const updatedItems = (params.currentItems ?? []).map((item) => {
      if (item.zone_id !== params.zoneId || !item.width_in) return item;
      const fits = item.width_in <= usable;
      return {
        ...item,
        zone_width_in: params.overrideWidthIn,
        fit_state: fits ? ("verified" as const) : ("blocked" as const),
        fit_label: fits
          ? `Verified Fit · ${item.width_in.toFixed(1)}" ≤ ${params.overrideWidthIn.toFixed(1)}"`
          : `Blocked by Hook · ${item.width_in.toFixed(1)}" > ${usable.toFixed(1)}" usable`,
      };
    });

    const blocked = updatedItems.filter((i) => i.fit_state === "blocked");
    return {
      zone_id: params.zoneId,
      width_in: params.overrideWidthIn,
      depth_in: params.overrideDepthIn,
      updated_items: updatedItems,
      hook_traces: [
        {
          id: `override-${Date.now()}`,
          decision: blocked.length > 0 ? "DENY" : "ALLOW",
          timestamp: "LIVE",
          tool_name: "verify_bundle.py (caliper_override)",
          summary:
            blocked.length > 0
              ? `DENY after caliper override (${params.overrideWidthIn.toFixed(1)}" W): ${blocked[0].title} exceeds usable width`
              : `ALLOW after caliper override (${params.overrideWidthIn.toFixed(1)}" W): all items fit with 2" margin`,
        },
      ],
    };
  }

  const res = await fetch(`${API_BASE_URL}/api/session/${params.sessionId}/zone`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      zone_id: params.zoneId,
      override_width_in: params.overrideWidthIn,
      override_depth_in: params.overrideDepthIn,
    }),
  });
  if (!res.ok) throw new Error(`Zone override failed (${res.status})`);
  return res.json();
}

export async function fetchBenchmarkData(useMock: boolean): Promise<BenchmarkData> {
  if (useMock) return MOCK_BENCHMARK_DATA;
  try {
    const res = await fetch(`${API_BASE_URL}/api/benchmark`);
    if (!res.ok) return MOCK_BENCHMARK_DATA;
    return res.json();
  } catch {
    return MOCK_BENCHMARK_DATA;
  }
}
