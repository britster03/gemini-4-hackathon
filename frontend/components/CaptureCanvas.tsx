"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  DollarSign,
  GripVertical,
  Layers,
  Mic,
  MicOff,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Store,
  Upload,
  X,
} from "lucide-react";
import type { DemoPreset, SpaceScope } from "@/types/clearbuy";
import {
  extractBudgetFromPrompt,
  preprocessRoomImage,
  type ProcessedRoomImage,
} from "@/lib/imageUtils";
import { DEMO_PRESETS } from "@/lib/mockData";

interface CaptureCanvasProps {
  onLaunchSession: (payload: {
    images: ProcessedRoomImage[];
    prompt: string;
    budgetUsd: number;
    scope: SpaceScope;
    preset?: DemoPreset;
  }) => void;
}

interface SpeechRecognitionEventLike {
  results: {
    length: number;
    [index: number]: {
      0: { transcript: string };
      isFinal: boolean;
    };
  };
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type ShowcaseMode = "original" | "blueprint" | "rendered";

const SCOPE_OPTIONS: { value: SpaceScope; label: string; hint: string }[] = [
  { value: "auto", label: "Auto", hint: "Neon auto-detects zones & anchors" },
  { value: "nook", label: "Single Nook", hint: 'Wall gap + 2" buffer + 24" pull-out' },
  { value: "upgrade", label: "Setup Upgrade", hint: "Masks kept furniture as Protected Anchors" },
  { value: "full_room", label: "Full Room", hint: "Multi-zone segmentation + >=24\" walkways" },
];

interface ShowcasePinItem {
  pin: number;
  id: string;
  category: string;
  title: string;
  merchant: string;
  price: number;
  dims: string;
  fitBadge: string;
  xPct: number;
  yPct: number;
  swapTitle?: string;
  swapMerchant?: string;
  swapPrice?: number;
  swapDelta?: string;
}

const SHOWCASE_PINS_V1: ShowcasePinItem[] = [
  {
    pin: 1,
    id: "desk",
    category: "Desk",
    title: "Home Standard 47-Inch White Desk w/ Riser",
    merchant: "Home Standard",
    price: 119.95,
    dims: '47.2" W × 23.6" D × 34.8" H',
    fitBadge: 'Verified Fit · 47.2" ≤ 53.6"',
    xPct: 39,
    yPct: 60,
    swapTitle: '72" Executive Walnut Desk',
    swapMerchant: "Adversarial Test",
    swapPrice: 389.0,
    swapDelta: 'Blocked by hooks.json (+18.4" over wall)',
  },
  {
    pin: 2,
    id: "chair",
    category: "Chair",
    title: "Garvee Ergonomic Mesh Chair w/ Footrest",
    merchant: "Garvee Home",
    price: 158.99,
    dims: '26.0" W × 25.0" D × 46.1" H',
    fitBadge: '24" Pull-Out Verified',
    xPct: 57,
    yPct: 56,
    swapTitle: "Sihoo Doro C300 Ergonomic Chair",
    swapMerchant: "Official US Sihoo Store",
    swapPrice: 269.99,
    swapDelta: "+$111 · Fits 24\" Clr (Preview Swap v2)",
  },
  {
    pin: 3,
    id: "lamp",
    category: "Lamp",
    title: "Kylie Pleated Ceramic Table Lamp",
    merchant: "Ornate Furniture",
    price: 54.0,
    dims: '6.8" W × 6.8" D × 9.0" H',
    fitBadge: "Surface Top · 0\" Wall Span",
    xPct: 41.5,
    yPct: 43,
  },
];

export function CaptureCanvas({ onLaunchSession }: CaptureCanvasProps) {
  const [images, setImages] = useState<ProcessedRoomImage[]>([]);
  const [prompt, setPrompt] = useState(
    "Set up a compact home office desk, ergonomic chair, and table lamp in this alcove under $480"
  );
  const [budgetUsd, setBudgetUsd] = useState<number>(480);
  const [scope, setScope] = useState<SpaceScope>("auto");
  const [showcaseMode, setShowcaseMode] = useState<ShowcaseMode>("rendered");
  const [showcaseSwappedV2, setShowcaseSwappedV2] = useState<boolean>(false);
  const [selectedPin, setSelectedPin] = useState<number>(2);
  const [wipePct, setWipePct] = useState<number>(100);
  const [isWiping, setIsWiping] = useState<boolean>(false);

  const [isDragging, setIsDragging] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [micDenied, setMicDenied] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    const detected = extractBudgetFromPrompt(prompt, budgetUsd);
    if (detected !== budgetUsd && detected >= 50 && detected <= 25000) {
      setBudgetUsd(detected);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt]);

