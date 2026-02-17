import { describe, expect, test, beforeEach } from "vitest";
import type {
  TrendState,
  PatternCandidate,
  CandidateId,
} from "@/types/trading";
import {
  findAllCandidates,
  resetCandidateCounter,
  deduplicateOverlapping,
} from "./candidate-finder";
import type { EnrichedDetectorCandle } from "./candidate-finder";

function makeEnrichedCandle(
  open: number,
  high: number,
  low: number,
  close: number,
  overrides?: Partial<EnrichedDetectorCandle>,
): EnrichedDetectorCandle {
  return {
    open,
    high,
    low,
    close,
    atr: 0.005,
    timestamp: "2024-01-15",
    trendState: "ranging" as TrendState,
    nearestSupport: null,
    nearestResistance: null,
    rsi: 50,
    ...overrides,
  };
}

beforeEach(() => {
  resetCandidateCounter();
});

describe(findAllCandidates, () => {
  test("returns empty for empty candles", () => {
    expect(findAllCandidates([], "EUR/USD")).toEqual([]);
  });

  test("detects pin bar in enriched candle array", () => {
    const candles: EnrichedDetectorCandle[] = [
      makeEnrichedCandle(1.1, 1.105, 1.095, 1.1),
      makeEnrichedCandle(1.1, 1.102, 1.08, 1.099),
      makeEnrichedCandle(1.1, 1.105, 1.095, 1.1),
    ];
    const results = findAllCandidates(candles, "EUR/USD");
    const pinBars = results.filter((r) => r.patternType === "pin_bar");
    expect(pinBars.length).toBeGreaterThanOrEqual(1);
    expect(pinBars[0].pair).toBe("EUR/USD");
    expect(pinBars[0].startIndex).toBe(1);
    expect(pinBars[0].endIndex).toBe(1);
  });

  test("each candidate has unique id", () => {
    const candles: EnrichedDetectorCandle[] = [
      makeEnrichedCandle(1.1, 1.105, 1.095, 1.1),
      makeEnrichedCandle(1.1, 1.102, 1.08, 1.099),
      makeEnrichedCandle(1.1, 1.105, 1.095, 1.1),
      makeEnrichedCandle(1.1, 1.12, 1.098, 1.101),
      makeEnrichedCandle(1.1, 1.105, 1.095, 1.1),
    ];
    const results = findAllCandidates(candles, "EUR/USD");
    const ids = results.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("candidates are sorted by startIndex", () => {
    const candles: EnrichedDetectorCandle[] = [
      makeEnrichedCandle(1.1, 1.105, 1.095, 1.1),
      makeEnrichedCandle(1.1, 1.102, 1.08, 1.099),
      makeEnrichedCandle(1.1, 1.105, 1.095, 1.1),
      makeEnrichedCandle(1.1, 1.12, 1.098, 1.101),
      makeEnrichedCandle(1.1, 1.105, 1.095, 1.1),
    ];
    const results = findAllCandidates(candles, "EUR/USD");
    for (let i = 1; i < results.length; i++) {
      expect(results[i].startIndex).toBeGreaterThanOrEqual(
        results[i - 1].startIndex,
      );
    }
  });

  test("context snapshot is populated from enriched candle", () => {
    const candles: EnrichedDetectorCandle[] = [
      makeEnrichedCandle(1.1, 1.105, 1.095, 1.1),
      makeEnrichedCandle(1.1, 1.102, 1.08, 1.099, {
        trendState: "strong_uptrend",
        nearestSupport: 1.07,
        rsi: 65,
      }),
      makeEnrichedCandle(1.1, 1.105, 1.095, 1.1),
    ];
    const results = findAllCandidates(candles, "EUR/USD");
    const pinBar = results.find((r) => r.patternType === "pin_bar");
    expect(pinBar?.contextSnapshot.trendState).toBe("strong_uptrend");
    expect(pinBar?.contextSnapshot.nearestSupport).toBe(1.07);
    expect(pinBar?.contextSnapshot.rsi).toBe(65);
  });

  test("confidence is between 0 and 1", () => {
    const candles: EnrichedDetectorCandle[] = [
      makeEnrichedCandle(1.1, 1.105, 1.095, 1.1),
      makeEnrichedCandle(1.1, 1.102, 1.08, 1.099),
      makeEnrichedCandle(1.1, 1.105, 1.095, 1.1),
    ];
    const results = findAllCandidates(candles, "EUR/USD");
    for (const r of results) {
      expect(r.confidence).toBeGreaterThanOrEqual(0);
      expect(r.confidence).toBeLessThanOrEqual(1);
    }
  });

  test("respects maxCandidates limit", () => {
    const candles: EnrichedDetectorCandle[] = [
      makeEnrichedCandle(1.1, 1.105, 1.095, 1.1),
      makeEnrichedCandle(1.1, 1.102, 1.08, 1.099),
      makeEnrichedCandle(1.1, 1.105, 1.095, 1.1),
      makeEnrichedCandle(1.1, 1.12, 1.098, 1.101),
      makeEnrichedCandle(1.1, 1.105, 1.095, 1.1),
    ];
    const results = findAllCandidates(candles, "EUR/USD", { maxCandidates: 1 });
    expect(results).toHaveLength(1);
  });

  test("limited candidates are sorted by highest confidence first", () => {
    const candles: EnrichedDetectorCandle[] = [
      makeEnrichedCandle(1.1, 1.105, 1.095, 1.1),
      makeEnrichedCandle(1.1, 1.102, 1.08, 1.099),
      makeEnrichedCandle(1.1, 1.105, 1.095, 1.1),
      makeEnrichedCandle(1.1, 1.12, 1.098, 1.101),
      makeEnrichedCandle(1.1, 1.105, 1.095, 1.1),
    ];
    const all = findAllCandidates(candles, "EUR/USD");
    const limited = findAllCandidates(candles, "EUR/USD", { maxCandidates: 1 });
    const maxConfidence = Math.max(...all.map((c) => c.confidence));
    expect(limited[0].confidence).toBe(maxConfidence);
  });
});

function makeCandidate(
  startIndex: number,
  endIndex: number,
  confidence: number,
): PatternCandidate {
  return {
    id: `candidate-${startIndex}` as CandidateId,
    pair: "EUR/USD",
    patternType: "pin_bar",
    startIndex,
    endIndex,
    keyPriceLevels: {
      entry: 1.1,
      stopLoss: 1.09,
      takeProfit: 1.12,
      anchorPrices: [],
    },
    confidence,
    contextSnapshot: {
      trendState: null,
      nearestSupport: null,
      nearestResistance: null,
      atr: null,
      rsi: null,
    },
  };
}

describe(deduplicateOverlapping, () => {
  test("returns empty for empty input", () => {
    expect(deduplicateOverlapping([])).toEqual([]);
  });

  test("keeps non-overlapping candidates", () => {
    const candidates = [makeCandidate(0, 2, 0.8), makeCandidate(5, 7, 0.6)];
    expect(deduplicateOverlapping(candidates)).toHaveLength(2);
  });

  test("removes overlapping candidate with lower confidence", () => {
    const candidates = [makeCandidate(0, 3, 0.5), makeCandidate(2, 5, 0.8)];
    const result = deduplicateOverlapping(candidates);
    expect(result).toHaveLength(1);
    expect(result[0].confidence).toBe(0.8);
  });

  test("keeps both when ranges are adjacent but not overlapping", () => {
    const candidates = [makeCandidate(0, 2, 0.5), makeCandidate(3, 5, 0.8)];
    expect(deduplicateOverlapping(candidates)).toHaveLength(2);
  });

  test("handles single-candle patterns at same index", () => {
    const candidates = [makeCandidate(3, 3, 0.9), makeCandidate(3, 3, 0.4)];
    const result = deduplicateOverlapping(candidates);
    expect(result).toHaveLength(1);
    expect(result[0].confidence).toBe(0.9);
  });
});
