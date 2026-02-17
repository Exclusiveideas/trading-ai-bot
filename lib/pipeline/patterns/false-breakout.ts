import type { DetectorCandle, KeyPriceLevels } from "@/types/trading";

export type FalseBreakoutConfig = {
  breakThresholdPips: number;
  reversalBars: number;
  useAtrThreshold: boolean;
  minAtrPenetration: number;
  maxAtrPenetration: number;
};

const DEFAULT_CONFIG: FalseBreakoutConfig = {
  breakThresholdPips: 5,
  reversalBars: 3,
  useAtrThreshold: false,
  minAtrPenetration: 0.1,
  maxAtrPenetration: 1.5,
};

export type FalseBreakoutDetection = {
  breakIndex: number;
  reversalIndex: number;
  brokenLevel: number;
  direction: "bullish" | "bearish";
};

export function detectFalseBreakouts(
  candles: DetectorCandle[],
  levels: number[],
  config?: Partial<FalseBreakoutConfig>,
): FalseBreakoutDetection[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const results: FalseBreakoutDetection[] = [];

  if (candles.length < 2 || levels.length === 0) return results;

  for (const level of levels) {
    for (let i = 1; i < candles.length; i++) {
      const prev = candles[i - 1];
      const curr = candles[i];
      const atr = curr.atr;

      const minThreshold = resolveMinThreshold(cfg, atr);
      const maxThreshold = resolveMaxThreshold(cfg, atr);

      const brokeAbove =
        prev.close <= level && curr.high > level + minThreshold;
      if (brokeAbove) {
        const penetration = curr.high - level;
        if (maxThreshold !== null && penetration > maxThreshold) continue;

        const reversalEnd = Math.min(i + cfg.reversalBars, candles.length - 1);
        for (let j = i + 1; j <= reversalEnd; j++) {
          if (candles[j].close < level) {
            results.push({
              breakIndex: i,
              reversalIndex: j,
              brokenLevel: level,
              direction: "bearish",
            });
            break;
          }
        }
      }

      const brokeBelow = prev.close >= level && curr.low < level - minThreshold;
      if (brokeBelow) {
        const penetration = level - curr.low;
        if (maxThreshold !== null && penetration > maxThreshold) continue;

        const reversalEnd = Math.min(i + cfg.reversalBars, candles.length - 1);
        for (let j = i + 1; j <= reversalEnd; j++) {
          if (candles[j].close > level) {
            results.push({
              breakIndex: i,
              reversalIndex: j,
              brokenLevel: level,
              direction: "bullish",
            });
            break;
          }
        }
      }
    }
  }

  return results;
}

function resolveMinThreshold(
  cfg: FalseBreakoutConfig,
  atr: number | null,
): number {
  if (cfg.useAtrThreshold && atr !== null && atr > 0) {
    return cfg.minAtrPenetration * atr;
  }
  return cfg.breakThresholdPips / 10000;
}

function resolveMaxThreshold(
  cfg: FalseBreakoutConfig,
  atr: number | null,
): number | null {
  if (cfg.useAtrThreshold && atr !== null && atr > 0) {
    return cfg.maxAtrPenetration * atr;
  }
  return null;
}

export type FalseBreakoutScoringContext = {
  levelTouchCount?: number;
  volume?: number | null;
  volumeSma?: number | null;
  reversalVolume?: number | null;
};

export function scoreFalseBreakout(
  candles: DetectorCandle[],
  detection: FalseBreakoutDetection,
  context: FalseBreakoutScoringContext,
): number {
  let score = 5;

  const { breakIndex, reversalIndex, brokenLevel, direction } = detection;
  const breakCandle = candles[breakIndex];
  const range = breakCandle.high - breakCandle.low;
  if (range <= 0) return 1;

  const reversalSpeed = reversalIndex - breakIndex;
  if (reversalSpeed <= 1) score += 1;
  else if (reversalSpeed >= 3) score -= 1;

  const bodyBeyondLevel =
    direction === "bearish"
      ? breakCandle.close > brokenLevel
      : breakCandle.close < brokenLevel;

  if (!bodyBeyondLevel) score += 1;
  else score -= 0.5;

  const touchCount = context.levelTouchCount ?? 0;
  if (touchCount >= 3) score += 1.5;
  else if (touchCount >= 2) score += 0.5;
  else score -= 1;

  if (
    context.volume != null &&
    context.volumeSma != null &&
    context.volumeSma > 0
  ) {
    const volRatio = context.volume / context.volumeSma;
    if (volRatio < 0.8) score += 1;
    else if (volRatio > 1.5) score -= 1;
  }

  if (
    context.reversalVolume != null &&
    context.volume != null &&
    context.volume > 0
  ) {
    const revDivergence = context.reversalVolume / context.volume;
    if (revDivergence >= 1.5) score += 1;
  }

  if (breakCandle.atr !== null && breakCandle.atr > 0) {
    const penetration =
      direction === "bearish"
        ? breakCandle.high - brokenLevel
        : brokenLevel - breakCandle.low;
    const atrRatio = penetration / breakCandle.atr;

    if (atrRatio <= 0.5) score += 0.5;
    else if (atrRatio > 1.0) score -= 0.5;
  }

  return Math.max(1, Math.min(10, Math.round(score)));
}

export function calculateFalseBreakoutLevels(
  pattern: {
    brokenLevel: number;
    extremePrice: number;
    direction: "bullish" | "bearish";
  },
  atr: number | null,
): KeyPriceLevels {
  const buffer =
    atr !== null
      ? atr * 0.5
      : Math.abs(pattern.extremePrice - pattern.brokenLevel) * 0.5;

  if (pattern.direction === "bullish") {
    const entry = pattern.brokenLevel;
    const stopLoss = pattern.extremePrice - buffer;
    const risk = entry - stopLoss;
    const takeProfit = entry + risk * 2;

    return {
      entry,
      stopLoss,
      takeProfit,
      anchorPrices: [
        { label: "broken_level", price: pattern.brokenLevel },
        { label: "false_break_extreme", price: pattern.extremePrice },
      ],
    };
  }

  const entry = pattern.brokenLevel;
  const stopLoss = pattern.extremePrice + buffer;
  const risk = stopLoss - entry;
  const takeProfit = entry - risk * 2;

  return {
    entry,
    stopLoss,
    takeProfit,
    anchorPrices: [
      { label: "broken_level", price: pattern.brokenLevel },
      { label: "false_break_extreme", price: pattern.extremePrice },
    ],
  };
}
