import { describe, expect, test } from "vitest";
import {
  detectSwingHighs,
  detectSwingLows,
  clusterLevels,
  detectSupportResistanceLevels,
  scoreSupportResistanceLevels,
  findNearestLevels,
  distanceInPips,
  distanceInAtr,
  classifyTrendState,
  identifyTradingSession,
  findNearestRoundNumber,
} from "./context-features";

function makeCandle(high: number, low: number, close?: number) {
  return { high, low, close: close ?? (high + low) / 2 };
}

describe(detectSwingHighs, () => {
  test("detects obvious swing high with window=2", () => {
    const candles = [
      makeCandle(1.0, 0.9),
      makeCandle(1.1, 1.0),
      makeCandle(1.5, 1.3),
      makeCandle(1.1, 1.0),
      makeCandle(1.0, 0.9),
    ];
    const highs = detectSwingHighs(candles, 2);
    expect(highs).toEqual([1.5]);
  });

  test("returns empty for flat data", () => {
    const candles = Array.from({ length: 20 }, () => makeCandle(1.0, 0.9));
    expect(detectSwingHighs(candles, 5)).toEqual([]);
  });
});

describe(detectSwingLows, () => {
  test("detects obvious swing low with window=2", () => {
    const candles = [
      makeCandle(1.5, 1.3),
      makeCandle(1.2, 1.1),
      makeCandle(1.0, 0.8),
      makeCandle(1.2, 1.1),
      makeCandle(1.5, 1.3),
    ];
    const lows = detectSwingLows(candles, 2);
    expect(lows).toEqual([0.8]);
  });
});

describe(clusterLevels, () => {
  test("clusters nearby levels together", () => {
    const levels = [1.0, 1.001, 1.002, 1.05, 1.051];
    const clustered = clusterLevels(levels, 0.005);
    expect(clustered).toHaveLength(2);
    expect(clustered[0]).toBeCloseTo(1.001, 3);
    expect(clustered[1]).toBeCloseTo(1.0505, 3);
  });

  test("returns empty for empty input", () => {
    expect(clusterLevels([], 0.005)).toEqual([]);
  });

  test("single level returns itself", () => {
    expect(clusterLevels([1.05], 0.005)).toEqual([1.05]);
  });
});

describe(detectSupportResistanceLevels, () => {
  test("returns empty when not enough candles", () => {
    const candles = Array.from({ length: 5 }, () => makeCandle(1.0, 0.9));
    expect(detectSupportResistanceLevels(candles, 100, 5)).toEqual([]);
  });
});

