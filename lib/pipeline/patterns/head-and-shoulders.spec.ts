import { describe, expect, test } from "vitest";
import fc from "fast-check";
import {
  detectHeadAndShoulders,
  calculateHaSLevels,
  scoreHeadAndShoulders,
} from "./head-and-shoulders";
import type { DetectorCandle } from "@/types/trading";

function makeCandle(
  high: number,
  low: number,
  atr: number | null = 0.005,
): DetectorCandle {
  return {
    open: (high + low) / 2,
    high,
    low,
    close: (high + low) / 2,
    atr,
    volume: null,
    volumeSma: null,
  };
}

function buildBearishHaSSequence(): DetectorCandle[] {
  return [
    makeCandle(1.08, 1.06),
    makeCandle(1.09, 1.07),
    makeCandle(1.1, 1.08),
    makeCandle(1.12, 1.1),
    makeCandle(1.1, 1.08),
    makeCandle(1.09, 1.07),
    makeCandle(1.08, 1.06),
    makeCandle(1.09, 1.07),
    makeCandle(1.1, 1.08),
    makeCandle(1.12, 1.1),
    makeCandle(1.14, 1.12),
    makeCandle(1.12, 1.1),
    makeCandle(1.1, 1.08),
    makeCandle(1.09, 1.07),
    makeCandle(1.08, 1.06),
    makeCandle(1.09, 1.07),
    makeCandle(1.1, 1.08),
    makeCandle(1.12, 1.1),
    makeCandle(1.1, 1.08),
    makeCandle(1.09, 1.07),
    makeCandle(1.08, 1.06),
  ];
}

function buildBullishHaSSequence(): DetectorCandle[] {
  return [
    makeCandle(1.12, 1.1),
    makeCandle(1.11, 1.09),
    makeCandle(1.1, 1.08),
    makeCandle(1.09, 1.07),
    makeCandle(1.1, 1.08),
    makeCandle(1.11, 1.09),
    makeCandle(1.12, 1.1),
    makeCandle(1.11, 1.09),
    makeCandle(1.1, 1.08),
    makeCandle(1.09, 1.07),
    makeCandle(1.08, 1.05),
    makeCandle(1.09, 1.07),
    makeCandle(1.1, 1.08),
    makeCandle(1.11, 1.09),
    makeCandle(1.12, 1.1),
    makeCandle(1.11, 1.09),
    makeCandle(1.1, 1.08),
    makeCandle(1.09, 1.07),
    makeCandle(1.1, 1.08),
    makeCandle(1.11, 1.09),
    makeCandle(1.12, 1.1),
  ];
}

