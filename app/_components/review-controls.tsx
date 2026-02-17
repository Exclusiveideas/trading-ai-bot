"use client";

import { useEffect } from "react";

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
    <div className="flex items-center justify-between rounded-md border border-zinc-200 bg-zinc-50 px-4 py-2 dark:border-zinc-700 dark:bg-zinc-800/50">
      <button
        onClick={onPrev}
        disabled={current <= 0}
        className="rounded px-2 py-1 text-sm font-medium text-zinc-600 hover:bg-zinc-200 disabled:opacity-30 dark:text-zinc-400 dark:hover:bg-zinc-700"
      >
        Prev
      </button>
      <span className="text-sm text-zinc-500 dark:text-zinc-400">
        {total === 0 ? "No candidates" : `${current + 1} of ${total}`}
      </span>
      <button
        onClick={onNext}
        disabled={current >= total - 1}
        className="rounded px-2 py-1 text-sm font-medium text-zinc-600 hover:bg-zinc-200 disabled:opacity-30 dark:text-zinc-400 dark:hover:bg-zinc-700"
      >
        Next
      </button>
    </div>
  );
}
