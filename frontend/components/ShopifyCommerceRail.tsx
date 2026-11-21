"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Store,
  X,
} from "lucide-react";
import type {
  AlternativeSKUCard,
  CartReadyEvent,
  VerifiedCartItem,
} from "@/types/clearbuy";

interface ShopifyCommerceRailProps {
  cartData: CartReadyEvent | null;
  budgetUsd: number;
  isLoading: boolean;
  isSwapping: boolean;
  hoveredItemId: string | null;
  pinnedItemId?: string | null;
  onHoverItem: (itemId: string | null) => void;
  onSelectVariant: (itemId: string, variantId: string) => void;
  onRerenderVariant: (item: VerifiedCartItem) => void;
  onSelectAlternative: (alt: AlternativeSKUCard) => void;
  onRequestSwapForItem: (item: VerifiedCartItem, promptOverride?: string) => void;
}

export function ShopifyCommerceRail({
  cartData,
  budgetUsd,
  isLoading,
  isSwapping,
  hoveredItemId,
  pinnedItemId,
  onHoverItem,
  onSelectVariant,
  onRerenderVariant,
  onSelectAlternative,
  onRequestSwapForItem,
}: ShopifyCommerceRailProps) {
  const [previewItem, setPreviewItem] = useState<VerifiedCartItem | null>(null);
  const [previewPhotoIdx, setPreviewPhotoIdx] = useState<number>(0);
  const [activeSkuTab, setActiveSkuTab] = useState<string>("all");
  const [expandedAltIds, setExpandedAltIds] = useState<Record<string, boolean>>({});
  const [activePhotoByItem, setActivePhotoByItem] = useState<Record<string, number>>({});
  const [dirtyVariantItems, setDirtyVariantItems] = useState<Record<string, boolean>>({});
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!pinnedItemId) return;
    setActiveSkuTab("all");
    cardRefs.current[pinnedItemId]?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [pinnedItemId]);

  useEffect(() => {
    if (!previewItem) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreviewItem(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [previewItem]);

  const totalUsd = cartData?.total_usd ?? 0;
  const budgetPct = Math.min(100, budgetUsd > 0 ? (totalUsd / budgetUsd) * 100 : 0);
  const isOverBudget = totalUsd > budgetUsd;

  const previewGallery =
    previewItem?.images && previewItem.images.length > 0
      ? previewItem.images
      : previewItem?.image_url
      ? [previewItem.image_url]
      : [];

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-at-card">
      {/* Dynamic Multi-SKU Tabs Bar (scales to ANY number of SKUs requested by user) */}
      {cartData && cartData.items.length > 1 && (
        <div className="px-4 py-2 border-b border-at-border flex items-center gap-1.5 overflow-x-auto bg-at-bg/40 shrink-0">
          <button
            type="button"
            onClick={() => setActiveSkuTab("all")}
            className={`px-2.5 py-1 rounded-md text-xs font-medium border shrink-0 cursor-pointer transition-colors ${
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
                className={`px-2.5 py-1 rounded-md text-xs font-medium border shrink-0 cursor-pointer transition-colors ${
                  isTabAct
                    ? "bg-at-cyan/15 border-at-cyan text-at-cyan font-semibold"
                    : "bg-at-card border-at-border text-at-muted hover:text-at-ink"
                }`}
              >
                #{it.pin_number} {it.category}
                {imgCount > 1 ? ` · ${imgCount}` : ""}
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
            const gallery =
              item.images && item.images.length > 0
                ? item.images
                : item.image_url
                ? [item.image_url]
                : [];
            const activeImgIdx = Math.min(
              activePhotoByItem[item.item_id] ?? 0,
              Math.max(0, gallery.length - 1)
            );
            const displayImg = gallery[activeImgIdx] || item.image_url;

            return (
              <div
                key={item.item_id}
                ref={(el) => {
                  cardRefs.current[item.item_id] = el;
                }}
                onMouseEnter={() => onHoverItem(item.item_id)}
                onMouseLeave={() => onHoverItem(null)}
                className={`rounded-xl p-3 bg-at-bg border transition-all space-y-2.5 ${
                  isHovered || pinnedItemId === item.item_id
                    ? "border-at-cyan ring-1 ring-at-cyan/30"
                    : item.fit_state === "blocked"
                    ? "border-at-coral/70"
                    : "border-at-border hover:border-at-cyan/50"
                }`}
              >
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewItem(item);
                      setPreviewPhotoIdx(activeImgIdx);
                    }}
                    title="Click to inspect all product photos"
                    className="relative h-20 w-20 rounded-xl overflow-hidden border border-at-border hover:border-at-cyan bg-at-card shrink-0 cursor-zoom-in group transition-colors"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={displayImg}
                      alt={item.title}
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                    <span className="absolute top-1 left-1 h-5 w-5 rounded-full bg-[#0C0D10]/90 border border-at-cyan text-[10px] font-mono font-bold text-white flex items-center justify-center">
                      {item.pin_number}
                    </span>
                  </button>

                  <div className="flex-1 min-w-0 flex flex-col justify-between gap-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-at-ink leading-snug line-clamp-2">
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
                      <span className="text-sm font-mono font-semibold tabular-nums-strict text-at-ink shrink-0">
                        ${item.price_usd.toFixed(2)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1 text-xs text-at-muted">
                        <Store className="h-3 w-3 shrink-0" />
                        <span>{item.merchant}</span>
                        <span className="text-at-emerald font-medium">· In Stock</span>
                      </span>

                      {item.fit_state === "verified" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-at-emerald/10 border border-at-emerald/30 text-[11px] font-mono tabular-nums-strict text-at-emerald">
                          <CheckCircle2 className="h-3 w-3" />
                          {item.fit_label}
                        </span>
                      )}
                      {item.fit_state === "unverified" && (
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-at-notice/10 border border-at-notice/40 text-[11px] text-at-notice">
                            <AlertTriangle className="h-3 w-3" />
                            Check size
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              onRequestSwapForItem(
                                item,
                                `Find a verified-size ${item.category.toLowerCase()} alternative`
                              )
                            }
                            className="px-2 py-0.5 rounded-full bg-at-card border border-at-border hover:border-at-cyan text-[11px] text-at-ink cursor-pointer"
                          >
                            Find fit
                          </button>
                        </div>
                      )}
                      {item.fit_state === "blocked" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-at-coral/10 border border-at-coral/40 text-[11px] text-at-coral">
                          <ShieldAlert className="h-3 w-3" />
                          {item.fit_label}
                        </span>
                      )}
                    </div>

                    {/* Multi-Photo Gallery Strip */}
                    {gallery.length > 1 && (
                      <div className="flex items-center gap-1 pt-0.5 overflow-x-auto">
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
                            className={`h-7 w-7 rounded overflow-hidden border shrink-0 cursor-pointer transition-all ${
                              gIdx === activeImgIdx
                                ? "border-at-cyan ring-1 ring-at-cyan/40"
                                : "border-at-border opacity-70 hover:opacity-100"
                            }`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={gUrl}
                              alt={`${item.title} #${gIdx + 1}`}
                              className="h-full w-full object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Finish Swatches + 1-Click Re-Render Finish + See Alternatives */}
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
                      onClick={() => {
                        const preAlts =
                          cartData?.alternatives_by_sku?.[item.sku_id] ||
                          cartData?.alternatives_by_sku?.[item.item_id] ||
                          [];
                        if (preAlts.length > 0) {
                          setExpandedAltIds((prev) => ({
                            ...prev,
                            [item.item_id]: !prev[item.item_id],
                          }));
                        } else {
                          onRequestSwapForItem(item);
                        }
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-at-card border border-at-border hover:border-at-cyan text-xs font-medium text-at-ink cursor-pointer"
                    >
                      <RefreshCw className="h-3 w-3 text-at-cyan" />
                      {(() => {
                        const cnt = (
                          cartData?.alternatives_by_sku?.[item.sku_id] ||
                          cartData?.alternatives_by_sku?.[item.item_id] ||
                          []
                        ).length;
                        return cnt > 0 ? `Alternatives (${cnt})` : "Find Alternatives";
                      })()}
                    </button>
                  </div>
                </div>

                {/* Inline Pre-Vetted Alternatives Visual Strip (auto-open on individual SKU tab or toggle) */}
                {(() => {
                  const preAlts =
                    cartData?.alternatives_by_sku?.[item.sku_id] ||
                    cartData?.alternatives_by_sku?.[item.item_id] ||
                    [];
                  const showAlts =
                    preAlts.length > 0 &&
                    (activeSkuTab === item.item_id || Boolean(expandedAltIds[item.item_id]));
                  if (!showAlts) return null;
                  return (
                    <div className="pt-2 border-t border-at-border space-y-2">
                      <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-at-muted">
                        <span>Pre-Vetted Alternatives ({preAlts.length})</span>
                        <span>1-Click Surgical Swap</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {preAlts.map((alt) => (
                          <div
                            key={alt.sku_id}
                            className={`rounded-lg p-2 bg-at-card border flex flex-col justify-between gap-2 ${
                              alt.hook_blocked ? "border-at-coral/60 opacity-85" : "border-at-border"
                            }`}
                          >
                            <div className="flex gap-2">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={alt.image_url}
                                alt={alt.title}
                                className="h-12 w-12 rounded-md object-cover border border-at-border shrink-0 bg-at-bg"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="text-[11px] font-medium text-at-ink line-clamp-2 leading-snug">
                                  {alt.title}
                                </p>
                                <p className="text-[10px] font-mono text-at-muted mt-0.5">
                                  ${alt.price_usd.toFixed(2)} · {alt.merchant}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center justify-between gap-1.5">
                              <span
                                className={`text-[10px] font-mono truncate ${
                                  alt.hook_blocked ? "text-at-coral" : "text-at-emerald"
                                }`}
                              >
                                {alt.fit_delta_label}
                              </span>
                              {alt.hook_blocked ? (
                                <span className="px-2 py-0.5 rounded bg-at-coral/15 text-at-coral text-[10px] font-mono shrink-0">
                                  Blocked
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  disabled={isSwapping}
                                  onClick={() => onSelectAlternative(alt)}
                                  className="px-2 py-0.5 rounded bg-at-cyan text-[#0C0D10] text-[10px] font-semibold hover:opacity-90 disabled:opacity-50 cursor-pointer shrink-0"
                                >
                                  {isSwapping ? "Swapping…" : "Swap into Room"}
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })}
      </div>

      {/* Sticky Combined Budget Bar + Per-Merchant Shop Pay Checkouts */}
      <div className="border-t border-at-border bg-at-card p-3 space-y-2.5 shrink-0">
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs font-mono tabular-nums-strict">
            <span className="text-at-muted">Bundle Total</span>
            <span className={isOverBudget ? "text-at-coral" : "text-at-emerald"}>
              ${totalUsd.toFixed(2)} / ${budgetUsd.toFixed(2)}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-at-bg overflow-hidden border border-at-border">
            <div
              className={`h-full transition-all duration-300 ${
                isOverBudget ? "bg-at-coral" : "bg-at-emerald"
              }`}
              style={{ width: `${budgetPct}%` }}
            />
          </div>
        </div>

        {cartData && cartData.checkouts.length > 0 ? (
          <div className="space-y-1.5">
            <div className="grid grid-cols-1 gap-1.5">
              {cartData.checkouts.map((chk) => (
                <a
                  key={chk.checkout_id || chk.merchant}
                  href={chk.continue_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2 px-3 rounded-xl bg-[#5A31F4] hover:opacity-95 text-white text-xs font-medium flex items-center justify-between transition-opacity"
                >
                  <span className="truncate">
                    Checkout at {chk.merchant} ({chk.item_count})
                  </span>
                  <span className="inline-flex items-center gap-1 font-mono tabular-nums-strict shrink-0">
                    ${chk.subtotal_usd.toFixed(2)}
                    <ExternalLink className="h-3 w-3 opacity-75" />
                  </span>
                </a>
              ))}
            </div>
            <div className="flex items-center justify-center gap-2 pt-0.5 text-[10px] text-at-muted">
              <span className="px-1.5 py-0.5 rounded bg-[#5A31F4]/15 text-[#5A31F4] font-semibold">
                Shop Pay
              </span>
              <span>Live merchant checkout handoff</span>
            </div>
          </div>
        ) : (
          <div className="h-9 rounded-xl bg-at-bg border border-at-border flex items-center justify-center text-xs text-at-muted">
            Finding verified in-stock items…
          </div>
        )}
      </div>

      {/* Full Multi-Image Product Lightbox Modal */}
      {previewItem && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setPreviewItem(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-at-card border border-at-border shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-at-border flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-at-ink truncate">
                  {previewItem.title}
                </p>
                <p className="text-xs text-at-muted">
                  {previewItem.merchant} · ${previewItem.price_usd.toFixed(2)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                className="p-1.5 rounded-lg hover:bg-at-bg text-at-muted hover:text-at-ink cursor-pointer"
                aria-label="Close preview"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="bg-at-bg p-6 flex flex-col items-center justify-center gap-3 max-h-[68vh]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewGallery[previewPhotoIdx] || previewItem.image_url}
                alt={previewItem.title}
                className="max-h-[50vh] w-auto max-w-full rounded-xl object-contain shadow-lg"
              />
              {previewGallery.length > 1 && (
                <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pt-1">
                  {previewGallery.map((gUrl, idx) => (
                    <button
                      key={`modal-img-${idx}`}
                      type="button"
                      onClick={() => setPreviewPhotoIdx(idx)}
                      className={`h-11 w-11 rounded-lg overflow-hidden border-2 shrink-0 cursor-pointer ${
                        idx === previewPhotoIdx
                          ? "border-at-cyan"
                          : "border-at-border opacity-70 hover:opacity-100"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={gUrl} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="px-4 py-3 border-t border-at-border flex items-center justify-between gap-2 text-xs">
              <span className="font-mono text-at-emerald">
                {previewItem.fit_label}
              </span>
              {previewItem.product_url ? (
                <a
                  href={previewItem.product_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-at-cyan hover:underline font-medium"
                >
                  View on {previewItem.merchant}
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <span className="text-at-muted">Pin #{previewItem.pin_number}</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
