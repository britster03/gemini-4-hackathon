"use client";

import React from "react";

export function DatumLogo({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Datum logo"
    >
      <defs>
        <linearGradient id="datumGrad" x1="2" y1="2" x2="34" y2="34" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#10B981" />
        </linearGradient>
      </defs>
      <rect
        x="1.5"
        y="1.5"
        width="33"
        height="33"
        rx="9"
        fill="#0C0D10"
        stroke="url(#datumGrad)"
        strokeWidth="2"
      />
      {/* Architectural Datum Crosshair + Surveying Caliper Diamond */}
      <path
        d="M18 6.5V11.5M18 24.5V29.5M6.5 18H11.5M24.5 18H29.5"
        stroke="#38BDF8"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M18 11.5L24.5 18L18 24.5L11.5 18L18 11.5Z"
        fill="url(#datumGrad)"
        fillOpacity="0.22"
        stroke="url(#datumGrad)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="18" cy="18" r="2.2" fill="#F4F5F7" />
    </svg>
  );
}

export function PoweredByBar({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`inline-flex items-center flex-wrap gap-2 ${
        compact ? "text-[11px]" : "text-xs"
      } text-at-muted`}
    >
      <span className="text-[10px] font-mono uppercase tracking-wider text-at-muted/80">
        Powered by
      </span>

      {/* Google Gemini 4 Mark */}
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-at-bg border border-at-border text-at-ink font-medium">
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
          <defs>
            <linearGradient id="geminiSpark" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#4285F4" />
              <stop offset="50%" stopColor="#9B72CB" />
              <stop offset="100%" stopColor="#D96570" />
            </linearGradient>
          </defs>
          <path
            d="M12 2C12.8 7.4 16.6 11.2 22 12C16.6 12.8 12.8 16.6 12 22C11.2 16.6 7.4 12.8 2 12C7.4 11.2 11.2 7.4 12 2Z"
            fill="url(#geminiSpark)"
          />
        </svg>
        <span>Google Gemini</span>
      </span>

      {/* Shopify Mark */}
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-at-bg border border-at-border text-at-ink font-medium">
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
          <path
            d="M19.5 6.4c-.1-.4-.4-.6-.7-.6-.3 0-2.5-.2-2.5-.2s-1.7-1.6-1.9-1.8c-.2-.2-.5-.1-.7-.1 0 0-.4.1-1 .3-.6-1.6-1.6-3-3.4-3-.1 0-.2 0-.3 0C8.4.4 7.7 0 7.1 0 4.6 0 3.4 3.1 3 4.7c-1 .3-1.7.5-1.8.6-.5.2-.5.2-.6.7C.5 6.4-1 18.2-1 18.2L14.2 21l7.8-1.7S19.6 6.8 19.5 6.4zM11.6 4.2c-.8.2-1.7.5-2.6.8.5-1.8 1.4-2.7 2.2-3 .3.7.4 1.5.4 2.2zm-1.4-3.1c-.8.4-1.7 1.4-2.2 3.4-.7.2-1.4.4-2 .6.6-1.9 1.9-4 4.2-4z"
            transform="translate(2 1.5) scale(0.9)"
            fill="#95BF47"
          />
          <path
            d="M13.5 11.2c-.3-.2-.8-.3-1.3-.3-.9 0-1.4.4-1.4 1 0 .6.4.9 1.2 1.2 1.2.4 1.9 1 1.9 2.1 0 1.4-1.1 2.3-2.7 2.3-1 0-1.9-.3-2.4-.7l.4-1.2c.5.3 1.2.6 1.9.6.8 0 1.3-.4 1.3-1 0-.6-.4-.9-1.3-1.3-1.1-.4-1.8-1-1.8-2 0-1.2 1-2.1 2.6-2.1.8 0 1.5.2 1.9.4l-.3 1z"
            fill="#FFFFFF"
          />
        </svg>
        <span>Shopify</span>
      </span>
    </div>
  );
}
