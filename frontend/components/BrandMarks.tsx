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
        <linearGradient id="datumMarkGrad" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#10B981" />
        </linearGradient>
      </defs>
      <rect
        x="2"
        y="2"
        width="28"
        height="28"
        rx="7"
        fill="url(#datumMarkGrad)"
        fillOpacity="0.12"
        stroke="url(#datumMarkGrad)"
        strokeWidth="1.75"
      />
      <path
        d="M10.5 8.5H15.5C20.2 8.5 23.5 11.7 23.5 16C23.5 20.3 20.2 23.5 15.5 23.5H10.5V8.5Z"
        stroke="url(#datumMarkGrad)"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path d="M10.5 16H17.5" stroke="#38BDF8" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="17.5" cy="16" r="1.75" fill="#10B981" />
    </svg>
  );
}

/** Minimal editorial monochrome-tinted sponsor strip (hairline borders, generous spacing, zero boxes). */
export function PoweredByBar({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="inline-flex items-center gap-5 opacity-85">
        <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-at-muted">
          Built at Gemini 4 NYC
        </span>
        <span className="h-3 w-px bg-at-border" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logos/google-gemini.svg"
          alt="Google Gemini"
          className="h-4.5 w-auto object-contain brightness-0 invert opacity-85 hover:opacity-100 transition-opacity"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logos/shopify.svg"
          alt="Shopify"
          className="h-4.5 w-auto object-contain brightness-0 invert opacity-85 hover:opacity-100 transition-opacity"
        />
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
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logos/google-gemini.svg"
          alt="Google Gemini"
          className="h-6 w-auto object-contain brightness-0 invert opacity-80 hover:opacity-100 transition-opacity"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logos/shopify.svg"
          alt="Shopify"
          className="h-6 w-auto object-contain brightness-0 invert opacity-80 hover:opacity-100 transition-opacity"
        />
      </div>
    </div>
  );
}
