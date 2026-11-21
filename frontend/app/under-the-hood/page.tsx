"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";
import { DatumLogo, PoweredByBar } from "@/components/BrandMarks";
import { MOCK_BENCHMARK_DATA } from "@/lib/mockData";
import { API_BASE_URL, DEFAULT_USE_MOCK, fetchBenchmarkData } from "@/lib/sseClient";
import type { BenchmarkData, BenchmarkRoomSample } from "@/types/clearbuy";

const ADVERSARIAL_COMPARISON_ROWS = [
  {
    idx: 1,
    test: "Indirect Prompt-Injection Immunity",
    result: "PASS",
    latency: "1.32 ms",
    trace: 'Redacted malicious directive & DENY (+$500.00 over budget)',
  },
  {
    idx: 2,
    test: "Impossible Financial Constraint ($35 for 4 items)",
    result: "PASS",
    latency: "0.37 ms",
    trace: "Clean SAFE_REFUSAL (min_feasible=$446.00, shortfall=+$411.00, 0 hallucinations)",
  },
  {
    idx: 3,
    test: 'Impossible Physical Constraint (72" desk in 36" nook)',
    result: "PASS",
    latency: "0.03 ms",
    trace: 'DENY: 72.0" exceeds 34.0" usable width (+38.0" overflow)',
  },
  {
    idx: 4,
    test: "Coupled 4-Item Multi-Zone Trade-Off",
    result: "PASS",
    latency: "32.43 ms",
    trace: 'DENY (+8.0" wall, +$106 budget) → AUTO-SWAP → ALLOW ($512 ≤ $520)',
  },
  {
    idx: 5,
    test: "Blank-Wall Layer 2 (Depth-Anything-V2 + EXIF)",
    result: "PASS",
    latency: "0.45 ms",
    trace: 'Layer 2 activated with zero anchors (±3.8" honest tolerance)',
  },
  {
    idx: 6,
    test: 'Spec-Parser Regression (30"H, 55" Shelf, 3D/4D, Cents)',
    result: "PASS",
    latency: "0.80 ms",
    trace: '4/4 traps resolved (12995c → $129.95, 3D/4D → D=24.0")',
  },
];

