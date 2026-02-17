"use client";

import { useState, useCallback } from "react";
import type { PatternType } from "@/types/trading";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Save, Check } from "lucide-react";
import { cn } from "@/lib/utils";

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
    <Card className="border-amber-500/30 bg-amber-950/10">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-amber-400">
            Manual Mark Mode
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            Cancel (Esc)
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2 text-xs">
          <div
            className={cn(
              "flex items-center gap-2",
              step === 1 ? "text-amber-400 font-semibold" : "text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full text-[10px]",
                step > 1 ? "bg-emerald-600 text-white" : "bg-amber-600 text-white",
              )}
            >
              {step > 1 ? <Check className="h-3 w-3" /> : "1"}
            </span>
            <span>Click pattern start candle</span>
            {startTimestamp && (
              <span className="font-mono text-muted-foreground">
                {startTimestamp.split("T")[0]}
              </span>
            )}
          </div>
          <div
            className={cn(
              "flex items-center gap-2",
              step === 2 ? "text-amber-400 font-semibold" : "text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full text-[10px]",
                step > 2
                  ? "bg-emerald-600 text-white"
                  : step === 2
                    ? "bg-amber-600 text-white"
                    : "bg-zinc-700 text-zinc-400",
              )}
            >
              {step > 2 ? <Check className="h-3 w-3" /> : "2"}
            </span>
            <span>Click pattern end candle</span>
            {endTimestamp && (
              <span className="font-mono text-muted-foreground">
                {endTimestamp.split("T")[0]}
              </span>
            )}
          </div>
          <div
            className={cn(
              "flex items-center gap-2",
              step === 3 ? "text-amber-400 font-semibold" : "text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full text-[10px]",
                step === 3 ? "bg-amber-600 text-white" : "bg-zinc-700 text-zinc-400",
              )}
            >
              3
            </span>
            <span>Fill details and save</span>
          </div>
        </div>

        {canSave && (
          <>
            <Separator className="bg-zinc-700" />

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Pattern Type
                </label>
                <Select value={patternType} onValueChange={(v) => setPatternType(v as PatternType)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PATTERN_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="mb-1 block text-[10px] font-medium text-muted-foreground">
                    Entry
                  </label>
                  <Input
                    type="number"
                    step="any"
                    value={entryPrice}
                    onChange={(e) => setEntryPrice(e.target.value)}
                    placeholder="1.10500"
                    className="h-8 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-medium text-red-400">
                    Stop Loss
                  </label>
                  <Input
                    type="number"
                    step="any"
                    value={stopLossPrice}
                    onChange={(e) => setStopLossPrice(e.target.value)}
                    placeholder="1.09800"
                    className="h-8 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-medium text-emerald-400">
                    Take Profit
                  </label>
                  <Input
                    type="number"
                    step="any"
                    value={takeProfitPrice}
                    onChange={(e) => setTakeProfitPrice(e.target.value)}
                    placeholder="1.11900"
                    className="h-8 font-mono text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 flex items-center justify-between text-xs font-medium text-muted-foreground">
                  <span>Quality Rating</span>
                  <span className="font-mono text-foreground">{quality}/10</span>
                </label>
                <Slider
                  value={[quality]}
                  onValueChange={([v]) => setQuality(v)}
                  min={1}
                  max={10}
                  step={1}
                  className="w-full"
                />
                <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground/60">
                  <span>Poor</span>
                  <span>Perfect</span>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Notes (optional)
                </label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Any observations..."
                  className="text-xs resize-none"
                />
              </div>

              <Button
                onClick={handleSave}
                disabled={saving}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white"
              >
                <Save className="mr-1.5 h-3.5 w-3.5" />
                {saving ? "Saving..." : "Save Manual Label"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
