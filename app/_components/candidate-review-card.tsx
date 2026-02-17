"use client";

import { useState, useEffect, useCallback } from "react";
import type { PatternCandidate, OutcomeResult } from "@/types/trading";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Check, X, Search } from "lucide-react";
import { cn } from "@/lib/utils";

type CandidateWithOutcome = PatternCandidate & {
  outcome: OutcomeResult;
  startTimestamp: string;
  endTimestamp: string;
};

export type ApprovalData = {
  qualityRating: number;
  notes: string;
};

type AnalysisData = {
  qualityRating: number;
  notes: string;
  approved: boolean;
};

type CandidateReviewCardProps = {
  candidate: CandidateWithOutcome | null;
  onApprove: (data: ApprovalData) => void;
  onReject: () => void;
  saving: boolean;
  analysis?: AnalysisData;
  playbackMode?: boolean;
};

const PATTERN_LABELS: Record<string, string> = {
  pin_bar: "Pin Bar",
  head_and_shoulders: "Head & Shoulders",
  double_top: "Double Top",
  double_bottom: "Double Bottom",
  false_breakout: "False Breakout",
};

export function CandidateReviewCard({
  candidate,
  onApprove,
  onReject,
  saving,
  analysis,
  playbackMode,
}: CandidateReviewCardProps) {
  const [manualQuality, setManualQuality] = useState(5);
  const [manualNotes, setManualNotes] = useState("");
  const [lastCandidateId, setLastCandidateId] = useState<string | undefined>();

  if (candidate?.id !== lastCandidateId) {
    setLastCandidateId(candidate?.id);
    setManualQuality(analysis?.qualityRating ?? 5);
    setManualNotes(analysis?.notes ?? "");
  }

  const quality =
    playbackMode && analysis ? analysis.qualityRating : manualQuality;
  const notes = playbackMode && analysis ? analysis.notes : manualNotes;

  const handleApprove = useCallback(() => {
    onApprove({ qualityRating: quality, notes });
  }, [onApprove, quality, notes]);

  useEffect(() => {
    if (playbackMode) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      if (e.key === "a" || e.key === "A") handleApprove();
      if (e.key === "r" || e.key === "R") onReject();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleApprove, onReject, playbackMode]);

  if (!candidate) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-10 text-center">
          <Search className="h-8 w-8 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">No candidate selected</p>
          <p className="mt-1 text-xs text-muted-foreground/60">
            Click &quot;Find Candidates&quot; to scan for patterns
          </p>
        </CardContent>
      </Card>
    );
  }

  const { keyPriceLevels, contextSnapshot, outcome } = candidate;
  const risk = Math.abs(keyPriceLevels.entry - keyPriceLevels.stopLoss);
  const reward = Math.abs(keyPriceLevels.takeProfit - keyPriceLevels.entry);
  const rr = risk > 0 ? (reward / risk).toFixed(1) : "N/A";

  return (
    <Card
      className={cn(
        playbackMode &&
          analysis &&
          (analysis.approved
            ? "border-emerald-500/40 bg-emerald-950/10"
            : "border-red-500/40 bg-red-950/10"),
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <Badge variant="secondary" className="font-mono text-xs">
            {PATTERN_LABELS[candidate.patternType] ?? candidate.patternType}
          </Badge>
          <div className="flex items-center gap-2">
            {playbackMode && analysis && (
              <Badge
                className={cn(
                  "text-[10px] font-bold animate-in fade-in slide-in-from-right-2 duration-300",
                  analysis.approved
                    ? "bg-emerald-600 text-white hover:bg-emerald-600"
                    : "bg-red-600 text-white hover:bg-red-600",
                )}
              >
                {analysis.approved ? "APPROVED" : "REJECTED"}
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">
              Confidence: {(candidate.confidence * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-1 text-xs">
          <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
            Price Levels
          </h4>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            <span className="text-muted-foreground">Entry</span>
            <span className="font-mono tabular-nums">
              {keyPriceLevels.entry.toFixed(5)}
            </span>
            <span className="text-muted-foreground">Stop Loss</span>
            <span className="font-mono tabular-nums text-red-400">
              {keyPriceLevels.stopLoss.toFixed(5)}
            </span>
            <span className="text-muted-foreground">Take Profit</span>
            <span className="font-mono tabular-nums text-emerald-400">
              {keyPriceLevels.takeProfit.toFixed(5)}
            </span>
            <span className="text-muted-foreground">R:R</span>
            <span className="font-mono tabular-nums">1:{rr}</span>
          </div>
        </div>

        <Separator />

        <div className="text-xs">
          <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
            Context
          </h4>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            <span className="text-muted-foreground">Trend</span>
            <span>{contextSnapshot.trendState ?? "N/A"}</span>
            <span className="text-muted-foreground">Support</span>
            <span className="font-mono tabular-nums">
              {contextSnapshot.nearestSupport?.toFixed(5) ?? "N/A"}
            </span>
            <span className="text-muted-foreground">Resistance</span>
            <span className="font-mono tabular-nums">
              {contextSnapshot.nearestResistance?.toFixed(5) ?? "N/A"}
            </span>
            <span className="text-muted-foreground">RSI</span>
            <span className="font-mono tabular-nums">
              {contextSnapshot.rsi?.toFixed(1) ?? "N/A"}
            </span>
            <span className="text-muted-foreground">ATR</span>
            <span className="font-mono tabular-nums">
              {contextSnapshot.atr?.toFixed(5) ?? "N/A"}
            </span>
          </div>
        </div>

        <Separator />

        <div className="text-xs">
          <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
            Outcome
          </h4>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            <span className="text-muted-foreground">Result</span>
            <Badge
              variant="outline"
              className={cn(
                "w-fit text-[10px] font-semibold",
                outcome.outcome === "win" &&
                  "border-emerald-500/50 text-emerald-400",
                outcome.outcome === "loss" && "border-red-500/50 text-red-400",
                outcome.outcome === "pending" &&
                  "border-amber-500/50 text-amber-400",
                outcome.outcome === "breakeven" &&
                  "border-zinc-500/50 text-zinc-400",
              )}
            >
              {outcome.outcome.toUpperCase()}
            </Badge>
            <span className="text-muted-foreground">R-Multiple</span>
            <span className="font-mono tabular-nums">
              {outcome.rMultiple?.toFixed(2) ?? "N/A"}
            </span>
            <span className="text-muted-foreground">Bars</span>
            <span>{outcome.barsToOutcome ?? "N/A"}</span>
          </div>
        </div>

        <Separator />

        <div>
          <label className="mb-2 flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>Quality Rating</span>
            <span
              className={cn(
                "font-mono text-foreground",
                playbackMode &&
                  analysis &&
                  (analysis.qualityRating >= 6
                    ? "text-emerald-400"
                    : "text-red-400"),
              )}
            >
              {quality}/10
            </span>
          </label>
          <Slider
            value={[quality]}
            onValueChange={
              playbackMode ? undefined : ([v]) => setManualQuality(v)
            }
            min={1}
            max={10}
            step={1}
            className="w-full"
            disabled={playbackMode}
          />
          <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground/60">
            <span>Poor</span>
            <span>Perfect</span>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            {playbackMode ? "Analysis Notes" : "Notes (optional)"}
          </label>
          {playbackMode ? (
            <div className="rounded-md border border-border bg-muted/30 p-2 text-xs leading-relaxed max-h-[200px] overflow-y-auto whitespace-pre-wrap animate-in fade-in duration-500">
              {notes || "No analysis notes"}
            </div>
          ) : (
            <Textarea
              value={notes}
              onChange={(e) => setManualNotes(e.target.value)}
              rows={2}
              placeholder="Any observations about this pattern..."
              className="text-xs resize-none"
            />
          )}
        </div>

        {!playbackMode && (
          <div className="flex gap-2">
            <Button
              onClick={handleApprove}
              disabled={saving}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Check className="mr-1.5 h-3.5 w-3.5" />
              {saving ? "Saving..." : "Approve (A)"}
            </Button>
            <Button
              variant="secondary"
              onClick={onReject}
              disabled={saving}
              className="flex-1"
            >
              <X className="mr-1.5 h-3.5 w-3.5" />
              Reject (R)
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