describe(scoreSupportResistanceLevels, () => {
  test("returns empty when not enough candles", () => {
    const candles = Array.from({ length: 5 }, () => makeCandle(1.0, 0.9));
    expect(scoreSupportResistanceLevels(candles, 100, 5)).toEqual([]);
  });

  test("returns scored levels with touch count and recency", () => {
    const candles = [
      makeCandle(1.0, 0.9),
      makeCandle(1.1, 1.0),
      makeCandle(1.5, 1.3),
      makeCandle(1.1, 1.0),
      makeCandle(1.0, 0.9),
      makeCandle(1.1, 1.0),
      makeCandle(1.5, 1.3),
      makeCandle(1.1, 1.0),
      makeCandle(1.0, 0.9),
      makeCandle(1.1, 1.0),
      makeCandle(1.5, 1.3),
      makeCandle(1.1, 1.0),
      makeCandle(1.0, 0.9),
    ];
    const levels = scoreSupportResistanceLevels(candles, 100, 2);
    expect(levels.length).toBeGreaterThan(0);
    for (const level of levels) {
      expect(level.touchCount).toBeGreaterThanOrEqual(1);
      expect(level.recencyScore).toBeGreaterThanOrEqual(0);
      expect(level.recencyScore).toBeLessThanOrEqual(1);
      expect(level.qualityScore).toBeGreaterThanOrEqual(0);
      expect(level.qualityScore).toBeLessThanOrEqual(1);
    }
  });

  test("recent levels have higher recency score than old levels", () => {
    const candles: { high: number; low: number; close: number }[] = [];
    for (let i = 0; i < 30; i++) {
      candles.push(
        makeCandle(
          1.1 + Math.sin(i * 0.3) * 0.05,
          1.0 + Math.sin(i * 0.3) * 0.05,
        ),
      );
    }
    candles.push(makeCandle(1.0, 0.9));
    candles.push(makeCandle(0.95, 0.85));
    candles.push(makeCandle(1.0, 0.9));
    candles.push(makeCandle(1.05, 0.95));
    candles.push(makeCandle(1.1, 1.0));

    const levels = scoreSupportResistanceLevels(candles, 100, 2);
    if (levels.length >= 2) {
      const sorted = [...levels].sort(
        (a, b) => b.recencyScore - a.recencyScore,
      );
      expect(sorted[0].recencyScore).toBeGreaterThan(
        sorted[sorted.length - 1].recencyScore,
      );
    }
  });

  test("levels touched multiple times have higher quality", () => {
    const candles = [
      makeCandle(1.0, 0.9),
      makeCandle(1.1, 1.0),
      makeCandle(1.5, 1.3),
      makeCandle(1.1, 1.0),
      makeCandle(1.0, 0.9),
      makeCandle(1.1, 1.0),
      makeCandle(1.5, 1.3),
      makeCandle(1.1, 1.0),
      makeCandle(1.0, 0.9),
    ];
    const levels = scoreSupportResistanceLevels(candles, 100, 2);
    for (const level of levels) {
      if (level.touchCount > 1) {
        expect(level.qualityScore).toBeGreaterThan(0);
      }
    }
  });
});

describe(findNearestLevels, () => {
  test("finds support below and resistance above", () => {
    const levels = [1.05, 1.1, 1.15, 1.2];
    const result = findNearestLevels(1.12, levels);
    expect(result).toEqual({ support: 1.1, resistance: 1.15 });
  });

  test("returns null support when price is below all levels", () => {
    const result = findNearestLevels(1.0, [1.05, 1.1]);
    expect(result).toEqual({ support: null, resistance: 1.05 });
  });

  test("returns null resistance when price is above all levels", () => {
    const result = findNearestLevels(1.25, [1.05, 1.1, 1.2]);
    expect(result).toEqual({ support: 1.2, resistance: null });
  });

  test("returns nulls for empty levels", () => {
    expect(findNearestLevels(1.1, [])).toEqual({
      support: null,
      resistance: null,
    });
  });
});

describe(distanceInPips, () => {
  test("calculates correct pip distance for standard pairs", () => {
    expect(distanceInPips(1.105, 1.1)).toBeCloseTo(50, 0);
  });

  test("is always positive", () => {
    expect(distanceInPips(1.1, 1.15)).toBeCloseTo(500, 0);
    expect(distanceInPips(1.15, 1.1)).toBeCloseTo(500, 0);
  });

  test("uses 100 multiplier for JPY pairs", () => {
    expect(distanceInPips(150.5, 150.0, "USD/JPY")).toBeCloseTo(50, 0);
    expect(distanceInPips(165.25, 165.0, "EUR/JPY")).toBeCloseTo(25, 0);
  });

  test("uses 10000 multiplier when pair is undefined", () => {
    expect(distanceInPips(1.105, 1.1)).toBeCloseTo(50, 0);
  });
});

describe(distanceInAtr, () => {
  test("calculates ATR-normalized distance", () => {
    expect(distanceInAtr(1.1, 1.09, 0.005)).toBeCloseTo(2.0, 1);
  });

  test("returns null when ATR is null", () => {
    expect(distanceInAtr(1.1, 1.09, null)).toBeNull();
  });

  test("returns null when ATR is zero", () => {
    expect(distanceInAtr(1.1, 1.09, 0)).toBeNull();
  });
});

