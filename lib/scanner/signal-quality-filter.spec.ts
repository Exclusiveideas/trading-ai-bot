import fc from "fast-check";
import { describe, expect, test } from "vitest";
import type { HtfSnapshot } from "./feature-vector";
import type {
  SignalFilterConfig,
  SignalFilterInput,
} from "./signal-quality-filter";
import {
  calculateCompositeScore,
  checkConfidence,
  checkHtfAlignment,
  checkMlThresholds,
  checkMinRiskReward,
  checkQualityThreshold,
  checkTradingSession,
  checkV3Mfe,
  getImmediateHigherTf,
  htfAlignmentScore,
  runSignalQualityFilters,
} from "./signal-quality-filter";

function makeHtfContexts(
  tf: string,
  trendState: string | null,
): Record<string, HtfSnapshot | null> {
  return {
    [tf]: {
      rsi: 50,
      adx: 25,
      macdHistogram: 0,
      close: 1.1,
      sma20: 1.1,
      sma50: 1.1,
      ema200: 1.1,
      bbUpper: 1.15,
      bbLower: 1.05,
      atr: 0.001,
      trendState: trendState as HtfSnapshot["trendState"],
    },
  };
}

const passingConfig: SignalFilterConfig = {
  minQualityRating: 6,
  minWinProb: 0.55,
  requireBothMlModels: true,
  minRiskReward: 1.5,
  minConfidence: 0.55,
  minV3Mfe: 0.5,
  rejectOffHours: true,
  rejectAsianForEurPairs: true,
  minCompositeScore: 0.55,
};

function makePassingInput(
  overrides: Partial<SignalFilterInput> = {},
): SignalFilterInput {
  return {
    qualityRating: 8,
    confidence: 0.7,
    v1WinProb: 0.65,
    v2MfeBucket: "1.5-2R",
    v3MfePrediction: 1.2,
    entryPrice: 1.1,
    stopLoss: 1.095,
    takeProfit: 1.115,
    direction: "bullish",
    pair: "EUR/USD",
    timeframe: "H4",
    tradingSession: "london",
    htfContexts: makeHtfContexts("d", "weak_uptrend"),
    ...overrides,
  };
}

describe("checkQualityThreshold", () => {
  test("passes when quality meets threshold", () => {
    expect(checkQualityThreshold(7, 6)).toEqual({
      passed: true,
      reason: "",
    });
  });

  test("passes at exact threshold", () => {
    expect(checkQualityThreshold(6, 6)).toEqual({
      passed: true,
      reason: "",
    });
  });

  test("rejects below threshold", () => {
    const result = checkQualityThreshold(5, 6);
    expect(result.passed).toBe(false);
    expect(result.reason).toContain("quality 5 < 6");
  });
});

describe("checkMlThresholds", () => {
  test("passes when both v1 and v2 pass (requireBoth=true)", () => {
    expect(checkMlThresholds(0.6, "1.5-2R", 0.55, true)).toEqual({
      passed: true,
      reason: "",
    });
  });

  test("rejects when v1 passes but v2 fails (requireBoth=true)", () => {
    const result = checkMlThresholds(0.6, "0.5-1R", 0.55, true);
    expect(result.passed).toBe(false);
    expect(result.reason).toContain("bucket=0.5-1R FAIL");
  });

  test("rejects when v2 passes but v1 fails (requireBoth=true)", () => {
    const result = checkMlThresholds(0.4, "2R+", 0.55, true);
    expect(result.passed).toBe(false);
    expect(result.reason).toContain("win=40% FAIL");
  });

  test("passes when either passes (requireBoth=false)", () => {
    expect(checkMlThresholds(0.6, "0-0.5R", 0.55, false)).toEqual({
      passed: true,
      reason: "",
    });
  });

  test("rejects when both fail (requireBoth=false)", () => {
    const result = checkMlThresholds(0.4, "0-0.5R", 0.55, false);
    expect(result.passed).toBe(false);
  });

  test("accepts all profitable MFE buckets", () => {
    for (const bucket of ["1-1.5R", "1.5-2R", "2R+"]) {
      expect(checkMlThresholds(0.6, bucket, 0.55, true).passed).toBe(true);
    }
  });

  test("rejects non-profitable MFE buckets", () => {
    for (const bucket of ["0-0.5R", "0.5-1R"]) {
      expect(checkMlThresholds(0.6, bucket, 0.55, true).passed).toBe(false);
    }
  });
});

