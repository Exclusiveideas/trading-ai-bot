import { describe, expect, test } from "vitest";
import fc from "fast-check";
import { detectPinBars, calculatePinBarLevels, scorePinBar } from "./pin-bar";
import type { DetectorCandle } from "@/types/trading";

function makeCandle(
  open: number,
  high: number,
  low: number,
  close: number,
  atr: number | null = 0.005,
): DetectorCandle {
  return { open, high, low, close, atr, volume: null, volumeSma: null };
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

  test("rejects candle with nose too large (> 25% of range)", () => {
    // Candle with large nose: open=1.1, high=1.12, low=1.098, close=1.1
    // Upper wick (nose for bullish) = 1.12 - 1.1 = 0.02
    // Lower wick (tail) = 1.1 - 1.098 = 0.002
    // This is bearish shape. Let's make a bullish with large nose:
    // Bullish: lower wick=tail, upper wick=nose
    // open=1.099, high=1.107, low=1.08, close=1.1
    // range=0.027, lower wick=1.099-1.08=0.019 (70%), body=0.001 (3.7%), upper wick=1.107-1.1=0.007 (26%)
    // nose=26% > 25% → should reject with maxNoseRatio
    const candles: DetectorCandle[] = [
      makeCandle(1.1, 1.105, 1.095, 1.1),
      makeCandle(1.099, 1.107, 1.08, 1.1),
      makeCandle(1.1, 1.105, 1.095, 1.1),
    ];
    const withNoseFilter = detectPinBars(candles, { maxNoseRatio: 0.25 });
    expect(withNoseFilter).toEqual([]);
  });

  test("rejects candle smaller than minAtrMultiple", () => {
    // Candle range = 0.022, ATR = 0.05 → range/ATR = 0.44 < 0.5
    const candles: DetectorCandle[] = [
      makeCandle(1.1, 1.105, 1.095, 1.1, 0.05),
      makeCandle(1.1, 1.102, 1.08, 1.099, 0.05),
      makeCandle(1.1, 1.105, 1.095, 1.1, 0.05),
    ];
    const results = detectPinBars(candles, { minAtrMultiple: 0.5 });
    expect(results).toEqual([]);
  });

  test("rejects candle larger than maxAtrMultiple", () => {
    // Candle range = 0.022, ATR = 0.005 → range/ATR = 4.4 > 3.0
    const candles: DetectorCandle[] = [
      makeCandle(1.1, 1.105, 1.095, 1.1),
      makeCandle(1.1, 1.102, 1.08, 1.099),
      makeCandle(1.1, 1.105, 1.095, 1.1),
    ];
    const results = detectPinBars(candles, { maxAtrMultiple: 3.0 });
    expect(results).toEqual([]);
  });

  test("accepts candle within ATR range", () => {
    // Candle range = 0.022, ATR = 0.02 → range/ATR = 1.1, within 0.5-3.0
    const candles: DetectorCandle[] = [
      makeCandle(1.1, 1.105, 1.095, 1.1, 0.02),
      makeCandle(1.1, 1.102, 1.08, 1.099, 0.02),
      makeCandle(1.1, 1.105, 1.095, 1.1, 0.02),
    ];
    const results = detectPinBars(candles, {
      minAtrMultiple: 0.5,
      maxAtrMultiple: 3.0,
    });
    expect(results).toEqual([{ index: 1, direction: "bullish" }]);
  });

  test("skips ATR filter when ATR is null", () => {
    const candles: DetectorCandle[] = [
      makeCandle(1.1, 1.105, 1.095, 1.1, null),
      makeCandle(1.1, 1.102, 1.08, 1.099, null),
      makeCandle(1.1, 1.105, 1.095, 1.1, null),
    ];
    const results = detectPinBars(candles, {
      minAtrMultiple: 0.5,
      maxAtrMultiple: 3.0,
    });
    expect(results).toEqual([{ index: 1, direction: "bullish" }]);
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

describe(scorePinBar, () => {
  test("high-quality bullish pin bar scores >= 7", () => {
    // Excellent pin bar: tail 78%, body 8%, nose 14%, protrudes past 5 candles, volume 1.5x
    const candles: DetectorCandle[] = [
      makeCandle(1.1, 1.105, 1.095, 1.1, 0.01),
      makeCandle(1.099, 1.104, 1.094, 1.1, 0.01),
      makeCandle(1.098, 1.103, 1.093, 1.099, 0.01),
      makeCandle(1.097, 1.102, 1.092, 1.098, 0.01),
      makeCandle(1.096, 1.101, 1.091, 1.097, 0.01),
      makeCandle(1.095, 1.1, 1.09, 1.096, 0.01),
      // Pin bar at index 6: open=1.098, high=1.100, low=1.078, close=1.099
      // range=0.022, lower wick=1.098-1.078=0.020 (91%), body=0.001 (4.5%), nose=0.001 (4.5%)
      makeCandle(1.098, 1.1, 1.078, 1.099, 0.01),
      makeCandle(1.099, 1.104, 1.094, 1.1, 0.01),
    ];
    const score = scorePinBar(candles, 6, "bullish", {
      nearestSupport: 1.079,
      volume: 1500,
      volumeSma: 1000,
    });
    expect(score).toBeGreaterThanOrEqual(7);
    expect(score).toBeLessThanOrEqual(10);
  });

  test("low-quality pin bar scores <= 4", () => {
    // Weak pin bar: barely qualifies, no protrusion, no level, low volume
    const candles: DetectorCandle[] = [
      makeCandle(1.1, 1.11, 1.09, 1.1, 0.01),
      makeCandle(1.1, 1.11, 1.09, 1.1, 0.01),
      makeCandle(1.1, 1.11, 1.09, 1.1, 0.01),
      // Pin bar at index 3: open=1.098, high=1.105, low=1.085, close=1.097
      // range=0.020, lower wick=0.012 (60%), body=0.001 (5%), nose=0.007 (35%)
      // Nose too large, no protrusion (prior lows are 1.090 vs pin low 1.085 — minimal protrusion)
      makeCandle(1.098, 1.105, 1.085, 1.097, 0.01),
      makeCandle(1.1, 1.11, 1.09, 1.1, 0.01),
    ];
    const score = scorePinBar(candles, 3, "bullish", {
      volume: 500,
      volumeSma: 1000,
    });
    expect(score).toBeLessThanOrEqual(4);
    expect(score).toBeGreaterThanOrEqual(1);
  });

  test("score is always between 1 and 10", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1.0, max: 1.5, noNaN: true }),
        fc.double({ min: 0.005, max: 0.03, noNaN: true }),
        (basePrice, tailLength) => {
          const open = basePrice + tailLength * 0.05;
          const close = basePrice + tailLength * 0.1;
          const low = basePrice - tailLength;
          const high = close + tailLength * 0.05;
          const candles: DetectorCandle[] = [
            makeCandle(
              basePrice,
              basePrice + 0.01,
              basePrice - 0.01,
              basePrice,
              0.01,
            ),
            makeCandle(
              basePrice,
              basePrice + 0.01,
              basePrice - 0.01,
              basePrice,
              0.01,
            ),
            makeCandle(open, high, low, close, 0.01),
            makeCandle(
              basePrice,
              basePrice + 0.01,
              basePrice - 0.01,
              basePrice,
              0.01,
            ),
          ];
          const score = scorePinBar(candles, 2, "bullish", {});
          return score >= 1 && score <= 10;
        },
      ),
    );
  });

  test("protrusion increases score", () => {
    // Same pin bar, but with lower prior lows (no protrusion) vs higher prior lows (protrusion)
    const pinBar = makeCandle(1.098, 1.1, 1.078, 1.099, 0.01);

    const noProtrusionCandles: DetectorCandle[] = [
      makeCandle(1.1, 1.105, 1.07, 1.1, 0.01),
      makeCandle(1.1, 1.105, 1.07, 1.1, 0.01),
      pinBar,
      makeCandle(1.099, 1.104, 1.094, 1.1, 0.01),
    ];

    const protrusionCandles: DetectorCandle[] = [
      makeCandle(1.1, 1.105, 1.095, 1.1, 0.01),
      makeCandle(1.1, 1.105, 1.095, 1.1, 0.01),
      pinBar,
      makeCandle(1.099, 1.104, 1.094, 1.1, 0.01),
    ];

    const scoreNoProtrusion = scorePinBar(
      noProtrusionCandles,
      2,
      "bullish",
      {},
    );
    const scoreProtrusion = scorePinBar(protrusionCandles, 2, "bullish", {});
    expect(scoreProtrusion).toBeGreaterThan(scoreNoProtrusion);
  });

  test("volume confirmation increases score", () => {
    const candles: DetectorCandle[] = [
      makeCandle(1.1, 1.105, 1.095, 1.1, 0.01),
      makeCandle(1.098, 1.1, 1.078, 1.099, 0.01),
      makeCandle(1.099, 1.104, 1.094, 1.1, 0.01),
    ];

    const scoreLowVol = scorePinBar(candles, 1, "bullish", {
      volume: 500,
      volumeSma: 1000,
    });
    const scoreHighVol = scorePinBar(candles, 1, "bullish", {
      volume: 1800,
      volumeSma: 1000,
    });
    expect(scoreHighVol).toBeGreaterThan(scoreLowVol);
  });

  test("S/R proximity increases score", () => {
    const candles: DetectorCandle[] = [
      makeCandle(1.1, 1.105, 1.095, 1.1, 0.01),
      makeCandle(1.098, 1.1, 1.078, 1.099, 0.01),
      makeCandle(1.099, 1.104, 1.094, 1.1, 0.01),
    ];

    const scoreNoLevel = scorePinBar(candles, 1, "bullish", {});
    const scoreAtLevel = scorePinBar(candles, 1, "bullish", {
      nearestSupport: 1.079,
    });
    expect(scoreAtLevel).toBeGreaterThan(scoreNoLevel);
  });
});
