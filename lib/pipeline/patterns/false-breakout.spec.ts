import { describe, expect, test } from "vitest";
import fc from "fast-check";
import {
  detectFalseBreakouts,
  calculateFalseBreakoutLevels,
  scoreFalseBreakout,
} from "./false-breakout";
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

describe(detectFalseBreakouts, () => {
  test("detects bearish false breakout above resistance", () => {
    const candles: DetectorCandle[] = [
      makeCandle(1.098, 1.1, 1.095, 1.099),
      makeCandle(1.099, 1.107, 1.098, 1.105),
      makeCandle(1.105, 1.106, 1.095, 1.097),
    ];
    const results = detectFalseBreakouts(candles, [1.1]);
    expect(results).toEqual([
      {
        breakIndex: 1,
        reversalIndex: 2,
        brokenLevel: 1.1,
        direction: "bearish",
      },
    ]);
  });

  test("detects bullish false breakout below support", () => {
    const candles: DetectorCandle[] = [
      makeCandle(1.102, 1.105, 1.1, 1.101),
      makeCandle(1.101, 1.102, 1.093, 1.094),
      makeCandle(1.094, 1.105, 1.094, 1.103),
    ];
    const results = detectFalseBreakouts(candles, [1.1]);
    expect(results).toEqual([
      {
        breakIndex: 1,
        reversalIndex: 2,
        brokenLevel: 1.1,
        direction: "bullish",
      },
    ]);
  });

  test("returns empty when no reversal within window", () => {
    const candles: DetectorCandle[] = [
      makeCandle(1.098, 1.1, 1.095, 1.099),
      makeCandle(1.099, 1.107, 1.098, 1.105),
      makeCandle(1.105, 1.11, 1.104, 1.108),
      makeCandle(1.108, 1.112, 1.107, 1.111),
    ];
    const results = detectFalseBreakouts(candles, [1.1], { reversalBars: 2 });
    expect(results).toEqual([]);
  });

  test("returns empty for empty candles", () => {
    expect(detectFalseBreakouts([], [1.1])).toEqual([]);
  });

  test("returns empty for empty levels", () => {
    const candles = [makeCandle(1.1, 1.11, 1.09, 1.1)];
    expect(detectFalseBreakouts(candles, [])).toEqual([]);
  });

  test("checks multiple levels", () => {
    const candles: DetectorCandle[] = [
      makeCandle(1.098, 1.1, 1.095, 1.099),
      makeCandle(1.099, 1.107, 1.098, 1.105),
      makeCandle(1.105, 1.106, 1.095, 1.097),
    ];
    const results = detectFalseBreakouts(candles, [1.1, 1.2]);
    expect(results).toHaveLength(1);
    expect(results[0].brokenLevel).toBe(1.1);
  });

  test("respects break threshold — small break ignored", () => {
    const candles: DetectorCandle[] = [
      makeCandle(1.098, 1.1, 1.095, 1.099),
      makeCandle(1.099, 1.1002, 1.098, 1.1001),
      makeCandle(1.1, 1.101, 1.095, 1.097),
    ];
    const results = detectFalseBreakouts(candles, [1.1], {
      breakThresholdPips: 5,
    });
    expect(results).toEqual([]);
  });

  test("uses ATR-based threshold when useAtrThreshold is true", () => {
    // ATR = 0.005, minAtrPenetration = 0.1 → threshold = 0.0005
    // Candle high = 1.107, level = 1.100 → penetration = 0.007 > 0.0005 ✓
    const candles: DetectorCandle[] = [
      makeCandle(1.098, 1.1, 1.095, 1.099),
      makeCandle(1.099, 1.107, 1.098, 1.105),
      makeCandle(1.105, 1.106, 1.095, 1.097),
    ];
    const results = detectFalseBreakouts(candles, [1.1], {
      useAtrThreshold: true,
      minAtrPenetration: 0.1,
    });
    expect(results).toEqual([
      {
        breakIndex: 1,
        reversalIndex: 2,
        brokenLevel: 1.1,
        direction: "bearish",
      },
    ]);
  });

  test("ATR threshold rejects penetration beyond maxAtrPenetration (real breakout)", () => {
    // ATR = 0.005, maxAtrPenetration = 1.5 → max = 0.0075
    // Candle high = 1.110, level = 1.100 → penetration = 0.010 > 0.0075 → too much, likely real
    const candles: DetectorCandle[] = [
      makeCandle(1.098, 1.1, 1.095, 1.099),
      makeCandle(1.099, 1.11, 1.098, 1.108),
      makeCandle(1.108, 1.109, 1.095, 1.097),
    ];
    const results = detectFalseBreakouts(candles, [1.1], {
      useAtrThreshold: true,
      maxAtrPenetration: 1.5,
    });
    expect(results).toEqual([]);
  });

  test("falls back to pips threshold when ATR is null with useAtrThreshold", () => {
    const candles: DetectorCandle[] = [
      makeCandle(1.098, 1.1, 1.095, 1.099, null),
      makeCandle(1.099, 1.107, 1.098, 1.105, null),
      makeCandle(1.105, 1.106, 1.095, 1.097, null),
    ];
    const results = detectFalseBreakouts(candles, [1.1], {
      useAtrThreshold: true,
    });
    expect(results).toEqual([
      {
        breakIndex: 1,
        reversalIndex: 2,
        brokenLevel: 1.1,
        direction: "bearish",
      },
    ]);
  });
});