describe("checkMinRiskReward", () => {
  test("passes when R:R meets threshold", () => {
    // entry=1.1, sl=1.095, tp=1.115 → risk=0.005, reward=0.015 → R:R=3.0
    expect(checkMinRiskReward(1.1, 1.095, 1.115, 1.5)).toEqual({
      passed: true,
      reason: "",
    });
  });

  test("rejects when R:R below threshold", () => {
    // entry=1.1, sl=1.095, tp=1.103 → risk=0.005, reward=0.003 → R:R=0.6
    const result = checkMinRiskReward(1.1, 1.095, 1.103, 1.5);
    expect(result.passed).toBe(false);
    expect(result.reason).toContain("rr 0.60 < 1.5");
  });

  test("rejects zero risk distance", () => {
    const result = checkMinRiskReward(1.1, 1.1, 1.115, 1.5);
    expect(result.passed).toBe(false);
    expect(result.reason).toContain("zero risk");
  });

  test("works for bearish signals (SL above entry)", () => {
    // entry=1.1, sl=1.105, tp=1.085 → risk=0.005, reward=0.015 → R:R=3.0
    expect(checkMinRiskReward(1.1, 1.105, 1.085, 1.5)).toEqual({
      passed: true,
      reason: "",
    });
  });
});

describe("checkConfidence", () => {
  test("passes above threshold", () => {
    expect(checkConfidence(0.7, 0.55)).toEqual({ passed: true, reason: "" });
  });

  test("rejects below threshold", () => {
    const result = checkConfidence(0.4, 0.55);
    expect(result.passed).toBe(false);
    expect(result.reason).toContain("confidence 0.40 < 0.55");
  });
});

describe("checkV3Mfe", () => {
  test("passes above threshold", () => {
    expect(checkV3Mfe(1.2, 0.5)).toEqual({ passed: true, reason: "" });
  });

  test("rejects below threshold", () => {
    const result = checkV3Mfe(0.3, 0.5);
    expect(result.passed).toBe(false);
    expect(result.reason).toContain("v3_mfe 0.30 < 0.5");
  });

  test("passes when v3 is null (model unavailable)", () => {
    expect(checkV3Mfe(null, 0.5)).toEqual({ passed: true, reason: "" });
  });
});

describe("checkTradingSession", () => {
  test("rejects off_hours", () => {
    const result = checkTradingSession("EUR/USD", "off_hours", true, true);
    expect(result.passed).toBe(false);
    expect(result.reason).toContain("off_hours");
  });

  test("allows off_hours when disabled", () => {
    expect(checkTradingSession("EUR/USD", "off_hours", false, true)).toEqual({
      passed: true,
      reason: "",
    });
  });

  test("rejects asian for EUR pairs", () => {
    const result = checkTradingSession("EUR/USD", "asian", true, true);
    expect(result.passed).toBe(false);
    expect(result.reason).toContain("asian rejected for EUR/USD");
  });

  test("rejects asian for GBP pairs", () => {
    const result = checkTradingSession("GBP/USD", "asian", true, true);
    expect(result.passed).toBe(false);
  });

  test("allows asian for JPY pairs", () => {
    expect(checkTradingSession("USD/JPY", "asian", true, true)).toEqual({
      passed: true,
      reason: "",
    });
  });

  test("allows asian for AUD pairs", () => {
    expect(checkTradingSession("AUD/NZD", "asian", true, true)).toEqual({
      passed: true,
      reason: "",
    });
  });

  test("passes null session", () => {
    expect(checkTradingSession("EUR/USD", null, true, true)).toEqual({
      passed: true,
      reason: "",
    });
  });

  test("passes daily session", () => {
    expect(checkTradingSession("EUR/USD", "daily", true, true)).toEqual({
      passed: true,
      reason: "",
    });
  });

  test("allows london and new_york for all pairs", () => {
    expect(checkTradingSession("EUR/USD", "london", true, true)).toEqual({
      passed: true,
      reason: "",
    });
    expect(checkTradingSession("EUR/USD", "new_york", true, true)).toEqual({
      passed: true,
      reason: "",
    });
  });
});

describe("getImmediateHigherTf", () => {
  test("returns correct higher timeframe", () => {
    expect(getImmediateHigherTf("M15")).toBe("H1");
    expect(getImmediateHigherTf("H1")).toBe("H4");
    expect(getImmediateHigherTf("H4")).toBe("D");
  });

  test("returns null for daily (no higher TF)", () => {
    expect(getImmediateHigherTf("D")).toBeNull();
  });
});

