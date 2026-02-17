"use client";

import { useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

type ReviewControlsProps = {
  current: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
};

export function ReviewControls({ current, total, onPrev, onNext }: ReviewControlsProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowLeft") onPrev();
      if (e.key === "ArrowRight") onNext();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onPrev, onNext]);

  return (
    <Card>
      <CardContent className="flex items-center justify-between px-3 py-2">
        <Button variant="ghost" size="icon" onClick={onPrev} disabled={current <= 0} className="h-7 w-7">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-mono text-muted-foreground">
          {total === 0 ? "No candidates" : `${current + 1} / ${total}`}
        </span>
        <Button variant="ghost" size="icon" onClick={onNext} disabled={current >= total - 1} className="h-7 w-7">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}
