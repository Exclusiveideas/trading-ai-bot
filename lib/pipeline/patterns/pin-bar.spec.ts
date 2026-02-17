import { describe, expect, test } from "vitest";
import fc from "fast-check";
import { detectPinBars, calculatePinBarLevels } from "./pin-bar";
import type { DetectorCandle } from "@/types/trading";

function makeCandle(
  open: number,
  high: number,
  low: number,
  close: number,
  atr: number | null = 0.005,
): DetectorCandle {
  return { open, high, low, close, atr };
}

describe(detectPinBars, () => {
  test("detects bullish pin bar with long lower wick", () => {
    const candles: DetectorCandle[] = [
      makeCandle(1.1, 1.105, 1.095, 1.1),
      makeCandle(1.1, 1.102, 1.08, 1.099),
      makeCandle(1.1, 1.105, 1.095, 1.1),
    ];
    const results = detectPinBars(candles);
    expect(results).toEqual([{ index: 1, direction: "bullish" }]);
  });

  test("detects bearish pin bar with long upper wick", () => {
    const candles: DetectorCandle[] = [
      makeCandle(1.1, 1.105, 1.095, 1.1),
      makeCandle(1.1, 1.12, 1.098, 1.101),
      makeCandle(1.1, 1.105, 1.095, 1.1),
    ];
    const results = detectPinBars(candles);
    expect(results).toEqual([{ index: 1, direction: "bearish" }]);
  });

  test("returns empty for candles with balanced wicks", () => {
    const candles: DetectorCandle[] = [
      makeCandle(1.1, 1.11, 1.09, 1.1),
      makeCandle(1.1, 1.11, 1.09, 1.1),
      makeCandle(1.1, 1.11, 1.09, 1.1),
    ];
    expect(detectPinBars(candles)).toEqual([]);
  });

  test("returns empty for empty input", () => {
    expect(detectPinBars([])).toEqual([]);
  });

  test("returns empty for single candle", () => {
    expect(detectPinBars([makeCandle(1.1, 1.12, 1.08, 1.099)])).toEqual([]);
  });

  test("respects custom config thresholds", () => {
    const candles: DetectorCandle[] = [
      makeCandle(1.1, 1.105, 1.095, 1.1),
      makeCandle(1.1, 1.102, 1.08, 1.099),
      makeCandle(1.1, 1.105, 1.095, 1.1),
    ];
    const strict = detectPinBars(candles, { minWickRatio: 0.9 });
    expect(strict).toEqual([]);
  });

  test("detects multiple pin bars in sequence", () => {
    const candles: DetectorCandle[] = [
      makeCandle(1.1, 1.105, 1.095, 1.1),
      makeCandle(1.1, 1.102, 1.08, 1.099),
      makeCandle(1.1, 1.105, 1.095, 1.1),
      makeCandle(1.1, 1.12, 1.098, 1.101),
      makeCandle(1.1, 1.105, 1.095, 1.1),
    ];
    const results = detectPinBars(candles);
    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({ index: 1, direction: "bullish" });
    expect(results[1]).toEqual({ index: 3, direction: "bearish" });
  });

  test("rejects candle with zero range", () => {
    const candles: DetectorCandle[] = [
      makeCandle(1.1, 1.105, 1.095, 1.1),
      makeCandle(1.1, 1.1, 1.1, 1.1),
      makeCandle(1.1, 1.105, 1.095, 1.1),
    ];
    expect(detectPinBars(candles)).toEqual([]);
  });

  test("momentum confirmation filters bullish pin bar closing below prior midpoint", () => {
    const candles: DetectorCandle[] = [
      makeCandle(1.1, 1.105, 1.095, 1.1),
      makeCandle(1.098, 1.099, 1.08, 1.097),
      makeCandle(1.1, 1.105, 1.095, 1.1),
    ];
    const withoutConfirmation = detectPinBars(candles);
    expect(withoutConfirmation).toEqual([{ index: 1, direction: "bullish" }]);

    const withConfirmation = detectPinBars(candles, {
      requireMomentumConfirmation: true,
    });
    expect(withConfirmation).toEqual([]);
  });

  test("momentum confirmation keeps bullish pin bar closing above prior midpoint", () => {
    const candles: DetectorCandle[] = [
      makeCandle(1.1, 1.105, 1.095, 1.1),
      makeCandle(1.1, 1.102, 1.08, 1.101),
      makeCandle(1.1, 1.105, 1.095, 1.1),
    ];
    const results = detectPinBars(candles, {
      requireMomentumConfirmation: true,
    });
    expect(results).toEqual([{ index: 1, direction: "bullish" }]);
  });

  test("momentum confirmation filters bearish pin bar closing above prior midpoint", () => {
    const candles: DetectorCandle[] = [
      makeCandle(1.1, 1.105, 1.095, 1.1),
      makeCandle(1.101, 1.12, 1.099, 1.102),
      makeCandle(1.1, 1.105, 1.095, 1.1),
    ];
    const withoutConfirmation = detectPinBars(candles);
    expect(withoutConfirmation).toEqual([{ index: 1, direction: "bearish" }]);

    const withConfirmation = detectPinBars(candles, {
      requireMomentumConfirmation: true,
    });
    expect(withConfirmation).toEqual([]);
  });

  test("momentum confirmation keeps bearish pin bar closing below prior midpoint", () => {
    const candles: DetectorCandle[] = [
      makeCandle(1.1, 1.105, 1.095, 1.1),
      makeCandle(1.099, 1.12, 1.098, 1.099),
      makeCandle(1.1, 1.105, 1.095, 1.1),
    ];
    const results = detectPinBars(candles, {
      requireMomentumConfirmation: true,
    });
    expect(results).toEqual([{ index: 1, direction: "bearish" }]);
  });

  test("never detects when wick ratio below threshold", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1.0, max: 1.5, noNaN: true }),
        fc.double({ min: 0.001, max: 0.01, noNaN: true }),
        (basePrice, bodySize) => {
          const open = basePrice;
          const close = basePrice + bodySize;
          const high = close + bodySize * 0.2;
          const low = open - bodySize * 0.2;
          const candles: DetectorCandle[] = [
            makeCandle(
              basePrice,
              basePrice + 0.01,
              basePrice - 0.01,
              basePrice,
            ),
            makeCandle(open, high, low, close, 0.005),
            makeCandle(
              basePrice,
              basePrice + 0.01,
              basePrice - 0.01,
              basePrice,
            ),
          ];
          const results = detectPinBars(candles, { minWickRatio: 0.95 });
          return results.length === 0;
        },
      ),
    );
  });
});

