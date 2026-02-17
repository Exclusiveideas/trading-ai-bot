"use client";

import { useState, useEffect, useCallback } from "react";
import type { PatternCandidate, OutcomeResult } from "@/types/trading";

type CandidateWithOutcome = PatternCandidate & {
  outcome: OutcomeResult;
  startTimestamp: string;
  endTimestamp: string;
};

type ApprovalData = {
  qualityRating: number;
  notes: string;
};

type CandidateReviewCardProps = {
  candidate: CandidateWithOutcome | null;
  onApprove: (data: ApprovalData) => void;
  onReject: () => void;
  saving: boolean;
};

const PATTERN_LABELS: Record<string, string> = {
  pin_bar: "Pin Bar",
  head_and_shoulders: "Head & Shoulders",
  double_top: "Double Top",
  double_bottom: "Double Bottom",
  false_breakout: "False Breakout",
};

const OUTCOME_COLORS: Record<string, string> = {
  win: "text-emerald-600 dark:text-emerald-400",
  loss: "text-red-600 dark:text-red-400",
  pending: "text-amber-600 dark:text-amber-400",
  breakeven: "text-zinc-600 dark:text-zinc-400",
};

export function CandidateReviewCard({ candidate, onApprove, onReject, saving }: CandidateReviewCardProps) {
  const [quality, setQuality] = useState(5);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    setQuality(5);
    setNotes("");
  }, [candidate?.id]);

  const handleApprove = useCallback(() => {
    onApprove({ qualityRating: quality, notes });
  }, [onApprove, quality, notes]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "a" || e.key === "A") handleApprove();
      if (e.key === "r" || e.key === "R") onReject();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleApprove, onReject]);

  if (!candidate) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
        No candidate selected. Click &quot;Find Candidates&quot; to scan for patterns.
      </div>
    );
  }

  const { keyPriceLevels, contextSnapshot, outcome } = candidate;
  const risk = Math.abs(keyPriceLevels.entry - keyPriceLevels.stopLoss);
  const reward = Math.abs(keyPriceLevels.takeProfit - keyPriceLevels.entry);
  const rr = risk > 0 ? (reward / risk).toFixed(1) : "N/A";

  return (
    <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
          {PATTERN_LABELS[candidate.patternType] ?? candidate.patternType}
        </span>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          Confidence: {(candidate.confidence * 100).toFixed(0)}%
        </span>
      </div>

      <div className="space-y-1 text-xs">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <span className="text-zinc-500 dark:text-zinc-400">Entry</span>
          <span className="font-mono">{keyPriceLevels.entry.toFixed(5)}</span>
          <span className="text-zinc-500 dark:text-zinc-400">Stop Loss</span>
          <span className="font-mono">{keyPriceLevels.stopLoss.toFixed(5)}</span>
          <span className="text-zinc-500 dark:text-zinc-400">Take Profit</span>
          <span className="font-mono">{keyPriceLevels.takeProfit.toFixed(5)}</span>
          <span className="text-zinc-500 dark:text-zinc-400">R:R</span>
          <span className="font-mono">1:{rr}</span>
        </div>
      </div>

      <div className="border-t border-zinc-100 pt-3 dark:border-zinc-800">
        <h4 className="mb-1 text-xs font-semibold text-zinc-700 dark:text-zinc-300">Context</h4>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <span className="text-zinc-500 dark:text-zinc-400">Trend</span>
          <span>{contextSnapshot.trendState ?? "N/A"}</span>
          <span className="text-zinc-500 dark:text-zinc-400">Support</span>
          <span className="font-mono">{contextSnapshot.nearestSupport?.toFixed(5) ?? "N/A"}</span>
          <span className="text-zinc-500 dark:text-zinc-400">Resistance</span>
          <span className="font-mono">{contextSnapshot.nearestResistance?.toFixed(5) ?? "N/A"}</span>
          <span className="text-zinc-500 dark:text-zinc-400">RSI</span>
          <span className="font-mono">{contextSnapshot.rsi?.toFixed(1) ?? "N/A"}</span>
          <span className="text-zinc-500 dark:text-zinc-400">ATR</span>
          <span className="font-mono">{contextSnapshot.atr?.toFixed(5) ?? "N/A"}</span>
        </div>
      </div>

      <div className="border-t border-zinc-100 pt-3 dark:border-zinc-800">
        <h4 className="mb-1 text-xs font-semibold text-zinc-700 dark:text-zinc-300">Outcome Preview</h4>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <span className="text-zinc-500 dark:text-zinc-400">Result</span>
          <span className={`font-semibold ${OUTCOME_COLORS[outcome.outcome]}`}>
            {outcome.outcome.toUpperCase()}
          </span>
          <span className="text-zinc-500 dark:text-zinc-400">R-Multiple</span>
          <span className="font-mono">{outcome.rMultiple?.toFixed(2) ?? "N/A"}</span>
          <span className="text-zinc-500 dark:text-zinc-400">Bars</span>
          <span>{outcome.barsToOutcome ?? "N/A"}</span>
        </div>
      </div>

      <div className="border-t border-zinc-100 pt-3 dark:border-zinc-800">
        <label className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
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
        <div className="mt-1 flex justify-between text-[10px] text-zinc-400">
          <span>1 (Poor)</span>
          <span>10 (Perfect)</span>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
          Notes (optional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full rounded border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800"
          placeholder="Any observations about this pattern..."
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleApprove}
          disabled={saving}
          className="flex-1 rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Approve (A)"}
        </button>
        <button
          onClick={onReject}
          disabled={saving}
          className="flex-1 rounded-md bg-zinc-200 px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-300 disabled:opacity-50 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600"
        >
          Reject (R)
        </button>
      </div>
    </div>
  );
}
