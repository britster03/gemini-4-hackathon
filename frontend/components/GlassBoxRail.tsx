"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  Ruler,
  ShieldCheck,
  ShieldX,
  ShoppingBag,
} from "lucide-react";
import type {
  CartReadyEvent,
  CatalogReadyEvent,
  DecisionsQAResult,
  HookEvent,
  ScaleReadyEvent,
  StageStatus,
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

type PillKey = "scale" | "catalog" | "guardrail" | "qa";

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
  const [expanded, setExpanded] = useState<PillKey | null>("guardrail");

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

  const scaleStatus: StageStatus = scaleData
    ? scaleData.calibration_layer === "layer2_depth_exif" || scaleData.skew_warning
      ? "amber"
      : "verified"
    : isStreaming
    ? "active"
    : "pending";

  const catalogStatus: StageStatus = catalogData
    ? "verified"
    : scaleData && isStreaming
    ? "active"
    : "pending";

  const guardrailStatus: StageStatus = hookData
    ? hookData.status === "refused"
      ? "blocked"
      : hookData.status === "self_corrected" || hookData.blocked_count > 0
      ? "amber"
      : "verified"
    : catalogData && isStreaming
    ? "active"
    : "pending";

  const qaStatus: StageStatus = decisionsQA
    ? decisionsQA.confidence_band === "high_pass" && !decisionsQA.repaired
      ? "verified"
      : "amber"
    : cartData && isStreaming
    ? "active"
    : "pending";

  const pills: {
    key: PillKey;
    label: string;
    sub: string;
    status: StageStatus;
    icon: React.ReactNode;
  }[] = [
    {
      key: "scale",
      label: "Scale",
      sub: scaleData
        ? `${scaleData.anchors[0]?.label ?? "Depth"} ±${scaleData.tolerance_in}"`
        : scaleStatus === "active"
        ? `${elapsedSec.toFixed(1)}s`
        : "Pending",
      status: scaleStatus,
      icon: <Ruler className="h-3.5 w-3.5" />,
    },
    {
      key: "catalog",
      label: "Stores",
      sub: catalogData
        ? `${catalogData.stores_scanned} live`
        : catalogStatus === "active"
        ? "Searching…"
        : "Pending",
      status: catalogStatus,
      icon: <ShoppingBag className="h-3.5 w-3.5" />,
    },
    {
      key: "guardrail",
      label: "Fit Check",
      sub: hookData
        ? hookData.status === "refused"
          ? "Blocked"
          : hookData.blocked_count > 0
          ? `${hookData.blocked_count} auto-fixed`
          : "All fit"
        : guardrailStatus === "active"
        ? "Checking…"
        : "Pending",
      status: guardrailStatus,
      icon:
        guardrailStatus === "blocked" ? (
          <ShieldX className="h-3.5 w-3.5" />
        ) : (
          <ShieldCheck className="h-3.5 w-3.5" />
        ),
    },
    {
      key: "qa",
      label: "Visual QA",
      sub: decisionsQA
        ? `${decisionsQA.latency_ms} ms`
        : qaStatus === "active"
        ? "Rendering…"
        : "Pending",
      status: qaStatus,
      icon: <Eye className="h-3.5 w-3.5" />,
    },
  ];

  const getPillClasses = (status: StageStatus, isSelected: boolean) => {
    const base =
      "flex flex-col gap-0.5 px-2.5 py-2 rounded-xl border text-left transition-all cursor-pointer ";
    const ring = isSelected ? "ring-1 ring-at-ink/20 " : "";
    switch (status) {
      case "active":
        return (
          base +
          ring +
          "bg-at-cyan/10 border-at-cyan/60 text-at-cyan animate-pulse"
        );
      case "verified":
        return (
          base +
          ring +
          "bg-at-emerald/10 border-at-emerald/40 text-at-emerald hover:border-at-emerald"
        );
      case "amber":
        return (
          base +
          ring +
          "bg-at-notice/12 border-at-notice/50 text-at-notice hover:border-at-notice"
        );
      case "blocked":
        return (
          base +
          ring +
          "bg-at-coral/12 border-at-coral/60 text-at-coral hover:border-at-coral"
        );
      default:
        return (
          base +
          ring +
          "bg-at-surface border-at-border text-at-muted hover:border-at-ink/25"
        );
    }
  };

  return (
    <div className="border-b border-at-border bg-at-card p-3 space-y-2.5 shrink-0">
      {/* Two Tactile Animated Circular Gauges: Space Fit & Budget Used */}
      <div className="grid grid-cols-2 gap-2">
        <div className="p-2.5 rounded-xl bg-at-surface border border-at-border flex items-center gap-2.5">
          <svg width="44" height="44" viewBox="0 0 46 46" className="shrink-0">
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

        <div className="p-2.5 rounded-xl bg-at-surface border border-at-border flex items-center gap-2.5">
          <svg width="44" height="44" viewBox="0 0 46 46" className="shrink-0">
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

      {/* 4 Segmented Verification Pills */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-1.5">
        {pills.map((pill) => {
          const isOpen = expanded === pill.key;
          return (
            <button
              key={pill.key}
              type="button"
              onClick={() => setExpanded(isOpen ? null : pill.key)}
              className={getPillClasses(pill.status, isOpen)}
            >
              <div className="flex items-center justify-between w-full">
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold">
                  {pill.icon}
                  {pill.label}
                </span>
                {isOpen ? (
                  <ChevronUp className="h-3 w-3 opacity-70" />
                ) : (
                  <ChevronDown className="h-3 w-3 opacity-70" />
                )}
              </div>
              <span className="text-[10px] font-mono tabular-nums-strict truncate w-full text-at-ink/85">
                {pill.sub}
              </span>
            </button>
          );
        })}
      </div>

      {/* Expandable Monospace Trace Drawer */}
      {expanded === "guardrail" && hookData && (
        <div className="rounded-xl bg-at-surface border border-at-border p-2.5 space-y-1.5 font-mono text-[11px] tabular-nums-strict">
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

      {expanded === "qa" && decisionsQA && (
        <div className="rounded-xl bg-at-surface border border-at-border p-2.5 space-y-2 font-mono text-[11px] tabular-nums-strict">
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
                className="flex items-center justify-between px-2 py-1 rounded bg-at-card border border-at-border"
              >
                <span className="text-at-muted">{v.label}</span>
                <span className={v.ok ? "text-at-emerald" : "text-at-coral"}>
                  {v.ok ? "YES" : "NO"}
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between px-2 py-1 rounded bg-at-card border border-at-border">
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

      {expanded === "scale" && scaleData && (
        <div className="rounded-xl bg-at-surface border border-at-border p-2.5 space-y-1 font-mono text-[11px] tabular-nums-strict">
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

      {expanded === "catalog" && catalogData && (
        <div className="rounded-xl bg-at-surface border border-at-border p-2.5 space-y-1 font-mono text-[10px] tabular-nums-strict">
          {catalogData.mcp_calls.map((call, idx) => (
            <div key={idx} className="flex items-center gap-1.5 text-at-muted truncate">
              <CheckCircle2 className="h-3 w-3 text-at-emerald shrink-0" />
              <span className="truncate">{call}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
