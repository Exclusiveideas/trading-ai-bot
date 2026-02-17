import { describe, expect, test } from "vitest";
import fc from "fast-check";
import {
  detectDoubleTops,
  calculateDoubleTopLevels,
  scoreDoubleTop,
} from "./double-top";
import type { DetectorCandle } from "@/types/trading";

function makeCandle(
  high: number,
  low: number,
  close?: number,
  open?: number,
  atr: number | null = 0.005,
): DetectorCandle {
  return {
    open: open ?? (high + low) / 2,
    high,
    low,
    close: close ?? (high + low) / 2,
    atr,
    volume: null,
    volumeSma: null,
  };
}

function buildDoubleTopSequence(): DetectorCandle[] {
  return [
    makeCandle(1.1, 1.08),
    makeCandle(1.11, 1.09),
    makeCandle(1.14, 1.12),
    makeCandle(1.15, 1.13),
    makeCandle(1.14, 1.12),
    makeCandle(1.12, 1.1),
    makeCandle(1.11, 1.09),
    makeCandle(1.1, 1.08),
    makeCandle(1.11, 1.09),
    makeCandle(1.12, 1.1),
    makeCandle(1.14, 1.12),
    makeCandle(1.149, 1.13),
    makeCandle(1.13, 1.11),
    makeCandle(1.12, 1.1),
    makeCandle(1.11, 1.09),
  ];
}

describe(detectDoubleTops, () => {
  test("detects classic double top pattern", () => {
    const candles = buildDoubleTopSequence();
    const results = detectDoubleTops(candles);
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      firstTopIndex: 3,
      secondTopIndex: 11,
      necklinePrice: 1.08,
    });
  });

  test("returns empty for monotonic uptrend", () => {
    const candles = Array.from({ length: 20 }, (_, i) =>
      makeCandle(1.1 + i * 0.01, 1.08 + i * 0.01),
    );
    expect(detectDoubleTops(candles)).toEqual([]);
  });

  test("returns empty for empty input", () => {
    expect(detectDoubleTops([])).toEqual([]);
  });

  test("returns empty when too few candles", () => {
    expect(detectDoubleTops([makeCandle(1.15, 1.1)])).toEqual([]);
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

  test("rejects pattern shorter than minHeightAtr", () => {
    // Pattern height ~0.07, ATR = 0.05 → height/ATR = 1.4 < 2.0
    const candles = buildDoubleTopSequence().map((c) => ({
      ...c,
      atr: 0.05,
    }));
    const results = detectDoubleTops(candles, { minHeightAtr: 2.0 });
    expect(results).toEqual([]);
  });

  test("accepts pattern meeting minHeightAtr", () => {
    // Pattern height ~0.07, ATR = 0.02 → height/ATR = 3.5 >= 2.0
    const candles = buildDoubleTopSequence().map((c) => ({
      ...c,
      atr: 0.02,
    }));
    const results = detectDoubleTops(candles, { minHeightAtr: 2.0 });
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  test("wider priceTolerance finds more patterns", () => {
    const candles = buildDoubleTopSequence();
    const tight = detectDoubleTops(candles, { priceTolerance: 0.001 });
    const wide = detectDoubleTops(candles, { priceTolerance: 0.03 });
    expect(wide.length).toBeGreaterThanOrEqual(tight.length);
  });
});

describe(scoreDoubleTop, () => {
  test("high-quality double top scores >= 7", () => {
    const candles = buildDoubleTopSequence().map((c) => ({
      ...c,
      atr: 0.02,
    }));
    const detection = detectDoubleTops(candles, { priceTolerance: 0.03 })[0];
    const score = scoreDoubleTop(candles, detection, {
      rsiAtFirst: 72,
      rsiAtSecond: 60,
    });
    expect(score).toBeGreaterThanOrEqual(7);
    expect(score).toBeLessThanOrEqual(10);
  });

  test("low-quality double top scores lower than high-quality", () => {
    // Small pattern relative to ATR, RSI going wrong direction (increasing)
    const candles = buildDoubleTopSequence().map((c) => ({
      ...c,
      atr: 0.05,
    }));
    const detection = detectDoubleTops(candles)[0];
    const lowScore = scoreDoubleTop(candles, detection, {
      rsiAtFirst: 55,
      rsiAtSecond: 58,
    });

    const goodCandles = buildDoubleTopSequence().map((c) => ({
      ...c,
      atr: 0.02,
    }));
    const goodDetection = detectDoubleTops(goodCandles, {
      priceTolerance: 0.03,
    })[0];
    const highScore = scoreDoubleTop(goodCandles, goodDetection, {
      rsiAtFirst: 72,
      rsiAtSecond: 60,
    });

    expect(highScore).toBeGreaterThan(lowScore);
  });

  test("RSI divergence increases score", () => {
    const candles = buildDoubleTopSequence().map((c) => ({
      ...c,
      atr: 0.02,
    }));
    const detection = detectDoubleTops(candles, { priceTolerance: 0.03 })[0];

    const scoreNoDivergence = scoreDoubleTop(candles, detection, {
      rsiAtFirst: 70,
      rsiAtSecond: 70,
    });
    const scoreDivergence = scoreDoubleTop(candles, detection, {
      rsiAtFirst: 75,
      rsiAtSecond: 60,
    });
    expect(scoreDivergence).toBeGreaterThan(scoreNoDivergence);
  });

  test("score is always between 1 and 10", () => {
    const candles = buildDoubleTopSequence();
    const detection = detectDoubleTops(candles)[0];
    fc.assert(
      fc.property(
        fc.double({ min: 20, max: 80, noNaN: true }),
        fc.double({ min: 20, max: 80, noNaN: true }),
        (rsi1, rsi2) => {
          const score = scoreDoubleTop(candles, detection, {
            rsiAtFirst: rsi1,
            rsiAtSecond: rsi2,
          });
          return score >= 1 && score <= 10;
        },
      ),
    );
  });
});

describe(calculateDoubleTopLevels, () => {
  test("entry at neckline, stop above top, target below entry", () => {
    const levels = calculateDoubleTopLevels(
      { topPrice: 1.15, necklinePrice: 1.08 },
      0.005,
    );
    expect(levels.entry).toBe(1.08);
    expect(levels.stopLoss).toBeGreaterThan(1.15);
    expect(levels.takeProfit).toBeLessThan(1.08);
  });

  test("target distance equals top-to-neckline distance", () => {
    const levels = calculateDoubleTopLevels(
      { topPrice: 1.15, necklinePrice: 1.08 },
      0.005,
    );
    const patternHeight = 1.15 - 1.08;
    const targetDistance = levels.entry - levels.takeProfit;
    expect(targetDistance).toBeCloseTo(patternHeight, 4);
  });

  test("handles null ATR with fallback buffer", () => {
    const levels = calculateDoubleTopLevels(
      { topPrice: 1.15, necklinePrice: 1.08 },
      null,
    );
    expect(levels.stopLoss).toBeGreaterThan(1.15);
  });

  test("anchor prices include both tops and neckline", () => {
    const levels = calculateDoubleTopLevels(
      { topPrice: 1.15, necklinePrice: 1.08 },
      0.005,
    );
    const labels = levels.anchorPrices.map((a) => a.label);
    expect(labels).toContain("top");
    expect(labels).toContain("neckline");
  });
});
