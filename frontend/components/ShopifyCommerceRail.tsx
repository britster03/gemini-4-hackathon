"use client";

import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Code2,
  ExternalLink,
  RefreshCw,
  ShieldAlert,
  Store,
  X,
} from "lucide-react";
import type { CartReadyEvent, VerifiedCartItem } from "@/types/clearbuy";

interface ShopifyCommerceRailProps {
  cartData: CartReadyEvent | null;
  budgetUsd: number;
  isLoading: boolean;
  hoveredItemId: string | null;
  onHoverItem: (itemId: string | null) => void;
  onSelectVariant: (itemId: string, variantId: string) => void;
  onRequestSwapForItem: (item: VerifiedCartItem, promptOverride?: string) => void;
}

export function ShopifyCommerceRail({
  cartData,
  budgetUsd,
  isLoading,
  hoveredItemId,
  onHoverItem,
  onSelectVariant,
  onRequestSwapForItem,
}: ShopifyCommerceRailProps) {
  const [showUcpModal, setShowUcpModal] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  const totalUsd = cartData?.total_usd ?? 0;
  const budgetPct = Math.min(100, budgetUsd > 0 ? (totalUsd / budgetUsd) * 100 : 0);
  const isOverBudget = totalUsd > budgetUsd;

  const formatFreshness = (epochMs: number) => {
    const secs = Math.max(1, Math.floor((nowMs - epochMs) / 1000));
    if (secs < 60) return `Verified ${secs}s ago`;
    return `Verified ${Math.floor(secs / 60)}m ago`;
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-at-card">
      {/* Clean Shopping Header + UCP Inspector */}
      <div className="px-4 py-2.5 border-b border-at-border flex items-center justify-between gap-2 bg-at-card shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="text-sm font-semibold text-at-ink truncate">
            Your Room Items
          </h2>
          {cartData && (
            <span className="px-2 py-0.5 rounded-full bg-at-surface border border-at-border text-[11px] font-mono text-at-muted">
              {cartData.items.length} items
            </span>
          )}
        </div>
        <button
          type="button"
          disabled={!cartData}
          onClick={() => setShowUcpModal(true)}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-at-surface border border-at-border hover:border-at-cyan text-[10px] font-mono text-at-muted hover:text-at-cyan disabled:opacity-40 shrink-0 cursor-pointer transition-colors"
          title="Inspect live Shopify GIDs and UCP checkout payloads"
        >
          <Code2 className="h-3 w-3" />
          UCP
        </button>
      </div>

      {/* Spacious Scrollable Product Cards */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {isLoading && !cartData && (
          <>
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-32 rounded-xl bg-at-surface border border-at-border p-3 animate-pulse flex gap-3"
              >
                <div className="h-18 w-18 rounded-lg bg-at-border shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-3/4 rounded bg-at-border" />
                  <div className="h-3 w-1/2 rounded bg-at-border" />
                  <div className="h-5 w-2/3 rounded bg-at-border" />
                </div>
              </div>
            ))}
          </>
        )}

        {cartData?.items.map((item) => {
          const isHovered = hoveredItemId === item.item_id;
          return (
            <div
              key={item.item_id}
              onMouseEnter={() => onHoverItem(item.item_id)}
              onMouseLeave={() => onHoverItem(null)}
              className={`rounded-xl p-3 bg-at-surface border transition-all space-y-2.5 ${
                isHovered
                  ? "border-at-cyan ring-1 ring-at-cyan/30"
                  : item.fit_state === "blocked"
                  ? "border-at-coral/70"
                  : "border-at-border hover:border-at-accent/60"
              }`}
            >
              <div className="flex gap-3">
                <div className="relative h-18 w-18 rounded-lg overflow-hidden border border-at-border bg-at-card shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.image_url}
                    alt={item.title}
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute top-1 left-1 h-5 w-5 rounded-full bg-[#0D0E12]/90 border border-at-cyan text-[10px] font-mono font-bold text-white flex items-center justify-center">
                    {item.pin_number}
                  </span>
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-xs font-semibold text-at-ink leading-snug line-clamp-2">
                      {item.title}
                    </h3>
                    <span className="text-xs font-mono font-semibold tabular-nums-strict text-at-ink shrink-0">
                      ${item.price_usd.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-at-muted">
                    <span className="inline-flex items-center gap-1">
                      <Store className="h-3 w-3" />
                      {item.merchant}
                    </span>
                    <span>·</span>
                    <span className="font-mono tabular-nums-strict text-at-emerald">
                      In Stock · {formatFreshness(item.stock_verified_at)}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    {item.fit_state === "verified" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-at-emerald/12 border border-at-emerald/35 text-[10px] font-mono tabular-nums-strict text-at-emerald">
                        <CheckCircle2 className="h-3 w-3" />
                        {item.fit_label}
                      </span>
                    )}
                    {item.fit_state === "unverified" && (
                      <>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-at-notice/12 border border-at-notice/45 text-[10px] font-mono text-at-notice">
                          <AlertTriangle className="h-3 w-3" />
                          Unverified Specs
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            onRequestSwapForItem(
                              item,
                              `Find a verified-size ${item.category.toLowerCase()} alternative`
                            )
                          }
                          className="px-1.5 py-0.5 rounded bg-at-card border border-at-border hover:border-at-accent text-[10px] font-mono text-at-ink cursor-pointer"
                        >
                          Find verified SKU
                        </button>
                      </>
                    )}
                    {item.fit_state === "blocked" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-at-coral/12 border border-at-coral/50 text-[10px] font-mono text-at-coral">
                        <ShieldAlert className="h-3 w-3" />
                        {item.fit_label}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Finish Swatches + Swap */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-at-border">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {item.variants.map((variant) => {
                    const active = variant.variant_id === item.selected_variant_id;
                    return (
                      <button
                        key={variant.variant_id}
                        type="button"
                        onClick={() => onSelectVariant(item.item_id, variant.variant_id)}
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] border transition-colors cursor-pointer ${
                          active
                            ? "bg-at-card border-at-accent text-at-ink font-medium"
                            : "bg-transparent border-at-border text-at-muted hover:text-at-ink"
                        }`}
                      >
                        <span
                          className="h-2.5 w-2.5 rounded-full border border-black/20"
                          style={{ backgroundColor: variant.color_hex }}
                        />
                        {variant.label}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => onRequestSwapForItem(item)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-at-card border border-at-border hover:border-at-accent text-[10px] font-mono text-at-muted hover:text-at-ink shrink-0 cursor-pointer"
                >
                  <RefreshCw className="h-3 w-3" />
                  Swap
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Sticky Combined Budget Bar + Per-Merchant Shop Pay Checkout Footer */}
      <div className="border-t border-at-border bg-at-card p-3 space-y-2.5 shrink-0">
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs font-mono tabular-nums-strict">
            <span className="text-at-muted">Bundle Total</span>
            <span className={isOverBudget ? "text-at-coral" : "text-at-emerald"}>
              ${totalUsd.toFixed(2)} / ${budgetUsd.toFixed(2)}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-at-surface overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                isOverBudget ? "bg-at-coral" : "bg-at-emerald"
              }`}
              style={{ width: `${budgetPct}%` }}
            />
          </div>
        </div>

        {cartData && cartData.checkouts.length > 0 ? (
          <div className="space-y-2">
            {/* Primary Checkout All CTA */}
            {cartData.checkouts.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  cartData.checkouts.forEach((chk) => {
                    window.open(chk.continue_url, "_blank", "noopener,noreferrer");
                  });
                }}
                className="w-full h-10 px-3.5 rounded-xl bg-at-shop hover:opacity-95 text-white text-xs font-semibold flex items-center justify-between transition-opacity shadow-sm cursor-pointer"
              >
                <span>
                  Checkout All ({cartData.checkouts.length} Stores) via Shop Pay
                </span>
                <span className="inline-flex items-center gap-1.5 font-mono tabular-nums-strict shrink-0">
                  ${totalUsd.toFixed(2)}
                  <ExternalLink className="h-3.5 w-3.5" />
                </span>
              </button>
            )}

            {/* Compact Individual Per-Merchant UCP Store Pills */}
            <div className="flex flex-wrap gap-1.5">
              {cartData.checkouts.map((chk) => (
                <a
                  key={chk.checkout_id}
                  href={chk.continue_url}
                  target="_blank"
                  rel="noreferrer"
                  className={`flex-1 min-w-[110px] h-8 px-2.5 rounded-lg border text-[11px] font-medium flex items-center justify-between gap-1.5 transition-colors ${
                    cartData.checkouts.length === 1
                      ? "bg-at-shop border-at-shop text-white hover:opacity-95"
                      : "bg-at-surface border-at-border text-at-ink hover:border-at-shop hover:text-at-shop"
                  }`}
                >
                  <span className="truncate">{chk.merchant}</span>
                  <span className="inline-flex items-center gap-1 font-mono tabular-nums-strict shrink-0">
                    ${chk.subtotal_usd.toFixed(0)}
                    <ExternalLink className="h-3 w-3 opacity-75" />
                  </span>
                </a>
              ))}
            </div>
          </div>
        ) : (
          <div className="h-9 rounded-xl bg-at-surface border border-at-border flex items-center justify-center text-[11px] font-mono text-at-muted">
            Verifying fit &amp; budget before checkout…
          </div>
        )}
      </div>

      {/* Inspect UCP Payload Modal */}
      {showUcpModal && cartData && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-at-card border border-at-border shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="px-4 py-3 border-b border-at-border flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-at-ink">
                  Live Shop MCP GIDs &amp; UCP Checkout Payloads
                </h3>
                <p className="text-[11px] font-mono text-at-muted">
                  Direct HTTP JSON-RPC → https://mcp.shop.com/
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowUcpModal(false)}
                className="p-1.5 rounded-lg hover:bg-at-surface text-at-muted cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto space-y-3 font-mono text-[11px]">
              {cartData.items.map((item) => (
                <div
                  key={item.item_id}
                  className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-at-surface border border-at-border"
                >
                  <span className="text-at-ink truncate">{item.title}</span>
                  <span className="text-at-emerald shrink-0 ml-2">
                    {item.shopify_gid}
                  </span>
                </div>
              ))}
              <pre className="p-3 rounded-xl bg-at-surface border border-at-border text-at-muted overflow-x-auto">
                {JSON.stringify(cartData.checkouts, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