  const handleFiles = useCallback(async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setIsProcessingImage(true);
    try {
      const selected = Array.from(fileList)
        .filter((f) => f.type.startsWith("image/"))
        .slice(0, 3);
      const processed = await Promise.all(
        selected.map((f) => preprocessRoomImage(f, 1024))
      );
      setImages((prev) => [...prev, ...processed].slice(0, 3));
    } finally {
      setIsProcessingImage(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const startVoiceCapture = () => {
    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechRec) {
      setMicDenied(true);
      return;
    }
    try {
      const rec = new SpeechRec();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "en-US";
      rec.onresult = (event) => {
        let transcript = "";
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript.trim()) setPrompt(transcript.trim());
      };
      rec.onerror = () => {
        setMicDenied(true);
        setIsListening(false);
      };
      rec.onend = () => setIsListening(false);
      recognitionRef.current = rec;
      rec.start();
      setIsListening(true);
    } catch {
      setMicDenied(true);
    }
  };

  const stopVoiceCapture = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
  };

  const handleRunPreset = (preset: DemoPreset) => {
    onLaunchSession({
      images: [],
      prompt: preset.prompt,
      budgetUsd: preset.budget_usd,
      scope: preset.scope,
      preset,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (images.length === 0) {
      handleRunPreset({
        ...DEMO_PRESETS[0],
        prompt: prompt.trim() || DEMO_PRESETS[0].prompt,
        budget_usd: budgetUsd,
        scope: scope === "auto" ? DEMO_PRESETS[0].scope : scope,
      });
      return;
    }
    onLaunchSession({
      images,
      prompt: prompt.trim() || DEMO_PRESETS[0].prompt,
      budgetUsd,
      scope,
    });
  };

  const renderedHeroUrl = showcaseSwappedV2
    ? "/demos/nyc_5_swap_v2.jpg"
    : "/demos/nyc_4_render_v1.jpg";

  const activePinItem =
    SHOWCASE_PINS_V1.find((p) => p.pin === selectedPin) || SHOWCASE_PINS_V1[1];
  const activeScopeObj =
    SCOPE_OPTIONS.find((s) => s.value === scope) || SCOPE_OPTIONS[0];

  return (
    <div
      className="h-[calc(100vh-48px)] w-screen flex flex-col lg:flex-row overflow-hidden bg-at-bg"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        capture="environment"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {/* =====================================================================
          LEFT 64% — FULL-BLEED INTERACTIVE SPATIAL VIEWPORT (PINS + WIPE + CAD)
          ===================================================================== */}
      <section className="relative w-full lg:w-[64%] h-[50%] lg:h-full flex flex-col border-b lg:border-b-0 lg:border-r border-at-border bg-[#0C0D10] min-h-0">
        {/* Top Viewport Bar */}
        <div className="px-4 py-2.5 border-b border-white/10 bg-[#14161B]/95 backdrop-blur flex flex-wrap items-center justify-between gap-2 shrink-0 z-20">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#10B981]/15 border border-[#10B981]/40 text-[11px] font-mono text-[#10B981]">
              <CheckCircle2 className="h-3.5 w-3.5" />
              US Outlet · 4.5&quot; H → 9.2 px/in (±1.5&quot;)
            </span>
            <span className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#38BDF8]/12 border border-[#38BDF8]/35 text-[11px] font-mono text-[#38BDF8]">
              Zone 1 · 55.6&quot; W (53.6&quot; usable) · ≥24&quot; Clr
            </span>
          </div>

          {images.length === 0 && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-[#0C0D10] border border-white/12 text-xs">
                {(["original", "blueprint", "rendered"] as ShowcaseMode[]).map(
                  (mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setShowcaseMode(mode)}
                      className={`px-3 py-1 rounded-md font-medium capitalize transition-all cursor-pointer ${
                        showcaseMode === mode
                          ? "bg-[#38BDF8] text-[#0C0D10] font-semibold"
                          : "text-[#9BA1AE] hover:text-white"
                      }`}
                    >
                      {mode}
                    </button>
                  )
                )}
              </div>

              {showcaseMode === "rendered" && (
                <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-[#0C0D10] border border-white/12 text-[11px] font-mono">
                  <button
                    type="button"
                    onClick={() => setShowcaseSwappedV2(false)}
                    className={`px-2 py-1 rounded cursor-pointer ${
                      !showcaseSwappedV2
                        ? "bg-[#10B981]/20 text-[#10B981] font-semibold"
                        : "text-[#9BA1AE] hover:text-white"
                    }`}
                  >
                    v1
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowcaseSwappedV2(true);
                      setSelectedPin(2);
                    }}
                    className={`px-2 py-1 rounded cursor-pointer ${
                      showcaseSwappedV2
                        ? "bg-[#10B981]/20 text-[#10B981] font-semibold"
                        : "text-[#9BA1AE] hover:text-white"
                    }`}
                  >
                    v2 Swap
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Full-Bleed Canvas Body (Ambient Blur Fill + Crisp Frame + Clickable Pins) */}
        <div
          className={`relative flex-1 min-h-0 overflow-hidden select-none flex items-center justify-center ${
            isDragging ? "ring-4 ring-inset ring-[#38BDF8]" : ""
          }`}
          onPointerMove={(e) => {
            if (!isWiping) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = ((e.clientX - rect.left) / rect.width) * 100;
            setWipePct(Math.max(5, Math.min(95, pct)));
          }}
          onPointerUp={() => setIsWiping(false)}
          onPointerLeave={() => setIsWiping(false)}
        >
          {isProcessingImage && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/55 backdrop-blur-xs">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#14161B] border border-[#38BDF8]/50 text-xs font-mono text-white shadow-xl">
                <Sparkles className="h-4 w-4 text-[#38BDF8] animate-spin" />
                Downsizing to 1024px &amp; extracting camera EXIF…
              </div>
            </div>
          )}

          {images.length === 0 ? (
            <>
              {/* Subtle Ambient Edge-to-Edge Backdrop so there are ZERO harsh black sidebars */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={
                  showcaseMode === "original"
                    ? "/demos/nyc_1_original.jpg"
                    : showcaseMode === "blueprint"
                    ? "/demos/nyc_2_blueprint.jpg"
                    : renderedHeroUrl
                }
                alt=""
                aria-hidden="true"
                className="absolute inset-0 w-full h-full object-cover blur-2xl scale-110 opacity-45 pointer-events-none"
              />

              {/* Crisp Uncropped Room Stage */}
              <div className="relative h-full w-full flex items-center justify-center">
                {/* Base Original / Blueprint Photo */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={
                    showcaseMode === "blueprint"
                      ? "/demos/nyc_2_blueprint.jpg"
                      : "/demos/nyc_1_original.jpg"
                  }
                  alt="NYC Apartment Alcove"
                  className="max-h-full max-w-full w-full h-full object-contain"
                />

                {/* Rendered Wipe Layer + Clickable Hotspot Pins (1, 2, 3) */}
                {showcaseMode === "rendered" && (
                  <>
                    <div
                      className="absolute inset-0 flex items-center justify-center overflow-hidden"
                      style={{ clipPath: `inset(0 ${100 - wipePct}% 0 0)` }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={renderedHeroUrl}
                        alt="Photorealistic Shopify SKU Render"
                        className="max-h-full max-w-full w-full h-full object-contain"
                      />
                    </div>

                    {/* Interactive Drag Wipe Handle */}
                    <div
                      className="absolute top-0 bottom-0 z-20 w-0.5 bg-[#38BDF8] cursor-ew-resize"
                      style={{ left: `${wipePct}%` }}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setIsWiping(true);
                      }}
                      title="Drag left/right to compare Original vs Rendered"
                    >
                      <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 h-9 w-6 rounded-full bg-[#0C0D10]/90 border border-[#38BDF8] flex items-center justify-center text-[#38BDF8] shadow-lg">
                        <GripVertical className="h-3.5 w-3.5" />
                      </div>
                    </div>

                    {/* Clickable Hotspot Pins (1, 2, 3) -> Select SKU & Show Alternatives */}
                    {SHOWCASE_PINS_V1.map((p) => {
                      const active = selectedPin === p.pin;
                      const displayTitle =
                        p.pin === 2 && showcaseSwappedV2 && p.swapTitle
                          ? p.swapTitle
                          : p.title;
                      return (
                        <button
                          key={p.pin}
                          type="button"
                          onClick={() => setSelectedPin(p.pin)}
                          style={{ left: `${p.xPct}%`, top: `${p.yPct}%` }}
                          className={`absolute -translate-x-1/2 -translate-y-1/2 z-20 h-8 w-8 rounded-full font-mono text-xs font-bold flex items-center justify-center transition-all cursor-pointer shadow-xl ${
                            active
                              ? "bg-[#38BDF8] text-[#0C0D10] scale-125 ring-4 ring-[#38BDF8]/35"
                              : "bg-[#0C0D10]/90 text-white border-2 border-white/85 hover:border-[#38BDF8]"
                          }`}
                          title={`Click to inspect #${p.pin} ${displayTitle}`}
                        >
                          {p.pin}
                        </button>
                      );
                    })}
                  </>
                )}
              </div>

              {/* Bottom Overlay Hint Bar */}
              <div className="absolute bottom-3 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
                <span className="px-3 py-1.5 rounded-full bg-[#0C0D10]/85 backdrop-blur border border-white/15 text-[11px] font-mono text-[#F4F5F7]">
                  Click pins <strong className="text-[#38BDF8]">#1 #2 #3</strong> to inspect verified Shopify SKUs &amp; swap alternatives · Drag cyan handle to wipe
                </span>
                <span className="px-3 py-1.5 rounded-full bg-[#0C0D10]/85 backdrop-blur border border-[#10B981]/40 text-[11px] font-mono text-[#10B981]">
                  Decisions QA · 0 Clipping · Honest Scale · 184 ms
                </span>
              </div>
            </>
          ) : (
            /* User Uploaded Photos View */
            <div className="relative w-full h-full flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={images[0].previewUrl}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 w-full h-full object-cover blur-2xl scale-110 opacity-40 pointer-events-none"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={images[0].previewUrl}
                alt="Your uploaded room"
                className="relative max-h-full max-w-full w-full h-full object-contain"
              />
              <div className="absolute bottom-4 left-4 right-4 z-20 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {images.map((img, idx) => (
                    <div
                      key={img.previewUrl}
                      className="relative h-14 w-20 rounded-lg overflow-hidden border-2 border-[#38BDF8] shadow-lg bg-[#0C0D10]"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.previewUrl}
                        alt={`Angle ${idx + 1}`}
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setImages((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-black/80 text-white cursor-pointer"
                        aria-label="Remove photo"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {images.length < 3 && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="h-14 px-3.5 rounded-lg bg-[#14161B]/90 backdrop-blur border border-white/20 text-xs font-mono text-white hover:border-[#38BDF8] cursor-pointer"
                    >
                      + Angle ({images.length}/3)
                    </button>
                  )}
                </div>
                {images[0]?.exifFocalMm && (
                  <span className="px-3 py-1.5 rounded-full bg-[#0C0D10]/90 border border-[#38BDF8]/40 text-xs font-mono text-[#38BDF8]">
                    EXIF {images[0].exifFocalMm}mm Ready
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* =====================================================================
          RIGHT 36% — SPATIAL COMPILER DECK + CLICKABLE SKU & SWAP INSPECTOR
          ===================================================================== */}
      <aside className="w-full lg:w-[36%] h-[50%] lg:h-full bg-at-card flex flex-col justify-between overflow-y-auto p-5 space-y-4">
        {/* 1. Headline + Architecture Badges */}
        <div className="space-y-2.5">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-at-cyan/12 border border-at-cyan/35 text-[10px] font-mono uppercase tracking-wider text-at-cyan">
            <Layers className="h-3 w-3" />
            Verified Spatial Commerce Compiler
          </div>
          <h1 className="text-2xl xl:text-3xl font-semibold tracking-[-0.02em] text-at-ink leading-tight">
            Compile real Shopify furniture into any room—zero tape measure.
          </h1>
          <p className="text-xs text-at-muted leading-relaxed">
            Auto-calibrates inches from room anchors &amp;{" "}
            <code className="font-mono text-at-cyan">Depth-Anything-V2</code>, hard-blocks
            oversized or over-budget items via{" "}
            <code className="font-mono text-at-emerald">hooks.json</code>, renders exact 2D
            merchant SKUs, and checks out via live Shop Pay UCP.
          </p>
        </div>

        {/* 2. Upload + Scope + Voice/Prompt + Budget Composer */}
        <form
          onSubmit={handleSubmit}
          className="rounded-xl p-3.5 bg-at-bg border border-at-border space-y-3"
        >
          {/* Dropzone Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-2.5 px-3.5 rounded-lg border border-dashed border-at-cyan/50 bg-at-card hover:border-at-cyan flex items-center justify-between gap-2 text-xs cursor-pointer transition-all"
          >
            <span className="inline-flex items-center gap-2 font-medium text-at-ink">
              <Upload className="h-4 w-4 text-at-cyan shrink-0" />
              {images.length > 0
                ? `${images.length} Room Photo${images.length > 1 ? "s" : ""} Loaded — Add More`
                : "Upload or Drop 1–3 Room Photos (or run live sample below)"}
            </span>
            <span className="text-[10px] font-mono text-at-cyan shrink-0">1024px · EXIF</span>
          </button>

          {/* Scope Selector Pills + Active Compiler Rule */}
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-at-muted">
                Compiler Scope
              </span>
              <span className="text-[10px] font-mono text-at-cyan truncate">
                {activeScopeObj.hint}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1 p-1 rounded-lg bg-at-card border border-at-border">
              {SCOPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setScope(opt.value);
                    if (opt.value === "nook") {
                      setPrompt(
                        "Set up a compact home office desk, ergonomic chair, and table lamp in this alcove under $480"
                      );
                      setBudgetUsd(480);
                    } else if (opt.value === "upgrade") {
                      setPrompt(
                        "Keep my existing desk; replace the chair and add a warm task lamp under $340"
                      );
                      setBudgetUsd(340);
                    } else if (opt.value === "full_room") {
                      setPrompt(
                        "Furnish this whole living room—sofa, coffee table, rug, and floor lamp under $1,350"
                      );
                      setBudgetUsd(1350);
                    }
                  }}
                  className={`py-1.5 px-1.5 rounded-md text-[11px] font-medium transition-all cursor-pointer truncate ${
                    scope === opt.value
                      ? "bg-at-cyan text-[#0C0D10] font-semibold"
                      : "text-at-muted hover:text-at-ink"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Prompt + Hold-to-Speak */}
          <div className="relative">
            <textarea
              rows={2}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Speak or type your room goal & budget..."
              className="w-full rounded-lg bg-at-card border border-at-border focus:border-at-cyan p-2.5 pr-11 text-xs text-at-ink placeholder:text-at-muted focus:outline-none resize-none leading-relaxed"
            />
            <button
              type="button"
              onMouseDown={startVoiceCapture}
              onMouseUp={stopVoiceCapture}
              onMouseLeave={() => isListening && stopVoiceCapture()}
              onTouchStart={startVoiceCapture}
              onTouchEnd={stopVoiceCapture}
              title={
                micDenied
                  ? "Mic unavailable — type your request"
                  : "Hold to speak your request"
              }
              className={`absolute right-2 top-2 h-8 w-8 rounded-lg border inline-flex items-center justify-center cursor-pointer transition-all ${
                isListening
                  ? "bg-at-cyan/20 border-at-cyan text-at-cyan"
                  : "bg-at-bg border-at-border hover:border-at-cyan text-at-cyan"
              }`}
            >
              {micDenied ? (
                <MicOff className="h-3.5 w-3.5 text-at-notice" />
              ) : (
                <Mic className="h-3.5 w-3.5" />
              )}
            </button>
          </div>

          {/* Budget + Primary Compile CTA */}
          <div className="flex items-center gap-2">
            <label className="h-10 px-3 rounded-lg bg-at-card border border-at-border inline-flex items-center gap-1 text-xs font-mono tabular-nums-strict text-at-emerald shrink-0">
              <span className="text-[10px] text-at-muted mr-0.5">MAX</span>
              <DollarSign className="h-3.5 w-3.5" />
              <input
                type="number"
                min={50}
                max={25000}
                step={25}
                value={budgetUsd}
                onChange={(e) => setBudgetUsd(Number(e.target.value) || 480)}
                className="w-14 bg-transparent font-semibold text-at-ink focus:outline-none"
              />
            </label>

            <button
              type="submit"
              className="flex-1 h-10 px-4 rounded-lg bg-at-cyan hover:opacity-95 text-[#0C0D10] text-xs font-semibold inline-flex items-center justify-center gap-2 cursor-pointer transition-transform active:scale-[0.99]"
            >
              <span>Compile &amp; Furnish Live</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </form>

        {/* 3. Interactive Pin-Linked SKU & Alternative Preview (Answers "Are items clickable?") */}
        {images.length === 0 && (
          <div className="rounded-xl p-3 bg-at-bg border border-at-border space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-at-muted">
                Selected Canvas Pin · Live Preview
              </span>
              <div className="flex items-center gap-1">
                {SHOWCASE_PINS_V1.map((p) => (
                  <button
                    key={p.pin}
                    type="button"
                    onClick={() => setSelectedPin(p.pin)}
                    className={`h-5 px-2 rounded text-[10px] font-mono cursor-pointer border ${
                      selectedPin === p.pin
                        ? "bg-at-cyan text-[#0C0D10] border-at-cyan font-bold"
                        : "bg-at-card text-at-muted border-at-border hover:text-at-ink"
                    }`}
                  >
                    #{p.pin} {p.category}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-at-card border border-at-border space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-semibold text-at-ink">
                  {activePinItem.pin === 2 && showcaseSwappedV2 && activePinItem.swapTitle
                    ? activePinItem.swapTitle
                    : activePinItem.title}
                </span>
                <span className="text-xs font-mono font-semibold text-at-ink shrink-0">
                  $
                  {(activePinItem.pin === 2 && showcaseSwappedV2 && activePinItem.swapPrice
                    ? activePinItem.swapPrice
                    : activePinItem.price
                  ).toFixed(2)}
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-1 text-[10px] font-mono">
                <span className="inline-flex items-center gap-1 text-at-muted">
                  <Store className="h-3 w-3" />
                  {activePinItem.pin === 2 && showcaseSwappedV2 && activePinItem.swapMerchant
                    ? activePinItem.swapMerchant
                    : activePinItem.merchant}{" "}
                  · {activePinItem.dims}
                </span>
                <span className="inline-flex items-center gap-1 text-at-emerald">
                  <ShieldCheck className="h-3 w-3" />
                  {activePinItem.fitBadge}
                </span>
              </div>

              {activePinItem.pin === 2 && (
                <button
                  type="button"
                  onClick={() => setShowcaseSwappedV2((v) => !v)}
                  className="w-full mt-1 py-1.5 px-2.5 rounded-md bg-at-cyan/12 border border-at-cyan/40 hover:border-at-cyan text-[11px] font-mono text-at-cyan inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <RefreshCw className="h-3 w-3" />
                  {showcaseSwappedV2
                    ? "Revert Surgical Swap back to v1 (Garvee Chair · $158.99)"
                    : "Preview Surgical Swap v1 → v2 (Sihoo Doro C300 · $269.99)"}
                </button>
              )}
              {activePinItem.pin === 1 && activePinItem.swapDelta && (
                <div className="mt-1 py-1 px-2 rounded bg-at-coral/12 border border-at-coral/40 text-[10px] font-mono text-at-coral">
                  Adversarial 72&quot; Executive Desk → {activePinItem.swapDelta}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 4. Three 100% Live Sample Room Launchers (Real Photos -> Real FastAPI SSE!) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-at-muted">
              1-Click Live Sample Rooms (Runs Real FastAPI + Shop MCP)
            </span>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {DEMO_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleRunPreset(preset)}
                className="group text-left rounded-xl p-2.5 bg-at-bg border border-at-border hover:border-at-cyan transition-all flex items-center gap-3 cursor-pointer"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preset.room_image_url}
                  alt={preset.title}
                  className="h-12 w-16 rounded-lg object-cover border border-at-border shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-at-ink group-hover:text-at-cyan transition-colors truncate">
                      {preset.title}
                    </p>
                    <span className="text-[10px] font-mono text-at-cyan shrink-0">
                      Run Live →
                    </span>
                  </div>
                  <p className="text-[11px] text-at-muted truncate mt-0.5">
                    {preset.subtitle}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
