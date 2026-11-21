"use client";

import React, { useEffect, useRef, useState } from "react";
import { Compass, Moon, RotateCcw, Sun } from "lucide-react";
import type {
  AlternativeSKUCard,
  CartReadyEvent,
  CatalogReadyEvent,
  DemoPreset,
  DetectedZone,
  HookEvent,
  RenderVersion,
  ScaleReadyEvent,
  SpaceScope,
  ThreadMessage,
  VerifiedCartItem,
} from "@/types/clearbuy";
import type { ProcessedRoomImage } from "@/lib/imageUtils";
import { makeSunlitRoomSvg, type RoomVibe } from "@/lib/mockData";
import {
  DEFAULT_USE_MOCK,
  executeSurgicalSwap,
  patchZoneOverride,
  sendThreadUtterance,
  startSessionStream,
} from "@/lib/sseClient";
import { CaptureCanvas } from "@/components/CaptureCanvas";
import { RoomCanvas, type CanvasViewMode } from "@/components/RoomCanvas";
import { GlassBoxRail } from "@/components/GlassBoxRail";
import { ShopifyCommerceRail } from "@/components/ShopifyCommerceRail";
import { VoiceSpatialThread } from "@/components/VoiceSpatialThread";

export default function DatumStudioPage() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [appPhase, setAppPhase] = useState<"capture" | "studio">("capture");
  const [selectedVibe, setSelectedVibe] = useState<RoomVibe>("scandi");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);

  // Room images / multi-angle tabs
  const [angleTabs, setAngleTabs] = useState<
    { id: string; label: string; imageUrl: string }[]
  >([]);
  const [activeAngleId, setActiveAngleId] = useState<string>("angle-1");

  // Pipeline SSE states
  const [budgetUsd, setBudgetUsd] = useState<number>(450);
  const [scaleData, setScaleData] = useState<ScaleReadyEvent | null>(null);
  const [catalogData, setCatalogData] = useState<CatalogReadyEvent | null>(null);
  const [hookData, setHookData] = useState<HookEvent | null>(null);
  const [cartData, setCartData] = useState<CartReadyEvent | null>(null);
  const [versions, setVersions] = useState<RenderVersion[]>([]);
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);

  // Studio UI interaction states
  const [viewMode, setViewMode] = useState<CanvasViewMode>("blueprint");
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const [pinnedItem, setPinnedItem] = useState<VerifiedCartItem | null>(null);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [isRepairing, setIsRepairing] = useState<boolean>(false);
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Conversational Spatial Thread states
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [isSendingThread, setIsSendingThread] = useState<boolean>(false);
  const [isSwapping, setIsSwapping] = useState<boolean>(false);

  const abortRef = useRef<AbortController | null>(null);

  // Persist Light / Dark Atelier theme
  useEffect(() => {
    const saved = window.localStorage.getItem("datum-theme");
    if (saved === "dark" || saved === "light") {
      setTheme(saved);
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("theme-dark", theme === "dark");
    document.documentElement.classList.toggle("theme-light", theme === "light");
    window.localStorage.setItem("datum-theme", theme);
  }, [theme]);

  // Live elapsed timer while pipeline streams
  useEffect(() => {
    if (!isStreaming) return;
    const t0 = performance.now();
    const id = setInterval(() => {
      setElapsedSec((performance.now() - t0) / 1000);
    }, 100);
    return () => clearInterval(id);
  }, [isStreaming]);

  // Update sunlit preset visuals live when user switches Room Style chip in Studio
  const handleChangeVibe = (vibe: RoomVibe) => {
    setSelectedVibe(vibe);
    if (appPhase === "studio" && activePresetId) {
      const isFullRoom = activePresetId === "full-living-room";
      setAngleTabs([
        {
          id: "angle-1",
          label: "Main View",
          imageUrl: makeSunlitRoomSvg({ vibe, rendered: false, multiZone: isFullRoom }),
        },
      ]);
      setVersions((prev) =>
        prev.map((ver, idx) => ({
          ...ver,
          image_url: makeSunlitRoomSvg({
            vibe,
            rendered: true,
            warmChair: idx > 0,
            multiZone: isFullRoom,
          }),
        }))
      );
    }
  };

  const resetToCapture = () => {
    abortRef.current?.abort();
    setAppPhase("capture");
    setSessionId(null);
    setScaleData(null);
    setCatalogData(null);
    setHookData(null);
    setCartData(null);
    setVersions([]);
    setActiveVersionId(null);
    setMessages([]);
    setPinnedItem(null);
    setErrorBanner(null);
    setIsStreaming(false);
    setElapsedSec(0);
  };

  const handleLaunchSession = async (payload: {
    images: ProcessedRoomImage[];
    prompt: string;
    budgetUsd: number;
    scope: SpaceScope;
    preset?: DemoPreset;
  }) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setScaleData(null);
    setCatalogData(null);
    setHookData(null);
    setCartData(null);
    setVersions([]);
    setActiveVersionId(null);
    setMessages([]);
    setPinnedItem(null);
    setErrorBanner(null);
    setBudgetUsd(payload.budgetUsd);
    setViewMode("blueprint");
    setElapsedSec(0);
    setIsStreaming(true);

    const isPreset = Boolean(payload.preset);
    setActivePresetId(payload.preset?.id ?? null);

    if (payload.preset) {
      setAngleTabs([
        {
          id: "angle-1",
          label: "Main View",
          imageUrl: payload.preset.room_image_url,
        },
      ]);
      setActiveAngleId("angle-1");
    } else {
      const tabs = payload.images.map((img, i) => ({
        id: `angle-${i + 1}`,
        label: i === 0 ? "Primary Wall" : `Angle ${i + 1}`,
        imageUrl: img.previewUrl,
      }));
      setAngleTabs(tabs);
      setActiveAngleId(tabs[0]?.id ?? "angle-1");
    }

    setAppPhase("studio");

    const runWithMock = DEFAULT_USE_MOCK || isPreset;

    await startSessionStream(
      {
        images: payload.images.map((i) => i.file),
        exifFocalMm:
          payload.images[0]?.exifFocalMm ?? payload.preset?.exif_focal_mm ?? null,
        prompt: payload.prompt,
        budgetUsd: payload.budgetUsd,
        scope: payload.scope,
        useMock: runWithMock,
        mockPresetId: payload.preset?.id ?? null,
      },
      {
        onSessionCreated: (id) => setSessionId(id),
        onScaleReady: (data) => {
          setScaleData(data);
          setViewMode("blueprint");
        },
        onCatalogReady: (data) => setCatalogData(data),
        onHookEvent: (data) => setHookData(data),
        onCartReady: (data) => setCartData(data),
        onRenderReady: (data) => {
          if (data.version.decisions_qa.repaired) {
            setIsRepairing(true);
            setTimeout(() => setIsRepairing(false), 1200);
          }
          const finalVersion = payload.preset
            ? {
                ...data.version,
                image_url: payload.preset.rendered_image_url,
              }
            : data.version;
          setVersions([finalVersion]);
          setActiveVersionId(finalVersion.version_id);
          setViewMode("rendered");
          setIsStreaming(false);
        },
        onError: (msg) => {
          setErrorBanner(msg);
          setIsStreaming(false);
        },
      },
      controller.signal
    );
  };

  const handleOverrideZoneWidth = async (zone: DetectedZone, newWidthIn: number) => {
    if (!scaleData) return;
    setScaleData({
      ...scaleData,
      zones: scaleData.zones.map((z) =>
        z.zone_id === zone.zone_id
          ? { ...z, width_in: newWidthIn, user_overridden: true }
          : z
      ),
    });

    const resp = await patchZoneOverride({
      sessionId: sessionId || "mock",
      zoneId: zone.zone_id,
      overrideWidthIn: newWidthIn,
      overrideDepthIn: zone.depth_in,
      useMock: DEFAULT_USE_MOCK || Boolean(activePresetId),
      currentItems: cartData?.items,
    });

    if (cartData) {
      setCartData({ ...cartData, items: resp.updated_items });
    }
    if (hookData && resp.hook_traces.length > 0) {
      const hasDeny = resp.hook_traces.some((t) => t.decision === "DENY");
      setHookData({
        ...hookData,
        status: hasDeny ? "refused" : "verified",
        blocked_count: hasDeny ? hookData.blocked_count + 1 : hookData.blocked_count,
        traces: [...hookData.traces, ...resp.hook_traces],
      });
    }
  };

  const handleSelectVariant = (itemId: string, variantId: string) => {
    if (!cartData) return;
    const updatedItems = cartData.items.map((item) => {
      if (item.item_id !== itemId) return item;
      const chosen = item.variants.find((v) => v.variant_id === variantId);
      if (!chosen) return item;
      return {
        ...item,
        selected_variant_id: chosen.variant_id,
        price_usd: chosen.price_usd,
      };
    });
    const newTotal =
      Math.round(updatedItems.reduce((sum, i) => sum + i.price_usd, 0) * 100) / 100;
    setCartData({
      ...cartData,
      items: updatedItems,
      total_usd: newTotal,
    });
  };

  const handleSendUtterance = async (utterance: string) => {
    setIsSendingThread(true);
    setMessages((prev) => [
      ...prev,
      {
        id: `u-${Date.now()}`,
        role: "user",
        text: utterance,
        pinned_chip: pinnedItem ? `@${pinnedItem.category}` : null,
        timestamp: Date.now(),
      },
    ]);

    try {
      const res = await sendThreadUtterance({
        sessionId: sessionId || "mock",
        utterance,
        pinnedZoneId: pinnedItem?.zone_id ?? null,
        pinnedItemId: pinnedItem?.item_id ?? null,
        useMock: DEFAULT_USE_MOCK || Boolean(activePresetId),
      });

      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          text: res.reply,
          alternatives: res.alternatives,
          timestamp: Date.now(),
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          text: `Could not route request: ${(err as Error).message}`,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsSendingThread(false);
    }
  };

  const handleSelectAlternative = async (alt: AlternativeSKUCard) => {
    setIsSwapping(true);
    try {
      const res = await executeSurgicalSwap({
        sessionId: sessionId || "mock",
        zoneId: alt.zone_id,
        targetItemId: alt.target_item_id,
        newSkuId: alt.sku_id,
        useMock: DEFAULT_USE_MOCK || Boolean(activePresetId),
        currentItems: cartData?.items,
        nextVersionNumber: versions.length + 1,
        mockPresetId: activePresetId,
      });

      if (!res.allowed) {
        setMessages((prev) => [
          ...prev,
          {
            id: `deny-${Date.now()}`,
            role: "assistant",
            text: res.hook_deny_reason || "Blocked by hooks.json",
            timestamp: Date.now(),
          },
        ]);
        return;
      }

      if (res.updated_item && cartData) {
        setCartData({
          ...cartData,
          items: cartData.items.map((item) =>
            item.item_id === res.updated_item!.item_id ? res.updated_item! : item
          ),
          total_usd: res.updated_total_usd ?? cartData.total_usd,
          checkouts: res.updated_checkouts ?? cartData.checkouts,
        });
      }

      if (res.new_version) {
        const vibeVersion = activePresetId
          ? {
              ...res.new_version,
              image_url: makeSunlitRoomSvg({
                vibe: selectedVibe,
                rendered: true,
                warmChair: true,
                multiZone: activePresetId === "full-living-room",
              }),
            }
          : res.new_version;
        setVersions((prev) => [...prev, vibeVersion]);
        setActiveVersionId(vibeVersion.version_id);
        setViewMode("rendered");
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `swapped-${Date.now()}`,
          role: "assistant",
          text: `Swapped & verified (${res.new_version?.decisions_qa.latency_ms ?? 176} ms). Saved as ${res.new_version?.version_id ?? "v2"}.`,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsSwapping(false);
    }
  };

  const handleRequestSwapForItem = (
    item: VerifiedCartItem,
    promptOverride?: string
  ) => {
    setPinnedItem(item);
    if (promptOverride) {
      handleSendUtterance(promptOverride);
    }
  };

  const activeAngleUrl =
    angleTabs.find((a) => a.id === activeAngleId)?.imageUrl ||
    angleTabs[0]?.imageUrl ||
    "";

  const activeVersion =
    versions.find((v) => v.version_id === activeVersionId) ||
    versions[versions.length - 1] ||
    null;

  return (
    <div className="h-screen w-screen flex flex-col bg-at-bg text-at-ink overflow-hidden transition-colors duration-300">
      {/* Ultra-Clean Top 48px Utility Bar: Logo Left · Room Summary Center · ONLY Light/Dark Right */}
      <header className="h-12 px-5 border-b border-at-border bg-at-card flex items-center justify-between gap-3 shrink-0 z-40">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={resetToCapture}
            className="flex items-center gap-2 cursor-pointer"
          >
            <span className="h-7 w-7 rounded-lg bg-at-accent/15 border border-at-accent/45 flex items-center justify-center text-at-accent">
              <Compass className="h-4 w-4" />
            </span>
            <span className="text-sm font-semibold tracking-[-0.02em] text-at-ink">
              Datum
            </span>
          </button>

          {appPhase === "studio" && (
            <button
              type="button"
              onClick={resetToCapture}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-at-surface border border-at-border hover:border-at-accent text-[11px] font-medium text-at-muted hover:text-at-ink cursor-pointer transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              New Room
            </button>
          )}
        </div>

        {/* Center Room & Budget Summary (only when inside Your Room) */}
        <div className="hidden md:flex items-center gap-2.5">
          {appPhase === "studio" && (
            <>
              <span className="px-2.5 py-1 rounded-lg bg-at-surface border border-at-border text-[11px] font-mono text-at-muted">
                {scaleData?.scope_label ?? "Measuring Space…"}
              </span>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-at-surface border border-at-border text-[11px] font-mono tabular-nums-strict">
                <span className="text-at-muted">Budget</span>
                <span
                  className={
                    (cartData?.total_usd ?? 0) > budgetUsd
                      ? "text-at-coral font-semibold"
                      : "text-at-emerald font-semibold"
                  }
                >
                  ${(cartData?.total_usd ?? 0).toFixed(2)}
                </span>
                <span className="text-at-muted">/ ${budgetUsd}</span>
              </div>
            </>
          )}
        </div>

        {/* Far Right: ONLY Light / Dark Mode Toggle */}
        <button
          type="button"
          onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
          className="px-3 py-1.5 rounded-lg bg-at-surface border border-at-border hover:border-at-accent text-xs font-medium text-at-ink inline-flex items-center gap-1.5 cursor-pointer transition-colors"
          aria-label="Toggle Light or Dark Mode"
        >
          {theme === "light" ? (
            <>
              <Sun className="h-3.5 w-3.5 text-at-accent" />
              <span>Light</span>
            </>
          ) : (
            <>
              <Moon className="h-3.5 w-3.5 text-at-accent" />
              <span>Dark</span>
            </>
          )}
        </button>
      </header>

      {/* Main Content: Upload Room Hero OR Your Room Split Studio */}
      {appPhase === "capture" ? (
        <CaptureCanvas
          selectedVibe={selectedVibe}
          onChangeVibe={handleChangeVibe}
          onLaunchSession={handleLaunchSession}
        />
      ) : (
        <main className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
          <section className="relative w-full lg:w-[64%] h-[55%] lg:h-full flex flex-col border-b lg:border-b-0 lg:border-r border-at-border min-h-0">
            {errorBanner && (
              <div className="px-4 py-2 bg-at-coral/12 border-b border-at-coral/40 text-xs font-mono text-at-coral">
                {errorBanner}
              </div>
            )}

            <RoomCanvas
              originalImageUrl={activeAngleUrl}
              scaleData={scaleData}
              versions={versions}
              activeVersionId={activeVersionId}
              onSelectVersion={setActiveVersionId}
              viewMode={viewMode}
              onChangeViewMode={setViewMode}
              selectedVibe={selectedVibe}
              onChangeVibe={handleChangeVibe}
              cartItems={cartData?.items ?? []}
              hoveredItemId={hoveredItemId}
              onHoverItem={setHoveredItemId}
              onPinItem={(item) => setPinnedItem(item)}
              onOverrideZoneWidth={handleOverrideZoneWidth}
              isRendering={isStreaming}
              isRepairing={isRepairing}
              angleTabs={angleTabs}
              activeAngleId={activeAngleId}
              onSelectAngle={setActiveAngleId}
            />

            <VoiceSpatialThread
              messages={messages}
              pinnedItem={pinnedItem}
              onClearPin={() => setPinnedItem(null)}
              onSendUtterance={handleSendUtterance}
              onSelectAlternative={handleSelectAlternative}
              isSending={isSendingThread}
              isSwapping={isSwapping}
            />
          </section>

          <aside className="w-full lg:w-[36%] h-[45%] lg:h-full flex flex-col min-h-0 bg-at-card">
            <GlassBoxRail
              scaleData={scaleData}
              catalogData={catalogData}
              hookData={hookData}
              cartData={cartData}
              decisionsQA={activeVersion?.decisions_qa ?? null}
              budgetUsd={budgetUsd}
              isStreaming={isStreaming}
              elapsedSec={elapsedSec}
            />

            <ShopifyCommerceRail
              cartData={cartData}
              budgetUsd={budgetUsd}
              isLoading={isStreaming}
              hoveredItemId={hoveredItemId}
              onHoverItem={setHoveredItemId}
              onSelectVariant={handleSelectVariant}
              onRequestSwapForItem={handleRequestSwapForItem}
            />
          </aside>
        </main>
      )}
    </div>
  );
}
