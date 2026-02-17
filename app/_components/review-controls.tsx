"use client";

import { useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Play, Pause, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

type PlaybackProps = {
  isPlaying: boolean;
  onTogglePlay: () => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
  approvedCount: number;
  rejectedCount: number;
};

type ReviewControlsProps = {
  current: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  playback?: PlaybackProps;
};

const SPEED_OPTIONS = [
  { value: 3000, label: "0.5x" },
  { value: 1500, label: "1x" },
  { value: 750, label: "2x" },
  { value: 400, label: "3x" },
];

export function ReviewControls({
  current,
  total,
  onPrev,
  onNext,
  playback,
}: ReviewControlsProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      if (playback) {
        if (e.key === " ") {
          e.preventDefault();
          playback.onTogglePlay();
        }
      }

      if (e.key === "ArrowLeft") onPrev();
      if (e.key === "ArrowRight") onNext();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onPrev, onNext, playback]);

  if (!playback) {
    return (
      <Card>
        <CardContent className="flex items-center justify-between px-3 py-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onPrev}
            disabled={current <= 0}
            className="h-7 w-7"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-mono text-muted-foreground">
            {total === 0 ? "No candidates" : `${current + 1} / ${total}`}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={onNext}
            disabled={current >= total - 1}
            className="h-7 w-7"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-blue-500/30 bg-blue-950/10">
      <CardContent className="space-y-3 px-3 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={playback.onTogglePlay}
              className="h-7 w-7"
            >
              {playback.isPlaying ? (
                <Pause className="h-3.5 w-3.5" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onPrev}
              disabled={current <= 0}
              className="h-7 w-7"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onNext}
              disabled={current >= total - 1}
              className="h-7 w-7"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <span className="text-sm font-mono text-muted-foreground">
            {current + 1} / {total}
          </span>
        </div>

        <div className="w-full rounded-full bg-muted h-1.5">
          <div
            className="h-1.5 rounded-full bg-blue-500 transition-all duration-300"
            style={{
              width: `${total > 0 ? ((current + 1) / total) * 100 : 0}%`,
            }}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Check className="h-3 w-3 text-emerald-400" />
              <span className="text-xs font-mono text-emerald-400">
                {playback.approvedCount}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <X className="h-3 w-3 text-red-400" />
              <span className="text-xs font-mono text-red-400">
                {playback.rejectedCount}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {SPEED_OPTIONS.map((opt) => (
              <Badge
                key={opt.value}
                variant="outline"
                className={cn(
                  "cursor-pointer text-[10px] px-1.5 py-0",
                  playback.speed === opt.value &&
                    "bg-blue-600 text-white border-blue-600 hover:bg-blue-600",
                )}
                onClick={() => playback.onSpeedChange(opt.value)}
              >
                {opt.label}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
