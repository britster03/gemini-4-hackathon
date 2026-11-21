"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  DollarSign,
  Eye,
  Mic,
  MicOff,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import type { DemoPreset, SpaceScope } from "@/types/clearbuy";
import {
  extractBudgetFromPrompt,
  preprocessRoomImage,
  type ProcessedRoomImage,
} from "@/lib/imageUtils";
import {
  DEMO_PRESETS,
  makeSunlitRoomSvg,
  ROOM_VIBES,
  type RoomVibe,
} from "@/lib/mockData";

interface CaptureCanvasProps {
  selectedVibe: RoomVibe;
  onChangeVibe: (vibe: RoomVibe) => void;
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

type PreviewMode = "original" | "measured" | "designed";

export function CaptureCanvas({
  selectedVibe,
  onChangeVibe,
  onLaunchSession,
}: CaptureCanvasProps) {
  const [images, setImages] = useState<ProcessedRoomImage[]>([]);
  const [prompt, setPrompt] = useState(
    "Compact standing desk, ergonomic chair & warm lamp"
  );
  const [budgetUsd, setBudgetUsd] = useState<number>(450);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("designed");
  const [isPeeking, setIsPeeking] = useState(false);
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
    const vibeRoom = makeSunlitRoomSvg({
      vibe: selectedVibe,
      rendered: false,
      multiZone: preset.scope === "full_room",
    });
    const vibeRendered = makeSunlitRoomSvg({
      vibe: selectedVibe,
      rendered: true,
      multiZone: preset.scope === "full_room",
    });
    const vibeRenderedV2 = makeSunlitRoomSvg({
      vibe: selectedVibe,
      rendered: true,
      warmChair: true,
      multiZone: preset.scope === "full_room",
    });
    onLaunchSession({
      images: [],
      prompt: preset.prompt,
      budgetUsd: preset.budget_usd,
      scope: preset.scope,
      preset: {
        ...preset,
        room_image_url: vibeRoom,
        rendered_image_url: vibeRendered,
        rendered_v2_image_url: vibeRenderedV2,
      },
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (images.length === 0) {
      handleRunPreset({
        ...DEMO_PRESETS[0],
        prompt: prompt.trim() || DEMO_PRESETS[0].prompt,
        budget_usd: budgetUsd,
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

  const effectiveMode: PreviewMode = isPeeking ? "original" : previewMode;
  const heroExampleImg = makeSunlitRoomSvg({
    vibe: selectedVibe,
    rendered: effectiveMode === "designed",
  });

  return (
    <div
      className="h-[calc(100vh-48px)] w-full bg-architectural-grid overflow-y-auto px-6 py-9"
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

      <div className="max-w-[1120px] mx-auto space-y-7">
        {/* Centered Editorial Headline */}
        <div className="text-center space-y-2.5 max-w-3xl mx-auto">
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-[-0.02em] text-at-ink leading-tight">
            See real furniture in your exact room.
          </h1>
          <p className="text-base text-at-muted leading-relaxed">
            Upload a photo and tell us what you want. Datum measures your space
            automatically, verifies what physically fits your wall and budget, and
            lets you buy directly from Shopify stores.
          </p>
        </div>

        {/* Centered Wide Room Showcase Card + Unified Single Horizontal Pill Bar */}
        <div
          className={`rounded-2xl overflow-hidden bg-at-card border shadow-xl transition-all ${
            isDragging
              ? "border-at-cyan ring-2 ring-at-cyan/30 scale-[1.005]"
              : "border-at-border"
          }`}
        >
          {/* Card Top Strip: Simple View Tabs + Style Chips */}
          <div className="px-5 py-3 border-b border-at-border flex flex-wrap items-center justify-between gap-2.5">
            {images.length === 0 ? (
              <div className="flex items-center gap-0.5 p-1 rounded-lg bg-at-surface border border-at-border text-sm">
                {(["original", "measured", "designed"] as PreviewMode[]).map(
                  (mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setPreviewMode(mode)}
                      className={`px-3 py-1 rounded-md font-medium capitalize transition-all cursor-pointer ${
                        previewMode === mode
                          ? "bg-at-card text-at-ink shadow-xs"
                          : "text-at-muted hover:text-at-ink"
                      }`}
                    >
                      {mode}
                    </button>
                  )
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm font-mono text-at-emerald">
                <span>
                  {images.length}/3 Room Photo{images.length > 1 ? "s" : ""} Ready
                  (1024px)
                </span>
                {images[0]?.exifFocalMm && (
                  <span className="text-at-cyan">
                    · EXIF {images[0].exifFocalMm}mm
                  </span>
                )}
              </div>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-at-muted">Style:</span>
              {ROOM_VIBES.map((vibe) => {
                const active = selectedVibe === vibe.id;
                return (
                  <button
                    key={vibe.id}
                    type="button"
                    onClick={() => onChangeVibe(vibe.id)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-all cursor-pointer ${
                      active
                        ? "bg-at-accent text-white border-at-accent"
                        : "bg-at-card text-at-ink border-at-border hover:border-at-accent/60"
                    }`}
                  >
                    {vibe.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Interactive Room Preview OR User's Uploaded Room Photo */}
          <div className="relative aspect-[16/9] w-full bg-at-surface overflow-hidden">
            {isProcessingImage && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/30 backdrop-blur-xs">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-at-card border border-at-border text-xs font-mono text-at-ink shadow-lg">
                  <Sparkles className="h-4 w-4 text-at-cyan animate-spin" />
                  Optimizing photo &amp; reading EXIF…
                </div>
              </div>
            )}

            {images.length === 0 ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={heroExampleImg}
                  alt="Interactive room example"
                  className="w-full h-full object-cover transition-all duration-300"
                />

                {/* Lightweight Measured CAD Preview Overlay on Example */}
                {effectiveMode === "measured" && (
                  <svg
                    viewBox="0 0 1000 660"
                    preserveAspectRatio="none"
                    className="absolute inset-0 w-full h-full pointer-events-none"
                  >
                    <rect
                      x="200"
                      y="376"
                      width="30"
                      height="42"
                      rx="4"
                      fill="rgba(2,132,199,0.16)"
                      stroke="#0284C7"
                      strokeWidth="2.5"
                      strokeDasharray="6 4"
                    />
                    <line
                      x1="230"
                      y1="397"
                      x2="262"
                      y2="397"
                      stroke="#0284C7"
                      strokeWidth="2"
                      strokeDasharray="5 4"
                    />
                    <rect
                      x="262"
                      y="302"
                      width="358"
                      height="234"
                      rx="6"
                      fill="rgba(2,132,199,0.08)"
                      stroke="#0284C7"
                      strokeWidth="2.5"
                    />
                    <line
                      x1="262"
                      y1="274"
                      x2="620"
                      y2="274"
                      stroke="#0284C7"
                      strokeWidth="2.5"
                    />
                    <line
                      x1="262"
                      y1="262"
                      x2="262"
                      y2="286"
                      stroke="#0284C7"
                      strokeWidth="2.5"
                    />
                    <line
                      x1="620"
                      y1="262"
                      x2="620"
                      y2="286"
                      stroke="#0284C7"
                      strokeWidth="2.5"
                    />
                    <rect
                      x="366"
                      y="256"
                      width="150"
                      height="34"
                      rx="8"
                      fill="#0D0E12"
                      fillOpacity="0.92"
                    />
                    <text
                      x="441"
                      y="278"
                      textAnchor="middle"
                      fill="#38BDF8"
                      fontSize="16"
                      fontFamily="monospace"
                      fontWeight="600"
                    >
                      Z1 · 43.5&quot; W
                    </text>
                  </svg>
                )}

                {/* Hold to Peek Original */}
                {previewMode !== "original" && (
                  <button
                    type="button"
                    onMouseDown={() => setIsPeeking(true)}
                    onMouseUp={() => setIsPeeking(false)}
                    onMouseLeave={() => setIsPeeking(false)}
                    onTouchStart={() => setIsPeeking(true)}
                    onTouchEnd={() => setIsPeeking(false)}
                    className="absolute bottom-4 right-4 px-3.5 py-2 rounded-full text-sm font-medium bg-at-card/90 backdrop-blur border border-at-border text-at-ink shadow-md inline-flex items-center gap-2 cursor-pointer select-none"
                  >
                    <Eye className="h-4 w-4 text-at-cyan" />
                    Hold to Peek Original
                  </button>
                )}

                <span className="absolute top-4 left-4 px-3 py-1.5 rounded-full bg-at-card/88 backdrop-blur border border-at-border text-xs text-at-muted">
                  Interactive Example · Drop your photo anywhere to replace
                </span>
              </>
            ) : (
              <div className="relative w-full h-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={images[0].previewUrl}
                  alt="Your uploaded room"
                  className="w-full h-full object-cover"
                />
                {/* Thumbnail Strip if 1-3 photos uploaded */}
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {images.map((img, idx) => (
                      <div
                        key={img.previewUrl}
                        className="relative h-14 w-20 rounded-lg overflow-hidden border-2 border-at-card shadow-lg"
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
                          className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-black/70 text-white cursor-pointer"
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
                        className="h-14 px-3 rounded-lg bg-at-card/90 backdrop-blur border border-at-border text-xs font-medium text-at-ink hover:border-at-accent cursor-pointer"
                      >
                        + Angle
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Unified Single Horizontal Pill Bar (Upload · Speak · Prompt · Budget · Design) */}
          <form
            onSubmit={handleSubmit}
            className="px-5 py-4 border-t border-at-border bg-at-card space-y-2.5"
          >
            <div className="flex items-center gap-2 rounded-full bg-at-surface border border-at-border p-2 pl-2.5 shadow-xs">
              {/* Upload Icon Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Upload room photo (or take photo)"
                className="h-11 px-4 rounded-full bg-at-card border border-at-border hover:border-at-accent text-sm font-medium text-at-ink inline-flex items-center gap-2 shrink-0 cursor-pointer transition-colors"
              >
                <Upload className="h-4 w-4 text-at-accent" />
                <span className="hidden sm:inline">Upload</span>
              </button>

              {/* Speak (Mic) Icon Button */}
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
                className={`h-11 w-11 rounded-full border inline-flex items-center justify-center shrink-0 cursor-pointer transition-all ${
                  isListening
                    ? "bg-at-cyan/15 border-at-cyan text-at-cyan"
                    : "bg-at-card border-at-border hover:border-at-cyan text-at-cyan"
                }`}
              >
                {micDenied ? (
                  <MicOff className="h-4 w-4 text-at-notice" />
                ) : isListening ? (
                  <span className="flex items-center gap-0.5 h-4">
                    {[0, 1, 2].map((bar) => (
                      <span
                        key={bar}
                        className="w-0.5 h-full bg-at-cyan rounded-full animate-datum-wave"
                        style={{ animationDelay: `${bar * 120}ms` }}
                      />
                    ))}
                  </span>
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </button>

              <div className="h-6 w-px bg-at-border mx-1 shrink-0" />

              {/* Inline Prompt Input */}
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe what you want (e.g., Standing desk, chair & warm lamp)"
                className="flex-1 bg-transparent text-sm sm:text-base text-at-ink placeholder:text-at-muted focus:outline-none min-w-0 px-1"
              />

              <div className="h-6 w-px bg-at-border mx-1 shrink-0" />

              {/* Budget Icon + Inline Number */}
              <label
                title="Maximum budget (USD)"
                className="h-11 px-3.5 rounded-full bg-at-card border border-at-border inline-flex items-center gap-1 text-sm font-mono tabular-nums-strict text-at-emerald shrink-0"
              >
                <DollarSign className="h-4 w-4" />
                <input
                  type="number"
                  min={50}
                  max={25000}
                  step={25}
                  value={budgetUsd}
                  onChange={(e) => setBudgetUsd(Number(e.target.value) || 450)}
                  className="w-14 bg-transparent font-semibold text-at-ink focus:outline-none"
                />
              </label>

              {/* Primary Design CTA */}
              <button
                type="submit"
                className="h-11 px-5 rounded-full bg-at-accent hover:opacity-95 text-white text-sm font-semibold inline-flex items-center gap-2 shrink-0 cursor-pointer transition-transform active:scale-95"
              >
                <span>Design</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-center text-at-muted">
              No tape measure needed — Datum measures automatically from your photo.
            </p>
          </form>
        </div>

        {/* 3 Sample Room Cards Below */}
        <div className="space-y-2.5 pb-6">
          <p className="text-sm font-medium text-center text-at-muted">
            Or try a sample room in one click
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {DEMO_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleRunPreset(preset)}
                className="group text-left rounded-xl p-4 bg-at-card border border-at-border hover:border-at-accent transition-all flex items-center gap-3.5 shadow-xs cursor-pointer"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={makeSunlitRoomSvg({
                    vibe: selectedVibe,
                    rendered: true,
                    multiZone: preset.scope === "full_room",
                  })}
                  alt={preset.title}
                  className="h-16 w-20 rounded-lg object-cover border border-at-border shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-at-ink group-hover:text-at-accent transition-colors truncate">
                    {preset.title}
                  </p>
                  <p className="text-xs text-at-muted truncate mt-0.5">
                    {preset.subtitle}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
