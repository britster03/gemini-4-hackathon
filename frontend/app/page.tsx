"use client";

import React, { useEffect, useRef, useState } from "react";
import { Compass, Moon, RotateCcw, Sun } from "lucide-react";
import type {
  AlternativeSKUCard,
  BenchmarkData,
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
import { MOCK_BENCHMARK_DATA } from "@/lib/mockData";
import {
  DEFAULT_USE_MOCK,
  executeSurgicalSwap,
  fetchBenchmarkData,
  patchZoneOverride,
  sendThreadUtterance,
  startSessionStream,
} from "@/lib/sseClient";
import { CaptureCanvas } from "@/components/CaptureCanvas";
import { RoomCanvas, type CanvasViewMode } from "@/components/RoomCanvas";
import { GlassBoxRail } from "@/components/GlassBoxRail";
import { ShopifyCommerceRail } from "@/components/ShopifyCommerceRail";
import { VoiceSpatialThread } from "@/components/VoiceSpatialThread";
import { BenchmarkDrawer } from "@/components/BenchmarkDrawer";
import { DatumLogo, PoweredByBar } from "@/components/BrandMarks";

export default function DatumStudioPage() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [appPhase, setAppPhase] = useState<"capture" | "studio">("capture");
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
  const [pinnedZone, setPinnedZone] = useState<DetectedZone | null>(null);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [isRepairing, setIsRepairing] = useState<boolean>(false);
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Conversational Spatial Thread states
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [isSendingThread, setIsSendingThread] = useState<boolean>(false);
  const [isSwapping, setIsSwapping] = useState<boolean>(false);

  // Proof & Benchmark Drawer states (Component F)
  const [proofOpen, setProofOpen] = useState<boolean>(false);
  const [benchmarkData, setBenchmarkData] =
    useState<BenchmarkData>(MOCK_BENCHMARK_DATA);

  const abortRef = useRef<AbortController | null>(null);

  // Persist Darkroom Studio (default) / Light Atelier theme
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

  useEffect(() => {
    if (!isStreaming) return;
    const t0 = performance.now();
    const id = setInterval(() => {
      setElapsedSec((performance.now() - t0) / 1000);
    }, 100);
    return () => clearInterval(id);
  }, [isStreaming]);

  useEffect(() => {
    if (!proofOpen) return;
    fetchBenchmarkData(DEFAULT_USE_MOCK).then(setBenchmarkData);
  }, [proofOpen]);

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
    setPinnedZone(null);
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
    setPinnedZone(null);
    setErrorBanner(null);
    setBudgetUsd(payload.budgetUsd);
    setViewMode("blueprint");
    setElapsedSec(0);
    setIsStreaming(true);

    setActivePresetId(payload.preset?.id ?? null);

    let filesToUpload: File[] = payload.images.map((i) => i.file);
    if (filesToUpload.length === 0 && payload.preset?.room_image_url) {
      try {
        const imgResp = await fetch(payload.preset.room_image_url);
        const blob = await imgResp.blob();
        filesToUpload = [
          new File([blob], `${payload.preset.id}.jpg`, {
            type: blob.type || "image/jpeg",
          }),
        ];
      } catch {
        filesToUpload = [];
      }
    }

    if (payload.preset) {
      setAngleTabs([
        {
          id: "angle-1",
          label: payload.preset.title,
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

    const runWithMock = DEFAULT_USE_MOCK || filesToUpload.length === 0;

    await startSessionStream(
      {
        images: filesToUpload,
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
          // Apply backend hotspot pin coordinates onto cart items when provided
          if (data.version.hotspot_pins?.length) {
            setCartData((prev) => {
              if (!prev) return prev;
              const pins = data.version.hotspot_pins!;
              return {
                ...prev,
                items: prev.items.map((item) => {
                  const match = pins.find((p) => p.sku_id === item.sku_id);
                  return match
                    ? {
                        ...item,
                        pin_number: match.pin_number,
                        pin_position: { x: match.x_norm, y: match.y_norm },
                      }
                    : item;
                }),
              };
            });
          }
          setVersions([data.version]);
          setActiveVersionId(data.version.version_id);
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
      useMock: DEFAULT_USE_MOCK || !sessionId || sessionId.startsWith("mock_"),
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

  const handleRerenderVariant = async (item: VerifiedCartItem) => {
    setIsSwapping(true);
    try {
      const res = await executeSurgicalSwap({
        sessionId: sessionId || "mock",
        zoneId: item.zone_id,
        targetItemId: item.item_id,
        newSkuId: item.sku_id,
        variantId: item.selected_variant_id,
        useMock: DEFAULT_USE_MOCK || !sessionId || sessionId.startsWith("mock_"),
        currentItems: cartData?.items,
        nextVersionNumber: versions.length + 1,
        mockPresetId: activePresetId,
      });

      if (!res.allowed) {
        setErrorBanner(res.hook_deny_reason || "Variant blocked by hooks.json");
        return;
      }

      if (cartData) {
        setCartData({
          ...cartData,
          items: res.updated_items ?? cartData.items,
          total_usd: res.updated_total_usd ?? cartData.total_usd,
          checkouts: res.updated_checkouts ?? cartData.checkouts,
        });
      }

      if (res.new_version) {
        setVersions((prev) => [...prev, res.new_version!]);
        setActiveVersionId(res.new_version.version_id);
        setViewMode("rendered");
      }
    } finally {
      setIsSwapping(false);
    }
  };

  const handleSendUtterance = async (
    utterance: string,
    explicitPinItem?: VerifiedCartItem | null
  ) => {
    const activePin = explicitPinItem !== undefined ? explicitPinItem : pinnedItem;
    setIsSendingThread(true);
    setMessages((prev) => [
      ...prev,
      {
        id: `u-${Date.now()}`,
        role: "user",
        text: utterance,
        pinned_chip: activePin
          ? `@${activePin.zone_id} · ${activePin.category}`
          : pinnedZone
          ? `@${pinnedZone.zone_id}`
          : null,
        timestamp: Date.now(),
      },
    ]);

    try {
      const res = await sendThreadUtterance({
        sessionId: sessionId || "mock",
        utterance,
        pinnedZoneId: activePin?.zone_id ?? pinnedZone?.zone_id ?? null,
        pinnedItemId: activePin?.item_id ?? null,
        useMock: DEFAULT_USE_MOCK || !sessionId || sessionId.startsWith("mock_"),
      });

      if (res.executed_swap?.allowed && res.executed_swap.new_version) {
        const swap = res.executed_swap;
        if (cartData) {
          setCartData({
            ...cartData,
            items: swap.updated_items ?? cartData.items,
            total_usd: swap.updated_total_usd ?? cartData.total_usd,
            checkouts: swap.updated_checkouts ?? cartData.checkouts,
          });
        }
        setVersions((prev) => [...prev, swap.new_version!]);
        setActiveVersionId(swap.new_version!.version_id);
        setViewMode("rendered");
      }

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
        useMock: DEFAULT_USE_MOCK || !sessionId || sessionId.startsWith("mock_"),
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

      if (cartData) {
        setCartData({
          ...cartData,
          items:
            res.updated_items ??
            (res.updated_item
              ? cartData.items.map((item) =>
                  item.item_id === res.updated_item!.item_id
                    ? res.updated_item!
                    : item
                )
              : cartData.items),
          total_usd: res.updated_total_usd ?? cartData.total_usd,
          checkouts: res.updated_checkouts ?? cartData.checkouts,
        });
      }

      if (res.new_version) {
        setVersions((prev) => [...prev, res.new_version!]);
        setActiveVersionId(res.new_version.version_id);
        setViewMode("rendered");
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `swapped-${Date.now()}`,
          role: "assistant",
          text: `Surgical swap verified by hooks.json + Decisions QA (${res.new_version?.decisions_qa.latency_ms ?? 176} ms). Saved as ${res.new_version?.version_id ?? "v2"}.`,
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
    setPinnedZone(null);
    setPinnedItem(item);
    handleSendUtterance(
      promptOverride || `Show alternatives for ${item.category}`,
      item
    );
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
    <div className="h-screen w-screen flex flex-col bg-at-bg text-at-ink overflow-hidden transition-colors duration-200">
      {/* Top 56px Studio Navigation Bar */}
      <header className="h-14 px-5 border-b border-at-border/80 bg-at-bg/95 backdrop-blur-md grid grid-cols-[1fr_auto_1fr] items-center gap-4 shrink-0 z-40">
        {/* Left: Datum Brand Lockup + Subtle Ghost New Space Action */}
        <div className="flex items-center gap-3 justify-self-start">
          <button
            type="button"
            onClick={resetToCapture}
            className="flex items-center gap-2.5 group cursor-pointer"
          >
            <DatumLogo className="h-7 w-7 shrink-0 transition-transform duration-200 group-hover:scale-[1.03]" />
            <span className="text-[15px] font-semibold tracking-[-0.03em] text-at-ink">
              Datum
            </span>
          </button>

          {appPhase === "studio" && (
            <>
              <span className="h-4 w-px bg-at-border/80" />
              <button
                type="button"
                onClick={resetToCapture}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-at-muted hover:text-at-ink hover:bg-at-card cursor-pointer transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>New Space</span>
              </button>
            </>
          )}
        </div>

        {/* Center: Mathematically Centered Sponsor Lockup */}
        <div className="hidden md:flex items-center justify-center">
          <PoweredByBar compact />
        </div>

        {/* Right: Refined Budget Meter Pill + Circular Theme Toggle */}
        <div className="flex items-center gap-2.5 justify-self-end">
          {(() => {
            const spent = cartData?.total_usd ?? 0;
            const overBudget = spent > budgetUsd;
            const pct = budgetUsd > 0 ? Math.min(100, Math.round((spent / budgetUsd) * 100)) : 0;
            return (
              <div className="hidden sm:flex flex-col justify-center px-3 py-1 rounded-full bg-at-card/80 border border-at-border/80 min-w-[152px]">
                <div className="flex items-center justify-between gap-2 text-[11px] font-mono tabular-nums-strict leading-tight">
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        overBudget
                          ? "bg-at-coral"
                          : spent > 0
                          ? "bg-at-emerald"
                          : "bg-at-muted/50"
                      }`}
                    />
                    <span className="text-[10px] font-sans uppercase tracking-wider text-at-muted">
                      Budget
                    </span>
                  </span>
                  <span>
                    <span
                      className={
                        overBudget
                          ? "text-at-coral font-semibold"
                          : spent > 0
                          ? "text-at-ink font-semibold"
                          : "text-at-muted font-medium"
                      }
                    >
                      ${spent.toFixed(2)}
                    </span>
                    <span className="text-at-muted/70"> / ${budgetUsd.toFixed(0)}</span>
                  </span>
                </div>
                <div className="mt-1 h-[2px] w-full rounded-full bg-at-border/60 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      overBudget ? "bg-at-coral" : "bg-at-emerald"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })()}

          <button
            type="button"
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            className="h-8 w-8 rounded-full bg-at-card/80 border border-at-border/80 hover:border-at-cyan/70 text-at-muted hover:text-at-ink inline-flex items-center justify-center cursor-pointer transition-colors"
            title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
            aria-label="Toggle Dark or Light Mode"
          >
            {theme === "dark" ? (
              <Sun className="h-3.5 w-3.5 text-at-ink/80" />
            ) : (
              <Moon className="h-3.5 w-3.5 text-at-ink/80" />
            )}
          </button>
        </div>
      </header>

      {/* Main Content: Universal Capture OR 64/36 Darkroom Studio */}
      {appPhase === "capture" ? (
        <CaptureCanvas onLaunchSession={handleLaunchSession} />
      ) : (
        <main className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
          <section className="relative w-full lg:w-[64%] h-[55%] lg:h-full flex flex-col border-b lg:border-b-0 lg:border-r border-at-border min-h-0">
            {errorBanner && (
              <div className="px-4 py-2 bg-at-coral/12 border-b border-at-coral/40 text-xs font-mono text-at-coral flex items-center justify-between">
                <span>{errorBanner}</span>
                <button
                  type="button"
                  onClick={() => setErrorBanner(null)}
                  className="underline ml-3 cursor-pointer"
                >
                  Dismiss
                </button>
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
              cartItems={cartData?.items ?? []}
              hoveredItemId={hoveredItemId}
              onHoverItem={setHoveredItemId}
              onPinItem={(item) => {
                handleRequestSwapForItem(item);
              }}
              onSelectZone={(zone) => {
                setPinnedItem(null);
                setPinnedZone(zone);
              }}
              onOverrideZoneWidth={handleOverrideZoneWidth}
              isRendering={isStreaming}
              isSwapping={isSwapping}
              isRepairing={isRepairing}
              angleTabs={angleTabs}
              activeAngleId={activeAngleId}
              onSelectAngle={setActiveAngleId}
            />

            <VoiceSpatialThread
              messages={messages}
              pinnedItem={pinnedItem}
              pinnedZone={pinnedZone}
              onClearPin={() => {
                setPinnedItem(null);
                setPinnedZone(null);
              }}
              onSendUtterance={handleSendUtterance}
              onSelectAlternative={handleSelectAlternative}
              isSending={isSendingThread}
              isSwapping={isSwapping}
            />
          </section>

          <aside className="w-full lg:w-[36%] h-[45%] lg:h-full flex flex-col min-h-0 bg-at-card">
            {/* Live 4-Stage Glass-Box Verification Strip (Zero Black Box!) */}
            <GlassBoxRail
              scaleData={scaleData}
              catalogData={catalogData}
              hookData={hookData}
              cartData={cartData}
              decisionsQA={activeVersion?.decisions_qa ?? null}
              isStreaming={isStreaming}
              elapsedSec={elapsedSec}
            />

            <ShopifyCommerceRail
              cartData={cartData}
              budgetUsd={budgetUsd}
              isLoading={isStreaming}
              isSwapping={isSwapping}
              hoveredItemId={hoveredItemId}
              pinnedItemId={pinnedItem?.item_id ?? null}
              onHoverItem={setHoveredItemId}
              onSelectVariant={handleSelectVariant}
              onRerenderVariant={handleRerenderVariant}
              onSelectAlternative={handleSelectAlternative}
              onRequestSwapForItem={handleRequestSwapForItem}
            />
          </aside>
        </main>
      )}

      {/* Slide-Over Proof & Benchmark Drawer (Component F) */}
      <BenchmarkDrawer
        open={proofOpen}
        onClose={() => setProofOpen(false)}
        data={benchmarkData}
      />
    </div>
  );
}