describe("checkHtfAlignment", () => {
  test("rejects bullish signal with strong_downtrend HTF", () => {
    const result = checkHtfAlignment(
      "bullish",
      "H4",
      makeHtfContexts("d", "strong_downtrend"),
    );
    expect(result.passed).toBe(false);
    expect(result.reason).toContain("bullish vs D strong_downtrend");
  });

  test("rejects bearish signal with strong_uptrend HTF", () => {
    const result = checkHtfAlignment(
      "bearish",
      "H1",
      makeHtfContexts("h4", "strong_uptrend"),
    );
    expect(result.passed).toBe(false);
    expect(result.reason).toContain("bearish vs H4 strong_uptrend");
  });

  test("allows bullish signal with uptrend HTF", () => {
    expect(
      checkHtfAlignment(
        "bullish",
        "H4",
        makeHtfContexts("d", "strong_uptrend"),
      ),
    ).toEqual({ passed: true, reason: "" });
  });

  test("allows signal with ranging HTF", () => {
    expect(
      checkHtfAlignment("bullish", "H4", makeHtfContexts("d", "ranging")),
    ).toEqual({ passed: true, reason: "" });
  });

  test("passes for daily timeframe (no higher TF)", () => {
    expect(checkHtfAlignment("bullish", "D", {})).toEqual({
      passed: true,
      reason: "",
    });
  });

  test("passes when HTF snapshot is null", () => {
    expect(checkHtfAlignment("bullish", "H4", { d: null })).toEqual({
      passed: true,
      reason: "",
    });
  });
});

describe("htfAlignmentScore", () => {
  test("returns 1.0 for fully aligned bullish", () => {
    expect(
      htfAlignmentScore(
        "bullish",
        "H4",
        makeHtfContexts("d", "strong_uptrend"),
      ),
    ).toBe(1.0);
  });

  test("returns 0.0 for fully counter-trend bullish", () => {
    expect(
      htfAlignmentScore(
        "bullish",
        "H4",
        makeHtfContexts("d", "strong_downtrend"),
      ),
    ).toBe(0.0);
  });

  test("returns 0.5 for ranging", () => {
    expect(
      htfAlignmentScore("bullish", "H4", makeHtfContexts("d", "ranging")),
    ).toBe(0.5);
  });

  test("returns 1.0 for fully aligned bearish", () => {
    expect(
      htfAlignmentScore(
        "bearish",
        "H4",
        makeHtfContexts("d", "strong_downtrend"),
      ),
    ).toBe(1.0);
  });

  test("returns 0.5 when no higher TF available", () => {
    expect(htfAlignmentScore("bullish", "D", {})).toBe(0.5);
  });
});

describe("calculateCompositeScore", () => {
  test("returns expected weighted score", () => {
    // quality=8/10=0.8, winProb=0.65, rr=3.0→min(1,1)=1.0, v3=1.2→min(0.6,1)=0.6, htf=1.0
    // 0.2*0.8 + 0.3*0.65 + 0.2*1.0 + 0.15*0.6 + 0.15*1.0
    // = 0.16 + 0.195 + 0.2 + 0.09 + 0.15 = 0.795
    expect(calculateCompositeScore(8, 0.65, 3.0, 1.2, 1.0)).toBeCloseTo(
      0.795,
      3,
    );
  });

  test("uses 0.5 default for null v3", () => {
    // v3=null → uses 0.5 → mfeNorm = 0.5/2 = 0.25
    const withNull = calculateCompositeScore(8, 0.65, 3.0, null, 1.0);
    const withDefault = calculateCompositeScore(8, 0.65, 3.0, 0.5, 1.0);
    expect(withNull).toBeCloseTo(withDefault, 5);
  });

  test("caps R:R normalization at 1.0", () => {
    const rr3 = calculateCompositeScore(8, 0.65, 3.0, 1.0, 1.0);
    const rr5 = calculateCompositeScore(8, 0.65, 5.0, 1.0, 1.0);
    expect(rr3).toBeCloseTo(rr5, 5);
  });

  test("caps MFE normalization at 1.0", () => {
    const mfe2 = calculateCompositeScore(8, 0.65, 2.0, 2.0, 1.0);
    const mfe5 = calculateCompositeScore(8, 0.65, 2.0, 5.0, 1.0);
    expect(mfe2).toBeCloseTo(mfe5, 5);
  });

  test("composite score is always between 0 and 1", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        fc.float({ min: 0, max: 1, noNaN: true }),
        fc.float({ min: 0, max: 10, noNaN: true }),
        fc.float({ min: -1, max: 5, noNaN: true }),
        fc.float({ min: 0, max: 1, noNaN: true }),
        (quality, winProb, rr, v3, htf) => {
          const score = calculateCompositeScore(quality, winProb, rr, v3, htf);
          return score >= 0 && score <= 1;
        },
      ),
    );
  });
});