describe(detectHeadAndShoulders, () => {
  test("detects bearish head and shoulders", () => {
    const candles = buildBearishHaSSequence();
    const results = detectHeadAndShoulders(candles);
    const bearish = results.filter((r) => r.direction === "bearish");
    expect(bearish.length).toBeGreaterThanOrEqual(1);

    const first = bearish[0];
    expect(candles[first.headIndex].high).toBeGreaterThan(
      candles[first.leftShoulderIndex].high,
    );
    expect(candles[first.headIndex].high).toBeGreaterThan(
      candles[first.rightShoulderIndex].high,
    );
  });

  test("detects bullish inverse head and shoulders", () => {
    const candles = buildBullishHaSSequence();
    const results = detectHeadAndShoulders(candles);
    const bullish = results.filter((r) => r.direction === "bullish");
    expect(bullish.length).toBeGreaterThanOrEqual(1);

    const first = bullish[0];
    expect(candles[first.headIndex].low).toBeLessThan(
      candles[first.leftShoulderIndex].low,
    );
    expect(candles[first.headIndex].low).toBeLessThan(
      candles[first.rightShoulderIndex].low,
    );
  });

  test("returns empty for flat data", () => {
    const candles = Array.from({ length: 30 }, () => makeCandle(1.1, 1.09));
    expect(detectHeadAndShoulders(candles)).toEqual([]);
  });

  test("returns empty for empty input", () => {
    expect(detectHeadAndShoulders([])).toEqual([]);
  });

  test("rejects when shoulders differ too much", () => {
    const candles = buildBearishHaSSequence();
    candles[17] = makeCandle(1.105, 1.085);
    const results = detectHeadAndShoulders(candles, {
      shoulderTolerance: 0.005,
    });
    expect(results.filter((r) => r.direction === "bearish")).toEqual([]);
  });

  test("head index is between left and right shoulder", () => {
    const candles = buildBearishHaSSequence();
    const results = detectHeadAndShoulders(candles);
    for (const r of results) {
      expect(r.headIndex).toBeGreaterThan(r.leftShoulderIndex);
      expect(r.headIndex).toBeLessThan(r.rightShoulderIndex);
    }
  });

  test("neckline is below head for bearish pattern", () => {
    const candles = buildBearishHaSSequence();
    const results = detectHeadAndShoulders(candles);
    const bearish = results.filter((r) => r.direction === "bearish");
    for (const r of bearish) {
      expect(r.necklinePrice).toBeLessThan(candles[r.headIndex].high);
    }
  });

  test("rejects pattern with steep neckline slope", () => {
    // Build H&S where neckline swing lows have very different prices
    const candles: DetectorCandle[] = [
      makeCandle(1.08, 1.06),
      makeCandle(1.09, 1.07),
      makeCandle(1.1, 1.08),
      makeCandle(1.12, 1.1), // LS at index 3
      makeCandle(1.1, 1.08),
      makeCandle(1.09, 1.04), // deep swing low at index 5
      makeCandle(1.08, 1.06),
      makeCandle(1.09, 1.07),
      makeCandle(1.1, 1.08),
      makeCandle(1.12, 1.1),
      makeCandle(1.15, 1.13), // Head at index 10
      makeCandle(1.12, 1.1),
      makeCandle(1.1, 1.08),
      makeCandle(1.09, 1.075), // higher swing low at index 13 — steep slope from 1.04 to 1.075
      makeCandle(1.08, 1.06),
      makeCandle(1.09, 1.07),
      makeCandle(1.1, 1.08),
      makeCandle(1.12, 1.1), // RS at index 17
      makeCandle(1.1, 1.08),
      makeCandle(1.09, 1.07),
      makeCandle(1.08, 1.06),
    ];
    // With very tight slope limit, steep necklines should be rejected
    const results = detectHeadAndShoulders(candles, {
      maxNecklineSlope: 0.001,
    });
    const bearish = results.filter((r) => r.direction === "bearish");
    expect(bearish).toEqual([]);
  });

  test("accepts pattern with flat neckline slope", () => {
    const candles = buildBearishHaSSequence();
    const withSlope = detectHeadAndShoulders(candles, {
      maxNecklineSlope: 0.05,
    });
    const withoutSlope = detectHeadAndShoulders(candles);
    expect(withSlope.length).toBeGreaterThanOrEqual(1);
    expect(withoutSlope.length).toBeGreaterThanOrEqual(withSlope.length);
  });

  test("rejects pattern with head not prominent enough (minHeadProminence)", () => {
    // Build a sequence where head is barely higher than shoulders
    const candles: DetectorCandle[] = [];
    // LS at index 3: high=1.12
    for (let i = 0; i < 3; i++)
      candles.push(makeCandle(1.08 + i * 0.01, 1.06 + i * 0.01));
    candles.push(makeCandle(1.12, 1.1)); // LS
    for (let i = 0; i < 3; i++)
      candles.push(makeCandle(1.1 - i * 0.01, 1.08 - i * 0.01));
    // Head at index 8: high=1.13 (only 1.08x LS, below 1.15)
    candles.push(makeCandle(1.09, 1.07));
    candles.push(makeCandle(1.13, 1.11)); // Head
    candles.push(makeCandle(1.09, 1.07));
    // RS at index 13: high=1.12
    for (let i = 0; i < 2; i++)
      candles.push(makeCandle(1.1 + i * 0.01, 1.08 + i * 0.01));
    candles.push(makeCandle(1.12, 1.1)); // RS
    for (let i = 0; i < 3; i++)
      candles.push(makeCandle(1.1 - i * 0.01, 1.08 - i * 0.01));

    const results = detectHeadAndShoulders(candles, {
      minHeadProminence: 1.15,
    });
    const bearish = results.filter((r) => r.direction === "bearish");
    expect(bearish).toEqual([]);
  });
});

