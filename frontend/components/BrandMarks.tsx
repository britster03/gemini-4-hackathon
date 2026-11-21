"use client";

import React from "react";

export function DatumLogo({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} shrink-0`}
      aria-label="Datum"
    >
      <defs>
        <linearGradient
          id="datumBgGrad"
          x1="0"
          y1="0"
          x2="32"
          y2="32"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#181C24" />
          <stop offset="100%" stopColor="#0E1117" />
        </linearGradient>
        <linearGradient
          id="datumAccentGrad"
          x1="8"
          y1="8"
          x2="24"
          y2="24"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#34D399" />
        </linearGradient>
      </defs>
      <rect
        x="1"
        y="1"
        width="30"
        height="30"
        rx="8"
        fill="url(#datumBgGrad)"
        stroke="rgba(255,255,255,0.14)"
        strokeWidth="1.2"
      />
      {/* Architectural D Monogram */}
      <path
        d="M10 8.5H15.2C19.8 8.5 23 11.7 23 16C23 20.3 19.8 23.5 15.2 23.5H10V8.5Z"
        stroke="#F8FAFC"
        strokeWidth="2.1"
        strokeLinejoin="round"
      />
      {/* Caliper Crosshair Axis */}
      <path
        d="M10 16H17.4"
        stroke="url(#datumAccentGrad)"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <circle cx="17.8" cy="16" r="1.8" fill="#38BDF8" />
    </svg>
  );
}

/** Razor-sharp inline Google Gemini mark — adapts seamlessly to Dark & Light themes. */
function GeminiWordmark({ size = "sm" }: { size?: "sm" | "md" }) {
  const iconCls = size === "sm" ? "h-3.5 w-3.5" : "h-4.5 w-4.5";
  const textCls =
    size === "sm"
      ? "text-[13px] font-medium tracking-[-0.02em] leading-none"
      : "text-[16px] font-medium tracking-[-0.02em] leading-none";
  return (
    <span className="inline-flex items-center gap-1.5 text-at-ink/90 hover:text-at-ink transition-colors select-none">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`${iconCls} shrink-0`}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="geminiSparkGrad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#60A5FA" />
            <stop offset="55%" stopColor="#818CF8" />
            <stop offset="100%" stopColor="#C084FC" />
          </linearGradient>
        </defs>
        <path
          d="M12 2C12.4 7.1 16.9 11.6 22 12C16.9 12.4 12.4 16.9 12 22C11.6 16.9 7.1 12.4 2 12C7.1 11.6 11.6 7.1 12 2Z"
          fill="url(#geminiSparkGrad)"
        />
      </svg>
      <span className={textCls}>Gemini</span>
    </span>
  );
}

/** Razor-sharp inline Shopify mark with crisp cut-out S bag — never a flat white blob. */
function ShopifyWordmark({ size = "sm" }: { size?: "sm" | "md" }) {
  const iconCls = size === "sm" ? "h-3.5 w-3.5" : "h-4.5 w-4.5";
  const textCls =
    size === "sm"
      ? "text-[13px] font-bold italic tracking-[-0.03em] leading-none"
      : "text-[16px] font-bold italic tracking-[-0.03em] leading-none";
  return (
    <span className="inline-flex items-center gap-1.5 text-at-ink/90 hover:text-at-ink transition-colors select-none">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`${iconCls} shrink-0`}
        aria-hidden="true"
      >
        {/* Bag Handle */}
        <path
          d="M9 6.5C9 4.5 10.3 3 12 3C13.7 3 15 4.5 15 6.5"
          stroke="#95BF47"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        {/* Bag Body */}
        <path
          d="M5.2 6.8L18.8 6.8L20 20.2C20.1 21 19.5 21.7 18.7 21.7H5.3C4.5 21.7 3.9 21 4 20.2L5.2 6.8Z"
          fill="#95BF47"
        />
        {/* Crisp Cut-Out S */}
        <path
          d="M14.3 11.4C14.1 10.7 13.3 10.3 12.3 10.3C11.1 10.3 10.4 10.9 10.4 11.7C10.4 12.5 11.1 12.9 12.2 13.2L12.8 13.4C14 13.8 14.7 14.4 14.7 15.6C14.7 17 13.5 17.9 11.9 17.9C10.5 17.9 9.5 17.2 9.2 16.2"
          stroke="#0C0D10"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
      <span className={textCls}>shopify</span>
    </span>
  );
}

/** Minimal editorial sponsor strip — optically balanced, hairline-framed, theme-aware. */
export function PoweredByBar({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="inline-flex items-center gap-3 px-3.5 py-1.5 rounded-full bg-at-card/70 border border-at-border/70 shadow-sm">
        <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-at-muted/80 leading-none">
          Gemini 4 NYC
        </span>
        <span className="h-3 w-px bg-at-border/90" />
        <GeminiWordmark size="sm" />
        <span className="text-[10px] text-at-muted/50 select-none">×</span>
        <ShopifyWordmark size="sm" />
      </div>
    );
  }

  return (
    <div className="w-full py-3.5 border-y border-at-border/70 space-y-2.5">
      <div className="flex items-center justify-between text-[9px] font-mono uppercase tracking-[0.18em] text-at-muted/80">
        <span>Built at Gemini 4 NYC</span>
        <span>With Thanks to Our Sponsors</span>
      </div>
      <div className="flex items-center justify-around gap-6 py-1">
        <GeminiWordmark size="md" />
        <ShopifyWordmark size="md" />
      </div>
    </div>
  );
}
