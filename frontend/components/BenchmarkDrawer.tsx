"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  FlaskConical,
  Wrench,
  X,
} from "lucide-react";
import type { BenchmarkData } from "@/types/clearbuy";

interface BenchmarkDrawerProps {
  open: boolean;
  onClose: () => void;
  data: BenchmarkData;
}

export function BenchmarkDrawer({ open, onClose, data }: BenchmarkDrawerProps) {
  const [selectedRoomId, setSelectedRoomId] = useState<string>(
    data.room_samples[0]?.room_id ?? ""
  );

  if (!open) return null;

  const selectedRoom =
    data.room_samples.find((r) => r.room_id === selectedRoomId) ||
    data.room_samples[0];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/65 backdrop-blur-sm">
      <div className="w-full max-w-2xl h-full bg-[#14161B] border-l border-white/12 shadow-2xl flex flex-col overflow-hidden">
        {/* Drawer Header */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between shrink-0">
          <div className="space-y-0.5">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-[#10B981]">
              <FlaskConical className="h-3.5 w-3.5" />5 Sigma Proof Layer ·{" "}
              {data.rooms_tested} Rooms Tested
            </div>
            <h2 className="text-base font-semibold text-[#F4F5F7]">
              {data.dataset_label}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 text-[#9BA1AE] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* 1. 3-Way Evaluation Table */}
          <section className="space-y-2.5">
            <h3 className="text-xs font-mono uppercase tracking-wider text-[#9BA1AE]">
              1. 3-Way Quantitative Benchmark (Pixel-Exact Kinect Ground Truth)
            </h3>
            <div className="rounded-xl border border-white/10 overflow-hidden bg-[#0C0D10]">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-[10px] font-mono uppercase text-[#636A78]">
                    <th className="py-2.5 px-3">Pipeline</th>
                    <th className="py-2.5 px-2 text-right">Real SKUs</th>
                    <th className="py-2.5 px-2 text-right">Fit Pass</th>
                    <th className="py-2.5 px-2 text-right">Budget</th>
                    <th className="py-2.5 px-3 text-right">Scale Err</th>
                  </tr>
                </thead>
                <tbody className="font-mono tabular-nums-strict divide-y divide-white/6">
                  {data.comparison_rows.map((row, i) => {
                    const isOurs = i === data.comparison_rows.length - 1;
                    return (
                      <tr
                        key={row.method}
                        className={isOurs ? "bg-[#10B981]/10 text-[#F4F5F7]" : "text-[#9BA1AE]"}
                      >
                        <td className="py-2.5 px-3 font-sans font-medium">
                          {row.method}
                        </td>
                        <td className="py-2.5 px-2 text-right">
                          {row.real_buyable_sku_pct.toFixed(0)}%
                        </td>
                        <td
                          className={`py-2.5 px-2 text-right ${
                            isOurs ? "text-[#10B981] font-semibold" : ""
                          }`}
                        >
                          {row.physical_fit_pass_pct.toFixed(1)}%
                        </td>
                        <td
                          className={`py-2.5 px-2 text-right ${
                            isOurs ? "text-[#10B981] font-semibold" : ""
                          }`}
                        >
                          {row.budget_compliance_pct.toFixed(1)}%
                        </td>
                        <td className="py-2.5 px-3 text-right text-[#38BDF8]">
                          {row.median_scale_err_in}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* 2. Gemini 4 Thinking-Level Ablation + Decisions QA Catch Rate */}
          <section className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono uppercase tracking-wider text-[#9BA1AE]">
                2. Gemini 4 Thinking-Level Ablation (Neon low vs. xhigh)
              </h3>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#38BDF8]/15 text-[11px] font-mono tabular-nums-strict text-[#38BDF8]">
                <Award className="h-3 w-3" />
                Decisions QA Catch Rate: {data.qa_catch_rate_pct}%
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {data.ablation_rows.map((ab, idx) => (
                <div
                  key={ab.model_config}
                  className={`rounded-xl p-3 bg-[#0C0D10] border space-y-1.5 ${
                    idx === 1 ? "border-[#38BDF8]/50" : "border-white/10"
                  }`}
                >
                  <p className="text-xs font-mono text-[#F4F5F7]">{ab.model_config}</p>
                  <div className="flex items-center justify-between text-[11px] font-mono tabular-nums-strict text-[#9BA1AE]">
                    <span>Multi-Anchor Err</span>
                    <span className="text-[#38BDF8]">{ab.multi_anchor_err_in}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-mono tabular-nums-strict text-[#9BA1AE]">
                    <span>4–5 Item Bundle Pass</span>
                    <span className={idx === 1 ? "text-[#10B981]" : "text-[#F59E0B]"}>
                      {ab.coupled_bundle_pass_pct}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 3. Clickable Room Filmstrip (Kinect GT vs Datum Estimate) */}
          <section className="space-y-2.5">
            <h3 className="text-xs font-mono uppercase tracking-wider text-[#9BA1AE]">
              3. Per-Room Kinect Ground-Truth Inspection
            </h3>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {data.room_samples.map((room) => (
                <button
                  key={room.room_id}
                  type="button"
                  onClick={() => setSelectedRoomId(room.room_id)}
                  className={`px-3 py-2 rounded-xl border text-left shrink-0 transition-all cursor-pointer ${
                    selectedRoom?.room_id === room.room_id
                      ? "bg-[#38BDF8]/12 border-[#38BDF8] text-[#F4F5F7]"
                      : "bg-[#0C0D10] border-white/10 text-[#9BA1AE] hover:border-white/25"
                  }`}
                >
                  <p className="text-xs font-medium">{room.room_label}</p>
                  <p className="text-[10px] font-mono tabular-nums-strict text-[#38BDF8]">
                    {room.room_id} · err ±{room.error_in.toFixed(1)}&quot;
                  </p>
                </button>
              ))}
            </div>

            {selectedRoom && (
              <div className="rounded-xl p-3.5 bg-[#0C0D10] border border-white/10 space-y-2 font-mono text-xs tabular-nums-strict">
                <div className="flex items-center justify-between">
                  <span className="text-[#F4F5F7] font-sans font-semibold">
                    {selectedRoom.room_label} ({selectedRoom.room_id})
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#10B981]/15 text-[#10B981] text-[10px]">
                    <CheckCircle2 className="h-3 w-3" />
                    {selectedRoom.calibration_layer}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <div className="p-2 rounded-lg bg-[#14161B]">
                    <p className="text-[10px] text-[#636A78]">Kinect GT Width</p>
                    <p className="text-sm text-[#F4F5F7]">
                      {selectedRoom.kinect_gt_width_in.toFixed(1)}&quot;
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-[#14161B]">
                    <p className="text-[10px] text-[#636A78]">Datum Estimate</p>
                    <p className="text-sm text-[#38BDF8]">
                      {selectedRoom.datum_est_width_in.toFixed(1)}&quot;
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-[#14161B]">
                    <p className="text-[10px] text-[#636A78]">Abs Error</p>
                    <p className="text-sm text-[#10B981]">
                      ±{selectedRoom.error_in.toFixed(1)}&quot;
                    </p>
                  </div>
                </div>
                <p className="text-[11px] font-sans text-[#9BA1AE]">
                  Chosen: <span className="text-[#F4F5F7]">{selectedRoom.chosen_sku}</span>
                  {selectedRoom.blocked_sku && (
                    <>
                      {" "}
                      · Blocked:{" "}
                      <span className="text-[#F43F5E]">{selectedRoom.blocked_sku}</span>
                    </>
                  )}
                </p>
                <p className="text-[11px] font-sans text-[#636A78]">{selectedRoom.note}</p>
              </div>
            )}
          </section>

          {/* 4. Honest "Where It Still Breaks" Audit */}
          <section className="space-y-2.5">
            <h3 className="text-xs font-mono uppercase tracking-wider text-[#F59E0B] flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />
              4. Honest Failure Audit — Real Bugs Caught &amp; Fixed During Eval
            </h3>
            <div className="space-y-2">
              {data.failure_audits.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl p-3 bg-[#0C0D10] border border-white/10 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-[#F4F5F7]">{item.title}</p>
                    <span className="px-1.5 py-0.5 rounded bg-white/8 text-[10px] font-mono text-[#9BA1AE]">
                      {item.room_ref}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#F43F5E]/90">
                    Broke: {item.what_broke}
                  </p>
                  <p className="text-[11px] text-[#10B981] flex items-start gap-1.5">
                    <Wrench className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>Fixed: {item.how_we_fixed_it}</span>
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
