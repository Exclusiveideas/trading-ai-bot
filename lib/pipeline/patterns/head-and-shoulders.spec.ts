import { describe, expect, test } from "vitest";
import { detectHeadAndShoulders, calculateHaSLevels } from "./head-and-shoulders";
import type { DetectorCandle } from "@/types/trading";

function makeCandle(
  high: number,
  low: number,
  atr: number | null = 0.005
): DetectorCandle {
  return { open: (high + low) / 2, high, low, close: (high + low) / 2, atr };
}

function buildBearishHaSSequence(): DetectorCandle[] {
  return [
    makeCandle(1.08, 1.06),
    makeCandle(1.09, 1.07),
    makeCandle(1.10, 1.08),
    makeCandle(1.12, 1.10),
    makeCandle(1.10, 1.08),
    makeCandle(1.09, 1.07),
    makeCandle(1.08, 1.06),
    makeCandle(1.09, 1.07),
    makeCandle(1.10, 1.08),
    makeCandle(1.12, 1.10),
    makeCandle(1.14, 1.12),
    makeCandle(1.12, 1.10),
    makeCandle(1.10, 1.08),
    makeCandle(1.09, 1.07),
    makeCandle(1.08, 1.06),
    makeCandle(1.09, 1.07),
    makeCandle(1.10, 1.08),
    makeCandle(1.12, 1.10),
    makeCandle(1.10, 1.08),
    makeCandle(1.09, 1.07),
    makeCandle(1.08, 1.06),
  ];
}

function buildBullishHaSSequence(): DetectorCandle[] {
  return [
    makeCandle(1.12, 1.10),
    makeCandle(1.11, 1.09),
    makeCandle(1.10, 1.08),
    makeCandle(1.09, 1.07),
    makeCandle(1.10, 1.08),
    makeCandle(1.11, 1.09),
    makeCandle(1.12, 1.10),
    makeCandle(1.11, 1.09),
    makeCandle(1.10, 1.08),
    makeCandle(1.09, 1.07),
    makeCandle(1.08, 1.05),
    makeCandle(1.09, 1.07),
    makeCandle(1.10, 1.08),
    makeCandle(1.11, 1.09),
    makeCandle(1.12, 1.10),
    makeCandle(1.11, 1.09),
    makeCandle(1.10, 1.08),
    makeCandle(1.09, 1.07),
    makeCandle(1.10, 1.08),
    makeCandle(1.11, 1.09),
    makeCandle(1.12, 1.10),
  ];
}

describe(detectHeadAndShoulders, () => {
  test("detects bearish head and shoulders", () => {
    const candles = buildBearishHaSSequence();
    const results = detectHeadAndShoulders(candles);
    const bearish = results.filter((r) => r.direction === "bearish");
    expect(bearish.length).toBeGreaterThanOrEqual(1);

    const first = bearish[0];
    expect(candles[first.headIndex].high).toBeGreaterThan(candles[first.leftShoulderIndex].high);
    expect(candles[first.headIndex].high).toBeGreaterThan(candles[first.rightShoulderIndex].high);
  });

  test("detects bullish inverse head and shoulders", () => {
    const candles = buildBullishHaSSequence();
    const results = detectHeadAndShoulders(candles);
    const bullish = results.filter((r) => r.direction === "bullish");
    expect(bullish.length).toBeGreaterThanOrEqual(1);

    const first = bullish[0];
    expect(candles[first.headIndex].low).toBeLessThan(candles[first.leftShoulderIndex].low);
    expect(candles[first.headIndex].low).toBeLessThan(candles[first.rightShoulderIndex].low);
  });

  test("returns empty for flat data", () => {
    const candles = Array.from({ length: 30 }, () => makeCandle(1.10, 1.09));
    expect(detectHeadAndShoulders(candles)).toEqual([]);
  });

  test("returns empty for empty input", () => {
    expect(detectHeadAndShoulders([])).toEqual([]);
  });

  test("rejects when shoulders differ too much", () => {
    const candles = buildBearishHaSSequence();
    candles[17] = makeCandle(1.105, 1.085);
    const results = detectHeadAndShoulders(candles, { shoulderTolerance: 0.005 });
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
});

describe(calculateHaSLevels, () => {
  test("bearish: entry at neckline, stop above head, target below", () => {
    const levels = calculateHaSLevels(
      { headPrice: 1.14, necklinePrice: 1.06, direction: "bearish" },
      0.005
    );
    expect(levels.entry).toBe(1.06);
    expect(levels.stopLoss).toBeGreaterThan(1.14);
    expect(levels.takeProfit).toBeLessThan(1.06);
  });

  test("bullish: entry at neckline, stop below head, target above", () => {
    const levels = calculateHaSLevels(
      { headPrice: 1.05, necklinePrice: 1.12, direction: "bullish" },
      0.005
    );
    expect(levels.entry).toBe(1.12);
    expect(levels.stopLoss).toBeLessThan(1.05);
    expect(levels.takeProfit).toBeGreaterThan(1.12);
  });

  test("target distance equals pattern height", () => {
    const levels = calculateHaSLevels(
      { headPrice: 1.14, necklinePrice: 1.06, direction: "bearish" },
      0.005
    );
    const height = 1.14 - 1.06;
    const targetDist = levels.entry - levels.takeProfit;
    expect(targetDist).toBeCloseTo(height, 4);
  });

  test("handles null ATR", () => {
    const levels = calculateHaSLevels(
      { headPrice: 1.14, necklinePrice: 1.06, direction: "bearish" },
      null
    );
    expect(levels.stopLoss).toBeGreaterThan(1.14);
  });

  test("anchor prices include head and neckline", () => {
    const levels = calculateHaSLevels(
      { headPrice: 1.14, necklinePrice: 1.06, direction: "bearish" },
      0.005
    );
    const labels = levels.anchorPrices.map((a) => a.label);
    expect(labels).toContain("head");
    expect(labels).toContain("neckline");
  });
});
