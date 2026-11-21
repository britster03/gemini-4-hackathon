"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Cpu,
  DollarSign,
  GripVertical,
  Mic,
  MicOff,
  RefreshCw,
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

interface ShowcasePinItem {
  pin: number;
  category: string;
  title: string;
  merchant: string;
  price: number;
  dims: string;
  fitLabel: string;
  xPct: number;
  yPct: number;
  swapTitle?: string;
  swapMerchant?: string;
  swapPrice?: number;
}

const SHOWCASE_PINS: ShowcasePinItem[] = [
  {
    pin: 1,
    category: "Desk",
    title: "Home Standard 47-Inch White Desk w/ Riser",
    merchant: "Home Standard",
    price: 119.95,
    dims: '47.2" W × 23.6" D',
    fitLabel: 'Fits 53.6" wall',
    xPct: 39,
    yPct: 60,
  },
  {
    pin: 2,
    category: "Chair",
    title: "Garvee Ergonomic Mesh Chair",
    merchant: "Garvee Home",
    price: 158.99,
    dims: '26.0" W × 25.0" D',
    fitLabel: '24" legroom clear',
    xPct: 57,
    yPct: 56,
    swapTitle: "Sihoo Doro C300 Ergonomic Chair",
    swapMerchant: "Official US Sihoo Store",
    swapPrice: 269.99,
  },
  {
    pin: 3,
    category: "Lamp",
    title: "Kylie Pleated Ceramic Table Lamp",
    merchant: "Ornate Furniture",
    price: 54.0,
    dims: '6.8" W × 9.0" H',
    fitLabel: "Fits desk riser",
    xPct: 41.5,
    yPct: 43,
  },
];

