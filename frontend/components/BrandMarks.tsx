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
      {/* Crisp geometric architectural D + caliper tick */}
      <rect x="2" y="2" width="28" height="28" rx="7" fill="url(#datumMarkGrad)" fillOpacity="0.12" stroke="url(#datumMarkGrad)" strokeWidth="1.75" />
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

export function PoweredByBar({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`inline-flex items-center gap-3 ${
        compact ? "text-xs" : "text-sm"
      } text-at-muted`}
    >
      <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-at-muted/70">
        Powered by
      </span>

      {/* Native Dark-Mode Google Gemini Mark (zero white box!) */}
      <span className="inline-flex items-center gap-1.5 text-at-ink font-medium tracking-tight">
        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" aria-hidden="true">
          <defs>
            <linearGradient id="gemGradNav" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#4285F4" />
              <stop offset="50%" stopColor="#9B72CB" />
              <stop offset="100%" stopColor="#D96570" />
            </linearGradient>
          </defs>
          <path
            d="M12 1.5C12.9 7.5 16.5 11.1 22.5 12C16.5 12.9 12.9 16.5 12 22.5C11.1 16.5 7.5 12.9 1.5 12C7.5 11.1 11.1 7.5 12 1.5Z"
            fill="url(#gemGradNav)"
          />
        </svg>
        <span className="text-xs font-semibold">Google Gemini</span>
      </span>

      <span className="h-3.5 w-px bg-at-border" aria-hidden="true" />

      {/* Native Dark-Mode Shopify Mark (zero white box!) */}
      <span className="inline-flex items-center gap-1.5 text-at-ink font-medium tracking-tight">
        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" aria-hidden="true">
          <path
            d="M19.8 5.9c-.1-.4-.4-.6-.8-.6-.3 0-2.7-.2-2.7-.2s-1.8-1.7-2-1.9c-.2-.2-.6-.1-.7-.1 0 0-.4.1-1.1.3-.7-1.8-1.8-3.4-3.7-3.4-.1 0-.2 0-.3 0C7.8.4 7.1 0 6.5 0 3.8 0 2.5 3.4 2.1 5.1c-1.1.3-1.9.6-2 .6-.6.2-.6.2-.7.8C-.7 7-2 19.6-2 19.6L14.2 22.6 22.5 20.8S19.9 6.3 19.8 5.9z"
            transform="translate(2.2 0.8) scale(0.88)"
            fill="#95BF47"
          />
          <path
            d="M13.6 11.4c-.3-.2-.9-.3-1.4-.3-1 0-1.5.4-1.5 1.1 0 .6.4.9 1.3 1.3 1.3.5 2 1.1 2 2.2 0 1.5-1.2 2.4-2.9 2.4-1.1 0-2-.3-2.6-.7l.4-1.3c.6.3 1.3.6 2.1.6.8 0 1.4-.4 1.4-1 0-.6-.4-.9-1.4-1.3-1.2-.5-1.9-1.1-1.9-2.1 0-1.3 1.1-2.2 2.8-2.2.9 0 1.6.2 2 .4l-.3 1z"
            fill="#FFFFFF"
          />
        </svg>
        <span className="text-xs font-semibold italic">shopify</span>
      </span>
    </div>
  );
}
