"use client";

import { useState, useCallback } from "react";
import type { PatternType } from "@/types/trading";

type ManualMarkPanelProps = {
  startTimestamp: string | null;
  endTimestamp: string | null;
  startIndex: number | null;
  endIndex: number | null;
  onSave: (data: ManualMarkData) => void;
  onCancel: () => void;
  saving: boolean;
};

export type ManualMarkData = {
  patternType: PatternType;
  qualityRating: number;
  notes: string;
  startIndex: number;
  endIndex: number;
  startTimestamp: string;
  endTimestamp: string;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
};

const PATTERN_OPTIONS: { value: PatternType; label: string }[] = [
  { value: "pin_bar", label: "Pin Bar" },
  { value: "double_top", label: "Double Top" },
  { value: "double_bottom", label: "Double Bottom" },
  { value: "head_and_shoulders", label: "Head & Shoulders" },
  { value: "false_breakout", label: "False Breakout" },
];

export function ManualMarkPanel({
  startTimestamp,
  endTimestamp,
  startIndex,
  endIndex,
  onSave,
  onCancel,
  saving,
}: ManualMarkPanelProps) {
  const [patternType, setPatternType] = useState<PatternType>("pin_bar");
  const [quality, setQuality] = useState(5);
  const [notes, setNotes] = useState("");
  const [entryPrice, setEntryPrice] = useState("");
  const [stopLossPrice, setStopLossPrice] = useState("");
  const [takeProfitPrice, setTakeProfitPrice] = useState("");

  const parsedEntry = parseFloat(entryPrice);
  const parsedStop = parseFloat(stopLossPrice);
  const parsedTarget = parseFloat(takeProfitPrice);
  const pricesValid =
    !isNaN(parsedEntry) &&
    !isNaN(parsedStop) &&
    !isNaN(parsedTarget) &&
    parsedEntry > 0 &&
    parsedStop > 0 &&
    parsedTarget > 0;
  const canSave =
    startTimestamp !== null &&
    endTimestamp !== null &&
    startIndex !== null &&
    endIndex !== null &&
    pricesValid;

  const handleSave = useCallback(() => {
    if (!canSave) return;
    onSave({
      patternType,
      qualityRating: quality,
      notes,
      startIndex: startIndex!,
      endIndex: endIndex!,
      startTimestamp: startTimestamp!,
      endTimestamp: endTimestamp!,
      entryPrice: parsedEntry,
      stopLoss: parsedStop,
      takeProfit: parsedTarget,
    });
  }, [
    canSave,
    onSave,
    patternType,
    quality,
    notes,
    startIndex,
    endIndex,
    startTimestamp,
    endTimestamp,
    parsedEntry,
    parsedStop,
    parsedTarget,
  ]);

  const step = startTimestamp === null ? 1 : endTimestamp === null ? 2 : 3;

  return (
    <div className="space-y-4 rounded-lg border border-amber-500/30 bg-amber-950/20 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-amber-400">
          Manual Mark Mode
        </h3>
        <button
          onClick={onCancel}
          className="text-xs text-zinc-400 hover:text-zinc-200"
        >
          Cancel (Esc)
        </button>
      </div>

      <div className="space-y-2 text-xs">
        <div
          className={`flex items-center gap-2 ${step === 1 ? "text-amber-400 font-semibold" : "text-zinc-500"}`}
        >
          <span
            className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${step > 1 ? "bg-emerald-600 text-white" : "bg-amber-600 text-white"}`}
          >
            {step > 1 ? "✓" : "1"}
          </span>
          <span>Click pattern start candle</span>
          {startTimestamp && (
            <span className="font-mono text-zinc-400">
              {startTimestamp.split("T")[0]}
            </span>
          )}
        </div>
        <div
          className={`flex items-center gap-2 ${step === 2 ? "text-amber-400 font-semibold" : "text-zinc-500"}`}
        >
          <span
            className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${step > 2 ? "bg-emerald-600 text-white" : step === 2 ? "bg-amber-600 text-white" : "bg-zinc-700 text-zinc-400"}`}
          >
            {step > 2 ? "✓" : "2"}
          </span>
          <span>Click pattern end candle</span>
          {endTimestamp && (
            <span className="font-mono text-zinc-400">
              {endTimestamp.split("T")[0]}
            </span>
          )}
        </div>
        <div
          className={`flex items-center gap-2 ${step === 3 ? "text-amber-400 font-semibold" : "text-zinc-500"}`}
        >
          <span
            className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${step === 3 ? "bg-amber-600 text-white" : "bg-zinc-700 text-zinc-400"}`}
          >
            3
          </span>
          <span>Fill details and save</span>
        </div>
      </div>

      {canSave && (
        <div className="space-y-3 border-t border-zinc-700 pt-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-zinc-300">
              Pattern Type
            </label>
            <select
              value={patternType}
              onChange={(e) => setPatternType(e.target.value as PatternType)}
              className="w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1.5 text-xs text-zinc-100"
            >
              {PATTERN_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="mb-1 block text-[10px] font-semibold text-zinc-300">
                Entry
              </label>
              <input
                type="number"
                step="any"
                value={entryPrice}
                onChange={(e) => setEntryPrice(e.target.value)}
                className="w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1.5 text-xs font-mono text-zinc-100"
                placeholder="1.10500"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold text-red-400">
                Stop Loss
              </label>
              <input
                type="number"
                step="any"
                value={stopLossPrice}
                onChange={(e) => setStopLossPrice(e.target.value)}
                className="w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1.5 text-xs font-mono text-zinc-100"
                placeholder="1.09800"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold text-emerald-400">
                Take Profit
              </label>
              <input
                type="number"
                step="any"
                value={takeProfitPrice}
                onChange={(e) => setTakeProfitPrice(e.target.value)}
                className="w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1.5 text-xs font-mono text-zinc-100"
                placeholder="1.11900"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-zinc-300">
              Quality Rating: {quality}
            </label>
            <input
              type="range"
              min={1}
              max={10}
              value={quality}
              onChange={(e) => setQuality(parseInt(e.target.value, 10))}
              className="w-full"
            />
            <div className="mt-1 flex justify-between text-[10px] text-zinc-500">
              <span>1 (Poor)</span>
              <span>10 (Perfect)</span>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-zinc-300">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs"
              placeholder="Any observations..."
            />
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full rounded-md bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Manual Label"}
          </button>
        </div>
      )}
    </div>
  );
}
