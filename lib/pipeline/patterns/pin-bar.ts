import type { DetectorCandle, KeyPriceLevels } from "@/types/trading";

export type PinBarConfig = {
  minWickRatio: number;
  maxBodyRatio: number;
  maxNoseRatio: number;
  minAtrMultiple: number;
  maxAtrMultiple: number;
  requireMomentumConfirmation: boolean;
};

const DEFAULT_CONFIG: PinBarConfig = {
  minWickRatio: 0.6,
  maxBodyRatio: 0.33,
  maxNoseRatio: 0.25,
  minAtrMultiple: 0,
  maxAtrMultiple: Infinity,
  requireMomentumConfirmation: false,
};

export function detectPinBars(
  candles: DetectorCandle[],
  config?: Partial<PinBarConfig>,
): { index: number; direction: "bullish" | "bearish" }[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const results: { index: number; direction: "bullish" | "bearish" }[] = [];

  for (let i = 1; i < candles.length - 1; i++) {
    const c = candles[i];
    const range = c.high - c.low;
    if (range <= 0) continue;

    if (c.atr !== null && c.atr > 0) {
      const atrRatio = range / c.atr;
      if (atrRatio < cfg.minAtrMultiple || atrRatio > cfg.maxAtrMultiple)
        continue;
    }

    const body = Math.abs(c.close - c.open);
    const bodyRatio = body / range;
    if (bodyRatio > cfg.maxBodyRatio) continue;

    const upperWick = c.high - Math.max(c.open, c.close);
    const lowerWick = Math.min(c.open, c.close) - c.low;

    const lowerWickRatio = lowerWick / range;
    const upperWickRatio = upperWick / range;

    let direction: "bullish" | "bearish" | null = null;
    if (lowerWickRatio >= cfg.minWickRatio) {
      const noseRatio = upperWick / range;
      if (noseRatio > cfg.maxNoseRatio) continue;
      direction = "bullish";
    } else if (upperWickRatio >= cfg.minWickRatio) {
      const noseRatio = lowerWick / range;
      if (noseRatio > cfg.maxNoseRatio) continue;
      direction = "bearish";
    }

    if (direction === null) continue;

    if (cfg.requireMomentumConfirmation) {
      const prev = candles[i - 1];
      const prevMidpoint = (prev.high + prev.low) / 2;
      if (direction === "bullish" && c.close < prevMidpoint) continue;
      if (direction === "bearish" && c.close > prevMidpoint) continue;
    }

    results.push({ index: i, direction });
  }

  return results;
}

export type PinBarScoringContext = {
  nearestSupport?: number | null;
  nearestResistance?: number | null;
  volume?: number | null;
  volumeSma?: number | null;
};

export function scorePinBar(
  candles: DetectorCandle[],
  index: number,
  direction: "bullish" | "bearish",
  context: PinBarScoringContext,
): number {
  const c = candles[index];
  const range = c.high - c.low;
  if (range <= 0) return 1;

  let score = 5;

  const body = Math.abs(c.close - c.open);
  const upperWick = c.high - Math.max(c.open, c.close);
  const lowerWick = Math.min(c.open, c.close) - c.low;
  const tail = direction === "bullish" ? lowerWick : upperWick;
  const nose = direction === "bullish" ? upperWick : lowerWick;
  const tailRatio = tail / range;
  const noseRatio = nose / range;
  const bodyRatio = body / range;

  if (tailRatio >= 0.75) score += 1;
  if (bodyRatio <= 0.15) score += 1;
  if (noseRatio <= 0.05) score += 1;

  const lookback = Math.min(index, 5);
  if (lookback > 0) {
    let protrusionCount = 0;
    for (let j = 1; j <= lookback; j++) {
      const prior = candles[index - j];
      if (direction === "bullish" && c.low < prior.low) protrusionCount++;
      if (direction === "bearish" && c.high > prior.high) protrusionCount++;
    }

    if (protrusionCount === 0) score -= 2;
    else if (protrusionCount >= 5) score += 2;
    else if (protrusionCount >= 3) score += 1;
  }

  if (context.nearestSupport != null && direction === "bullish") {
    const atr = c.atr ?? range;
    const dist = Math.abs(c.low - context.nearestSupport);
    if (dist <= 0.5 * atr) score += 2;
    else if (dist <= 1.0 * atr) score += 1;
  }
  if (context.nearestResistance != null && direction === "bearish") {
    const atr = c.atr ?? range;
    const dist = Math.abs(c.high - context.nearestResistance);
    if (dist <= 0.5 * atr) score += 2;
    else if (dist <= 1.0 * atr) score += 1;
  }
  if (context.nearestSupport == null && context.nearestResistance == null) {
    score -= 2;
  }

  if (
    context.volume != null &&
    context.volumeSma != null &&
    context.volumeSma > 0
  ) {
    const volRatio = context.volume / context.volumeSma;
    if (volRatio >= 1.5) score += 1;
    else if (volRatio < 0.8) score -= 1;
  }

  if (c.atr !== null && c.atr > 0) {
    const atrRatio = range / c.atr;
    if (atrRatio < 0.5 || atrRatio > 2.0) score -= 0.5;
  }

  if (direction === "bullish" && c.close > c.open) score += 0.5;
  if (direction === "bearish" && c.close < c.open) score += 0.5;

  return Math.max(1, Math.min(10, Math.round(score)));
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
