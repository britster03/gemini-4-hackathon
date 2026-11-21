"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  GripVertical,
  Layers,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import type {
  DetectedZone,
  RenderVersion,
  ScaleReadyEvent,
  VerifiedCartItem,
} from "@/types/clearbuy";
import { BlueprintOverlay } from "./BlueprintOverlay";

export type CanvasViewMode = "original" | "blueprint" | "rendered";

interface RoomCanvasProps {
  originalImageUrl: string;
  scaleData: ScaleReadyEvent | null;
  versions: RenderVersion[];
  activeVersionId: string | null;
  onSelectVersion: (versionId: string) => void;
  viewMode: CanvasViewMode;
  onChangeViewMode: (mode: CanvasViewMode) => void;
  cartItems: VerifiedCartItem[];
  hoveredItemId: string | null;
  onHoverItem: (itemId: string | null) => void;
  onPinItem: (item: VerifiedCartItem) => void;
  onSelectZone: (zone: DetectedZone) => void;
  onOverrideZoneWidth: (zone: DetectedZone, newWidthIn: number) => void;
  isRendering: boolean;
  isRepairing: boolean;
  angleTabs?: { id: string; label: string; imageUrl: string }[];
  activeAngleId?: string;
  onSelectAngle?: (id: string) => void;
}

const MODE_LABELS: { key: CanvasViewMode; label: string }[] = [
  { key: "original", label: "Original" },
  { key: "blueprint", label: "Blueprint" },
  { key: "rendered", label: "Rendered" },
];

