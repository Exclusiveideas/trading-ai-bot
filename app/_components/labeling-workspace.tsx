"use client";

import { useState, useCallback } from "react";
import { PairSelector } from "./pair-selector";
import { ExportButton } from "./export-button";
import { ChartPanel } from "./chart-panel";
import { CandidateReviewCard } from "./candidate-review-card";
import { ReviewControls } from "./review-controls";
import { ManualMarkPanel } from "./manual-mark-panel";
import type { ManualMarkData } from "./manual-mark-panel";
import { calculateOutcome } from "@/lib/pipeline/outcome-calculator";
import type {
  PatternCandidate,
  OutcomeResult,
  PatternType,
  TrendState,
} from "@/types/trading";

type CandleData = {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  features: {
    sma20: number | null;
    sma50: number | null;
    ema200: number | null;
    rsi: number | null;
    atr: number | null;
    bbUpper: number | null;
    bbMiddle: number | null;
    bbLower: number | null;
  } | null;
  context: {
    trendState: string | null;
    nearestSupport: number | null;
    nearestResistance: number | null;
  } | null;
};

type CandidateWithOutcome = PatternCandidate & {
  outcome: OutcomeResult;
  startTimestamp: string;
  endTimestamp: string;
};

const PAIRS = ["EUR/USD", "GBP/USD"];
const PATTERN_TYPES: { value: string; label: string }[] = [
  { value: "", label: "All Patterns" },
  { value: "pin_bar", label: "Pin Bar" },
  { value: "double_top", label: "Double Top" },
  { value: "double_bottom", label: "Double Bottom" },
  { value: "head_and_shoulders", label: "Head & Shoulders" },
  { value: "false_breakout", label: "False Breakout" },
];