export function CaptureCanvas({ onLaunchSession }: CaptureCanvasProps) {
  const [images, setImages] = useState<ProcessedRoomImage[]>([]);
  const [prompt, setPrompt] = useState(
    "Set up a compact home office desk, ergonomic chair, and warm table lamp under $480"
  );
  const [budgetUsd, setBudgetUsd] = useState<number>(480);
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
        scope: "auto",
      });
      return;
    }
    onLaunchSession({
      images,
      prompt: prompt.trim() || DEMO_PRESETS[0].prompt,
      budgetUsd,
      scope: "auto",
    });
  };

  const renderedHeroUrl = showcaseSwappedV2
    ? "/demos/nyc_5_swap_v2.jpg"
    : "/demos/nyc_4_render_v1.jpg";
  const activePinItem =
    SHOWCASE_PINS.find((p) => p.pin === selectedPin) || SHOWCASE_PINS[1];

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

      {/* LEFT 64% — Full-Width Interactive Room Preview (Zero Cropping, Clickable Pins) */}
      <section className="relative w-full lg:w-[64%] h-[48%] lg:h-full flex flex-col border-b lg:border-b-0 lg:border-r border-at-border bg-[#0C0D10] min-h-0">
        <div className="px-4 py-2.5 border-b border-white/10 bg-[#14161B]/95 backdrop-blur flex flex-wrap items-center justify-between gap-2 shrink-0 z-20">
          <span className="inline-flex items-center gap-1.5 text-xs text-[#10B981] font-medium">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {images.length > 0
              ? `${images.length} Room Photo${images.length > 1 ? "s" : ""} Ready`
              : "Auto-Measured Room · 55.6\" Wall Gap · Zero Tape Measure"}
          </span>

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
                <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-[#0C0D10] border border-white/12 text-xs">
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
                    v2 Chair Swap
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

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
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#14161B] border border-[#38BDF8]/50 text-xs text-white shadow-xl">
                <Sparkles className="h-4 w-4 text-[#38BDF8] animate-spin" />
                Preparing your room photo…
              </div>
            </div>
          )}

          {images.length === 0 ? (
            <>
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

              <div className="relative h-full w-full flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={
                    showcaseMode === "blueprint"
                      ? "/demos/nyc_2_blueprint.jpg"
                      : "/demos/nyc_1_original.jpg"
                  }
                  alt="Room example"
                  className="max-h-full max-w-full w-full h-full object-contain"
                />

                {showcaseMode === "rendered" && (
                  <>
                    <div
                      className="absolute inset-0 flex items-center justify-center overflow-hidden"
                      style={{ clipPath: `inset(0 ${100 - wipePct}% 0 0)` }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={renderedHeroUrl}
                        alt="Rendered room"
                        className="max-h-full max-w-full w-full h-full object-contain"
                      />
                    </div>

                    <div
                      className="absolute top-0 bottom-0 z-20 w-0.5 bg-[#38BDF8] cursor-ew-resize"
                      style={{ left: `${wipePct}%` }}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setIsWiping(true);
                      }}
                      title="Drag to compare before & after"
                    >
                      <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 h-9 w-6 rounded-full bg-[#0C0D10]/90 border border-[#38BDF8] flex items-center justify-center text-[#38BDF8] shadow-lg">
                        <GripVertical className="h-3.5 w-3.5" />
                      </div>
                    </div>

                    {SHOWCASE_PINS.map((p) => {
                      const active = selectedPin === p.pin;
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
                          title={`Click to inspect ${p.category}`}
                        >
                          {p.pin}
                        </button>
                      );
                    })}
                  </>
                )}
              </div>

              {/* Clean Floating Selected-Item Pill on Canvas */}
              {showcaseMode === "rendered" && (
                <div className="absolute bottom-3 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-2 bg-[#14161B]/92 backdrop-blur border border-white/12 rounded-xl px-3.5 py-2 text-xs text-white">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="h-6 w-6 rounded-full bg-[#38BDF8] text-[#0C0D10] font-mono font-bold flex items-center justify-center shrink-0">
                      {activePinItem.pin}
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium truncate">
                        {activePinItem.pin === 2 && showcaseSwappedV2 && activePinItem.swapTitle
                          ? activePinItem.swapTitle
                          : activePinItem.title}
                      </p>
                      <p className="text-[11px] text-[#9BA1AE] truncate">
                        <Store className="inline h-3 w-3 mr-1" />
                        {activePinItem.pin === 2 && showcaseSwappedV2 && activePinItem.swapMerchant
                          ? activePinItem.swapMerchant
                          : activePinItem.merchant}{" "}
                        · {activePinItem.dims} ·{" "}
                        <span className="text-[#10B981]">{activePinItem.fitLabel}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono font-semibold text-sm">
                      $
                      {(activePinItem.pin === 2 && showcaseSwappedV2 && activePinItem.swapPrice
                        ? activePinItem.swapPrice
                        : activePinItem.price
                      ).toFixed(2)}
                    </span>
                    {activePinItem.pin === 2 && (
                      <button
                        type="button"
                        onClick={() => setShowcaseSwappedV2((v) => !v)}
                        className="px-2.5 py-1 rounded-lg bg-[#38BDF8]/15 border border-[#38BDF8]/45 text-[#38BDF8] hover:bg-[#38BDF8]/25 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className="h-3 w-3" />
                        {showcaseSwappedV2 ? "Back to Option 1" : "Try Chair Swap"}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
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
              <div className="absolute bottom-4 left-4 right-4 z-20 flex items-center gap-2">
                {images.map((img, idx) => (
                  <div
                    key={img.previewUrl}
                    className="relative h-14 w-20 rounded-lg overflow-hidden border-2 border-[#38BDF8] shadow-lg bg-[#0C0D10]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.previewUrl}
                      alt={`Photo ${idx + 1}`}
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
                    className="h-14 px-3.5 rounded-lg bg-[#14161B]/90 backdrop-blur border border-white/20 text-xs text-white hover:border-[#38BDF8] cursor-pointer"
                  >
                    + Add Angle ({images.length}/3)
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* RIGHT 36% — Effortless Consumer Controls (Zero Technical Jargon) */}
      <aside className="w-full lg:w-[36%] h-[52%] lg:h-full bg-at-card flex flex-col justify-between overflow-y-auto p-6 space-y-5">
        <div className="space-y-5">
          <div className="space-y-2">
            <h1 className="text-2xl xl:text-3xl font-semibold tracking-[-0.02em] text-at-ink leading-tight">
              See real furniture in your exact room.
            </h1>
            <p className="text-sm text-at-muted leading-relaxed">
              Snap or drop a photo of your space, say what you want, and set your
              budget. We measure automatically so every item is guaranteed to fit.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="rounded-2xl p-4 bg-at-bg border border-at-border space-y-3.5"
          >
            {/* Step 1: Photo Upload */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-3.5 px-4 rounded-xl border border-dashed border-at-cyan/50 bg-at-card hover:border-at-cyan flex items-center justify-between gap-2 text-sm cursor-pointer transition-all"
            >
              <span className="inline-flex items-center gap-2.5 font-medium text-at-ink">
                <Upload className="h-4 w-4 text-at-cyan shrink-0" />
                {images.length > 0
                  ? `${images.length} Photo${images.length > 1 ? "s" : ""} Selected — Add Another`
                  : "Upload or Drop Room Photo"}
              </span>
              <span className="text-xs text-at-muted shrink-0">1–3 angles</span>
            </button>

            {/* Step 2: Natural Request + Mic */}
            <div className="relative">
              <textarea
                rows={3}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="What would you like here? (e.g., Standing desk, comfy chair & warm lamp)"
                className="w-full rounded-xl bg-at-card border border-at-border focus:border-at-cyan p-3 pr-12 text-sm text-at-ink placeholder:text-at-muted focus:outline-none resize-none leading-relaxed"
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
                    : "Hold to speak"
                }
                className={`absolute right-2.5 top-2.5 h-9 w-9 rounded-lg border inline-flex items-center justify-center cursor-pointer transition-all ${
                  isListening
                    ? "bg-at-cyan/20 border-at-cyan text-at-cyan"
                    : "bg-at-bg border-at-border hover:border-at-cyan text-at-cyan"
                }`}
              >
                {micDenied ? (
                  <MicOff className="h-4 w-4 text-at-notice" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </button>
            </div>

            {/* Step 3: Budget + Primary Button */}
            <div className="flex items-center gap-2.5">
              <label className="h-11 px-3.5 rounded-xl bg-at-card border border-at-border inline-flex items-center gap-1 text-sm font-mono tabular-nums-strict text-at-emerald shrink-0">
                <span className="text-xs font-sans text-at-muted mr-1">Budget</span>
                <DollarSign className="h-4 w-4" />
                <input
                  type="number"
                  min={50}
                  max={25000}
                  step={25}
                  value={budgetUsd}
                  onChange={(e) => setBudgetUsd(Number(e.target.value) || 480)}
                  className="w-16 bg-transparent font-semibold text-at-ink focus:outline-none"
                />
              </label>

              <button
                type="submit"
                className="flex-1 h-11 px-4 rounded-xl bg-at-cyan hover:opacity-95 text-[#0C0D10] text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer transition-transform active:scale-[0.99]"
              >
                <span>Design My Room</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </form>

          {/* 3 Real Sample Rooms */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-at-muted">
              No photo handy? Try a real room right now:
            </p>
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
                      <span className="text-xs text-at-cyan font-medium shrink-0">
                        Try room →
                      </span>
                    </div>
                    <p className="text-xs text-at-muted truncate mt-0.5">
                      {preset.subtitle}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Subtle Footer: Single Clean Link to Live Proof & Benchmarks */}
        <div className="pt-3 border-t border-at-border flex items-center justify-between gap-2 text-xs text-at-muted">
          <span>Verified in-stock merchants · Shop Pay checkout</span>
          <Link
            href="/under-the-hood"
            className="inline-flex items-center gap-1 text-at-cyan hover:underline font-medium shrink-0"
          >
            <Cpu className="h-3.5 w-3.5" />
            Live Proof &amp; Benchmarks ↗
          </Link>
        </div>
      </aside>
    </div>
  );
}
