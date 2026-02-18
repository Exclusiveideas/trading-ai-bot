"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
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
  TrendState,
} from "@/types/trading";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Search,
  Crosshair,
  X,
  BarChart3,
  Loader2,
  Sparkles,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { toast } from "sonner";

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

type AnalysisData = {
  qualityRating: number;
  notes: string;
  approved: boolean;
};

type CandidateWithOutcome = PatternCandidate & {
  outcome: OutcomeResult;
  startTimestamp: string;
  endTimestamp: string;
  analysis?: AnalysisData;
};

const PAIRS = ["EUR/USD", "GBP/USD"];
const ALL_PATTERNS_VALUE = "__all__";
const PATTERN_TYPES: { value: string; label: string }[] = [
  { value: ALL_PATTERNS_VALUE, label: "All Patterns" },
  { value: "pin_bar", label: "Pin Bar" },
  { value: "double_top", label: "Double Top" },
  { value: "double_bottom", label: "Double Bottom" },
  { value: "head_and_shoulders", label: "Head & Shoulders" },
  { value: "false_breakout", label: "False Breakout" },
];
const DEFAULT_PLAYBACK_SPEED = 1500;
const CHART_WINDOW_SIZE = 50;
const CHART_LOAD_MORE_SIZE = 50;

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

  const [analyzing, setAnalyzing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(DEFAULT_PLAYBACK_SPEED);
  const [playbackMode, setPlaybackMode] = useState(false);
  const [approvedCount, setApprovedCount] = useState(0);
  const [rejectedCount, setRejectedCount] = useState(0);
  const [chartDisplayCount, setChartDisplayCount] = useState(CHART_WINDOW_SIZE);
  const playbackSavingRef = useRef(false);

  const loadCandles = useCallback(async (selectedPair: string) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/candles?pair=${encodeURIComponent(selectedPair)}`,
      );
      const data = await res.json();
      const loadedCandles: CandleData[] = data.candles;
      setCandles(loadedCandles);
      setChartDisplayCount(CHART_WINDOW_SIZE);
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

  const chartWindowStart = Math.max(0, candles.length - chartDisplayCount);

  const chartCandles = useMemo(
    () => candles.slice(chartWindowStart),
    [candles, chartWindowStart],
  );

  const handleLoadMore = useCallback(() => {
    setChartDisplayCount((prev) => prev + CHART_LOAD_MORE_SIZE);
  }, []);

  const findCandidates = useCallback(async () => {
    setLoading(true);
    setPlaybackMode(false);
    setIsPlaying(false);
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

  const runAnalysis = useCallback(async () => {
    setAnalyzing(true);
    setPlaybackMode(false);
    setIsPlaying(false);
    setApprovedCount(0);
    setRejectedCount(0);
    try {
      const url = patternFilter
        ? `/api/analyze?pair=${encodeURIComponent(pair)}&patternType=${patternFilter}`
        : `/api/analyze?pair=${encodeURIComponent(pair)}`;
      const res = await fetch(url);
      const data = await res.json();
      setCandidates(data.candidates);
      setCurrentIdx(0);
      setPlaybackMode(true);
      setIsPlaying(true);
      toast.success(
        `Analysis complete: ${data.approvedCount} approved, ${data.rejectedCount} rejected`,
      );
    } catch {
      toast.error("Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }, [pair, patternFilter]);

  const handlePairChange = useCallback(
    (newPair: string) => {
      setPair(newPair);
      setCandidates([]);
      setCurrentIdx(0);
      setCandlesLoaded(false);
      setChartDisplayCount(CHART_WINDOW_SIZE);
      setPlaybackMode(false);
      setIsPlaying(false);
      loadCandles(newPair);
    },
    [loadCandles],
  );

  const currentCandidate = candidates[currentIdx] ?? null;

  const saveLabel = useCallback(
    async (
      candidate: CandidateWithOutcome,
      data: { qualityRating: number; notes: string },
    ) => {
      await fetch("/api/labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pair: candidate.pair,
          patternType: candidate.patternType,
          startTimestamp: candidate.startTimestamp,
          endTimestamp: candidate.endTimestamp,
          entryPrice: candidate.keyPriceLevels.entry,
          stopLoss: candidate.keyPriceLevels.stopLoss,
          takeProfit: candidate.keyPriceLevels.takeProfit,
          outcome: candidate.outcome.outcome,
          rMultiple: candidate.outcome.rMultiple,
          barsToOutcome: candidate.outcome.barsToOutcome,
          qualityRating: data.qualityRating,
          trendState: candidate.contextSnapshot.trendState,
          session: "daily",
          supportQuality: null,
          notes: data.notes || null,
          contextJson: candidate.contextSnapshot,
        }),
      });
    },
    [],
  );

  const handleApprove = useCallback(
    async (data: { qualityRating: number; notes: string }) => {
      if (!currentCandidate) return;
      setSaving(true);
      try {
        await saveLabel(currentCandidate, data);
        setLabelCount((c) => c + 1);
        if (currentIdx < candidates.length - 1) {
          setCurrentIdx((i) => i + 1);
        }
      } finally {
        setSaving(false);
      }
    },
    [currentCandidate, currentIdx, candidates.length, saveLabel],
  );

  const handleReject = useCallback(() => {
    if (currentIdx < candidates.length - 1) {
      setCurrentIdx((i) => i + 1);
    }
  }, [currentIdx, candidates.length]);

  // Playback timer
  useEffect(() => {
    if (!isPlaying || !playbackMode || candidates.length === 0) return;

    const timer = setTimeout(async () => {
      const candidate = candidates[currentIdx];
      const analysis = candidate?.analysis;

      if (candidate && analysis && !playbackSavingRef.current) {
        if (analysis.approved) {
          playbackSavingRef.current = true;
          try {
            await saveLabel(candidate, {
              qualityRating: analysis.qualityRating,
              notes: analysis.notes,
            });
            setLabelCount((c) => c + 1);
            setApprovedCount((c) => c + 1);
          } finally {
            playbackSavingRef.current = false;
          }
        } else {
          setRejectedCount((c) => c + 1);
        }
      }

      if (currentIdx < candidates.length - 1) {
        setCurrentIdx((i) => i + 1);
      } else {
        setIsPlaying(false);
        toast.success("Playback complete — all candidates processed");
      }
    }, playbackSpeed);

    return () => clearTimeout(timer);
  }, [
    isPlaying,
    playbackMode,
    currentIdx,
    candidates,
    playbackSpeed,
    saveLabel,
  ]);

  const handleCandleClick = useCallback(
    (timestamp: string, index: number) => {
      if (!manualMode) return;
      const fullIndex = chartWindowStart + index;
      if (markStart === null) {
        setMarkStart({ timestamp, index: fullIndex });
      } else if (markEnd === null) {
        const start = markStart;
        if (fullIndex < start.index) {
          setMarkStart({ timestamp, index: fullIndex });
          setMarkEnd(start);
        } else {
          setMarkEnd({ timestamp, index: fullIndex });
        }
      }
    },
    [manualMode, markStart, markEnd, chartWindowStart],
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

  const exitPlayback = useCallback(() => {
    setPlaybackMode(false);
    setIsPlaying(false);
  }, []);

  const handlePatternFilterChange = (value: string) => {
    setPatternFilter(value === ALL_PATTERNS_VALUE ? "" : value);
  };

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border px-4 py-2">
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-semibold tracking-tight">Trading AI</h1>
          <Separator orientation="vertical" className="h-5" />
          <PairSelector
            pairs={PAIRS}
            selected={pair}
            onSelect={handlePairChange}
          />
          <Select
            value={patternFilter || ALL_PATTERNS_VALUE}
            onValueChange={handlePatternFilterChange}
          >
            <SelectTrigger className="w-[160px] h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PATTERN_TYPES.map((pt) => (
                <SelectItem key={pt.value} value={pt.value}>
                  {pt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Separator orientation="vertical" className="h-5" />
          {!candlesLoaded ? (
            <Button
              size="sm"
              onClick={() => loadCandles(pair)}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <BarChart3 className="mr-1.5 h-3.5 w-3.5" />
              )}
              {loading ? "Loading..." : "Load Chart"}
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                onClick={findCandidates}
                disabled={loading || manualMode || analyzing}
              >
                {loading ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Search className="mr-1.5 h-3.5 w-3.5" />
                )}
                {loading ? "Scanning..." : "Find Candidates"}
              </Button>
              <Button
                size="sm"
                variant="default"
                onClick={runAnalysis}
                disabled={loading || manualMode || analyzing}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {analyzing ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                )}
                {analyzing ? "Analyzing..." : "Analyze"}
              </Button>
              <Button
                variant={manualMode ? "destructive" : "outline"}
                size="sm"
                onClick={() => {
                  if (manualMode) {
                    cancelManualMode();
                  } else {
                    setManualMode(true);
                    setCandidates([]);
                    setCurrentIdx(0);
                    setPlaybackMode(false);
                    setIsPlaying(false);
                  }
                }}
                disabled={analyzing}
              >
                {manualMode ? (
                  <X className="mr-1.5 h-3.5 w-3.5" />
                ) : (
                  <Crosshair className="mr-1.5 h-3.5 w-3.5" />
                )}
                {manualMode ? "Exit Manual" : "Manual Mark"}
              </Button>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          {playbackMode && (
            <Button variant="ghost" size="sm" onClick={exitPlayback}>
              <X className="mr-1.5 h-3.5 w-3.5" />
              Exit Playback
            </Button>
          )}
          <span className="text-xs font-mono text-muted-foreground">
            Labels: {labelCount}
          </span>
          <ExportButton pair={pair} />
          <ThemeToggle />
        </div>
      </header>

      <main className="flex min-h-0 flex-1">
        <div className="flex-1 p-2">
          {candles.length > 0 ? (
            <ChartPanel
              candles={chartCandles}
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
              onLoadMore={handleLoadMore}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
              <BarChart3 className="h-12 w-12 opacity-20" />
              <div className="text-center">
                <p className="text-sm font-medium">No chart data loaded</p>
                <p className="mt-1 text-xs text-muted-foreground/70">
                  Select a pair and click &quot;Load Chart&quot; to begin
                </p>
              </div>
            </div>
          )}
        </div>

        <aside className="flex w-[340px] flex-col gap-3 overflow-y-auto border-l border-border bg-card/50 p-3">
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
                onPrev={() => {
                  setIsPlaying(false);
                  setCurrentIdx((i) => Math.max(0, i - 1));
                }}
                onNext={() => {
                  setIsPlaying(false);
                  setCurrentIdx((i) => Math.min(candidates.length - 1, i + 1));
                }}
                playback={
                  playbackMode
                    ? {
                        isPlaying,
                        onTogglePlay: () => setIsPlaying((p) => !p),
                        speed: playbackSpeed,
                        onSpeedChange: setPlaybackSpeed,
                        approvedCount,
                        rejectedCount,
                      }
                    : undefined
                }
              />
              <CandidateReviewCard
                candidate={currentCandidate}
                onApprove={handleApprove}
                onReject={handleReject}
                saving={saving}
                analysis={currentCandidate?.analysis}
                playbackMode={playbackMode}
              />
            </>
          )}
        </aside>
      </main>
    </div>
  );
}
