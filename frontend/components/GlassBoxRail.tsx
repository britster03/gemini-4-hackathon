"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  Loader2,
  Ruler,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
} from "lucide-react";
import type {
  CartReadyEvent,
  CatalogReadyEvent,
  DecisionsQAResult,
  HookEvent,
  ScaleReadyEvent,
} from "@/types/clearbuy";

interface GlassBoxRailProps {
  scaleData: ScaleReadyEvent | null;
  catalogData: CatalogReadyEvent | null;
  hookData: HookEvent | null;
  cartData: CartReadyEvent | null;
  decisionsQA: DecisionsQAResult | null;
  isStreaming: boolean;
  elapsedSec: number;
}

type LogTab = "scale" | "catalog" | "guardrail" | "qa";

export function GlassBoxRail({
  scaleData,
  catalogData,
  hookData,
  cartData,
  decisionsQA,
  isStreaming,
  elapsedSec,
}: GlassBoxRailProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<LogTab>("guardrail");

  const refusalReason = hookData?.refusal_reason || cartData?.refusal_reason || null;
  const isRefused =
    hookData?.status === "refused" ||
    cartData?.status === "safe_refusal" ||
    Boolean(refusalReason);

  const anchorName =
    scaleData?.calibration_layer === "layer2_depth_exif"
      ? "Depth+EXIF"
      : scaleData?.anchors[0]?.label ?? "Outlet";
  const skusCount = catalogData?.skus_screened ?? 0;
  const blockedCount = hookData?.blocked_count ?? 0;

  const summaryText = isStreaming
    ? !scaleData
      ? `Scale calibrating… (${elapsedSec.toFixed(1)}s)`
      : !catalogData
      ? `Shop MCP searching… (${elapsedSec.toFixed(1)}s)`
      : !hookData
      ? `hooks.json checking… (${elapsedSec.toFixed(1)}s)`
      : `Nano Banana rendering + QA… (${elapsedSec.toFixed(1)}s)`
    : isRefused
    ? "Safe Refusal · No SKU fits wall + budget"
    : `${anchorName} · ${skusCount} SKUs · ${
        blockedCount > 0 ? `${blockedCount} blocked → swapped` : "0 violations"
      }${decisionsQA ? ` · ${decisionsQA.latency_ms} ms` : ""}`;

  return (
    <div className="border-b border-at-border bg-at-card shrink-0">
      {/* Slim Single-Line Compact Verified Summary (Collapsed by Default) */}
      <button
        type="button"
        onClick={() => setIsExpanded((v) => !v)}
        className="w-full px-4 py-2.5 flex items-center justify-between gap-2 text-left hover:bg-at-bg/60 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2 min-w-0">
          {isStreaming ? (
            <Loader2 className="h-3.5 w-3.5 text-at-cyan animate-spin shrink-0" />
          ) : isRefused ? (
            <ShieldAlert className="h-3.5 w-3.5 text-at-coral shrink-0" />
          ) : blockedCount > 0 ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-at-notice shrink-0" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5 text-at-emerald shrink-0" />
          )}
          <span
            className={`text-xs font-mono truncate tabular-nums-strict ${
              isStreaming
                ? "text-at-cyan"
                : isRefused
                ? "text-at-coral font-semibold"
                : "text-at-ink"
            }`}
          >
            {summaryText}
          </span>
        </div>

        <span className="inline-flex items-center gap-1 text-[11px] font-mono text-at-muted shrink-0">
          {isExpanded ? "Hide log" : "View log"}
          {isExpanded ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </span>
      </button>

      {/* Coral Safe Refusal Banner (Always Visible When Triggered — Section 03.D) */}
      {isRefused && (
        <div className="mx-3 mb-2.5 px-3 py-2 rounded-xl bg-at-coral/12 border border-at-coral/50 text-xs text-at-coral flex items-start gap-2">
          <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-semibold">Safe Refusal — Guardrail Enforced</p>
            <p className="text-[11px] font-mono text-at-coral/90">
              {refusalReason ||
                "No in-stock Shopify SKU satisfies both the physical wall clearance and strict USD budget cap."}
            </p>
          </div>
        </div>
      )}

      {/* Expandable 4-Stage Glass-Box Verification Strip (Scale | Catalog | Guardrail | Visual QA) */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-2 border-t border-at-border bg-at-bg/60 space-y-2.5">
          <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-at-card border border-at-border">
            {(
              [
                { key: "scale", label: "Scale", icon: <Ruler className="h-3 w-3" /> },
                { key: "catalog", label: "Catalog", icon: <ShoppingBag className="h-3 w-3" /> },
                { key: "guardrail", label: "Guardrail", icon: <ShieldCheck className="h-3 w-3" /> },
                { key: "qa", label: "Visual QA", icon: <Eye className="h-3 w-3" /> },
              ] as { key: LogTab; label: string; icon: React.ReactNode }[]
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`py-1.5 px-1.5 rounded-lg text-[11px] font-medium inline-flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                  activeTab === tab.key
                    ? "bg-at-bg text-at-ink border border-at-cyan/40 font-semibold"
                    : "text-at-muted hover:text-at-ink"
                }`}
              >
                {tab.icon}
                <span className="truncate">{tab.label}</span>
              </button>
            ))}
          </div>

          {activeTab === "guardrail" && hookData && (
            <div className="rounded-xl bg-at-card border border-at-border p-2.5 space-y-1.5 font-mono text-[11px] tabular-nums-strict">
              <div className="flex items-center justify-between text-[10px] text-at-muted pb-1 border-b border-at-border">
                <span>.agents/hooks.json · pre_tool_execution → verify_bundle.py</span>
                <span className="text-at-notice">{hookData.blocked_count} DENY</span>
              </div>
              {hookData.traces.map((t) => (
                <div key={t.id} className="flex items-start gap-2 leading-relaxed">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                      t.decision === "DENY"
                        ? "bg-at-coral/18 text-at-coral"
                        : t.decision === "RETRY"
                        ? "bg-at-notice/18 text-at-notice"
                        : "bg-at-emerald/18 text-at-emerald"
                    }`}
                  >
                    {t.decision}
                  </span>
                  <span className="text-at-ink/90 break-words">{t.summary}</span>
                </div>
              ))}
            </div>
          )}

          {activeTab === "qa" && decisionsQA && (
            <div className="rounded-xl bg-at-card border border-at-border p-2.5 space-y-2 font-mono text-[11px] tabular-nums-strict">
              <div className="flex items-center justify-between text-[10px] text-at-muted pb-1 border-b border-at-border">
                <span>gemini-decision-1 (v1beta · zero-token audit)</span>
                <span className="text-at-emerald">
                  {decisionsQA.latency_ms} ms · {decisionsQA.output_tokens} output tokens
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { label: "no_clipping", ok: decisionsQA.no_clipping },
                  { label: "room_preserved", ok: decisionsQA.room_preserved },
                  { label: "scale_honest", ok: decisionsQA.scale_honest },
                ].map((v) => (
                  <div
                    key={v.label}
                    className="flex items-center justify-between px-2 py-1 rounded bg-at-bg"
                  >
                    <span className="text-at-muted">{v.label}</span>
                    <span className={v.ok ? "text-at-emerald" : "text-at-coral"}>
                      {v.ok ? "YES" : "NO"}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between px-2 py-1 rounded bg-at-bg">
                  <span className="text-at-muted">sku_fidelity</span>
                  <span className="text-at-emerald">{decisionsQA.sku_fidelity}/3</span>
                </div>
              </div>
              {decisionsQA.repair_note && (
                <div className="flex items-center gap-1.5 text-[10px] text-at-notice">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  {decisionsQA.repair_note}
                </div>
              )}
            </div>
          )}

          {activeTab === "scale" && scaleData && (
            <div className="rounded-xl bg-at-card border border-at-border p-2.5 space-y-1 font-mono text-[11px] tabular-nums-strict">
              <div className="flex items-center justify-between text-[10px] text-at-muted pb-1 border-b border-at-border">
                <span>gemini-4-neon (xhigh) multi-anchor audit</span>
                <span className="text-at-cyan">±{scaleData.tolerance_in}&quot;</span>
              </div>
              {scaleData.anchors.map((a) => (
                <div key={a.id} className="flex items-center justify-between text-at-ink">
                  <span>
                    {a.label} ({a.known_size_label})
                  </span>
                  <span className="text-at-cyan">{a.px_per_in.toFixed(1)} px/in</span>
                </div>
              ))}
              {scaleData.zones.map((z) => (
                <div key={z.zone_id} className="flex items-center justify-between text-at-muted">
                  <span>
                    {z.zone_id} · {z.label}
                  </span>
                  <span className="text-at-emerald">
                    {z.width_in.toFixed(1)}&quot; W × {z.depth_in.toFixed(1)}&quot; D
                  </span>
                </div>
              ))}
            </div>
          )}

          {activeTab === "catalog" && catalogData && (
            <div className="rounded-xl bg-at-card border border-at-border p-2.5 space-y-1.5 font-mono text-[10px] tabular-nums-strict">
              <div className="flex items-center justify-between text-at-muted pb-1 border-b border-at-border">
                <span>
                  Shop MCP · {catalogData.stores_scanned} stores ·{" "}
                  {catalogData.skus_screened} SKUs screened
                </span>
                <span className="text-at-emerald">
                  Decisions Gate {catalogData.catalog_gate_ms} ms
                </span>
              </div>
              {catalogData.mcp_calls.map((call, idx) => (
                <div key={idx} className="flex items-center gap-1.5 text-at-muted truncate">
                  <CheckCircle2 className="h-3 w-3 text-at-emerald shrink-0" />
                  <span className="truncate">{call}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