export function LabelingWorkspace() {
  const [pair, setPair] = useState(PAIRS[0]);
  const [patternFilter, setPatternFilter] = useState("");
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [candidates, setCandidates] = useState<CandidateWithOutcome[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [labelCount, setLabelCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [candlesLoaded, setCandlesLoaded] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [markStart, setMarkStart] = useState<{
    timestamp: string;
    index: number;
  } | null>(null);
  const [markEnd, setMarkEnd] = useState<{
    timestamp: string;
    index: number;
  } | null>(null);

  const loadCandles = useCallback(async (selectedPair: string) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/candles?pair=${encodeURIComponent(selectedPair)}`,
      );
      const data = await res.json();
      setCandles(data.candles);
      setCandlesLoaded(true);

      const labelsRes = await fetch(
        `/api/labels?pair=${encodeURIComponent(selectedPair)}`,
      );
      const labelsData = await labelsRes.json();
      setLabelCount(labelsData.labels.length);
    } finally {
      setLoading(false);
    }
  }, []);

  const findCandidates = useCallback(async () => {
    setLoading(true);
    try {
      const url = patternFilter
        ? `/api/candidates?pair=${encodeURIComponent(pair)}&patternType=${patternFilter}`
        : `/api/candidates?pair=${encodeURIComponent(pair)}`;
      const res = await fetch(url);
      const data = await res.json();
      setCandidates(data.candidates);
      setCurrentIdx(0);
    } finally {
      setLoading(false);
    }
  }, [pair, patternFilter]);

  const handlePairChange = useCallback(
    (newPair: string) => {
      setPair(newPair);
      setCandidates([]);
      setCurrentIdx(0);
      setCandlesLoaded(false);
      loadCandles(newPair);
    },
    [loadCandles],
  );

  const currentCandidate = candidates[currentIdx] ?? null;

  const handleApprove = useCallback(
    async (data: { qualityRating: number; notes: string }) => {
      if (!currentCandidate) return;
      setSaving(true);
      try {
        await fetch("/api/labels", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pair: currentCandidate.pair,
            patternType: currentCandidate.patternType,
            startTimestamp: currentCandidate.startTimestamp,
            endTimestamp: currentCandidate.endTimestamp,
            entryPrice: currentCandidate.keyPriceLevels.entry,
            stopLoss: currentCandidate.keyPriceLevels.stopLoss,
            takeProfit: currentCandidate.keyPriceLevels.takeProfit,
            outcome: currentCandidate.outcome.outcome,
            rMultiple: currentCandidate.outcome.rMultiple,
            barsToOutcome: currentCandidate.outcome.barsToOutcome,
            qualityRating: data.qualityRating,
            trendState: currentCandidate.contextSnapshot.trendState,
            session: "daily",
            supportQuality: null,
            notes: data.notes || null,
            contextJson: currentCandidate.contextSnapshot,
          }),
        });
        setLabelCount((c) => c + 1);
        if (currentIdx < candidates.length - 1) {
          setCurrentIdx((i) => i + 1);
        }
      } finally {
        setSaving(false);
      }
    },
    [currentCandidate, currentIdx, candidates.length],
  );

  const handleReject = useCallback(() => {
    if (currentIdx < candidates.length - 1) {
      setCurrentIdx((i) => i + 1);
    }
  }, [currentIdx, candidates.length]);

  const handleCandleClick = useCallback(
    (timestamp: string, index: number) => {
      if (!manualMode) return;
      if (markStart === null) {
        setMarkStart({ timestamp, index });
      } else if (markEnd === null) {
        const start = markStart;
        if (index < start.index) {
          setMarkStart({ timestamp, index });
          setMarkEnd(start);
        } else {
          setMarkEnd({ timestamp, index });
        }
      }
    },
    [manualMode, markStart, markEnd],
  );

  const handleManualSave = useCallback(
    async (data: ManualMarkData) => {
      setSaving(true);
      try {
        const outcomeCandles = candles.map((c) => ({
          high: c.high,
          low: c.low,
          close: c.close,
        }));
        const outcome = calculateOutcome(outcomeCandles, {
          entryPrice: data.entryPrice,
          stopLoss: data.stopLoss,
          takeProfit: data.takeProfit,
          entryIndex: data.endIndex,
        });

        const endCandle = candles[data.endIndex];
        const ctx = endCandle?.context;
        const features = endCandle?.features;
        const contextSnapshot = {
          trendState: ctx?.trendState ?? null,
          nearestSupport: ctx?.nearestSupport ?? null,
          nearestResistance: ctx?.nearestResistance ?? null,
          atr: features?.atr ?? null,
          rsi: features?.rsi ?? null,
        };

        await fetch("/api/labels", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pair,
            patternType: data.patternType,
            startTimestamp: data.startTimestamp,
            endTimestamp: data.endTimestamp,
            entryPrice: data.entryPrice,
            stopLoss: data.stopLoss,
            takeProfit: data.takeProfit,
            outcome: outcome.outcome,
            rMultiple: outcome.rMultiple,
            barsToOutcome: outcome.barsToOutcome,
            qualityRating: data.qualityRating,
            trendState: (contextSnapshot.trendState as TrendState) ?? null,
            session: "daily",
            supportQuality: null,
            notes: data.notes || null,
            contextJson: contextSnapshot,
          }),
        });
        setLabelCount((c) => c + 1);
        setManualMode(false);
        setMarkStart(null);
        setMarkEnd(null);
      } finally {
        setSaving(false);
      }
    },
    [pair, candles],
  );

  const cancelManualMode = useCallback(() => {
    setManualMode(false);
    setMarkStart(null);
    setMarkEnd(null);
  }, []);

  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-zinc-100">
      <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">Trading AI — Labeling</h1>
          <PairSelector
            pairs={PAIRS}
            selected={pair}
            onSelect={handlePairChange}
          />
          <select
            value={patternFilter}
            onChange={(e) => setPatternFilter(e.target.value)}
            className="rounded-md border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100"
          >
            {PATTERN_TYPES.map((pt) => (
              <option key={pt.value} value={pt.value}>
                {pt.label}
              </option>
            ))}
          </select>
          {!candlesLoaded ? (
            <button
              onClick={() => loadCandles(pair)}
              disabled={loading}
              className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Loading..." : "Load Chart"}
            </button>
          ) : (
            <>
              <button
                onClick={findCandidates}
                disabled={loading || manualMode}
                className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? "Scanning..." : "Find Candidates"}
              </button>
              <button
                onClick={() => {
                  if (manualMode) {
                    cancelManualMode();
                  } else {
                    setManualMode(true);
                    setCandidates([]);
                    setCurrentIdx(0);
                  }
                }}
                className={`rounded-md px-4 py-1.5 text-sm font-medium ${
                  manualMode
                    ? "bg-amber-600 text-white hover:bg-amber-700"
                    : "border border-zinc-600 text-zinc-300 hover:bg-zinc-800"
                }`}
              >
                {manualMode ? "Exit Manual" : "Manual Mark"}
              </button>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-400">Labels: {labelCount}</span>
          <ExportButton pair={pair} />
        </div>
      </header>

      <main className="flex min-h-0 flex-1">
        <div className="flex-1 border-r border-zinc-800 p-2">
          {candles.length > 0 ? (
            <ChartPanel
              candles={candles}
              focusTimestamp={
                manualMode ? undefined : currentCandidate?.endTimestamp
              }
              entryPrice={
                manualMode ? undefined : currentCandidate?.keyPriceLevels.entry
              }
              stopLoss={
                manualMode
                  ? undefined
                  : currentCandidate?.keyPriceLevels.stopLoss
              }
              takeProfit={
                manualMode
                  ? undefined
                  : currentCandidate?.keyPriceLevels.takeProfit
              }
              onCandleClick={manualMode ? handleCandleClick : undefined}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-zinc-500">
              {loading
                ? "Loading chart data..."
                : 'Click "Load Chart" to view candles'}
            </div>
          )}
        </div>

        <aside className="flex w-80 flex-col gap-3 overflow-y-auto p-3">
          {manualMode ? (
            <ManualMarkPanel
              startTimestamp={markStart?.timestamp ?? null}
              endTimestamp={markEnd?.timestamp ?? null}
              startIndex={markStart?.index ?? null}
              endIndex={markEnd?.index ?? null}
              onSave={handleManualSave}
              onCancel={cancelManualMode}
              saving={saving}
            />
          ) : (
            <>
              <ReviewControls
                current={currentIdx}
                total={candidates.length}
                onPrev={() => setCurrentIdx((i) => Math.max(0, i - 1))}
                onNext={() =>
                  setCurrentIdx((i) => Math.min(candidates.length - 1, i + 1))
                }
              />
              <CandidateReviewCard
                candidate={currentCandidate}
                onApprove={handleApprove}
                onReject={handleReject}
                saving={saving}
              />
            </>
          )}
        </aside>
      </main>
    </div>
  );
}