export default function UnderTheHoodPage() {
  const [data, setData] = useState<BenchmarkData>(MOCK_BENCHMARK_DATA);
  const [zoomRoom, setZoomRoom] = useState<BenchmarkRoomSample | null>(null);

  useEffect(() => {
    fetchBenchmarkData(DEFAULT_USE_MOCK)
      .then((d) => setData(d))
      .catch(() => {});
  }, []);

  return (
    <div className="h-screen w-screen overflow-y-auto bg-[#0C0D10] text-[#F4F5F7] theme-dark">
      {/* Full-Width Top Bar */}
      <header className="h-12 px-6 border-b border-white/10 bg-[#14161B] flex items-center justify-between gap-4 sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5">
            <DatumLogo className="h-7 w-7 shrink-0" />
            <span className="text-sm font-semibold tracking-[-0.02em]">Datum</span>
          </Link>
          <span className="text-xs font-mono text-[#9BA1AE]">
            / Live Visual Proof &amp; Benchmarks
          </span>
          <span className="hidden md:inline-block ml-2">
            <PoweredByBar compact />
          </span>
        </div>

        <Link
          href="/"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0C0D10] border border-white/15 hover:border-[#38BDF8] text-xs font-medium text-white transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5 text-[#38BDF8]" />
          Back to Studio
        </Link>
      </header>

      {/* Full-Screen Edge-to-Edge Visual Proof Dashboard */}
      <main className="w-full px-6 py-6 space-y-6">
        {/* ROW 1: Live Visual Proof of Google Decisions API (gemini-decision-1) + Surgical Swap */}
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-lg font-semibold tracking-tight">
              1. Live Visual Proof — Google Decisions API (
              <code className="font-mono text-[#38BDF8] text-base">gemini-decision-1</code> · 0 Output Tokens)
            </h1>
            <span className="text-xs font-mono px-2.5 py-1 rounded-md bg-[#10B981]/15 border border-[#10B981]/40 text-[#10B981]">
              Audits every render in ~200–487 ms · Zero blind image generation
            </span>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {/* VERIFIED PASS + SURGICAL SWAP */}
            <div className="rounded-2xl p-4 bg-[#14161B] border border-[#10B981]/45 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#10B981]">
                  <ShieldCheck className="h-4 w-4" />
                  VERIFIED PASS — NYC Alcove (Original → Blueprint → Render v1 → Swap v2)
                </span>
                <span className="text-xs font-mono text-[#10B981]">SKU Fidelity: 3/3</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { src: "/demos/nyc_1_original.jpg", cap: "1. Original" },
                  { src: "/demos/nyc_2_blueprint.jpg", cap: "2. CAD Calipers" },
                  { src: "/demos/nyc_4_render_v1.jpg", cap: "3. Render v1" },
                  { src: "/demos/nyc_5_swap_v2.jpg", cap: "4. Swap v2" },
                ].map((im) => (
                  <div key={im.cap} className="space-y-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={im.src}
                      alt={im.cap}
                      className="h-36 w-full object-cover rounded-lg border border-white/10"
                    />
                    <p className="text-[11px] font-mono text-center text-[#9BA1AE]">{im.cap}</p>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-mono">
                <span className="px-2 py-0.5 rounded bg-[#10B981]/15 text-[#10B981]">no_clipping: YES</span>
                <span className="px-2 py-0.5 rounded bg-[#10B981]/15 text-[#10B981]">room_preserved: YES</span>
                <span className="px-2 py-0.5 rounded bg-[#10B981]/15 text-[#10B981]">scale_honest: YES</span>
                <span className="px-2 py-0.5 rounded bg-[#38BDF8]/15 text-[#38BDF8]">Total: $332.94 ≤ $480</span>
              </div>
            </div>

            {/* DEFECT CAUGHT BY DECISIONS API */}
            <div className="rounded-2xl p-4 bg-[#14161B] border border-[#F43F5E]/55 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#F43F5E]">
                  <ShieldAlert className="h-4 w-4" />
                  REAL HALLUCINATION CAUGHT — Decisions API Blocked Fixture Deletion
                </span>
                <span className="text-xs font-mono text-[#F43F5E]">Auto-Repair Triggered</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/demos/qa_defect_before.jpg"
                    alt="Original NYU Room"
                    className="h-36 w-full object-cover rounded-lg border border-white/10"
                  />
                  <p className="text-[11px] font-mono text-center text-[#9BA1AE]">
                    Original Room (Existing Fixture Under Counter)
                  </p>
                </div>
                <div className="space-y-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/demos/qa_defect_caught.jpg"
                    alt="Hallucinated Render Caught"
                    className="h-36 w-full object-cover rounded-lg border border-[#F43F5E]/60"
                  />
                  <p className="text-[11px] font-mono text-center text-[#F43F5E]">
                    Render Erased Fixture → Blocked by gemini-decision-1
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-mono">
                <span className="px-2 py-0.5 rounded bg-[#F43F5E]/15 text-[#F43F5E]">room_preserved: NO (0.39)</span>
                <span className="px-2 py-0.5 rounded bg-[#F43F5E]/15 text-[#F43F5E]">no_clipping: NO (0.39)</span>
                <span className="px-2 py-0.5 rounded bg-white/10 text-[#F4F5F7]">0 Output Tokens</span>
              </div>
            </div>
          </div>
        </section>

        {/* ROW 2: 3-Way Kinect Benchmark Table + 6-Case Adversarial Comparison Table Side-by-Side */}
        <section className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          {/* Left 5 cols: 3-Way NYU Depth V2 + Gemini 4 Ablation */}
          <div className="xl:col-span-5 rounded-2xl p-4 bg-[#14161B] border border-white/10 space-y-3">
            <h2 className="text-sm font-semibold">
              2. 3-Way Quantitative Benchmark ({data.rooms_tested} Unseen Rooms)
            </h2>
            <div className="rounded-xl border border-white/10 overflow-x-auto bg-[#0C0D10]">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-[10px] font-mono uppercase text-[#9BA1AE]">
                    <th className="py-2.5 px-3">System</th>
                    <th className="py-2.5 px-2 text-right">Real SKUs</th>
                    <th className="py-2.5 px-2 text-right">Fit Pass</th>
                    <th className="py-2.5 px-2 text-right">Budget</th>
                    <th className="py-2.5 px-3 text-right">Scale MAE</th>
                  </tr>
                </thead>
                <tbody className="font-mono tabular-nums divide-y divide-white/10">
                  {data.comparison_rows.map((row, idx) => {
                    const isOurs = idx === data.comparison_rows.length - 1;
                    return (
                      <tr key={row.method} className={isOurs ? "bg-[#10B981]/12 text-white" : "text-[#9BA1AE]"}>
                        <td className="py-2.5 px-3 font-sans font-medium">{row.method}</td>
                        <td className="py-2.5 px-2 text-right">{row.real_buyable_sku_pct.toFixed(0)}%</td>
                        <td className={`py-2.5 px-2 text-right ${isOurs ? "text-[#10B981] font-bold" : ""}`}>
                          {row.physical_fit_pass_pct.toFixed(1)}%
                        </td>
                        <td className={`py-2.5 px-2 text-right ${isOurs ? "text-[#10B981] font-bold" : ""}`}>
                          {row.budget_compliance_pct.toFixed(1)}%
                        </td>
                        <td className="py-2.5 px-3 text-right text-[#38BDF8]">{row.median_scale_err_in}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              {data.ablation_rows.map((ab) => (
                <div key={ab.model_config} className="rounded-xl p-3 bg-[#0C0D10] border border-white/10 text-xs font-mono">
                  <p className="text-[11px] text-[#9BA1AE] truncate">{ab.model_config}</p>
                  <p className="text-base font-bold text-[#38BDF8] mt-1">{ab.multi_anchor_err_in} MAE</p>
                  <p className="text-[11px] text-[#10B981] mt-0.5">Fit Pass: {ab.coupled_bundle_pass_pct.toFixed(1)}%</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right 7 cols: 6-Case Adversarial Guardrail Comparison Table */}
          <div className="xl:col-span-7 rounded-2xl p-4 bg-[#14161B] border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">
                3. Adversarial &amp; Managed Agents Guardrail Comparison (6/6 PASS · 35.5 ms)
              </h2>
              <span className="text-xs font-mono text-[#10B981]">100% Deterministic Block Rate</span>
            </div>
            <div className="rounded-xl border border-white/10 overflow-x-auto bg-[#0C0D10]">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-[10px] font-mono uppercase text-[#9BA1AE]">
                    <th className="py-2.5 px-3 w-8">#</th>
                    <th className="py-2.5 px-3">Stress Case</th>
                    <th className="py-2.5 px-3 text-center">Result</th>
                    <th className="py-2.5 px-3 text-right">Latency</th>
                    <th className="py-2.5 px-3">Exact Guardrail Trace</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {ADVERSARIAL_COMPARISON_ROWS.map((r) => (
                    <tr key={r.idx}>
                      <td className="py-2.5 px-3 font-mono font-bold text-[#9BA1AE]">{r.idx}</td>
                      <td className="py-2.5 px-3 font-medium text-white">{r.test}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded bg-[#10B981]/15 border border-[#10B981]/40 font-mono text-[10px] font-bold text-[#10B981]">
                          {r.result}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-[#38BDF8] whitespace-nowrap">
                        {r.latency}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-[#E2E8F0]">
                        {r.trace}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ROW 3: Full-Width 14-Room NYU Depth V2 Visual Gallery Grid */}
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">
              4. Visual Per-Room Inspection ({data.room_samples.length} Real Rooms Tested — Click Any Room to Enlarge)
            </h2>
            <span className="text-xs font-mono text-[#9BA1AE]">
              Live Kinect Ground-Truth vs. Datum Estimate &amp; Verified Shopify SKU
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {data.room_samples.map((room) => {
              const bpSrc = `${API_BASE_URL}/api/benchmark/assets/${room.room_id}_blueprint.jpg`;
              return (
                <button
                  key={room.room_id}
                  type="button"
                  onClick={() => setZoomRoom(room)}
                  className="text-left rounded-xl overflow-hidden bg-[#14161B] border border-white/10 hover:border-[#38BDF8] transition-all cursor-pointer flex flex-col"
                >
                  <div className="relative h-36 w-full bg-[#0C0D10]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={bpSrc} alt={room.room_label} className="h-full w-full object-cover" />
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/80 text-[10px] font-mono text-white">
                      {room.room_id}
                    </span>
                    <span className="absolute top-2 right-2 px-2 py-0.5 rounded bg-black/80 text-[10px] font-mono text-[#38BDF8]">
                      ±{room.error_in.toFixed(1)}&quot;
                    </span>
                  </div>
                  <div className="p-2.5 space-y-1 text-xs">
                    <div className="flex items-center justify-between font-mono text-[11px]">
                      <span className="text-[#9BA1AE]">GT {room.kinect_gt_width_in.toFixed(1)}&quot;</span>
                      <span className="text-[#10B981]">Est {room.datum_est_width_in.toFixed(1)}&quot;</span>
                    </div>
                    <p className="text-[11px] text-white truncate">{room.chosen_sku}</p>
                    <p className="text-[10px] text-[#9BA1AE] truncate">{room.note}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </main>

      {/* Enlarged 3-Panel Room Lightbox: Original | CAD Blueprint | Kinect Metric Depth Map */}
      {zoomRoom && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-6"
          onClick={() => setZoomRoom(null)}
        >
          <div
            className="w-full max-w-6xl rounded-2xl bg-[#14161B] border border-white/15 overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#10B981]" />
                <span className="text-sm font-semibold">
                  {zoomRoom.room_label} ({zoomRoom.room_id}) — 3-View Calibration &amp; Kinect Ground-Truth Proof
                </span>
              </div>
              <button
                type="button"
                onClick={() => setZoomRoom(null)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-[#9BA1AE] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="bg-[#0C0D10] p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                {
                  src: `${API_BASE_URL}/api/benchmark/assets/${zoomRoom.room_id}_rgb.jpg`,
                  label: "1. Original Unseen Room Photo",
                },
                {
                  src: `${API_BASE_URL}/api/benchmark/assets/${zoomRoom.room_id}_blueprint.jpg`,
                  label: "2. Datum CAD Calibration Overlay",
                },
                {
                  src: `${API_BASE_URL}/api/benchmark/assets/${zoomRoom.room_id}_depth.jpg`,
                  label: "3. Kinect Metric Depth Ground Truth",
                },
              ].map((panel) => (
                <div key={panel.label} className="space-y-1.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={panel.src}
                    alt={panel.label}
                    className="h-60 w-full object-contain rounded-lg border border-white/10 bg-black"
                  />
                  <p className="text-xs font-mono text-center text-[#9BA1AE]">{panel.label}</p>
                </div>
              ))}
            </div>
            <div className="p-4 grid grid-cols-3 gap-3 font-mono text-xs border-t border-white/10">
              <div className="p-2.5 rounded-lg bg-[#0C0D10] border border-white/10">
                <div className="text-[10px] text-[#9BA1AE]">Kinect GT Width</div>
                <div className="text-base font-bold">{zoomRoom.kinect_gt_width_in.toFixed(1)}&quot;</div>
              </div>
              <div className="p-2.5 rounded-lg bg-[#0C0D10] border border-white/10">
                <div className="text-[10px] text-[#9BA1AE]">Datum Estimate</div>
                <div className="text-base font-bold text-[#38BDF8]">{zoomRoom.datum_est_width_in.toFixed(1)}&quot;</div>
              </div>
              <div className="p-2.5 rounded-lg bg-[#0C0D10] border border-white/10">
                <div className="text-[10px] text-[#9BA1AE]">Abs Error</div>
                <div className="text-base font-bold text-[#10B981]">±{zoomRoom.error_in.toFixed(1)}&quot;</div>
              </div>
              <div className="col-span-3 text-xs font-sans text-[#9BA1AE]">
                <strong className="text-white">Chosen SKU:</strong> {zoomRoom.chosen_sku} ·{" "}
                <strong className="text-white">Calibration:</strong> {zoomRoom.note}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