describe(scoreFalseBreakout, () => {
  test("high-quality false breakout scores >= 7", () => {
    // Quick reversal (same candle window), wick-only penetration, at key level
    const candles: DetectorCandle[] = [
      makeCandle(1.098, 1.1, 1.095, 1.099, 0.005),
      makeCandle(1.099, 1.107, 1.098, 1.098, 0.005), // breakout candle: body stays below level
      makeCandle(1.098, 1.1, 1.094, 1.097, 0.005), // quick reversal
    ];
    const score = scoreFalseBreakout(
      candles,
      {
        breakIndex: 1,
        reversalIndex: 2,
        brokenLevel: 1.1,
        direction: "bearish",
      },
      {
        levelTouchCount: 4,
        volume: 800,
        volumeSma: 1000,
        reversalVolume: 1600,
      },
    );
    expect(score).toBeGreaterThanOrEqual(7);
    expect(score).toBeLessThanOrEqual(10);
  });

  test("low-quality false breakout scores <= 4", () => {
    const candles: DetectorCandle[] = [
      makeCandle(1.098, 1.1, 1.095, 1.099, 0.005),
      makeCandle(1.099, 1.107, 1.098, 1.106, 0.005), // body closes beyond level
      makeCandle(1.106, 1.107, 1.1, 1.103, 0.005),
      makeCandle(1.103, 1.104, 1.098, 1.099, 0.005), // slow reversal
    ];
    const score = scoreFalseBreakout(
      candles,
      {
        breakIndex: 1,
        reversalIndex: 3,
        brokenLevel: 1.1,
        direction: "bearish",
      },
      {
        levelTouchCount: 1,
      },
    );
    expect(score).toBeLessThanOrEqual(4);
    expect(score).toBeGreaterThanOrEqual(1);
  });

  test("score is always between 1 and 10", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1.0, max: 1.5, noNaN: true }),
        fc.double({ min: 0.001, max: 0.01, noNaN: true }),
        (level, penetration) => {
          const candles: DetectorCandle[] = [
            makeCandle(
              level - 0.002,
              level,
              level - 0.005,
              level - 0.001,
              0.005,
            ),
            makeCandle(
              level - 0.001,
              level + penetration,
              level - 0.002,
              level + penetration * 0.5,
              0.005,
            ),
            makeCandle(
              level + penetration * 0.3,
              level + penetration * 0.5,
              level - 0.003,
              level - 0.002,
              0.005,
            ),
          ];
          const score = scoreFalseBreakout(
            candles,
            {
              breakIndex: 1,
              reversalIndex: 2,
              brokenLevel: level,
              direction: "bearish",
            },
            {},
          );
          return score >= 1 && score <= 10;
        },
      ),
    );
  });

  test("faster reversal scores higher", () => {
    const base: DetectorCandle[] = [
      makeCandle(1.098, 1.1, 1.095, 1.099, 0.005),
      makeCandle(1.099, 1.107, 1.098, 1.105, 0.005),
      makeCandle(1.105, 1.106, 1.095, 1.097, 0.005),
      makeCandle(1.097, 1.099, 1.094, 1.096, 0.005),
    ];

    const fastScore = scoreFalseBreakout(
      base,
      {
        breakIndex: 1,
        reversalIndex: 2,
        brokenLevel: 1.1,
        direction: "bearish",
      },
      {},
    );

    const slowScore = scoreFalseBreakout(
      base,
      {
        breakIndex: 1,
        reversalIndex: 3,
        brokenLevel: 1.1,
        direction: "bearish",
      },
      {},
    );

    expect(fastScore).toBeGreaterThan(slowScore);
  });
});

describe(calculateFalseBreakoutLevels, () => {
  test("bullish: entry at level, stop below extreme, target above", () => {
    const levels = calculateFalseBreakoutLevels(
      { brokenLevel: 1.1, extremePrice: 1.094, direction: "bullish" },
      0.005,
    );
    expect(levels.entry).toBe(1.1);
    expect(levels.stopLoss).toBeLessThan(1.094);
    expect(levels.takeProfit).toBeGreaterThan(1.1);
  });

  test("bearish: entry at level, stop above extreme, target below", () => {
    const levels = calculateFalseBreakoutLevels(
      { brokenLevel: 1.1, extremePrice: 1.107, direction: "bearish" },
      0.005,
    );
    expect(levels.entry).toBe(1.1);
    expect(levels.stopLoss).toBeGreaterThan(1.107);
    expect(levels.takeProfit).toBeLessThan(1.1);
  });

  test("take profit is 2R", () => {
    const levels = calculateFalseBreakoutLevels(
      { brokenLevel: 1.1, extremePrice: 1.094, direction: "bullish" },
      0.005,
    );
    const risk = Math.abs(levels.entry - levels.stopLoss);
    const reward = Math.abs(levels.takeProfit - levels.entry);
    expect(reward / risk).toBeCloseTo(2.0, 1);
  });

  test("handles null ATR", () => {
    const levels = calculateFalseBreakoutLevels(
      { brokenLevel: 1.1, extremePrice: 1.094, direction: "bullish" },
      null,
    );
    expect(levels.stopLoss).toBeLessThan(1.094);
  });

  test("anchor prices include broken level and extreme", () => {
    const levels = calculateFalseBreakoutLevels(
      { brokenLevel: 1.1, extremePrice: 1.094, direction: "bullish" },
      0.005,
    );
    const labels = levels.anchorPrices.map((a) => a.label);
    expect(labels).toContain("broken_level");
    expect(labels).toContain("false_break_extreme");
  });
});
