import { describe, expect, test } from "vitest";
import fc from "fast-check";
import { calculateOutcome } from "./outcome-calculator";

function makeBar(high: number, low: number, close?: number) {
  return { high, low, close: close ?? (high + low) / 2 };
}

describe(calculateOutcome, () => {
  test("long trade hits take profit", () => {
    const candles = [
      makeBar(1.1, 1.08),
      makeBar(1.12, 1.09),
      makeBar(1.15, 1.11),
    ];
    const result = calculateOutcome(candles, {
      entryPrice: 1.1,
      stopLoss: 1.08,
      takeProfit: 1.14,
      entryIndex: 0,
    });
    expect(result.outcome).toBe("win");
    expect(result.rMultiple).toBeCloseTo(2, 5);
    expect(result.barsToOutcome).toBe(2);
    expect(result.exitPrice).toBe(1.14);
    expect(result.maxFavorableExcursion).toBeCloseTo(2.5, 1);
  });

  test("long trade hits stop loss", () => {
    const candles = [makeBar(1.1, 1.08), makeBar(1.09, 1.07)];
    const result = calculateOutcome(candles, {
      entryPrice: 1.1,
      stopLoss: 1.08,
      takeProfit: 1.14,
      entryIndex: 0,
    });
    expect(result).toEqual({
      outcome: "loss",
      rMultiple: -1,
      barsToOutcome: 1,
      exitPrice: 1.08,
      maxFavorableExcursion: expect.any(Number),
      maxAdverseExcursion: expect.any(Number),
    });
  });

  test("short trade hits take profit", () => {
    const candles = [
      makeBar(1.12, 1.1),
      makeBar(1.11, 1.09),
      makeBar(1.09, 1.06),
    ];
    const result = calculateOutcome(candles, {
      entryPrice: 1.1,
      stopLoss: 1.12,
      takeProfit: 1.06,
      entryIndex: 0,
    });
    expect(result).toEqual({
      outcome: "win",
      rMultiple: 2,
      barsToOutcome: 2,
      exitPrice: 1.06,
      maxFavorableExcursion: expect.any(Number),
      maxAdverseExcursion: expect.any(Number),
    });
    expect(result.maxFavorableExcursion).toBeCloseTo(2, 1);
  });

  test("short trade hits stop loss", () => {
    const candles = [makeBar(1.12, 1.1), makeBar(1.13, 1.11)];
    const result = calculateOutcome(candles, {
      entryPrice: 1.1,
      stopLoss: 1.12,
      takeProfit: 1.06,
      entryIndex: 0,
    });
    expect(result).toEqual({
      outcome: "loss",
      rMultiple: -1,
      barsToOutcome: 1,
      exitPrice: 1.12,
      maxFavorableExcursion: expect.any(Number),
      maxAdverseExcursion: expect.any(Number),
    });
  });

  test("same bar stop and target hit assumes stop (conservative)", () => {
    const candles = [makeBar(1.1, 1.08), makeBar(1.15, 1.05)];
    const result = calculateOutcome(candles, {
      entryPrice: 1.1,
      stopLoss: 1.08,
      takeProfit: 1.14,
      entryIndex: 0,
    });
    expect(result.outcome).toBe("loss");
    expect(result.exitPrice).toBe(1.08);
  });

  test("pending when max bars exceeded", () => {
    const candles = [
      makeBar(1.1, 1.09),
      makeBar(1.105, 1.095, 1.1),
      makeBar(1.105, 1.095, 1.1),
    ];
    const result = calculateOutcome(
      candles,
      { entryPrice: 1.1, stopLoss: 1.05, takeProfit: 1.2, entryIndex: 0 },
      2,
    );
    expect(result.outcome).toBe("pending");
    expect(result.rMultiple).not.toBeNull();
    expect(result.barsToOutcome).toBe(2);
    expect(result.exitPrice).toBeNull();
    expect(result.maxFavorableExcursion).toBeCloseTo(0.1, 1);
  });

  test("pending when entry at end of data", () => {
    const candles = [makeBar(1.1, 1.08)];
    const result = calculateOutcome(candles, {
      entryPrice: 1.1,
      stopLoss: 1.08,
      takeProfit: 1.14,
      entryIndex: 0,
    });
    expect(result.outcome).toBe("pending");
    expect(result.maxFavorableExcursion).toBeNull();
    expect(result.maxAdverseExcursion).toBeNull();
  });

  test("pending when zero risk", () => {
    const candles = [makeBar(1.1, 1.08), makeBar(1.12, 1.09)];
    const result = calculateOutcome(candles, {
      entryPrice: 1.1,
      stopLoss: 1.1,
      takeProfit: 1.14,
      entryIndex: 0,
    });
    expect(result.outcome).toBe("pending");
    expect(result.maxFavorableExcursion).toBeNull();
    expect(result.maxAdverseExcursion).toBeNull();
  });

  test("MFE tracks peak favorable movement before stop", () => {
    const candles = [
      makeBar(1.1, 1.08),
      makeBar(1.12, 1.09),
      makeBar(1.13, 1.1),
      makeBar(1.11, 1.07),
    ];
    const result = calculateOutcome(candles, {
      entryPrice: 1.1,
      stopLoss: 1.08,
      takeProfit: 1.16,
      entryIndex: 0,
    });
    expect(result.outcome).toBe("loss");
    expect(result.maxFavorableExcursion).toBeCloseTo(1.5, 1);
  });

  test("MAE tracks peak adverse movement for long trade", () => {
    const candles = [
      makeBar(1.1, 1.08),
      makeBar(1.11, 1.085),
      makeBar(1.12, 1.09),
      makeBar(1.15, 1.11),
    ];
    const result = calculateOutcome(candles, {
      entryPrice: 1.1,
      stopLoss: 1.06,
      takeProfit: 1.14,
      entryIndex: 0,
    });
    expect(result.outcome).toBe("win");
    // MAE = (1.1 - 1.085) / (1.1 - 1.06) = 0.015 / 0.04 = 0.375R
    expect(result.maxAdverseExcursion).toBeCloseTo(0.375, 2);
  });

  test("MAE tracks peak adverse movement for short trade", () => {
    const candles = [
      makeBar(1.12, 1.1),
      makeBar(1.13, 1.09),
      makeBar(1.11, 1.08),
      makeBar(1.08, 1.05),
    ];
    const result = calculateOutcome(candles, {
      entryPrice: 1.1,
      stopLoss: 1.14,
      takeProfit: 1.06,
      entryIndex: 0,
    });
    expect(result.outcome).toBe("win");
    // MAE for short = (bar.high - entry) / risk = (1.13 - 1.1) / (1.14 - 1.1) = 0.03 / 0.04 = 0.75R
    expect(result.maxAdverseExcursion).toBeCloseTo(0.75, 2);
  });

  test("MAE is zero when price never moves against entry", () => {
    const candles = [
      makeBar(1.1, 1.1),
      makeBar(1.12, 1.1),
      makeBar(1.15, 1.11),
    ];
    const result = calculateOutcome(candles, {
      entryPrice: 1.1,
      stopLoss: 1.08,
      takeProfit: 1.14,
      entryIndex: 0,
    });
    expect(result.outcome).toBe("win");
    expect(result.maxAdverseExcursion).toBe(0);
  });

  test("rMultiple sign matches outcome for long trades", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1.0, max: 1.5, noNaN: true }),
        fc.double({ min: 0.005, max: 0.05, noNaN: true }),
        (entry, risk) => {
          const stopLoss = entry - risk;
          const takeProfit = entry + risk * 2;
          const winBar = makeBar(takeProfit + 0.01, entry - risk * 0.5);
          const lossBar = makeBar(entry + risk * 0.5, stopLoss - 0.01);

          const winResult = calculateOutcome(
            [makeBar(entry + 0.001, entry - 0.001), winBar],
            { entryPrice: entry, stopLoss, takeProfit, entryIndex: 0 },
          );

          const lossResult = calculateOutcome(
            [makeBar(entry + 0.001, entry - 0.001), lossBar],
            { entryPrice: entry, stopLoss, takeProfit, entryIndex: 0 },
          );

          const winOk =
            winResult.outcome !== "win" ||
            (winResult.rMultiple !== null && winResult.rMultiple > 0);
          const lossOk =
            lossResult.outcome !== "loss" ||
            (lossResult.rMultiple !== null && lossResult.rMultiple < 0);
          return winOk && lossOk;
        },
      ),
    );
  });

  test("MAE is always non-negative", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1.0, max: 1.5, noNaN: true }),
        fc.double({ min: 0.005, max: 0.05, noNaN: true }),
        (entry, risk) => {
          const stopLoss = entry - risk;
          const takeProfit = entry + risk * 2;
          const bar = makeBar(entry + risk * 0.5, entry - risk * 0.8);

          const result = calculateOutcome(
            [makeBar(entry + 0.001, entry - 0.001), bar],
            { entryPrice: entry, stopLoss, takeProfit, entryIndex: 0 },
          );

          return (
            result.maxAdverseExcursion === null ||
            result.maxAdverseExcursion >= 0
          );
        },
      ),
    );
  });
});
