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
  budgetUsd: number;
  isStreaming: boolean;
  elapsedSec: number;
}

type LogTab = "guardrail" | "qa" | "scale" | "catalog";

/**
 * Shopping-First Collapsible Trust Summary Bar.
 * Stays collapsed to a single slim line by default so ~80% of the right panel
 * is dedicated to furniture cards & checkout; expands on click for judges.
 */
export function GlassBoxRail({
  scaleData,
  catalogData,
  hookData,
  cartData,
  decisionsQA,
  budgetUsd,
  isStreaming,
  elapsedSec,
}: GlassBoxRailProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<LogTab>("guardrail");

  // Animated circular gauge math (circumference = 2 * pi * 18 ≈ 113.1)
  const zoneWidth = scaleData?.zones[0]?.width_in ?? 43.5;
  const maxItemWidth =
    cartData?.items.reduce((max, item) => Math.max(max, item.width_in ?? 0), 0) ?? 0;
  const fitPct =
    zoneWidth > 0 && maxItemWidth > 0
      ? Math.min(100, Math.round((maxItemWidth / zoneWidth) * 100))
      : 0;
  const fitOverflow = maxItemWidth > Math.max(0, zoneWidth - 2);
  const fitMargin = Math.max(0, zoneWidth - maxItemWidth);

  const totalUsd = cartData?.total_usd ?? 0;
  const budgetPct =
    budgetUsd > 0 ? Math.min(100, Math.round((totalUsd / budgetUsd) * 100)) : 0;
  const overBudget = totalUsd > budgetUsd;
  const budgetLeft = Math.max(0, budgetUsd - totalUsd);

  const circ = 113.1;
  const fitOffset = circ - (circ * fitPct) / 100;
  const budgetOffset = circ - (circ * budgetPct) / 100;

  const isRefused = hookData?.status === "refused";
  const hasAutoSwap = (hookData?.blocked_count ?? 0) > 0;

  const summaryText = isStreaming
    ? !scaleData
      ? `Measuring room anchors… (${elapsedSec.toFixed(1)}s)`
      : !catalogData
      ? `Searching live Shopify stores… (${elapsedSec.toFixed(1)}s)`
      : !hookData
      ? `Running fit & budget checks… (${elapsedSec.toFixed(1)}s)`
      : `Rendering exact items & running QA… (${elapsedSec.toFixed(1)}s)`
    : isRefused
    ? "Safe Refusal · Constraint exceeded"
    : `Verified Fit${
        hasAutoSwap
          ? ` · ${hookData?.blocked_count} oversized item auto-swapped`
          : ""
      }${decisionsQA ? ` · ${decisionsQA.latency_ms}ms QA` : ""}`;

  return (
    <div className="border-b border-at-border bg-at-card shrink-0">
      {/* Slim Single-Line Trust Summary Pill (Collapsed by Default) */}
      <button
        type="button"
        onClick={() => setIsExpanded((v) => !v)}
        className="w-full px-4 py-2.5 flex items-center justify-between gap-2 text-left hover:bg-at-surface/60 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2 min-w-0">
          {isStreaming ? (
            <Loader2 className="h-3.5 w-3.5 text-at-cyan animate-spin shrink-0" />
          ) : isRefused ? (
            <ShieldAlert className="h-3.5 w-3.5 text-at-coral shrink-0" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5 text-at-emerald shrink-0" />
          )}
          <span
            className={`text-xs font-medium truncate tabular-nums-strict ${
              isStreaming
                ? "text-at-cyan"
                : isRefused
                ? "text-at-coral"
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

      {/* Expandable Judge Proof Panel (Gauges + 4-Stage Tabs + Raw Traces) */}
      {isExpanded && (
        <div className="px-4 pb-3.5 pt-2 border-t border-at-border bg-at-surface/50 space-y-3">
          {/* Compact Animated Space Fit & Budget Gauges */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 rounded-xl bg-at-card border border-at-border flex items-center gap-2.5">
              <svg width="42" height="42" viewBox="0 0 46 46" className="shrink-0">
                <circle
                  cx="23"
                  cy="23"
                  r="18"
                  fill="none"
                  stroke="var(--at-border)"
                  strokeWidth="5"
                />
                <circle
                  cx="23"
                  cy="23"
                  r="18"
                  fill="none"
                  stroke={fitOverflow ? "var(--at-coral)" : "var(--at-emerald)"}
                  strokeWidth="5"
                  strokeDasharray={circ}
                  strokeDashoffset={fitOffset}
                  strokeLinecap="round"
                  transform="rotate(-90 23 23)"
                  className="gauge-ring"
                />
                <text
                  x="23"
                  y="26"
                  textAnchor="middle"
                  fill="var(--at-ink)"
                  fontSize="10"
                  fontFamily="monospace"
                  fontWeight="700"
                >
                  {fitPct}%
                </text>
              </svg>
              <div className="min-w-0">
                <p className="text-[11px] text-at-muted">Space Fit</p>
                <p className="text-xs font-mono font-semibold tabular-nums-strict text-at-ink truncate">
                  {maxItemWidth > 0 ? `${maxItemWidth.toFixed(1)}"` : "—"} /{" "}
                  {zoneWidth.toFixed(1)}&quot;
                </p>
                <p
                  className={`text-[10px] font-mono truncate ${
                    fitOverflow ? "text-at-coral" : "text-at-emerald"
                  }`}
                >
                  {maxItemWidth === 0
                    ? "Checking…"
                    : fitOverflow
                    ? "Exceeds margin"
                    : `+${fitMargin.toFixed(1)}" buffer`}
                </p>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-at-card border border-at-border flex items-center gap-2.5">
              <svg width="42" height="42" viewBox="0 0 46 46" className="shrink-0">
                <circle
                  cx="23"
                  cy="23"
                  r="18"
                  fill="none"
                  stroke="var(--at-border)"
                  strokeWidth="5"
                />
                <circle
                  cx="23"
                  cy="23"
                  r="18"
                  fill="none"
                  stroke={overBudget ? "var(--at-coral)" : "var(--at-accent)"}
                  strokeWidth="5"
                  strokeDasharray={circ}
                  strokeDashoffset={budgetOffset}
                  strokeLinecap="round"
                  transform="rotate(-90 23 23)"
                  className="gauge-ring"
                />
                <text
                  x="23"
                  y="26"
                  textAnchor="middle"
                  fill="var(--at-ink)"
                  fontSize="10"
                  fontFamily="monospace"
                  fontWeight="700"
                >
                  {budgetPct}%
                </text>
              </svg>
              <div className="min-w-0">
                <p className="text-[11px] text-at-muted">Budget Used</p>
                <p className="text-xs font-mono font-semibold tabular-nums-strict text-at-ink truncate">
                  ${totalUsd.toFixed(0)} / ${budgetUsd}
                </p>
                <p
                  className={`text-[10px] font-mono truncate ${
                    overBudget ? "text-at-coral" : "text-at-accent"
                  }`}
                >
                  {overBudget
                    ? `+$${(totalUsd - budgetUsd).toFixed(0)} over`
                    : `$${budgetLeft.toFixed(0)} left`}
                </p>
              </div>
            </div>
          </div>

          {/* 4-Stage Inspector Tabs */}
          <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-at-card border border-at-border">
            {(
              [
                { key: "guardrail", label: "Fit Hook", icon: <ShieldCheck className="h-3 w-3" /> },
                { key: "qa", label: "Visual QA", icon: <Eye className="h-3 w-3" /> },
                { key: "scale", label: "Scale", icon: <Ruler className="h-3 w-3" /> },
                { key: "catalog", label: "Shop MCP", icon: <ShoppingBag className="h-3 w-3" /> },
              ] as { key: LogTab; label: string; icon: React.ReactNode }[]
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`py-1.5 px-2 rounded-lg text-[11px] font-medium inline-flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                  activeTab === tab.key
                    ? "bg-at-surface text-at-ink font-semibold"
                    : "text-at-muted hover:text-at-ink"
                }`}
              >
                {tab.icon}
                <span className="truncate">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Active Trace Content */}
          {activeTab === "guardrail" && hookData && (
            <div className="rounded-xl bg-at-card border border-at-border p-2.5 space-y-1.5 font-mono text-[11px] tabular-nums-strict">
              <div className="flex items-center justify-between text-[10px] text-at-muted pb-1 border-b border-at-border">
                <span>.agents/hooks.json → verify_bundle.py</span>
                <span className="text-at-notice">{hookData.blocked_count} blocked</span>
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
                <span>gemini-decision-1 Visual Audit</span>
                <span className="text-at-emerald">
                  {decisionsQA.latency_ms} ms · {decisionsQA.output_tokens} tokens
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
                    className="flex items-center justify-between px-2 py-1 rounded bg-at-surface"
                  >
                    <span className="text-at-muted">{v.label}</span>
                    <span className={v.ok ? "text-at-emerald" : "text-at-coral"}>
                      {v.ok ? "YES" : "NO"}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between px-2 py-1 rounded bg-at-surface">
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
            <div className="rounded-xl bg-at-card border border-at-border p-2.5 space-y-1 font-mono text-[10px] tabular-nums-strict">
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
