import type { OutcomeResult } from "@/types/trading";

export type OutcomeCalculatorInput = {
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  entryIndex: number;
};

export function calculateOutcome(
  candles: { high: number; low: number; close: number }[],
  input: OutcomeCalculatorInput,
  maxBarsToHold: number = 100
): OutcomeResult {
  const { entryPrice, stopLoss, takeProfit, entryIndex } = input;

  if (entryIndex >= candles.length - 1) {
    return { outcome: "pending", rMultiple: null, barsToOutcome: null, exitPrice: null };
  }

  const isLong = takeProfit > entryPrice;
  const risk = Math.abs(entryPrice - stopLoss);

  if (risk === 0) {
    return { outcome: "pending", rMultiple: null, barsToOutcome: null, exitPrice: null };
  }

  const scanEnd = Math.min(entryIndex + 1 + maxBarsToHold, candles.length);

  for (let i = entryIndex + 1; i < scanEnd; i++) {
    const bar = candles[i];
    const barsElapsed = i - entryIndex;

    const stopHit = isLong ? bar.low <= stopLoss : bar.high >= stopLoss;
    const targetHit = isLong ? bar.high >= takeProfit : bar.low <= takeProfit;

    if (stopHit && targetHit) {
      const rMultiple = -1;
      return { outcome: "loss", rMultiple, barsToOutcome: barsElapsed, exitPrice: stopLoss };
    }

    if (stopHit) {
      const rMultiple = isLong
        ? (stopLoss - entryPrice) / risk
        : (entryPrice - stopLoss) / risk;
      return { outcome: "loss", rMultiple, barsToOutcome: barsElapsed, exitPrice: stopLoss };
    }

    if (targetHit) {
      const rMultiple = isLong
        ? (takeProfit - entryPrice) / risk
        : (entryPrice - takeProfit) / risk;
      return { outcome: "win", rMultiple, barsToOutcome: barsElapsed, exitPrice: takeProfit };
    }
  }

  const lastBar = candles[scanEnd - 1];
  const unrealizedPnl = isLong
    ? lastBar.close - entryPrice
    : entryPrice - lastBar.close;
  const rMultiple = unrealizedPnl / risk;
  const barsToOutcome = scanEnd - 1 - entryIndex;

  return { outcome: "pending", rMultiple, barsToOutcome, exitPrice: null };
}
