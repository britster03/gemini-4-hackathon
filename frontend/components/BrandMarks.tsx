"use client";

import React from "react";

export function DatumLogo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logos/datum-logo.png"
      alt="Datum"
      className={`${className} rounded-lg object-cover border border-white/15 shadow-sm shrink-0`}
    />
  );
}

export function PoweredByBar({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`inline-flex items-center flex-wrap gap-2 ${
        compact ? "text-[11px]" : "text-xs"
      } text-at-muted`}
    >
      <span className="text-[10px] font-mono uppercase tracking-wider text-at-muted">
        Powered by
      </span>

      {/* Official Google Gemini Sponsor Logo */}
      <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-white border border-black/10 shadow-xs">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logos/google-gemini.svg"
          alt="Google Gemini"
          className={compact ? "h-4 w-auto object-contain" : "h-5 w-auto object-contain"}
        />
      </span>

      <span className="text-at-muted/60 font-mono text-[10px]">×</span>

      {/* Official Shopify Sponsor Logo */}
      <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-white border border-black/10 shadow-xs">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logos/shopify.svg"
          alt="Shopify"
          className={compact ? "h-4 w-auto object-contain" : "h-5 w-auto object-contain"}
        />
      </span>
    </div>
  );
}