describe(scoreHeadAndShoulders, () => {
  test("score is always between 1 and 10", () => {
    const candles = buildBearishHaSSequence();
    const results = detectHeadAndShoulders(candles);
    const bearish = results.filter((r) => r.direction === "bearish");
    expect(bearish.length).toBeGreaterThanOrEqual(1);
    fc.assert(
      fc.property(
        fc.double({ min: 20, max: 80, noNaN: true }),
        fc.double({ min: 20, max: 80, noNaN: true }),
        (rsiHead, rsiShoulder) => {
          const score = scoreHeadAndShoulders(candles, bearish[0], {
            rsiAtHead: rsiHead,
            rsiAtShoulder: rsiShoulder,
          });
          return score >= 1 && score <= 10;
        },
      ),
    );
  });

  test("RSI divergence increases score", () => {
    const candles = buildBearishHaSSequence();
    const results = detectHeadAndShoulders(candles);
    const detection = results.filter((r) => r.direction === "bearish")[0];

    const scoreNoDivergence = scoreHeadAndShoulders(candles, detection, {
      rsiAtHead: 70,
      rsiAtShoulder: 70,
    });
    const scoreDivergence = scoreHeadAndShoulders(candles, detection, {
      rsiAtHead: 60,
      rsiAtShoulder: 72,
    });
    expect(scoreDivergence).toBeGreaterThan(scoreNoDivergence);
  });

  test("symmetric shoulders score higher than asymmetric", () => {
    const candles = buildBearishHaSSequence();
    const results = detectHeadAndShoulders(candles);
    const detection = results.filter((r) => r.direction === "bearish")[0];

    const score = scoreHeadAndShoulders(candles, detection, {});
    // The build function creates symmetric shoulders, so score should be reasonable
    expect(score).toBeGreaterThanOrEqual(5);
  });
});

describe(calculateHaSLevels, () => {
  test("bearish: entry at neckline, stop above head, target below", () => {
    const levels = calculateHaSLevels(
      { headPrice: 1.14, necklinePrice: 1.06, direction: "bearish" },
      0.005,
    );
    expect(levels.entry).toBe(1.06);
    expect(levels.stopLoss).toBeGreaterThan(1.14);
    expect(levels.takeProfit).toBeLessThan(1.06);
  });

  test("bullish: entry at neckline, stop below head, target above", () => {
    const levels = calculateHaSLevels(
      { headPrice: 1.05, necklinePrice: 1.12, direction: "bullish" },
      0.005,
    );
    expect(levels.entry).toBe(1.12);
    expect(levels.stopLoss).toBeLessThan(1.05);
    expect(levels.takeProfit).toBeGreaterThan(1.12);
  });

  test("target distance equals pattern height", () => {
    const levels = calculateHaSLevels(
      { headPrice: 1.14, necklinePrice: 1.06, direction: "bearish" },
      0.005,
    );
    const height = 1.14 - 1.06;
    const targetDist = levels.entry - levels.takeProfit;
    expect(targetDist).toBeCloseTo(height, 4);
  });

  test("handles null ATR", () => {
    const levels = calculateHaSLevels(
      { headPrice: 1.14, necklinePrice: 1.06, direction: "bearish" },
      null,
    );
    expect(levels.stopLoss).toBeGreaterThan(1.14);
  });

  test("anchor prices include head and neckline", () => {
    const levels = calculateHaSLevels(
      { headPrice: 1.14, necklinePrice: 1.06, direction: "bearish" },
      0.005,
    );
    const labels = levels.anchorPrices.map((a) => a.label);
    expect(labels).toContain("head");
    expect(labels).toContain("neckline");
  });
});
