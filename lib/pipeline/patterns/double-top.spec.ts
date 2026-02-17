import { describe, expect, test } from "vitest";
import { detectDoubleTops, calculateDoubleTopLevels } from "./double-top";
import type { DetectorCandle } from "@/types/trading";

function makeCandle(
  high: number,
  low: number,
  close?: number,
  open?: number,
  atr: number | null = 0.005
): DetectorCandle {
  return {
    open: open ?? (high + low) / 2,
    high,
    low,
    close: close ?? (high + low) / 2,
    atr,
  };
}

function buildDoubleTopSequence(): DetectorCandle[] {
  return [
    makeCandle(1.10, 1.08),
    makeCandle(1.11, 1.09),
    makeCandle(1.14, 1.12),
    makeCandle(1.15, 1.13),
    makeCandle(1.14, 1.12),
    makeCandle(1.12, 1.10),
    makeCandle(1.11, 1.09),
    makeCandle(1.10, 1.08),
    makeCandle(1.11, 1.09),
    makeCandle(1.12, 1.10),
    makeCandle(1.14, 1.12),
    makeCandle(1.149, 1.13),
    makeCandle(1.13, 1.11),
    makeCandle(1.12, 1.10),
    makeCandle(1.11, 1.09),
  ];
}

describe(detectDoubleTops, () => {
  test("detects classic double top pattern", () => {
    const candles = buildDoubleTopSequence();
    const results = detectDoubleTops(candles);
    expect(results.length).toBeGreaterThanOrEqual(1);
    const first = results[0];
    expect(first.firstTopIndex).toBe(3);
    expect(first.secondTopIndex).toBe(11);
    expect(first.necklinePrice).toBeLessThan(1.15);
  });

  test("returns empty for monotonic uptrend", () => {
    const candles = Array.from({ length: 20 }, (_, i) =>
      makeCandle(1.10 + i * 0.01, 1.08 + i * 0.01)
    );
    expect(detectDoubleTops(candles)).toEqual([]);
  });

  test("returns empty for empty input", () => {
    expect(detectDoubleTops([])).toEqual([]);
  });

  test("returns empty when too few candles", () => {
    expect(detectDoubleTops([makeCandle(1.15, 1.10)])).toEqual([]);
  });

  test("rejects tops that differ by more than tolerance", () => {
    const candles = buildDoubleTopSequence();
    const results = detectDoubleTops(candles, { priceTolerance: 0.0001 });
    expect(results).toEqual([]);
  });

  test("rejects tops closer than minPullbackBars", () => {
    const candles = buildDoubleTopSequence();
    const results = detectDoubleTops(candles, { minPullbackBars: 20 });
    expect(results).toEqual([]);
  });

  test("neckline is the lowest low between the two tops", () => {
    const candles = buildDoubleTopSequence();
    const results = detectDoubleTops(candles);
    if (results.length > 0) {
      const { firstTopIndex, secondTopIndex, necklinePrice } = results[0];
      const betweenLows = candles
        .slice(firstTopIndex + 1, secondTopIndex)
        .map((c) => c.low);
      expect(necklinePrice).toBe(Math.min(...betweenLows));
    }
  });
});

describe(calculateDoubleTopLevels, () => {
  test("entry at neckline, stop above top, target below entry", () => {
    const levels = calculateDoubleTopLevels(
      { topPrice: 1.15, necklinePrice: 1.08 },
      0.005
    );
    expect(levels.entry).toBe(1.08);
    expect(levels.stopLoss).toBeGreaterThan(1.15);
    expect(levels.takeProfit).toBeLessThan(1.08);
  });

  test("target distance equals top-to-neckline distance", () => {
    const levels = calculateDoubleTopLevels(
      { topPrice: 1.15, necklinePrice: 1.08 },
      0.005
    );
    const patternHeight = 1.15 - 1.08;
    const targetDistance = levels.entry - levels.takeProfit;
    expect(targetDistance).toBeCloseTo(patternHeight, 4);
  });

  test("handles null ATR with fallback buffer", () => {
    const levels = calculateDoubleTopLevels(
      { topPrice: 1.15, necklinePrice: 1.08 },
      null
    );
    expect(levels.stopLoss).toBeGreaterThan(1.15);
  });

  test("anchor prices include both tops and neckline", () => {
    const levels = calculateDoubleTopLevels(
      { topPrice: 1.15, necklinePrice: 1.08 },
      0.005
    );
    const labels = levels.anchorPrices.map((a) => a.label);
    expect(labels).toContain("top");
    expect(labels).toContain("neckline");
  });
});
