"use client";

import React, { useRef, useState } from "react";
import type { DetectedZone, ScaleReadyEvent } from "@/types/clearbuy";

interface BlueprintOverlayProps {
  scaleData: ScaleReadyEvent;
  isRendering: boolean;
  onOverrideZoneWidth: (zone: DetectedZone, newWidthIn: number) => void;
}

/**
 * Interactive SVG CAD Caliper Overlay operating on Gemini 4 Neon's 0–1000 normalized grid.
 * Draws:
 *  1) Dashed cyan Reference Anchor Callout (e.g., US Outlet · 4.5" H → 14.2 px/in) + leader line
 *  2) Numbered zone bounding boxes with architectural end-capped calipers (|◄—— 43.5" W ——►|)
 *  3) 24" ergonomic pull-out / walkway clearance arcs
 *  4) Hover-revealed drag handles allowing optional manual width overrides
 */
export function BlueprintOverlay({
  scaleData,
  isRendering,
  onOverrideZoneWidth,
}: BlueprintOverlayProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [draggingZoneId, setDraggingZoneId] = useState<string | null>(null);
  const [dragPreviewWidth, setDragPreviewWidth] = useState<number | null>(null);
  const dragStartRef = useRef<{ clientX: number; baseWidthIn: number } | null>(null);

  const primaryAnchor = scaleData.anchors[0];
  const primaryZone = scaleData.zones[0];

  const handlePointerDown = (e: React.PointerEvent, zone: DetectedZone) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    setDraggingZoneId(zone.zone_id);
    setDragPreviewWidth(zone.width_in);
    dragStartRef.current = { clientX: e.clientX, baseWidthIn: zone.width_in };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingZoneId || !dragStartRef.current) return;
    const dxPx = e.clientX - dragStartRef.current.clientX;
    // 6px drag = 1 inch adjustment for crisp tactile control
    const nextWidth = Math.max(
      18,
      Math.min(180, Math.round((dragStartRef.current.baseWidthIn + dxPx / 6) * 2) / 2)
    );
    setDragPreviewWidth(nextWidth);
  };

  const handlePointerUp = (e: React.PointerEvent, zone: DetectedZone) => {
    if (!draggingZoneId) return;
    (e.target as Element).releasePointerCapture(e.pointerId);
    const finalWidth = dragPreviewWidth ?? zone.width_in;
    setDraggingZoneId(null);
    setDragPreviewWidth(null);
    dragStartRef.current = null;
    if (Math.abs(finalWidth - zone.width_in) >= 0.5) {
      onOverrideZoneWidth(zone, finalWidth);
    }
  };

  return (
    <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
      {/* Subtle 2.4s architectural scan-line while Nano Banana renders in background */}
      {isRendering && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="w-full h-16 bg-gradient-to-b from-transparent via-[#38BDF8]/20 to-transparent border-b border-[#38BDF8]/50 animate-datum-scanline" />
        </div>
      )}

      <svg
        ref={svgRef}
        viewBox="0 0 1000 1000"
        preserveAspectRatio="none"
        className="w-full h-full"
      >
        <defs>
          <marker
            id="cad-arrow-left"
            viewBox="0 0 10 10"
            refX="2"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M 10 1 L 0 5 L 10 9 z" fill="#38BDF8" />
          </marker>
          <marker
            id="cad-arrow-right"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#38BDF8" />
          </marker>
        </defs>

        {/* Reference Anchor Callout Boxes (Layer 1) */}
        {scaleData.anchors.map((anchor, idx) => {
          const [y1, x1, y2, x2] = anchor.bbox;
          const w = x2 - x1;
          const h = y2 - y1;
          return (
            <g key={anchor.id}>
              <rect
                x={x1}
                y={y1}
                width={w}
                height={h}
                fill="rgba(56, 189, 248, 0.14)"
                stroke="#38BDF8"
                strokeWidth="2.5"
                strokeDasharray="6 4"
                rx="3"
              />
              {/* Thin leader line from primary anchor to primary zone */}
              {idx === 0 && primaryZone && (
                <line
                  x1={x2}
                  y1={(y1 + y2) / 2}
                  x2={primaryZone.bbox[1]}
                  y2={(primaryZone.bbox[0] + primaryZone.bbox[2]) / 2}
                  stroke="#38BDF8"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                  opacity="0.75"
                />
              )}
            </g>
          );
        })}

        {/* Detected Placement Zones + Architectural End-Capped Calipers */}
        {scaleData.zones.map((zone) => {
          const [y1, x1, y2, x2] = zone.bbox;
          const w = x2 - x1;
          const h = y2 - y1;
          const midX = (x1 + x2) / 2;
          const caliperY = Math.max(40, y1 - 22);
          const displayWidth =
            draggingZoneId === zone.zone_id && dragPreviewWidth !== null
              ? dragPreviewWidth
              : zone.width_in;

          return (
            <g key={zone.zone_id} className="group">
              {/* Zone translucent fill & crisp CAD border */}
              <rect
                x={x1}
                y={y1}
                width={w}
                height={h}
                fill={
                  zone.protected_anchor
                    ? "rgba(245, 158, 11, 0.10)"
                    : "rgba(56, 189, 248, 0.08)"
                }
                stroke={zone.protected_anchor ? "#F59E0B" : "#38BDF8"}
                strokeWidth="2"
                rx="4"
              />

              {/* Corner CAD brackets */}
              <path
                d={`M ${x1} ${y1 + 18} L ${x1} ${y1} L ${x1 + 18} ${y1}`}
                fill="none"
                stroke="#38BDF8"
                strokeWidth="3.5"
              />
              <path
                d={`M ${x2 - 18} ${y1} L ${x2} ${y1} L ${x2} ${y1 + 18}`}
                fill="none"
                stroke="#38BDF8"
                strokeWidth="3.5"
              />
              <path
                d={`M ${x1} ${y2 - 18} L ${x1} ${y2} L ${x1 + 18} ${y2}`}
                fill="none"
                stroke="#38BDF8"
                strokeWidth="3.5"
              />
              <path
                d={`M ${x2 - 18} ${y2} L ${x2} ${y2} L ${x2} ${y2 - 18}`}
                fill="none"
                stroke="#38BDF8"
                strokeWidth="3.5"
              />

              {/* Architectural End-Capped Width Caliper (|◄—— 43.5" W ——►|) */}
              <line
                x1={x1}
                y1={caliperY - 10}
                x2={x1}
                y2={caliperY + 10}
                stroke="#38BDF8"
                strokeWidth="2.5"
              />
              <line
                x1={x2}
                y1={caliperY - 10}
                x2={x2}
                y2={caliperY + 10}
                stroke="#38BDF8"
                strokeWidth="2.5"
              />
              <line
                x1={x1 + 4}
                y1={caliperY}
                x2={x2 - 4}
                y2={caliperY}
                stroke="#38BDF8"
                strokeWidth="2"
                markerStart="url(#cad-arrow-left)"
                markerEnd="url(#cad-arrow-right)"
              />

              {/* 24" Chair Pull-Out / Walkway Clearance Arc */}
              {zone.clearance_in && (
                <path
                  d={`M ${x1 + w * 0.15} ${y2} Q ${midX} ${Math.min(
                    980,
                    y2 + 65
                  )} ${x2 - w * 0.15} ${y2}`}
                  fill="rgba(56, 189, 248, 0.06)"
                  stroke="#38BDF8"
                  strokeWidth="1.5"
                  strokeDasharray="5 5"
                />
              )}

              {/* Interactive Draggable Right Caliper Override Handle */}
              <circle
                cx={x2}
                cy={caliperY}
                r="11"
                fill={draggingZoneId === zone.zone_id ? "#38BDF8" : "#0C0D10"}
                stroke="#38BDF8"
                strokeWidth="2.5"
                className="pointer-events-auto cursor-ew-resize"
                onPointerDown={(e) => handlePointerDown(e, zone)}
                onPointerMove={handlePointerMove}
                onPointerUp={(e) => handlePointerUp(e, zone)}
              >
                <title>Drag horizontally to override {zone.zone_id} width</title>
              </circle>

              {/* Inline SVG width pill */}
              <rect
                x={midX - 66}
                y={caliperY - 16}
                width="132"
                height="28"
                rx="6"
                fill="#0C0D10"
                fillOpacity="0.92"
                stroke="#38BDF8"
                strokeWidth="1.5"
              />
              <text
                x={midX}
                y={caliperY + 3}
                textAnchor="middle"
                fill="#F4F5F7"
                fontSize="16"
                fontFamily="monospace"
                fontWeight="600"
              >
                {zone.zone_id} · {displayWidth.toFixed(1)}&quot; W
              </text>
            </g>
          );
        })}
      </svg>

      {/* Crisp HTML Anchor Callout Pill (non-distorted typography) */}
      {primaryAnchor && scaleData.calibration_layer === "layer1_anchor" && (
        <div
          className="absolute px-2.5 py-1 rounded-md bg-[#0C0D10]/92 border border-[#38BDF8]/70 text-[11px] font-mono tabular-nums-strict text-[#38BDF8] shadow-lg"
          style={{
            left: `${Math.min(72, Math.max(2, primaryAnchor.bbox[1] / 10 - 2))}%`,
            top: `${Math.max(8, primaryAnchor.bbox[0] / 10 - 9)}%`,
          }}
        >
          {primaryAnchor.label} · {primaryAnchor.known_size_label} →{" "}
          {primaryAnchor.px_per_in.toFixed(1)} px/in (±{scaleData.tolerance_in}&quot;)
        </div>
      )}

      {/* Dragging feedback toast */}
      {draggingZoneId && dragPreviewWidth !== null && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-lg bg-[#0C0D10]/95 border border-[#38BDF8] text-xs font-mono tabular-nums-strict text-[#38BDF8] shadow-xl">
          Overriding {draggingZoneId} width → {dragPreviewWidth.toFixed(1)}&quot; W (release to
          re-run verify_bundle.py)
        </div>
      )}
    </div>
  );
}
