import type { DetectorCandle, KeyPriceLevels } from "@/types/trading";

export type PinBarConfig = {
  minWickRatio: number;
  maxBodyRatio: number;
  requireMomentumConfirmation: boolean;
};

const DEFAULT_CONFIG: PinBarConfig = {
  minWickRatio: 0.6,
  maxBodyRatio: 0.35,
  requireMomentumConfirmation: false,
};

export function detectPinBars(
  candles: DetectorCandle[],
  config?: Partial<PinBarConfig>,
): { index: number; direction: "bullish" | "bearish" }[] {
  const { minWickRatio, maxBodyRatio, requireMomentumConfirmation } = {
    ...DEFAULT_CONFIG,
    ...config,
  };
  const results: { index: number; direction: "bullish" | "bearish" }[] = [];

  for (let i = 1; i < candles.length - 1; i++) {
    const c = candles[i];
    const range = c.high - c.low;
    if (range <= 0) continue;

    const body = Math.abs(c.close - c.open);
    const bodyRatio = body / range;
    if (bodyRatio > maxBodyRatio) continue;

    const upperWick = c.high - Math.max(c.open, c.close);
    const lowerWick = Math.min(c.open, c.close) - c.low;

    const lowerWickRatio = lowerWick / range;
    const upperWickRatio = upperWick / range;

    let direction: "bullish" | "bearish" | null = null;
    if (lowerWickRatio >= minWickRatio) {
      direction = "bullish";
    } else if (upperWickRatio >= minWickRatio) {
      direction = "bearish";
    }

    if (direction === null) continue;

    if (requireMomentumConfirmation) {
      const prev = candles[i - 1];
      const prevMidpoint = (prev.high + prev.low) / 2;
      if (direction === "bullish" && c.close < prevMidpoint) continue;
      if (direction === "bearish" && c.close > prevMidpoint) continue;
    }

    results.push({ index: i, direction });
  }

  return results;
}

export function calculatePinBarLevels(
  candle: DetectorCandle,
  direction: "bullish" | "bearish",
): KeyPriceLevels {
  const buffer =
    candle.atr !== null ? candle.atr * 0.5 : (candle.high - candle.low) * 0.1;

  if (direction === "bullish") {
    const entry = candle.high;
    const stopLoss = candle.low - buffer;
    const risk = entry - stopLoss;
    const takeProfit = entry + risk * 2;

    return {
      entry,
      stopLoss,
      takeProfit,
      anchorPrices: [
        { label: "wick_tip", price: candle.low },
        { label: "body_top", price: Math.max(candle.open, candle.close) },
      ],
    };
  }

  const entry = candle.low;
  const stopLoss = candle.high + buffer;
  const risk = stopLoss - entry;
  const takeProfit = entry - risk * 2;

  return {
    entry,
    stopLoss,
    takeProfit,
    anchorPrices: [
      { label: "wick_tip", price: candle.high },
      { label: "body_bottom", price: Math.min(candle.open, candle.close) },
    ],
  };
}
