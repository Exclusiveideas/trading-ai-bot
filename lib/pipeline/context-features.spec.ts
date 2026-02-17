import { describe, expect, test } from "vitest";
import {
  detectSwingHighs,
  detectSwingLows,
  clusterLevels,
  detectSupportResistanceLevels,
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

describe(findNearestLevels, () => {
  test("finds support below and resistance above", () => {
    const levels = [1.05, 1.10, 1.15, 1.20];
    const result = findNearestLevels(1.12, levels);
    expect(result).toEqual({ support: 1.10, resistance: 1.15 });
  });

  test("returns null support when price is below all levels", () => {
    const result = findNearestLevels(1.0, [1.05, 1.10]);
    expect(result).toEqual({ support: null, resistance: 1.05 });
  });

  test("returns null resistance when price is above all levels", () => {
    const result = findNearestLevels(1.25, [1.05, 1.10, 1.20]);
    expect(result).toEqual({ support: 1.20, resistance: null });
  });

  test("returns nulls for empty levels", () => {
    expect(findNearestLevels(1.10, [])).toEqual({
      support: null,
      resistance: null,
    });
  });
});

describe(distanceInPips, () => {
  test("calculates correct pip distance", () => {
    expect(distanceInPips(1.1050, 1.1000)).toBeCloseTo(50, 0);
  });

  test("is always positive", () => {
    expect(distanceInPips(1.10, 1.15)).toBeCloseTo(500, 0);
    expect(distanceInPips(1.15, 1.10)).toBeCloseTo(500, 0);
  });
});

describe(distanceInAtr, () => {
  test("calculates ATR-normalized distance", () => {
    expect(distanceInAtr(1.10, 1.09, 0.005)).toBeCloseTo(2.0, 1);
  });

  test("returns null when ATR is null", () => {
    expect(distanceInAtr(1.10, 1.09, null)).toBeNull();
  });

  test("returns null when ATR is zero", () => {
    expect(distanceInAtr(1.10, 1.09, 0)).toBeNull();
  });
});

describe(classifyTrendState, () => {
  test("strong uptrend: ADX>25, close>EMA200, SMA20>SMA50", () => {
    expect(classifyTrendState(1.12, 1.10, 1.05, 30, 1.11)).toBe("strong_uptrend");
  });

  test("weak uptrend: ADX<=25, close>EMA200", () => {
    expect(classifyTrendState(1.12, 1.10, 1.05, 20, 1.11)).toBe("weak_uptrend");
  });

  test("strong downtrend: ADX>25, close<EMA200, SMA20<SMA50", () => {
    expect(classifyTrendState(1.05, 1.08, 1.15, 30, 1.10)).toBe("strong_downtrend");
  });

  test("weak downtrend: ADX<=25, close<EMA200", () => {
    expect(classifyTrendState(1.05, 1.08, 1.15, 20, 1.10)).toBe("weak_downtrend");
  });

  test("ranging: ADX>25, above EMA200 but SMA20<SMA50", () => {
    expect(classifyTrendState(1.08, 1.10, 1.05, 30, 1.11)).toBe("ranging");
  });

  test("returns null when any indicator is null", () => {
    expect(classifyTrendState(null, 1.10, 1.05, 30, 1.11)).toBeNull();
    expect(classifyTrendState(1.12, null, 1.05, 30, 1.11)).toBeNull();
    expect(classifyTrendState(1.12, 1.10, null, 30, 1.11)).toBeNull();
    expect(classifyTrendState(1.12, 1.10, 1.05, null, 1.11)).toBeNull();
  });
});

describe(identifyTradingSession, () => {
  test("returns daily for any timestamp", () => {
    expect(identifyTradingSession(new Date("2024-01-15T10:00:00Z"))).toBe("daily");
  });
});

describe(findNearestRoundNumber, () => {
  test("finds nearest major round number", () => {
    expect(findNearestRoundNumber(1.0982)).toBeCloseTo(1.10, 4);
  });

  test("finds nearest half-round when closer", () => {
    expect(findNearestRoundNumber(1.0524)).toBeCloseTo(1.05, 4);
  });

  test("handles exact round number", () => {
    expect(findNearestRoundNumber(1.10)).toBeCloseTo(1.10, 4);
  });

  test("handles exact half-round", () => {
    expect(findNearestRoundNumber(1.055)).toBeCloseTo(1.055, 4);
  });
});
