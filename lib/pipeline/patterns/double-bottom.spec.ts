import { describe, expect, test } from "vitest";
import { detectDoubleBottoms, calculateDoubleBottomLevels } from "./double-bottom";
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

function buildDoubleBottomSequence(): DetectorCandle[] {
  return [
    makeCandle(1.12, 1.10),
    makeCandle(1.11, 1.09),
    makeCandle(1.09, 1.07),
    makeCandle(1.08, 1.06),
    makeCandle(1.09, 1.07),
    makeCandle(1.11, 1.09),
    makeCandle(1.12, 1.10),
    makeCandle(1.13, 1.11),
    makeCandle(1.12, 1.10),
    makeCandle(1.10, 1.08),
    makeCandle(1.09, 1.07),
    makeCandle(1.081, 1.061),
    makeCandle(1.09, 1.07),
    makeCandle(1.11, 1.09),
    makeCandle(1.12, 1.10),
  ];
}

describe(detectDoubleBottoms, () => {
  test("detects classic double bottom pattern", () => {
    const candles = buildDoubleBottomSequence();
    const results = detectDoubleBottoms(candles);
    expect(results.length).toBeGreaterThanOrEqual(1);
    const first = results[0];
    expect(first.firstBottomIndex).toBe(3);
    expect(first.secondBottomIndex).toBe(11);
    expect(first.necklinePrice).toBeGreaterThan(1.06);
  });

  test("returns empty for monotonic downtrend", () => {
    const candles = Array.from({ length: 20 }, (_, i) =>
      makeCandle(1.20 - i * 0.01, 1.18 - i * 0.01)
    );
    expect(detectDoubleBottoms(candles)).toEqual([]);
  });

  test("returns empty for empty input", () => {
    expect(detectDoubleBottoms([])).toEqual([]);
  });

  test("rejects bottoms that differ by more than tolerance", () => {
    const candles = buildDoubleBottomSequence();
    const results = detectDoubleBottoms(candles, { priceTolerance: 0.0001 });
    expect(results).toEqual([]);
  });

  test("neckline is the highest high between the two bottoms", () => {
    const candles = buildDoubleBottomSequence();
    const results = detectDoubleBottoms(candles);
    if (results.length > 0) {
      const { firstBottomIndex, secondBottomIndex, necklinePrice } = results[0];
      const betweenHighs = candles
        .slice(firstBottomIndex + 1, secondBottomIndex)
        .map((c) => c.high);
      expect(necklinePrice).toBe(Math.max(...betweenHighs));
    }
  });
});

describe(calculateDoubleBottomLevels, () => {
  test("entry at neckline, stop below bottom, target above entry", () => {
    const levels = calculateDoubleBottomLevels(
      { bottomPrice: 1.06, necklinePrice: 1.13 },
      0.005
    );
    expect(levels.entry).toBe(1.13);
    expect(levels.stopLoss).toBeLessThan(1.06);
    expect(levels.takeProfit).toBeGreaterThan(1.13);
  });

  test("target distance equals neckline-to-bottom distance", () => {
    const levels = calculateDoubleBottomLevels(
      { bottomPrice: 1.06, necklinePrice: 1.13 },
      0.005
    );
    const patternHeight = 1.13 - 1.06;
    const targetDistance = levels.takeProfit - levels.entry;
    expect(targetDistance).toBeCloseTo(patternHeight, 4);
  });

  test("handles null ATR with fallback buffer", () => {
    const levels = calculateDoubleBottomLevels(
      { bottomPrice: 1.06, necklinePrice: 1.13 },
      null
    );
    expect(levels.stopLoss).toBeLessThan(1.06);
  });

  test("anchor prices include bottom and neckline", () => {
    const levels = calculateDoubleBottomLevels(
      { bottomPrice: 1.06, necklinePrice: 1.13 },
      0.005
    );
    const labels = levels.anchorPrices.map((a) => a.label);
    expect(labels).toContain("bottom");
    expect(labels).toContain("neckline");
  });
});
