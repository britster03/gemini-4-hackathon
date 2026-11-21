"use client";

import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Code2,
  ExternalLink,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Store,
  X,
} from "lucide-react";
import type { CartReadyEvent, VerifiedCartItem } from "@/types/clearbuy";

interface ShopifyCommerceRailProps {
  cartData: CartReadyEvent | null;
  budgetUsd: number;
  isLoading: boolean;
  isSwapping: boolean;
  hoveredItemId: string | null;
  onHoverItem: (itemId: string | null) => void;
  onSelectVariant: (itemId: string, variantId: string) => void;
  onRerenderVariant: (item: VerifiedCartItem) => void;
  onRequestSwapForItem: (item: VerifiedCartItem, promptOverride?: string) => void;
}

export function ShopifyCommerceRail({
  cartData,
  budgetUsd,
  isLoading,
  isSwapping,
  hoveredItemId,
  onHoverItem,
  onSelectVariant,
  onRerenderVariant,
  onRequestSwapForItem,
}: ShopifyCommerceRailProps) {
  const [showUcpModal, setShowUcpModal] = useState(false);
  const [dirtyVariantItems, setDirtyVariantItems] = useState<Record<string, boolean>>({});
  const [activeSkuTab, setActiveSkuTab] = useState<string>("all");
  const [activePhotoByItem, setActivePhotoByItem] = useState<Record<string, number>>({});
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
      {/* Protocol Status Line (Section 03.B Component D) */}
      <div className="px-4 py-2 border-b border-at-border flex items-center justify-between gap-2 bg-at-bg/60 shrink-0">
        <div className="flex items-center gap-1.5 text-[10px] font-mono text-at-muted truncate">
          <span className="h-1.5 w-1.5 rounded-full bg-at-emerald shrink-0" />
          <span className="truncate">
            Shop MCP · search_catalog → get_product → create_checkout
          </span>
        </div>
        <button
          type="button"
          disabled={!cartData}
          onClick={() => setShowUcpModal(true)}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-at-card border border-at-border hover:border-at-cyan text-[10px] font-mono text-at-cyan disabled:opacity-40 shrink-0 cursor-pointer transition-colors"
        >
          <Code2 className="h-3 w-3" />
          Inspect UCP Payload &amp; GIDs
        </button>
      </div>

      {/* Dynamic Multi-SKU Tabs Bar (scales to ANY number of SKUs requested by user) */}
      {cartData && cartData.items.length > 1 && (
        <div className="px-4 py-2 border-b border-at-border flex items-center gap-1.5 overflow-x-auto bg-at-bg/40 shrink-0">
          <button
            type="button"
            onClick={() => setActiveSkuTab("all")}
            className={`px-2.5 py-1 rounded-md text-[10px] font-mono border shrink-0 cursor-pointer transition-colors ${
              activeSkuTab === "all"
                ? "bg-at-cyan/15 border-at-cyan text-at-cyan font-semibold"
                : "bg-at-card border-at-border text-at-muted hover:text-at-ink"
            }`}
          >
            All ({cartData.items.length})
          </button>
          {cartData.items.map((it) => {
            const isTabAct = activeSkuTab === it.item_id;
            const imgCount = it.images?.length || (it.image_url ? 1 : 0);
            return (
              <button
                key={`tab-${it.item_id}`}
                type="button"
                onClick={() => setActiveSkuTab(it.item_id)}
                className={`px-2.5 py-1 rounded-md text-[10px] font-mono border shrink-0 cursor-pointer transition-colors ${
                  isTabAct
                    ? "bg-at-cyan/15 border-at-cyan text-at-cyan font-semibold"
                    : "bg-at-card border-at-border text-at-muted hover:text-at-ink"
                }`}
              >
                #{it.pin_number} · {it.category}
                {imgCount > 1 ? ` (${imgCount})` : ""}
              </button>
            );
          })}
        </div>
      )}

      {/* Spacious Scrollable Product Cards */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {isLoading && !cartData && (
          <>
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-32 rounded-xl bg-at-bg border border-at-border p-3 animate-pulse flex gap-3"
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

        {(cartData?.items ?? [])
          .filter((item) => activeSkuTab === "all" || item.item_id === activeSkuTab)
          .map((item) => {
          const isHovered = hoveredItemId === item.item_id;
          const needsRerender = Boolean(dirtyVariantItems[item.item_id]);
          const gallery = item.images && item.images.length > 0 ? item.images : item.image_url ? [item.image_url] : [];
          const activeImgIdx = Math.min(activePhotoByItem[item.item_id] ?? 0, Math.max(0, gallery.length - 1));
          const displayImg = gallery[activeImgIdx] || item.image_url;
          return (
            <div
              key={item.item_id}
              onMouseEnter={() => onHoverItem(item.item_id)}
              onMouseLeave={() => onHoverItem(null)}
              className={`rounded-xl p-3 bg-at-bg border transition-all space-y-2.5 ${
                isHovered
                  ? "border-at-cyan ring-1 ring-at-cyan/30"
                  : item.fit_state === "blocked"
                  ? "border-at-coral/70"
                  : "border-at-border hover:border-at-cyan/50"
              }`}
            >
              <div className="flex gap-3">
                <div className="relative h-20 w-20 rounded-lg overflow-hidden border border-at-border bg-at-card shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={displayImg}
                    alt={item.title}
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute top-1 left-1 h-5 w-5 rounded-full bg-[#0C0D10]/90 border border-at-cyan text-[10px] font-mono font-bold text-white flex items-center justify-center">
                    {item.pin_number}
                  </span>
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-xs font-semibold text-at-ink leading-snug line-clamp-2">
                      {item.product_url ? (
                        <a
                          href={item.product_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline inline-flex items-center gap-1"
                        >
                          <span>{item.title}</span>
                          <ExternalLink className="h-3 w-3 shrink-0 text-at-cyan" />
                        </a>
                      ) : (
                        item.title
                      )}
                    </h3>
                    <span className="text-xs font-mono font-semibold tabular-nums-strict text-at-ink shrink-0">
                      ${item.price_usd.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-at-muted">
                    <span className="inline-flex items-center gap-1">
                      <Store className="h-3 w-3" />
                      Sold by {item.merchant}
                    </span>
                    <span>·</span>
                    <span className="font-mono tabular-nums-strict text-at-emerald">
                      In Stock · {formatFreshness(item.stock_verified_at)}
                    </span>
                  </div>

                  {/* All Real Shopify Product Gallery Thumbnails */}
                  {gallery.length > 1 && (
                    <div className="flex items-center gap-1 pt-1 overflow-x-auto">
                      {gallery.map((gUrl, gIdx) => (
                        <button
                          key={`${item.item_id}-img-${gIdx}`}
                          type="button"
                          onClick={() =>
                            setActivePhotoByItem((prev) => ({
                              ...prev,
                              [item.item_id]: gIdx,
                            }))
                          }
                          className={`h-8 w-8 rounded overflow-hidden border shrink-0 cursor-pointer transition-all ${
                            gIdx === activeImgIdx
                              ? "border-at-cyan ring-1 ring-at-cyan/40"
                              : "border-at-border opacity-70 hover:opacity-100"
                          }`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={gUrl} alt={`${item.title} #${gIdx + 1}`} className="h-full w-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}

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
                          Unverified Specs · Check Seller
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            onRequestSwapForItem(
                              item,
                              `Find a verified-size ${item.category.toLowerCase()} alternative`
                            )
                          }
                          className="px-1.5 py-0.5 rounded bg-at-card border border-at-border hover:border-at-cyan text-[10px] font-mono text-at-ink cursor-pointer"
                        >
                          Find verified-size SKU
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

              {/* Finish Swatches + 1-Click Re-Render Finish + Swap */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-at-border flex-wrap">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {item.variants.map((variant) => {
                    const active = variant.variant_id === item.selected_variant_id;
                    return (
                      <button
                        key={variant.variant_id}
                        type="button"
                        onClick={() => {
                          onSelectVariant(item.item_id, variant.variant_id);
                          setDirtyVariantItems((prev) => ({
                            ...prev,
                            [item.item_id]: true,
                          }));
                        }}
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] border transition-colors cursor-pointer ${
                          active
                            ? "bg-at-card border-at-cyan text-at-ink font-medium"
                            : "bg-transparent border-at-border text-at-muted hover:text-at-ink"
                        }`}
                      >
                        <span
                          className="h-2.5 w-2.5 rounded-full border border-white/25"
                          style={{ backgroundColor: variant.color_hex }}
                        />
                        {variant.label}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {needsRerender && (
                    <button
                      type="button"
                      disabled={isSwapping}
                      onClick={() => {
                        setDirtyVariantItems((prev) => ({
                          ...prev,
                          [item.item_id]: false,
                        }));
                        onRerenderVariant(item);
                      }}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-at-cyan text-[#0C0D10] text-[10px] font-semibold disabled:opacity-50 cursor-pointer"
                    >
                      <Sparkles className="h-3 w-3" />
                      Re-render finish
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onRequestSwapForItem(item)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-at-card border border-at-border hover:border-at-cyan text-[10px] font-mono text-at-muted hover:text-at-ink cursor-pointer"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Swap
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Sticky Combined Budget Bar + Checkout All + Per-Merchant UCP + Shop Pay Banner */}
      <div className="border-t border-at-border bg-at-card p-3 space-y-2.5 shrink-0">
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs font-mono tabular-nums-strict">
            <span className="text-at-muted">Verified Bundle Total</span>
            <span className={isOverBudget ? "text-at-coral" : "text-at-emerald"}>
              ${totalUsd.toFixed(2)} / ${budgetUsd.toFixed(2)}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-at-bg overflow-hidden">
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
                      : "bg-at-bg border-at-border text-at-ink hover:border-at-shop hover:text-at-shop"
                  }`}
                >
                  <span className="truncate">Checkout at {chk.merchant}</span>
                  <span className="inline-flex items-center gap-1 font-mono tabular-nums-strict shrink-0">
                    ${chk.subtotal_usd.toFixed(2)}
                    <ExternalLink className="h-3 w-3 opacity-75" />
                  </span>
                </a>
              ))}
            </div>

            {/* Authentic Shop Pay Handoff Banner (Section 03.B Component D) */}
            <div className="flex items-center justify-center gap-2 pt-0.5 text-[10px] font-mono text-at-muted">
              <span className="px-1.5 py-0.5 rounded bg-at-shop/15 text-at-shop font-semibold">
                Shop Pay
              </span>
              <span>Native per-merchant Universal Commerce Protocol (UCP) handoff</span>
            </div>
          </div>
        ) : (
          <div className="h-9 rounded-xl bg-at-bg border border-at-border flex items-center justify-center text-[11px] font-mono text-at-muted">
            Awaiting hooks.json ALLOW before UCP checkout creation…
          </div>
        )}
      </div>

      {/* Inspect UCP Payload & GIDs Modal */}
      {showUcpModal && cartData && (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-at-card border border-at-border shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="px-4 py-3 border-b border-at-border flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-at-ink">
                  Live Shop MCP GIDs &amp; Per-Merchant UCP Payloads
                </h3>
                <p className="text-[11px] font-mono text-at-muted">
                  Direct HTTP JSON-RPC → https://mcp.shop.com/
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowUcpModal(false)}
                className="p-1.5 rounded-lg hover:bg-at-bg text-at-muted cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto space-y-3 font-mono text-[11px]">
              {cartData.items.map((item) => (
                <div
                  key={item.item_id}
                  className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-at-bg border border-at-border"
                >
                  <span className="text-at-ink truncate">{item.title}</span>
                  <span className="text-at-emerald shrink-0 ml-2">
                    {item.shopify_gid}
                  </span>
                </div>
              ))}
              <pre className="p-3 rounded-xl bg-at-bg border border-at-border text-at-muted overflow-x-auto">
                {JSON.stringify(cartData.checkouts, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