describe(classifyTrendState, () => {
  test("strong uptrend: ADX>25, close>EMA200, SMA20>SMA50", () => {
    expect(classifyTrendState(1.12, 1.1, 1.05, 30, 1.11)).toBe(
      "strong_uptrend",
    );
  });

  test("weak uptrend: ADX<=25, close>EMA200", () => {
    expect(classifyTrendState(1.12, 1.1, 1.05, 20, 1.11)).toBe("weak_uptrend");
  });

  test("strong downtrend: ADX>25, close<EMA200, SMA20<SMA50", () => {
    expect(classifyTrendState(1.05, 1.08, 1.15, 30, 1.1)).toBe(
      "strong_downtrend",
    );
  });

  test("weak downtrend: ADX<=25, close<EMA200", () => {
    expect(classifyTrendState(1.05, 1.08, 1.15, 20, 1.1)).toBe(
      "weak_downtrend",
    );
  });

  test("ranging: ADX>25, above EMA200 but SMA20<SMA50", () => {
    expect(classifyTrendState(1.08, 1.1, 1.05, 30, 1.11)).toBe("ranging");
  });

  test("returns null when any indicator is null", () => {
    expect(classifyTrendState(null, 1.1, 1.05, 30, 1.11)).toBeNull();
    expect(classifyTrendState(1.12, null, 1.05, 30, 1.11)).toBeNull();
    expect(classifyTrendState(1.12, 1.1, null, 30, 1.11)).toBeNull();
    expect(classifyTrendState(1.12, 1.1, 1.05, null, 1.11)).toBeNull();
  });
});

describe(identifyTradingSession, () => {
  test("returns daily for D timeframe regardless of hour", () => {
    expect(identifyTradingSession(new Date("2024-01-15T10:00:00Z"), "D")).toBe(
      "daily",
    );
    expect(identifyTradingSession(new Date("2024-01-15T03:00:00Z"), "D")).toBe(
      "daily",
    );
  });

  test("returns asian for 00:00-07:59 UTC", () => {
    expect(identifyTradingSession(new Date("2024-01-15T00:00:00Z"), "H1")).toBe(
      "asian",
    );
    expect(identifyTradingSession(new Date("2024-01-15T07:59:00Z"), "H4")).toBe(
      "asian",
    );
  });

  test("returns london for 08:00-12:59 UTC", () => {
    expect(identifyTradingSession(new Date("2024-01-15T08:00:00Z"), "H1")).toBe(
      "london",
    );
    expect(
      identifyTradingSession(new Date("2024-01-15T12:00:00Z"), "M15"),
    ).toBe("london");
  });

  test("returns new_york for 13:00-20:59 UTC", () => {
    expect(identifyTradingSession(new Date("2024-01-15T13:00:00Z"), "H1")).toBe(
      "new_york",
    );
    expect(
      identifyTradingSession(new Date("2024-01-15T20:00:00Z"), "M15"),
    ).toBe("new_york");
  });

  test("returns off_hours for 21:00-23:59 UTC", () => {
    expect(identifyTradingSession(new Date("2024-01-15T21:00:00Z"), "H1")).toBe(
      "off_hours",
    );
    expect(
      identifyTradingSession(new Date("2024-01-15T23:30:00Z"), "M15"),
    ).toBe("off_hours");
  });

  test("defaults to session-based when no timeframe provided", () => {
    expect(identifyTradingSession(new Date("2024-01-15T10:00:00Z"))).toBe(
      "london",
    );
  });
});

describe(findNearestRoundNumber, () => {
  test("finds nearest major round number", () => {
    expect(findNearestRoundNumber(1.0982)).toBeCloseTo(1.1, 4);
  });

  test("finds nearest half-round when closer", () => {
    expect(findNearestRoundNumber(1.0524)).toBeCloseTo(1.05, 4);
  });

  test("handles exact round number", () => {
    expect(findNearestRoundNumber(1.1)).toBeCloseTo(1.1, 4);
  });

  test("handles exact half-round", () => {
    expect(findNearestRoundNumber(1.055)).toBeCloseTo(1.055, 4);
  });
});
