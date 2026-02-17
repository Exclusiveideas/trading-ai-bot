import { describe, expect, test } from "vitest";
import fc from "fast-check";
import { alignIndicatorResult, calculateAllIndicators } from "./indicators";

describe(alignIndicatorResult, () => {
  test("pads with correct number of nulls", () => {
    const result = alignIndicatorResult([10, 20, 30], 5);
    expect(result).toEqual([null, null, 10, 20, 30]);
  });

  test("no padding when lengths match", () => {
    const result = alignIndicatorResult([1, 2, 3], 3);
    expect(result).toEqual([1, 2, 3]);
  });

  test("all nulls when values array is empty", () => {
    const result = alignIndicatorResult([], 3);
    expect(result).toEqual([null, null, null]);
  });

  test("output length always equals inputLength", () => {
    fc.assert(
      fc.property(
        fc.array(fc.float({ min: 0, max: 1000, noNaN: true })),
        fc.integer({ min: 0, max: 200 }),
        (values, extra) => {
          const inputLength = values.length + extra;
          const result = alignIndicatorResult(values, inputLength);
          return result.length === inputLength;
        }
      )
    );
  });
});

function seededRandom(seed: number) {
  return () => {
    seed = (seed * 16807 + 0) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

function generateCandles(count: number) {
  const rand = seededRandom(42);
  const candles = [];
  let price = 1.1;
  for (let i = 0; i < count; i++) {
    const change = Math.sin(i * 0.1) * 0.005 + (rand() - 0.5) * 0.002;
    price += change;
    const high = price + rand() * 0.003;
    const low = price - rand() * 0.003;
    candles.push({
      open: price,
      high,
      low,
      close: price + (rand() - 0.5) * 0.002,
      volume: 0,
    });
  }
  return candles;
}

describe(calculateAllIndicators, () => {
  test("returns empty array for empty input", () => {
    expect(calculateAllIndicators([])).toEqual([]);
  });

  test("output length equals input length", () => {
    const candles = generateCandles(300);
    const result = calculateAllIndicators(candles);
    expect(result.length).toBe(candles.length);
  });

  test("early candles have null indicators due to lookback period", () => {
    const candles = generateCandles(300);
    const result = calculateAllIndicators(candles);
    expect(result[0]).toEqual({
      sma20: null,
      sma50: null,
      ema200: null,
      rsi: null,
      macd: null,
      macdSignal: null,
      macdHistogram: null,
      adx: null,
      atr: null,
      bbUpper: null,
      bbMiddle: null,
      bbLower: null,
      volumeSma: null,
    });
  });

  test("later candles have non-null indicators", () => {
    const candles = generateCandles(300);
    const result = calculateAllIndicators(candles);
    const last = result[299];
    expect(last).toEqual({
      sma20: expect.any(Number),
      sma50: expect.any(Number),
      ema200: expect.any(Number),
      rsi: expect.any(Number),
      macd: expect.any(Number),
      macdSignal: expect.any(Number),
      macdHistogram: expect.any(Number),
      adx: expect.any(Number),
      atr: expect.any(Number),
      bbUpper: expect.any(Number),
      bbMiddle: expect.any(Number),
      bbLower: expect.any(Number),
      volumeSma: expect.any(Number),
    });
  });

  test("RSI values are between 0 and 100 when present", () => {
    const candles = generateCandles(300);
    const result = calculateAllIndicators(candles);
    for (const row of result) {
      if (row.rsi !== null) {
        expect(row.rsi).toBeGreaterThanOrEqual(0);
        expect(row.rsi).toBeLessThanOrEqual(100);
      }
    }
  });

  test("Bollinger upper > middle > lower when present", () => {
    const candles = generateCandles(300);
    const result = calculateAllIndicators(candles);
    for (const row of result) {
      if (row.bbUpper !== null && row.bbMiddle !== null && row.bbLower !== null) {
        expect(row.bbUpper).toBeGreaterThan(row.bbMiddle);
        expect(row.bbMiddle).toBeGreaterThan(row.bbLower);
      }
    }
  });

  test("ATR is always positive when present", () => {
    const candles = generateCandles(300);
    const result = calculateAllIndicators(candles);
    for (const row of result) {
      if (row.atr !== null) {
        expect(row.atr).toBeGreaterThan(0);
      }
    }
  });

  test("fewer candles than longest lookback produces all-null for that indicator", () => {
    const candles = generateCandles(50);
    const result = calculateAllIndicators(candles);
    for (const row of result) {
      expect(row.ema200).toBeNull();
    }
  });
});
