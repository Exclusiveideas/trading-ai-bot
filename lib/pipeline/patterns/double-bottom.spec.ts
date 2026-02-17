import { describe, expect, test } from "vitest";
import fc from "fast-check";
import {
  detectDoubleBottoms,
  calculateDoubleBottomLevels,
  scoreDoubleBottom,
} from "./double-bottom";
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

function buildDoubleBottomSequence(): DetectorCandle[] {
  return [
    makeCandle(1.12, 1.1),
    makeCandle(1.11, 1.09),
    makeCandle(1.09, 1.07),
    makeCandle(1.08, 1.06),
    makeCandle(1.09, 1.07),
    makeCandle(1.11, 1.09),
    makeCandle(1.12, 1.1),
    makeCandle(1.13, 1.11),
    makeCandle(1.12, 1.1),
    makeCandle(1.1, 1.08),
    makeCandle(1.09, 1.07),
    makeCandle(1.081, 1.061),
    makeCandle(1.09, 1.07),
    makeCandle(1.11, 1.09),
    makeCandle(1.12, 1.1),
  ];
}

describe(detectDoubleBottoms, () => {
  test("detects classic double bottom pattern", () => {
    const candles = buildDoubleBottomSequence();
    const results = detectDoubleBottoms(candles);
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      firstBottomIndex: 3,
      secondBottomIndex: 11,
      necklinePrice: 1.13,
    });
  });

  test("returns empty for monotonic downtrend", () => {
    const candles = Array.from({ length: 20 }, (_, i) =>
      makeCandle(1.2 - i * 0.01, 1.18 - i * 0.01),
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
      0.005,
    );
    expect(levels.entry).toBe(1.13);
    expect(levels.stopLoss).toBeLessThan(1.06);
    expect(levels.takeProfit).toBeGreaterThan(1.13);
  });

  test("target distance equals neckline-to-bottom distance", () => {
    const levels = calculateDoubleBottomLevels(
      { bottomPrice: 1.06, necklinePrice: 1.13 },
      0.005,
    );
    const patternHeight = 1.13 - 1.06;
    const targetDistance = levels.takeProfit - levels.entry;
    expect(targetDistance).toBeCloseTo(patternHeight, 4);
  });

  test("handles null ATR with fallback buffer", () => {
    const levels = calculateDoubleBottomLevels(
      { bottomPrice: 1.06, necklinePrice: 1.13 },
      null,
    );
    expect(levels.stopLoss).toBeLessThan(1.06);
  });

  test("anchor prices include bottom and neckline", () => {
    const levels = calculateDoubleBottomLevels(
      { bottomPrice: 1.06, necklinePrice: 1.13 },
      0.005,
    );
    const labels = levels.anchorPrices.map((a) => a.label);
    expect(labels).toContain("bottom");
    expect(labels).toContain("neckline");
  });
});

describe(scoreDoubleBottom, () => {
  test("high-quality double bottom scores >= 7", () => {
    const candles = buildDoubleBottomSequence().map((c) => ({
      ...c,
      atr: 0.02,
    }));
    const detection = detectDoubleBottoms(candles, { priceTolerance: 0.03 })[0];
    const score = scoreDoubleBottom(candles, detection, {
      rsiAtFirst: 25,
      rsiAtSecond: 40,
      volumeAtFirst: 1500,
      volumeAtSecond: 1200,
    });
    expect(score).toBeGreaterThanOrEqual(7);
    expect(score).toBeLessThanOrEqual(10);
  });

  test("low-quality double bottom scores lower than high-quality", () => {
    const lowQualityCandles = buildDoubleBottomSequence().map((c) => ({
      ...c,
      atr: 0.05,
    }));
    const lowDetection = detectDoubleBottoms(lowQualityCandles)[0];
    const lowScore = scoreDoubleBottom(lowQualityCandles, lowDetection, {
      rsiAtFirst: 30,
      rsiAtSecond: 28,
    });

    const highQualityCandles = buildDoubleBottomSequence().map((c) => ({
      ...c,
      atr: 0.02,
    }));
    const highDetection = detectDoubleBottoms(highQualityCandles, {
      priceTolerance: 0.03,
    })[0];
    const highScore = scoreDoubleBottom(highQualityCandles, highDetection, {
      rsiAtFirst: 25,
      rsiAtSecond: 40,
    });

    expect(highScore).toBeGreaterThan(lowScore);
  });

  test("volume decline at second bottom increases score", () => {
    const candles = buildDoubleBottomSequence().map((c) => ({
      ...c,
      atr: 0.02,
    }));
    const detection = detectDoubleBottoms(candles, { priceTolerance: 0.03 })[0];

    const scoreHighVol = scoreDoubleBottom(candles, detection, {
      volumeAtFirst: 1000,
      volumeAtSecond: 1500,
    });
    const scoreLowVol = scoreDoubleBottom(candles, detection, {
      volumeAtFirst: 1500,
      volumeAtSecond: 1000,
    });
    expect(scoreLowVol).toBeGreaterThan(scoreHighVol);
  });

  test("RSI divergence increases score", () => {
    const candles = buildDoubleBottomSequence().map((c) => ({
      ...c,
      atr: 0.02,
    }));
    const detection = detectDoubleBottoms(candles, { priceTolerance: 0.03 })[0];

    const scoreNoDivergence = scoreDoubleBottom(candles, detection, {
      rsiAtFirst: 30,
      rsiAtSecond: 30,
    });
    const scoreDivergence = scoreDoubleBottom(candles, detection, {
      rsiAtFirst: 25,
      rsiAtSecond: 40,
    });
    expect(scoreDivergence).toBeGreaterThan(scoreNoDivergence);
  });

  test("score is always between 1 and 10", () => {
    const candles = buildDoubleBottomSequence();
    const detection = detectDoubleBottoms(candles)[0];
    fc.assert(
      fc.property(
        fc.double({ min: 20, max: 80, noNaN: true }),
        fc.double({ min: 20, max: 80, noNaN: true }),
        (rsi1, rsi2) => {
          const score = scoreDoubleBottom(candles, detection, {
            rsiAtFirst: rsi1,
            rsiAtSecond: rsi2,
          });
          return score >= 1 && score <= 10;
        },
      ),
    );
  });
});
