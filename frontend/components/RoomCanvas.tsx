"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
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
import { ROOM_VIBES, type RoomVibe } from "@/lib/mockData";
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
  selectedVibe: RoomVibe;
  onChangeVibe: (vibe: RoomVibe) => void;
  cartItems: VerifiedCartItem[];
  hoveredItemId: string | null;
  onHoverItem: (itemId: string | null) => void;
  onPinItem: (item: VerifiedCartItem) => void;
  onOverrideZoneWidth: (zone: DetectedZone, newWidthIn: number) => void;
  isRendering: boolean;
  isRepairing: boolean;
  angleTabs?: { id: string; label: string; imageUrl: string }[];
  activeAngleId?: string;
  onSelectAngle?: (id: string) => void;
}

const MODE_LABELS: { key: CanvasViewMode; label: string }[] = [
  { key: "original", label: "Original" },
  { key: "blueprint", label: "Measured" },
  { key: "rendered", label: "Designed" },
];

export function RoomCanvas({
  originalImageUrl,
  scaleData,
  versions,
  activeVersionId,
  onSelectVersion,
  viewMode,
  onChangeViewMode,
  selectedVibe,
  onChangeVibe,
  cartItems,
  hoveredItemId,
  onHoverItem,
  onPinItem,
  onOverrideZoneWidth,
  isRendering,
  isRepairing,
  angleTabs,
  activeAngleId,
  onSelectAngle,
}: RoomCanvasProps) {
  const [isPeekingOriginal, setIsPeekingOriginal] = useState(false);

  const activeVersion =
    versions.find((v) => v.version_id === activeVersionId) ||
    versions[versions.length - 1] ||
    null;

  const hasRender = Boolean(activeVersion);
  const effectiveMode: CanvasViewMode = isPeekingOriginal ? "original" : viewMode;

  return (
    <div className="relative flex-1 flex flex-col bg-at-bg overflow-hidden">
      {/* Top Canvas Controls Strip */}
      <div className="px-4 py-2.5 border-b border-at-border bg-at-card/80 backdrop-blur flex flex-wrap items-center justify-between gap-2 shrink-0 z-20">
        {/* Left: Calibration Status or Angle Tabs */}
        <div className="flex items-center gap-2">
          {angleTabs && angleTabs.length > 1 && onSelectAngle && (
            <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-at-surface border border-at-border">
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
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-at-notice/12 border border-at-notice/45 text-[11px] font-mono text-at-notice">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              Depth + EXIF {scaleData.exif_focal_mm ?? 26}mm (±{scaleData.tolerance_in}&quot;)
            </div>
          )}

          {scaleData && scaleData.calibration_layer === "layer1_anchor" && (
            <div className="inline-flex items-center gap-1.5 text-[11px] font-mono tabular-nums-strict text-at-emerald">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Measured from {scaleData.anchors[0]?.label ?? "Room Anchor"} (±
              {scaleData.tolerance_in}&quot;)
            </div>
          )}
        </div>

        {/* Center: Simple View Tabs (Original · Measured · Designed) */}
        <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-at-surface border border-at-border">
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
                    ? "bg-at-card text-at-ink shadow-xs font-semibold"
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
            <div className="flex items-center gap-1 p-0.5 rounded-lg bg-at-surface border border-at-border">
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
          Auto-repairing render (clip detected)…
        </div>
      )}

      {/* Main Stage Image Container */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 pb-20 gap-3 min-h-0">
        <div className="relative w-full max-w-4xl aspect-[1000/660] rounded-2xl overflow-hidden border border-at-border bg-at-card shadow-xl">
          {/* Base Original Room Photo */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={originalImageUrl}
            alt="Original room"
            className={`w-full h-full object-cover transition-all duration-300 ${
              isRendering && !hasRender ? "brightness-90" : "brightness-100"
            }`}
          />

          {/* Designed / Rendered Layer (clean cross-fade, zero awkward slider) */}
          {effectiveMode === "rendered" && activeVersion && (
            <div className="absolute inset-0 transition-opacity duration-300 ease-out">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={activeVersion.image_url}
                alt={activeVersion.label}
                className="w-full h-full object-cover"
              />

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
                        ? "bg-at-cyan text-white scale-125 ring-4 ring-at-cyan/30"
                        : "bg-[#0D0E12]/90 text-white border-2 border-white/80 hover:border-at-cyan"
                    }`}
                    title={`Click to swap ${item.title}`}
                  >
                    {item.pin_number}
                  </button>
                );
              })}

              {activeVersion.decisions_qa.confidence_band === "borderline_amber" && (
                <div className="absolute bottom-3 left-3 z-10 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-at-card/92 border border-at-notice text-[11px] font-mono text-at-notice">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Borderline Scale — Verify Manually
                </div>
              )}
            </div>
          )}

          {/* Measured CAD Caliper Overlay */}
          {effectiveMode === "blueprint" && scaleData && (
            <BlueprintOverlay
              scaleData={scaleData}
              isRendering={isRendering}
              onOverrideZoneWidth={onOverrideZoneWidth}
            />
          )}

          {/* Hold to Peek Original Button */}
          {hasRender && viewMode !== "original" && (
            <button
              type="button"
              onMouseDown={() => setIsPeekingOriginal(true)}
              onMouseUp={() => setIsPeekingOriginal(false)}
              onMouseLeave={() => setIsPeekingOriginal(false)}
              onTouchStart={() => setIsPeekingOriginal(true)}
              onTouchEnd={() => setIsPeekingOriginal(false)}
              className="absolute bottom-3 right-3 z-20 px-3 py-1.5 rounded-full text-xs font-medium bg-at-card/90 backdrop-blur border border-at-border text-at-ink shadow-md inline-flex items-center gap-1.5 cursor-pointer select-none"
            >
              <Eye className="h-3.5 w-3.5 text-at-cyan" />
              Hold to Peek Original
            </button>
          )}

          {/* Initial Calibrating Status Pill */}
          {!scaleData && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-at-card/95 border border-at-cyan/50 text-xs font-mono text-at-cyan shadow-xl">
                <Sparkles className="h-4 w-4 animate-spin" />
                Measuring room from photo anchors…
              </div>
            </div>
          )}
        </div>

        {/* Room Style Quick Switcher Chips */}
        <div className="flex items-center gap-1.5 flex-wrap justify-center">
          <span className="text-[11px] text-at-muted mr-1">Room Style:</span>
          {ROOM_VIBES.map((vibe) => {
            const active = selectedVibe === vibe.id;
            return (
              <button
                key={vibe.id}
                type="button"
                onClick={() => onChangeVibe(vibe.id)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all cursor-pointer ${
                  active
                    ? "bg-at-accent text-white border-at-accent"
                    : "bg-at-card text-at-ink border-at-border hover:border-at-accent/60"
                }`}
              >
                {vibe.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
