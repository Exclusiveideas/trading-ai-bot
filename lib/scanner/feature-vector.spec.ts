import { describe, expect, test } from "vitest";
import { buildFeatureVector, type HtfSnapshot } from "./feature-vector";
import type { PatternCandidate, CandidateId } from "@/types/trading";
import type { IndicatorRow } from "@/lib/pipeline/indicators";
import { readFileSync } from "fs";
import { resolve } from "path";

const META_PATH = resolve(
  __dirname,
  "../../python/models/xgb_v1b_multipattern_meta.json",
);

describe("buildFeatureVector", () => {
  const expectedFeatures: string[] = JSON.parse(
    readFileSync(META_PATH, "utf-8"),
  ).features;

  const mockCandidate: PatternCandidate = {
    id: "test-id" as CandidateId,
    pair: "EUR/USD",
    patternType: "pin_bar",
    startIndex: 290,
    endIndex: 295,
    keyPriceLevels: {
      entry: 1.085,
      stopLoss: 1.082,
      takeProfit: 1.091,
      anchorPrices: [],
    },
    confidence: 0.8,
    contextSnapshot: {
      trendState: "weak_uptrend",
      nearestSupport: 1.08,
      nearestResistance: 1.09,
      atr: 0.0012,
      rsi: 55,
    },
  };

  const mockCandle = {
    open: 1.084,
    high: 1.087,
    low: 1.081,
    close: 1.085,
    volume: 12345,
  };

  const mockIndicators: IndicatorRow = {
    sma20: 1.083,
    sma50: 1.08,
    ema200: 1.075,
    rsi: 55,
    macd: 0.0003,
    macdSignal: 0.0002,
    macdHistogram: 0.0001,
    adx: 28,
    atr: 0.0012,
    bbUpper: 1.088,
    bbMiddle: 1.083,
    bbLower: 1.078,
    volumeSma: 10000,
  };

  const mockContext = {
    distToSupportPips: 50,
    distToResistancePips: 50,
    distToSupportAtr: 0.42,
    distToResistanceAtr: 0.42,
    distToRoundNumberPips: 10,
    trendState: "weak_uptrend" as const,
    tradingSession: "london",
  };

  const mockHtf: Record<string, HtfSnapshot | null> = {
    d: {
      rsi: 60,
      adx: 30,
      macdHistogram: 0.002,
      close: 1.085,
      sma20: 1.082,
      sma50: 1.079,
      ema200: 1.07,
      bbUpper: 1.09,
      bbLower: 1.075,
      atr: 0.005,
      trendState: "strong_uptrend",
    },
    h4: {
      rsi: 58,
      adx: 26,
      macdHistogram: 0.001,
      close: 1.085,
      sma20: 1.083,
      sma50: 1.081,
      ema200: 1.073,
      bbUpper: 1.089,
      bbLower: 1.077,
      atr: 0.003,
      trendState: "weak_uptrend",
    },
    h1: null,
  };

  test("produces exactly 104 features matching meta JSON", () => {
    const vector = buildFeatureVector(
      mockCandidate,
      mockCandle,
      mockIndicators,
      mockContext,
      "M15",
      mockHtf,
    );

    const keys = Object.keys(vector);
    expect(keys.length).toBe(104);
    expect(keys.sort()).toEqual([...expectedFeatures].sort());
  });

  test("feature names match meta JSON exactly", () => {
    const vector = buildFeatureVector(
      mockCandidate,
      mockCandle,
      mockIndicators,
      mockContext,
      "M15",
      mockHtf,
    );

    for (const name of expectedFeatures) {
      expect(vector).toHaveProperty(name);
    }
  });

  test("one-hot encoding sums to 1 for each category", () => {
    const vector = buildFeatureVector(
      mockCandidate,
      mockCandle,
      mockIndicators,
      mockContext,
      "M15",
      mockHtf,
    );

    const patternSum = expectedFeatures
      .filter((f) => f.startsWith("pattern_type_"))
      .reduce((sum, f) => sum + (vector[f] ?? 0), 0);
    expect(patternSum).toBe(1);

    const tfSum = expectedFeatures
      .filter((f) => f.startsWith("timeframe_"))
      .reduce((sum, f) => sum + (vector[f] ?? 0), 0);
    expect(tfSum).toBe(1);

    const trendSum = expectedFeatures
      .filter((f) => f.startsWith("trend_state_") && !f.startsWith("trend_state_unknown"))
      .concat(["trend_state_unknown"])
      .filter((f) => expectedFeatures.includes(f) && !f.startsWith("htf_"))
      .reduce((sum, f) => sum + (vector[f] ?? 0), 0);

    // Filter just the top-level trend_state one-hots
    const trendKeys = expectedFeatures.filter(
      (f) => f.startsWith("trend_state_") && !f.includes("htf_"),
    );
    const actualTrendSum = trendKeys.reduce(
      (sum, f) => sum + (vector[f] ?? 0),
      0,
    );
    expect(actualTrendSum).toBe(1);
  });

  test("HTF features are null for inapplicable timeframes", () => {
    const vector = buildFeatureVector(
      mockCandidate,
      mockCandle,
      mockIndicators,
      mockContext,
      "D",
      mockHtf,
    );

    // D timeframe has no higher TFs — all HTF features should be null
    const htfKeys = expectedFeatures.filter((f) => f.startsWith("htf_"));
    for (const key of htfKeys) {
      if (key.includes("trend_state_")) {
        // One-hot for unknown trend state should be 1, rest 0
        continue;
      }
      expect(vector[key]).toBeNull();
    }
  });

  test("derived features compute correctly", () => {
    const vector = buildFeatureVector(
      mockCandidate,
      mockCandle,
      mockIndicators,
      mockContext,
      "H1",
      mockHtf,
    );

    // body_ratio = |close - open| / (high - low) = |1.085 - 1.084| / (1.087 - 1.081) = 0.001 / 0.006
    expect(vector.body_ratio).toBeCloseTo(0.001 / 0.006, 3);

    // bb_width = (bbUpper - bbLower) / bbMiddle = (1.088 - 1.078) / 1.083
    expect(vector.bb_width).toBeCloseTo((1.088 - 1.078) / 1.083, 5);

    // volatility_regime = atr / close = 0.0012 / 1.085
    expect(vector.volatility_regime).toBeCloseTo(0.0012 / 1.085, 5);

    // risk_reward_ratio = |tp - entry| / |entry - sl| = |1.091 - 1.085| / |1.085 - 1.082| = 0.006 / 0.003 = 2
    expect(vector.risk_reward_ratio).toBe(2);
  });
});
