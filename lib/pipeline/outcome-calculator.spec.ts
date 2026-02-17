import { describe, expect, test } from "vitest";
import fc from "fast-check";
import { calculateOutcome } from "./outcome-calculator";

function makeBar(high: number, low: number, close?: number) {
  return { high, low, close: close ?? (high + low) / 2 };
}

describe(calculateOutcome, () => {
  test("long trade hits take profit", () => {
    const candles = [
      makeBar(1.10, 1.08),
      makeBar(1.12, 1.09),
      makeBar(1.15, 1.11),
    ];
    const result = calculateOutcome(candles, {
      entryPrice: 1.10,
      stopLoss: 1.08,
      takeProfit: 1.14,
      entryIndex: 0,
    });
    expect(result.outcome).toBe("win");
    expect(result.rMultiple).toBeCloseTo(2, 5);
    expect(result.barsToOutcome).toBe(2);
    expect(result.exitPrice).toBe(1.14);
  });

  test("long trade hits stop loss", () => {
    const candles = [
      makeBar(1.10, 1.08),
      makeBar(1.09, 1.07),
    ];
    const result = calculateOutcome(candles, {
      entryPrice: 1.10,
      stopLoss: 1.08,
      takeProfit: 1.14,
      entryIndex: 0,
    });
    expect(result).toEqual({
      outcome: "loss",
      rMultiple: -1,
      barsToOutcome: 1,
      exitPrice: 1.08,
    });
  });

  test("short trade hits take profit", () => {
    const candles = [
      makeBar(1.12, 1.10),
      makeBar(1.11, 1.09),
      makeBar(1.09, 1.06),
    ];
    const result = calculateOutcome(candles, {
      entryPrice: 1.10,
      stopLoss: 1.12,
      takeProfit: 1.06,
      entryIndex: 0,
    });
    expect(result).toEqual({
      outcome: "win",
      rMultiple: 2,
      barsToOutcome: 2,
      exitPrice: 1.06,
    });
  });

  test("short trade hits stop loss", () => {
    const candles = [
      makeBar(1.12, 1.10),
      makeBar(1.13, 1.11),
    ];
    const result = calculateOutcome(candles, {
      entryPrice: 1.10,
      stopLoss: 1.12,
      takeProfit: 1.06,
      entryIndex: 0,
    });
    expect(result).toEqual({
      outcome: "loss",
      rMultiple: -1,
      barsToOutcome: 1,
      exitPrice: 1.12,
    });
  });

  test("same bar stop and target hit assumes stop (conservative)", () => {
    const candles = [
      makeBar(1.10, 1.08),
      makeBar(1.15, 1.05),
    ];
    const result = calculateOutcome(candles, {
      entryPrice: 1.10,
      stopLoss: 1.08,
      takeProfit: 1.14,
      entryIndex: 0,
    });
    expect(result.outcome).toBe("loss");
    expect(result.exitPrice).toBe(1.08);
  });

  test("pending when max bars exceeded", () => {
    const candles = [
      makeBar(1.10, 1.09),
      makeBar(1.105, 1.095, 1.10),
      makeBar(1.105, 1.095, 1.10),
    ];
    const result = calculateOutcome(
      candles,
      { entryPrice: 1.10, stopLoss: 1.05, takeProfit: 1.20, entryIndex: 0 },
      2
    );
    expect(result.outcome).toBe("pending");
    expect(result.rMultiple).not.toBeNull();
    expect(result.barsToOutcome).toBe(2);
    expect(result.exitPrice).toBeNull();
  });

  test("pending when entry at end of data", () => {
    const candles = [makeBar(1.10, 1.08)];
    const result = calculateOutcome(candles, {
      entryPrice: 1.10,
      stopLoss: 1.08,
      takeProfit: 1.14,
      entryIndex: 0,
    });
    expect(result.outcome).toBe("pending");
  });

  test("pending when zero risk", () => {
    const candles = [
      makeBar(1.10, 1.08),
      makeBar(1.12, 1.09),
    ];
    const result = calculateOutcome(candles, {
      entryPrice: 1.10,
      stopLoss: 1.10,
      takeProfit: 1.14,
      entryIndex: 0,
    });
    expect(result.outcome).toBe("pending");
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
            { entryPrice: entry, stopLoss, takeProfit, entryIndex: 0 }
          );

          const lossResult = calculateOutcome(
            [makeBar(entry + 0.001, entry - 0.001), lossBar],
            { entryPrice: entry, stopLoss, takeProfit, entryIndex: 0 }
          );

          const winOk = winResult.outcome !== "win" || (winResult.rMultiple !== null && winResult.rMultiple > 0);
          const lossOk = lossResult.outcome !== "loss" || (lossResult.rMultiple !== null && lossResult.rMultiple < 0);
          return winOk && lossOk;
        }
      )
    );
  });
});
