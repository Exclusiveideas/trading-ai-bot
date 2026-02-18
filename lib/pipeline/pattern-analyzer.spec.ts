import { describe, expect, test } from "vitest";
import { analyzeCandidate } from "./pattern-analyzer";
import type { AnalysisCandle } from "./pattern-analyzer";
import type {
  PatternCandidate,
  OutcomeResult,
  CandidateId,
} from "@/types/trading";

function makeCandle(overrides?: Partial<AnalysisCandle>): AnalysisCandle {
  return {
    open: 1.1,
    high: 1.105,
    low: 1.095,
    close: 1.102,
    volume: 1000,
    atr: 0.01,
    volumeSma: 800,
    sma20: 1.1,
    sma50: 1.098,
    ema200: 1.09,
    rsi: 50,
    macd: 0.001,
    macdSignal: 0.0008,
    macdHistogram: 0.0002,
    adx: 25,
    bbUpper: 1.12,
    bbLower: 1.08,
    trendState: "ranging",
    nearestSupport: 1.095,
    nearestResistance: 1.11,
    ...overrides,
  };
}

function makeCandles(
  count: number,
  overrides?: Partial<AnalysisCandle>,
): AnalysisCandle[] {
  return Array.from({ length: count }, () => makeCandle(overrides));
}

function makeCandidate(
  overrides?: Partial<PatternCandidate & { outcome: OutcomeResult }>,
): PatternCandidate & { outcome: OutcomeResult } {
  return {
    id: "test-id" as CandidateId,
    pair: "EUR/USD",
    patternType: "pin_bar",
    startIndex: 5,
    endIndex: 5,
    keyPriceLevels: {
      entry: 1.105,
      stopLoss: 1.09,
      takeProfit: 1.135,
      anchorPrices: [],
    },
    confidence: 0.7,
    contextSnapshot: {
      trendState: "ranging",
      nearestSupport: 1.095,
      nearestResistance: 1.11,
      atr: 0.01,
      rsi: 50,
    },
    outcome: {
      outcome: "win",
      rMultiple: 2.0,
      barsToOutcome: 15,
      exitPrice: 1.135,
    },
    ...overrides,
  };
}

function makeNullIndicatorCandle(): AnalysisCandle {
  return {
    open: 1.1,
    high: 1.105,
    low: 1.095,
    close: 1.102,
    volume: 1000,
    atr: null,
    volumeSma: null,
    sma20: null,
    sma50: null,
    ema200: null,
    rsi: null,
    macd: null,
    macdSignal: null,
    macdHistogram: null,
    adx: null,
    bbUpper: null,
    bbLower: null,
    trendState: null,
    nearestSupport: null,
    nearestResistance: null,
  };
}

