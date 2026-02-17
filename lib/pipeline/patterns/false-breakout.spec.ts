import { describe, expect, test } from "vitest";
import { detectFalseBreakouts, calculateFalseBreakoutLevels } from "./false-breakout";
import type { DetectorCandle } from "@/types/trading";

function makeCandle(
  open: number,
  high: number,
  low: number,
  close: number,
  atr: number | null = 0.005
): DetectorCandle {
  return { open, high, low, close, atr };
}

describe(detectFalseBreakouts, () => {
  test("detects bearish false breakout above resistance", () => {
    const candles: DetectorCandle[] = [
      makeCandle(1.098, 1.100, 1.095, 1.099),
      makeCandle(1.099, 1.107, 1.098, 1.105),
      makeCandle(1.105, 1.106, 1.095, 1.097),
    ];
    const results = detectFalseBreakouts(candles, [1.100]);
    expect(results).toEqual([
      {
        breakIndex: 1,
        reversalIndex: 2,
        brokenLevel: 1.100,
        direction: "bearish",
      },
    ]);
  });

  test("detects bullish false breakout below support", () => {
    const candles: DetectorCandle[] = [
      makeCandle(1.102, 1.105, 1.100, 1.101),
      makeCandle(1.101, 1.102, 1.093, 1.094),
      makeCandle(1.094, 1.105, 1.094, 1.103),
    ];
    const results = detectFalseBreakouts(candles, [1.100]);
    expect(results).toEqual([
      {
        breakIndex: 1,
        reversalIndex: 2,
        brokenLevel: 1.100,
        direction: "bullish",
      },
    ]);
  });

  test("returns empty when no reversal within window", () => {
    const candles: DetectorCandle[] = [
      makeCandle(1.098, 1.100, 1.095, 1.099),
      makeCandle(1.099, 1.107, 1.098, 1.105),
      makeCandle(1.105, 1.110, 1.104, 1.108),
      makeCandle(1.108, 1.112, 1.107, 1.111),
    ];
    const results = detectFalseBreakouts(candles, [1.100], { reversalBars: 2 });
    expect(results).toEqual([]);
  });

  test("returns empty for empty candles", () => {
    expect(detectFalseBreakouts([], [1.100])).toEqual([]);
  });

  test("returns empty for empty levels", () => {
    const candles = [makeCandle(1.10, 1.11, 1.09, 1.10)];
    expect(detectFalseBreakouts(candles, [])).toEqual([]);
  });

  test("checks multiple levels", () => {
    const candles: DetectorCandle[] = [
      makeCandle(1.098, 1.100, 1.095, 1.099),
      makeCandle(1.099, 1.107, 1.098, 1.105),
      makeCandle(1.105, 1.106, 1.095, 1.097),
    ];
    const results = detectFalseBreakouts(candles, [1.100, 1.200]);
    expect(results).toHaveLength(1);
    expect(results[0].brokenLevel).toBe(1.100);
  });

  test("respects break threshold — small break ignored", () => {
    const candles: DetectorCandle[] = [
      makeCandle(1.098, 1.100, 1.095, 1.099),
      makeCandle(1.099, 1.1002, 1.098, 1.1001),
      makeCandle(1.100, 1.101, 1.095, 1.097),
    ];
    const results = detectFalseBreakouts(candles, [1.100], { breakThresholdPips: 5 });
    expect(results).toEqual([]);
  });
});

describe(calculateFalseBreakoutLevels, () => {
  test("bullish: entry at level, stop below extreme, target above", () => {
    const levels = calculateFalseBreakoutLevels(
      { brokenLevel: 1.100, extremePrice: 1.094, direction: "bullish" },
      0.005
    );
    expect(levels.entry).toBe(1.100);
    expect(levels.stopLoss).toBeLessThan(1.094);
    expect(levels.takeProfit).toBeGreaterThan(1.100);
  });

  test("bearish: entry at level, stop above extreme, target below", () => {
    const levels = calculateFalseBreakoutLevels(
      { brokenLevel: 1.100, extremePrice: 1.107, direction: "bearish" },
      0.005
    );
    expect(levels.entry).toBe(1.100);
    expect(levels.stopLoss).toBeGreaterThan(1.107);
    expect(levels.takeProfit).toBeLessThan(1.100);
  });

  test("take profit is 2R", () => {
    const levels = calculateFalseBreakoutLevels(
      { brokenLevel: 1.100, extremePrice: 1.094, direction: "bullish" },
      0.005
    );
    const risk = Math.abs(levels.entry - levels.stopLoss);
    const reward = Math.abs(levels.takeProfit - levels.entry);
    expect(reward / risk).toBeCloseTo(2.0, 1);
  });

  test("handles null ATR", () => {
    const levels = calculateFalseBreakoutLevels(
      { brokenLevel: 1.100, extremePrice: 1.094, direction: "bullish" },
      null
    );
    expect(levels.stopLoss).toBeLessThan(1.094);
  });

  test("anchor prices include broken level and extreme", () => {
    const levels = calculateFalseBreakoutLevels(
      { brokenLevel: 1.100, extremePrice: 1.094, direction: "bullish" },
      0.005
    );
    const labels = levels.anchorPrices.map((a) => a.label);
    expect(labels).toContain("broken_level");
    expect(labels).toContain("false_break_extreme");
  });
});