describe("runSignalQualityFilters", () => {
  test("passes signal that meets all criteria", () => {
    const result = runSignalQualityFilters(makePassingInput(), passingConfig);
    expect(result).toEqual({
      passed: true,
      rejections: [],
      compositeScore: expect.any(Number),
    });
    expect(result.compositeScore).toBeGreaterThan(0.55);
  });

  test("rejects signal failing quality threshold", () => {
    const result = runSignalQualityFilters(
      makePassingInput({ qualityRating: 4 }),
      passingConfig,
    );
    expect(result.passed).toBe(false);
    expect(result.rejections).toContain("quality 4 < 6");
  });

  test("rejects signal failing ML threshold", () => {
    const result = runSignalQualityFilters(
      makePassingInput({ v1WinProb: 0.4, v2MfeBucket: "0-0.5R" }),
      passingConfig,
    );
    expect(result.passed).toBe(false);
    expect(result.rejections.some((r) => r.includes("ml_threshold"))).toBe(
      true,
    );
  });

  test("rejects signal with poor R:R", () => {
    const result = runSignalQualityFilters(
      makePassingInput({ takeProfit: 1.103 }),
      passingConfig,
    );
    expect(result.passed).toBe(false);
    expect(result.rejections.some((r) => r.includes("rr"))).toBe(true);
  });

  test("rejects signal with low confidence", () => {
    const result = runSignalQualityFilters(
      makePassingInput({ confidence: 0.3 }),
      passingConfig,
    );
    expect(result.passed).toBe(false);
    expect(result.rejections.some((r) => r.includes("confidence"))).toBe(true);
  });

  test("rejects signal with low v3 MFE", () => {
    const result = runSignalQualityFilters(
      makePassingInput({ v3MfePrediction: 0.1 }),
      passingConfig,
    );
    expect(result.passed).toBe(false);
    expect(result.rejections.some((r) => r.includes("v3_mfe"))).toBe(true);
  });

  test("rejects off_hours signal", () => {
    const result = runSignalQualityFilters(
      makePassingInput({ tradingSession: "off_hours" }),
      passingConfig,
    );
    expect(result.passed).toBe(false);
    expect(result.rejections.some((r) => r.includes("off_hours"))).toBe(true);
  });

  test("rejects counter-trend HTF signal", () => {
    const result = runSignalQualityFilters(
      makePassingInput({
        direction: "bullish",
        htfContexts: makeHtfContexts("d", "strong_downtrend"),
      }),
      passingConfig,
    );
    expect(result.passed).toBe(false);
    expect(result.rejections.some((r) => r.includes("htf_alignment"))).toBe(
      true,
    );
  });

  test("collects multiple rejections", () => {
    const result = runSignalQualityFilters(
      makePassingInput({
        qualityRating: 4,
        confidence: 0.3,
        tradingSession: "off_hours",
      }),
      passingConfig,
    );
    expect(result.passed).toBe(false);
    expect(result.rejections.length).toBeGreaterThanOrEqual(3);
  });

  test("rejects when composite score is too low", () => {
    const result = runSignalQualityFilters(
      makePassingInput({
        qualityRating: 6,
        v1WinProb: 0.55,
        v2MfeBucket: "1-1.5R",
        confidence: 0.55,
        v3MfePrediction: 0.5,
        htfContexts: makeHtfContexts("d", "strong_downtrend"),
      }),
      { ...passingConfig, minCompositeScore: 0.8 },
    );
    expect(result.passed).toBe(false);
    expect(result.rejections.some((r) => r.includes("composite"))).toBe(true);
  });

  test("includes composite score in result", () => {
    const result = runSignalQualityFilters(makePassingInput(), passingConfig);
    expect(result.compositeScore).toBeGreaterThan(0);
    expect(result.compositeScore).toBeLessThanOrEqual(1);
  });
});
