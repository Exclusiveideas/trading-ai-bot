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
  overrides?: Partial<PatternCandidate>,
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

describe("analyzeCandidate", () => {
  describe("pin_bar", () => {
    test("high-quality bullish pin bar near support scores >= 6", () => {
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
      expect(result.qualityRating).toBeGreaterThanOrEqual(6);
      expect(result.approved).toBe(true);
      expect(result.notes).toContain("tail");
      expect(result.notes).toContain("RSI");
    });

    test("weak pin bar far from S/R scores low", () => {
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
      expect(result.qualityRating).toBeLessThanOrEqual(5);
      expect(result.approved).toBe(false);
    });

    test("result is always between 1 and 10", () => {
      const candles = makeCandles(10);
      const candidate = makeCandidate();
      const result = analyzeCandidate(candidate, candles);
      expect(result.qualityRating).toBeGreaterThanOrEqual(1);
      expect(result.qualityRating).toBeLessThanOrEqual(10);
    });

    test("notes contain outcome information", () => {
      const candles = makeCandles(10);
      const candidate = makeCandidate();
      const result = analyzeCandidate(candidate, candles);
      expect(result.notes).toContain("Outcome");
    });
  });

  describe("double_top", () => {
    test("symmetric double top with RSI divergence scores high", () => {
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
      expect(result.qualityRating).toBeGreaterThanOrEqual(6);
      expect(result.notes).toContain("symmetry");
      expect(result.notes).toContain("RSI divergence");
    });
  });

  describe("double_bottom", () => {
    test("symmetric double bottom scores reasonably", () => {
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
      expect(result.qualityRating).toBeGreaterThanOrEqual(5);
      expect(result.notes).toContain("trough symmetry");
    });
  });

  describe("head_and_shoulders", () => {
    test("analyzes H&S pattern and returns valid result", () => {
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
      expect(result.qualityRating).toBeGreaterThanOrEqual(1);
      expect(result.qualityRating).toBeLessThanOrEqual(10);
      expect(result.notes).toContain("Outcome");
    });
  });

  describe("false_breakout", () => {
    test("quick reversal with low break volume scores high", () => {
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
      expect(result.qualityRating).toBeGreaterThanOrEqual(5);
      expect(result.notes).toContain("reversal");
    });
  });

  describe("approval threshold", () => {
    test("score of 6+ is approved, below 6 is rejected", () => {
      const candles = makeCandles(10);

      const highQuality = makeCandidate();
      const highResult = analyzeCandidate(highQuality, candles);

      if (highResult.qualityRating >= 6) {
        expect(highResult.approved).toBe(true);
      } else {
        expect(highResult.approved).toBe(false);
      }
    });
  });
});