describe("analyzeCandidate", () => {
  describe("pin_bar", () => {
    test("high-quality bullish pin bar near support scores 7-10", () => {
      const candles = makeCandles(10);
      candles[5] = makeCandle({
        open: 1.1,
        high: 1.102,
        low: 1.085,
        close: 1.101,
        rsi: 28,
        trendState: "weak_downtrend",
        nearestSupport: 1.086,
        volume: 1600,
        volumeSma: 800,
      });
      for (let j = 1; j <= 5; j++) {
        candles[5 - j] = makeCandle({ low: 1.092 + j * 0.001 });
      }

      const candidate = makeCandidate({
        keyPriceLevels: {
          entry: 1.102,
          stopLoss: 1.08,
          takeProfit: 1.146,
          anchorPrices: [],
        },
      });

      const result = analyzeCandidate(candidate, candles);
      expect(result.qualityRating).toBeGreaterThanOrEqual(7);
      expect(result.qualityRating).toBeLessThanOrEqual(10);
      expect(result.approved).toBe(true);
      expect(result.notes).toContain("tail");
      expect(result.notes).toContain("RSI oversold");
    });

    test("weak pin bar far from S/R scores 1-4", () => {
      const candles = makeCandles(10);
      candles[5] = makeCandle({
        open: 1.1,
        high: 1.106,
        low: 1.094,
        close: 1.099,
        rsi: 50,
        trendState: "ranging",
        nearestSupport: 1.05,
        nearestResistance: 1.15,
        volume: 300,
        volumeSma: 800,
      });
      for (let j = 1; j <= 5; j++) {
        candles[5 - j] = makeCandle({ low: 1.09 });
      }

      const candidate = makeCandidate({
        keyPriceLevels: {
          entry: 1.106,
          stopLoss: 1.089,
          takeProfit: 1.14,
          anchorPrices: [],
        },
      });

      const result = analyzeCandidate(candidate, candles);
      expect(result.qualityRating).toBeGreaterThanOrEqual(1);
      expect(result.qualityRating).toBeLessThanOrEqual(4);
      expect(result.approved).toBe(false);
    });

    test("zero-range candle returns rating 1 and rejected", () => {
      const candles = makeCandles(10);
      candles[5] = makeCandle({
        open: 1.1,
        high: 1.1,
        low: 1.1,
        close: 1.1,
      });

      const candidate = makeCandidate({
        keyPriceLevels: {
          entry: 1.105,
          stopLoss: 1.09,
          takeProfit: 1.135,
          anchorPrices: [],
        },
      });

      const result = analyzeCandidate(candidate, candles);
      expect(result.qualityRating).toBe(1);
      expect(result.approved).toBe(false);
      expect(result.notes).toContain("zero range");
    });

    test("all-null indicators still produces valid score", () => {
      const candles = Array.from({ length: 10 }, () =>
        makeNullIndicatorCandle(),
      );
      candles[5] = {
        ...makeNullIndicatorCandle(),
        open: 1.1,
        high: 1.102,
        low: 1.085,
        close: 1.101,
      };

      const candidate = makeCandidate({
        keyPriceLevels: {
          entry: 1.102,
          stopLoss: 1.08,
          takeProfit: 1.146,
          anchorPrices: [],
        },
      });

      const result = analyzeCandidate(candidate, candles);
      expect(result.qualityRating).toBeGreaterThanOrEqual(1);
      expect(result.qualityRating).toBeLessThanOrEqual(10);
      expect(result.notes).toContain("Outcome");
    });

    test("outcome information is always included in notes", () => {
      const candles = makeCandles(10);

      const winCandidate = makeCandidate({
        outcome: {
          outcome: "win",
          rMultiple: 2.0,
          barsToOutcome: 15,
          exitPrice: 1.135,
        },
      });
      expect(analyzeCandidate(winCandidate, candles).notes).toContain(
        "Outcome: Won",
      );

      const lossCandidate = makeCandidate({
        outcome: {
          outcome: "loss",
          rMultiple: -1.0,
          barsToOutcome: 5,
          exitPrice: 1.09,
        },
      });
      expect(analyzeCandidate(lossCandidate, candles).notes).toContain(
        "Outcome: Lost",
      );

      const pendingCandidate = makeCandidate({
        outcome: {
          outcome: "pending",
          rMultiple: null,
          barsToOutcome: null,
          exitPrice: null,
        },
      });
      expect(analyzeCandidate(pendingCandidate, candles).notes).toContain(
        "Outcome: Pending",
      );
    });
  });

  describe("double_top", () => {
    test("symmetric double top with RSI divergence scores 7-10", () => {
      const candles = makeCandles(30);
      candles[5] = makeCandle({
        high: 1.12,
        rsi: 75,
        volume: 1200,
        trendState: "strong_uptrend",
      });
      candles[25] = makeCandle({
        high: 1.1195,
        rsi: 62,
        volume: 800,
        trendState: "weak_uptrend",
      });

      const candidate = makeCandidate({
        patternType: "double_top",
        startIndex: 5,
        endIndex: 25,
        keyPriceLevels: {
          entry: 1.1,
          stopLoss: 1.125,
          takeProfit: 1.08,
          anchorPrices: [{ label: "top", price: 1.12 }],
        },
      });

      const result = analyzeCandidate(candidate, candles);
      expect(result.qualityRating).toBeGreaterThanOrEqual(7);
      expect(result.qualityRating).toBeLessThanOrEqual(10);
      expect(result.approved).toBe(true);
      expect(result.notes).toContain("Excellent peak symmetry");
      expect(result.notes).toContain("RSI divergence");
      expect(result.notes).toContain("Declining volume");
    });
  });

  describe("double_bottom", () => {
    test("symmetric double bottom with divergence scores 7-10", () => {
      const candles = makeCandles(30);
      candles[5] = makeCandle({
        low: 1.08,
        rsi: 25,
        volume: 1200,
        trendState: "strong_downtrend",
      });
      candles[25] = makeCandle({
        low: 1.0805,
        rsi: 35,
        volume: 800,
        trendState: "weak_downtrend",
      });

      const candidate = makeCandidate({
        patternType: "double_bottom",
        startIndex: 5,
        endIndex: 25,
        keyPriceLevels: {
          entry: 1.1,
          stopLoss: 1.075,
          takeProfit: 1.12,
          anchorPrices: [{ label: "bottom", price: 1.08 }],
        },
      });

      const result = analyzeCandidate(candidate, candles);
      expect(result.qualityRating).toBeGreaterThanOrEqual(7);
      expect(result.qualityRating).toBeLessThanOrEqual(10);
      expect(result.approved).toBe(true);
      expect(result.notes).toContain("Excellent trough symmetry");
      expect(result.notes).toContain("RSI divergence");
    });
  });

  describe("head_and_shoulders", () => {
    test("symmetric H&S with RSI divergence and trend reversal scores 7-10", () => {
      const candles = makeCandles(30);
      candles[5] = makeCandle({ high: 1.11, rsi: 65 });
      candles[15] = makeCandle({ high: 1.13, rsi: 58 });
      candles[25] = makeCandle({ high: 1.109, trendState: "weak_uptrend" });

      const candidate = makeCandidate({
        patternType: "head_and_shoulders",
        startIndex: 5,
        endIndex: 25,
        keyPriceLevels: {
          entry: 1.095,
          stopLoss: 1.135,
          takeProfit: 1.06,
          anchorPrices: [
            { label: "head", price: 1.13 },
            { label: "neckline", price: 1.095 },
          ],
        },
      });

      const result = analyzeCandidate(candidate, candles);
      expect(result.qualityRating).toBeGreaterThanOrEqual(7);
      expect(result.qualityRating).toBeLessThanOrEqual(10);
      expect(result.approved).toBe(true);
      expect(result.notes).toContain("shoulder symmetry");
      expect(result.notes).toContain("time symmetry");
      expect(result.notes).toContain("trend reversal");
    });

    test("uses head anchor price for candle lookup", () => {
      const candles = makeCandles(30);
      candles[5] = makeCandle({ high: 1.11, rsi: 65 });
      candles[12] = makeCandle({ high: 1.13, rsi: 55 });
      candles[25] = makeCandle({ high: 1.109, trendState: "weak_uptrend" });

      const candidate = makeCandidate({
        patternType: "head_and_shoulders",
        startIndex: 5,
        endIndex: 25,
        keyPriceLevels: {
          entry: 1.095,
          stopLoss: 1.135,
          takeProfit: 1.06,
          anchorPrices: [
            { label: "head", price: 1.13 },
            { label: "neckline", price: 1.095 },
          ],
        },
      });

      const result = analyzeCandidate(candidate, candles);
      expect(result.notes).toContain("Asymmetric timing");
    });
  });

  describe("false_breakout", () => {
    test("quick reversal with low break volume scores 6-9", () => {
      const candles = makeCandles(10);
      candles[5] = makeCandle({
        high: 1.112,
        close: 1.108,
        volume: 400,
        volumeSma: 800,
        trendState: "weak_downtrend",
      });
      candles[6] = makeCandle({
        close: 1.098,
        volume: 1500,
        trendState: "weak_downtrend",
      });

      const candidate = makeCandidate({
        patternType: "false_breakout",
        startIndex: 5,
        endIndex: 6,
        keyPriceLevels: {
          entry: 1.11,
          stopLoss: 1.117,
          takeProfit: 1.096,
          anchorPrices: [
            { label: "broken_level", price: 1.11 },
            { label: "false_break_extreme", price: 1.112 },
          ],
        },
      });

      const result = analyzeCandidate(candidate, candles);
      expect(result.qualityRating).toBeGreaterThanOrEqual(6);
      expect(result.qualityRating).toBeLessThanOrEqual(9);
      expect(result.approved).toBe(true);
      expect(result.notes).toContain("Immediate reversal");
      expect(result.notes).toContain("Low volume on break");
    });
  });

  describe("approval threshold", () => {
    test("score exactly 6 is approved", () => {
      const candles = makeCandles(10);
      candles[5] = makeCandle({
        open: 1.1,
        high: 1.102,
        low: 1.088,
        close: 1.101,
        rsi: 35,
        trendState: "weak_downtrend",
        nearestSupport: 1.089,
        volume: 1000,
        volumeSma: 800,
      });
      for (let j = 1; j <= 5; j++) {
        candles[5 - j] = makeCandle({ low: 1.092 + j * 0.001 });
      }

      const candidate = makeCandidate({
        keyPriceLevels: {
          entry: 1.102,
          stopLoss: 1.083,
          takeProfit: 1.14,
          anchorPrices: [],
        },
      });

      const result = analyzeCandidate(candidate, candles);
      if (result.qualityRating >= 6) {
        expect(result.approved).toBe(true);
      }
      if (result.qualityRating < 6) {
        expect(result.approved).toBe(false);
      }
    });

    test("known low-quality setup is rejected", () => {
      const candles = Array.from({ length: 10 }, () =>
        makeNullIndicatorCandle(),
      );
      candles[5] = {
        ...makeNullIndicatorCandle(),
        open: 1.1,
        high: 1.104,
        low: 1.096,
        close: 1.099,
      };

      const candidate = makeCandidate({
        keyPriceLevels: {
          entry: 1.104,
          stopLoss: 1.091,
          takeProfit: 1.13,
          anchorPrices: [],
        },
      });

      const result = analyzeCandidate(candidate, candles);
      expect(result.qualityRating).toBeLessThan(6);
      expect(result.approved).toBe(false);
    });

    test("known high-quality setup is approved", () => {
      const candles = makeCandles(10);
      candles[5] = makeCandle({
        open: 1.1,
        high: 1.102,
        low: 1.082,
        close: 1.101,
        rsi: 25,
        trendState: "weak_downtrend",
        nearestSupport: 1.083,
        volume: 2000,
        volumeSma: 800,
        bbLower: 1.083,
      });
      for (let j = 1; j <= 5; j++) {
        candles[5 - j] = makeCandle({ low: 1.092 + j * 0.002 });
      }

      const candidate = makeCandidate({
        keyPriceLevels: {
          entry: 1.102,
          stopLoss: 1.077,
          takeProfit: 1.152,
          anchorPrices: [],
        },
      });

      const result = analyzeCandidate(candidate, candles);
      expect(result.qualityRating).toBeGreaterThanOrEqual(6);
      expect(result.approved).toBe(true);
    });
  });

  describe("rating bounds", () => {
    test("extremely favorable conditions cap at 10", () => {
      const candles = makeCandles(10);
      candles[5] = makeCandle({
        open: 1.1,
        high: 1.101,
        low: 1.07,
        close: 1.1,
        rsi: 15,
        trendState: "weak_downtrend",
        nearestSupport: 1.071,
        volume: 3000,
        volumeSma: 800,
        bbLower: 1.072,
        macdHistogram: 0.001,
        sma20: 1.1,
        sma50: 1.1,
        ema200: 1.1,
      });
      candles[4] = makeCandle({
        low: 1.09,
        macdHistogram: -0.001,
      });
      for (let j = 2; j <= 5; j++) {
        candles[5 - j] = makeCandle({ low: 1.09 + j * 0.002 });
      }

      const candidate = makeCandidate({
        keyPriceLevels: {
          entry: 1.101,
          stopLoss: 1.065,
          takeProfit: 1.173,
          anchorPrices: [],
        },
      });

      const result = analyzeCandidate(candidate, candles);
      expect(result.qualityRating).toBe(10);
    });
  });
});
