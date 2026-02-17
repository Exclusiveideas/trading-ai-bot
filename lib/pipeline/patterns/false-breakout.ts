import type { DetectorCandle, KeyPriceLevels } from "@/types/trading";

export type FalseBreakoutConfig = {
  breakThresholdPips: number;
  reversalBars: number;
};

const DEFAULT_CONFIG: FalseBreakoutConfig = {
  breakThresholdPips: 5,
  reversalBars: 3,
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
  config?: Partial<FalseBreakoutConfig>
): FalseBreakoutDetection[] {
  const { breakThresholdPips, reversalBars } = { ...DEFAULT_CONFIG, ...config };
  const results: FalseBreakoutDetection[] = [];

  if (candles.length < 2 || levels.length === 0) return results;

  const breakThreshold = breakThresholdPips / 10000;

  for (const level of levels) {
    for (let i = 1; i < candles.length; i++) {
      const prev = candles[i - 1];
      const curr = candles[i];

      const brokeAbove = prev.close <= level && curr.high > level + breakThreshold;
      if (brokeAbove) {
        const reversalEnd = Math.min(i + reversalBars, candles.length - 1);
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

      const brokeBelow = prev.close >= level && curr.low < level - breakThreshold;
      if (brokeBelow) {
        const reversalEnd = Math.min(i + reversalBars, candles.length - 1);
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

export function calculateFalseBreakoutLevels(
  pattern: { brokenLevel: number; extremePrice: number; direction: "bullish" | "bearish" },
  atr: number | null
): KeyPriceLevels {
  const buffer = atr !== null ? atr * 0.5 : Math.abs(pattern.extremePrice - pattern.brokenLevel) * 0.5;

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