export function RoomCanvas({
  originalImageUrl,
  scaleData,
  versions,
  activeVersionId,
  onSelectVersion,
  viewMode,
  onChangeViewMode,
  cartItems,
  hoveredItemId,
  onHoverItem,
  onPinItem,
  onSelectZone,
  onOverrideZoneWidth,
  isRendering,
  isRepairing,
  angleTabs,
  activeAngleId,
  onSelectAngle,
}: RoomCanvasProps) {
  const [wipePct, setWipePct] = useState(100);
  const [isWiping, setIsWiping] = useState(false);

  const activeVersion =
    versions.find((v) => v.version_id === activeVersionId) ||
    versions[versions.length - 1] ||
    null;

  const hasRender = Boolean(activeVersion);

  const updateWipeFromClientX = (clientX: number, rect: DOMRect) => {
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setWipePct(Math.max(4, Math.min(96, pct)));
  };

  return (
    <div className="relative flex-1 flex flex-col bg-at-bg overflow-hidden">
      {/* Top Canvas Controls Strip */}
      <div className="px-4 py-2.5 border-b border-at-border bg-at-card/85 backdrop-blur flex flex-wrap items-center justify-between gap-2 shrink-0 z-20">
        {/* Left: Calibration Layer / Multi-Anchor Skew Warning / Angle Tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          {angleTabs && angleTabs.length > 1 && onSelectAngle && (
            <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-at-bg border border-at-border">
              {angleTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onSelectAngle(tab.id)}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                    activeAngleId === tab.id
                      ? "bg-at-card text-at-ink shadow-xs"
                      : "text-at-muted hover:text-at-ink"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          {scaleData?.calibration_layer === "layer2_depth_exif" && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-at-notice/12 border border-at-notice/50 text-[11px] font-mono text-at-notice">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {scaleData.fallback_badge ||
                `No anchor found · Depth-Anything-V2 + EXIF ${scaleData.exif_focal_mm ?? 26}mm (±${scaleData.tolerance_in}")`}
            </div>
          )}

          {(scaleData?.foreshortening_warning || scaleData?.skew_warning) && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-at-notice/12 border border-at-notice/55 text-[11px] font-mono text-at-notice">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {scaleData.skew_warning ||
                `Multi-anchor skew >15% (${(scaleData.cross_anchor_skew_pct ?? 18).toFixed(0)}%)`}
            </div>
          )}

          {scaleData &&
            scaleData.calibration_layer === "layer1_anchor" &&
            !scaleData.foreshortening_warning &&
            !scaleData.skew_warning && (
              <div className="inline-flex items-center gap-1.5 text-[11px] font-mono tabular-nums-strict text-at-emerald">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Layer 1 Anchor Lock (±{scaleData.tolerance_in}&quot;)
              </div>
            )}
        </div>

        {/* Center: 3-Mode Switcher (Original | Blueprint | Rendered) */}
        <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-at-bg border border-at-border">
          {MODE_LABELS.map((item) => {
            const disabled = item.key === "rendered" && !hasRender;
            const active = viewMode === item.key;
            return (
              <button
                key={item.key}
                type="button"
                disabled={disabled}
                onClick={() => onChangeViewMode(item.key)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  active
                    ? "bg-at-cyan text-[#0C0D10] font-semibold"
                    : disabled
                    ? "text-at-micro cursor-not-allowed"
                    : "text-at-muted hover:text-at-ink cursor-pointer"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Right: Version Pills (v1 -> v2) */}
        <div className="flex items-center gap-1.5">
          {versions.length > 0 && (
            <div className="flex items-center gap-1 p-0.5 rounded-lg bg-at-bg border border-at-border">
              <Layers className="h-3.5 w-3.5 text-at-muted ml-1.5" />
              {versions.map((ver) => (
                <button
                  key={ver.version_id}
                  type="button"
                  onClick={() => {
                    onSelectVersion(ver.version_id);
                    onChangeViewMode("rendered");
                  }}
                  title={ver.label}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-mono transition-colors cursor-pointer ${
                    activeVersion?.version_id === ver.version_id
                      ? "bg-at-emerald/15 text-at-emerald font-semibold"
                      : "text-at-muted hover:text-at-ink"
                  }`}
                >
                  {ver.version_id}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Decisions QA Repair Banner */}
      {isRepairing && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-20 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-at-card border border-at-notice text-xs font-mono text-at-notice shadow-xl">
          <ShieldAlert className="h-4 w-4 animate-pulse" />
          Repairing render (clip detected by gemini-decision-1)…
        </div>
      )}

      {/* Main Stage Image Container */}
      <div className="flex-1 flex items-center justify-center p-4 pb-20 min-h-0">
        <div
          className="relative w-full max-w-4xl aspect-[1000/660] rounded-2xl overflow-hidden border border-at-border bg-at-card shadow-2xl"
          onPointerMove={(e) => {
            if (!isWiping) return;
            updateWipeFromClientX(e.clientX, e.currentTarget.getBoundingClientRect());
          }}
          onPointerUp={() => setIsWiping(false)}
          onPointerLeave={() => setIsWiping(false)}
        >
          {/* Base Original Room Photo */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={originalImageUrl}
            alt="Original room"
            className={`w-full h-full object-cover transition-all duration-300 ${
              isRendering && !hasRender ? "brightness-85" : "brightness-100"
            }`}
          />

          {/* Rendered Layer with Vertical Before/After Wipe Slider (Section 03.B Component B) */}
          {viewMode === "rendered" && activeVersion && (
            <>
              <div
                className="absolute inset-0 transition-opacity duration-300 ease-out"
                style={{
                  clipPath: `inset(0 ${100 - wipePct}% 0 0)`,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={activeVersion.image_url}
                  alt={activeVersion.label}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Vertical Wipe Handle */}
              <div
                className="absolute top-0 bottom-0 z-10 w-0.5 bg-at-cyan cursor-ew-resize"
                style={{ left: `${wipePct}%` }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  setIsWiping(true);
                }}
                title="Drag left/right to compare Original vs Rendered"
              >
                <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 h-9 w-6 rounded-full bg-[#0C0D10]/90 border border-[#38BDF8] flex items-center justify-center text-[#38BDF8] shadow-lg">
                  <GripVertical className="h-3.5 w-3.5" />
                </div>
              </div>

              {/* Numbered Hotspot Pins (1, 2, 3) */}
              {cartItems.map((item) => {
                const isHovered = hoveredItemId === item.item_id;
                return (
                  <button
                    key={item.item_id}
                    type="button"
                    onMouseEnter={() => onHoverItem(item.item_id)}
                    onMouseLeave={() => onHoverItem(null)}
                    onClick={() => onPinItem(item)}
                    style={{
                      left: `${item.pin_position.x / 10}%`,
                      top: `${item.pin_position.y / 10}%`,
                    }}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 z-10 h-7 w-7 rounded-full font-mono text-xs font-bold flex items-center justify-center transition-all cursor-pointer shadow-lg ${
                      isHovered
                        ? "bg-at-cyan text-[#0C0D10] scale-125 ring-4 ring-at-cyan/30"
                        : "bg-[#0C0D10]/90 text-white border-2 border-white/80 hover:border-at-cyan"
                    }`}
                    title={`Click to swap ${item.title} (${item.zone_id})`}
                  >
                    {item.pin_number}
                  </button>
                );
              })}

              {activeVersion.decisions_qa.confidence_band === "borderline_amber" && (
                <div className="absolute bottom-3 left-3 z-10 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0C0D10]/90 border border-[#F59E0B] text-[11px] font-mono text-[#F59E0B]">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Borderline Scale — Verify Manually
                </div>
              )}
            </>
          )}

          {/* Blueprint CAD Caliper Overlay */}
          {viewMode === "blueprint" && scaleData && (
            <BlueprintOverlay
              scaleData={scaleData}
              isRendering={isRendering}
              onOverrideZoneWidth={onOverrideZoneWidth}
              onSelectZone={onSelectZone}
            />
          )}

          {/* Initial Calibrating Status Pill */}
          {!scaleData && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/25">
              <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-at-card/95 border border-at-cyan/50 text-xs font-mono text-at-cyan shadow-xl">
                <Sparkles className="h-4 w-4 animate-spin" />
                Detecting room anchors &amp; calibrating CAD scale…
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