describe(calculatePinBarLevels, () => {
  test("bullish pin bar: entry at high, stop below low", () => {
    const candle = makeCandle(1.1, 1.102, 1.08, 1.099);
    const levels = calculatePinBarLevels(candle, "bullish");
    expect(levels.entry).toBe(1.102);
    expect(levels.stopLoss).toBeLessThan(1.08);
    expect(levels.takeProfit).toBeGreaterThan(1.102);
  });

  test("bearish pin bar: entry at low, stop above high", () => {
    const candle = makeCandle(1.1, 1.12, 1.098, 1.101);
    const levels = calculatePinBarLevels(candle, "bearish");
    expect(levels.entry).toBe(1.098);
    expect(levels.stopLoss).toBeGreaterThan(1.12);
    expect(levels.takeProfit).toBeLessThan(1.098);
  });

  test("take profit is 2R from entry", () => {
    const candle = makeCandle(1.1, 1.102, 1.08, 1.099, 0.005);
    const levels = calculatePinBarLevels(candle, "bullish");
    const risk = Math.abs(levels.entry - levels.stopLoss);
    const reward = Math.abs(levels.takeProfit - levels.entry);
    expect(reward / risk).toBeCloseTo(2.0, 1);
  });

  test("anchor prices include wick tip", () => {
    const candle = makeCandle(1.1, 1.102, 1.08, 1.099);
    const levels = calculatePinBarLevels(candle, "bullish");
    expect(levels.anchorPrices.some((a) => a.label === "wick_tip")).toBe(true);
  });

  test("handles null ATR gracefully with fallback buffer", () => {
    const candle = makeCandle(1.1, 1.102, 1.08, 1.099, null);
    const levels = calculatePinBarLevels(candle, "bullish");
    expect(levels.stopLoss).toBeLessThan(1.08);
    expect(levels.takeProfit).toBeGreaterThan(1.102);
  });
});
