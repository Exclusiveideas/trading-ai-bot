import type { DetectorCandle, KeyPriceLevels } from "@/types/trading";

export type DoubleTopConfig = {
  priceTolerance: number;
  minPullbackBars: number;
  maxPullbackBars: number;
  swingWindow: number;
};

const DEFAULT_CONFIG: DoubleTopConfig = {
  priceTolerance: 0.003,
  minPullbackBars: 5,
  maxPullbackBars: 50,
  swingWindow: 3,
};

function findSwingHighs(
  candles: DetectorCandle[],
  window: number
): number[] {
  const indices: number[] = [];
  for (let i = window; i < candles.length - window; i++) {
    let isHigh = true;
    for (let j = 1; j <= window; j++) {
      if (candles[i].high <= candles[i - j].high || candles[i].high <= candles[i + j].high) {
        isHigh = false;
        break;
      }
    }
    if (isHigh) indices.push(i);
  }
  return indices;
}

export function detectDoubleTops(
  candles: DetectorCandle[],
  config?: Partial<DoubleTopConfig>
): { firstTopIndex: number; secondTopIndex: number; necklinePrice: number }[] {
  const { priceTolerance, minPullbackBars, maxPullbackBars, swingWindow } = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  if (candles.length < minPullbackBars + 2) return [];

  const swingHighIndices = findSwingHighs(candles, swingWindow);
  const results: { firstTopIndex: number; secondTopIndex: number; necklinePrice: number }[] = [];

  for (let i = 0; i < swingHighIndices.length; i++) {
    for (let j = i + 1; j < swingHighIndices.length; j++) {
      const firstIdx = swingHighIndices[i];
      const secondIdx = swingHighIndices[j];
      const gap = secondIdx - firstIdx;

      if (gap < minPullbackBars || gap > maxPullbackBars) continue;

      const firstHigh = candles[firstIdx].high;
      const secondHigh = candles[secondIdx].high;
      const avgHigh = (firstHigh + secondHigh) / 2;
      const diff = Math.abs(firstHigh - secondHigh) / avgHigh;

      if (diff > priceTolerance) continue;

      let neckline = Infinity;
      for (let k = firstIdx + 1; k < secondIdx; k++) {
        if (candles[k].low < neckline) neckline = candles[k].low;
      }

      results.push({
        firstTopIndex: firstIdx,
        secondTopIndex: secondIdx,
        necklinePrice: neckline,
      });
    }
  }

  return results;
}

export function calculateDoubleTopLevels(
  pattern: { topPrice: number; necklinePrice: number },
  atr: number | null
): KeyPriceLevels {
  const buffer = atr !== null ? atr * 0.5 : (pattern.topPrice - pattern.necklinePrice) * 0.05;
  const patternHeight = pattern.topPrice - pattern.necklinePrice;

  const entry = pattern.necklinePrice;
  const stopLoss = pattern.topPrice + buffer;
  const takeProfit = entry - patternHeight;

  return {
    entry,
    stopLoss,
    takeProfit,
    anchorPrices: [
      { label: "top", price: pattern.topPrice },
      { label: "neckline", price: pattern.necklinePrice },
    ],
  };
}
