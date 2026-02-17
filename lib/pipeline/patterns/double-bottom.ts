import type { DetectorCandle, KeyPriceLevels } from "@/types/trading";

export type DoubleBottomConfig = {
  priceTolerance: number;
  minPullbackBars: number;
  maxPullbackBars: number;
  swingWindow: number;
};

const DEFAULT_CONFIG: DoubleBottomConfig = {
  priceTolerance: 0.003,
  minPullbackBars: 5,
  maxPullbackBars: 50,
  swingWindow: 3,
};

function findSwingLows(
  candles: DetectorCandle[],
  window: number
): number[] {
  const indices: number[] = [];
  for (let i = window; i < candles.length - window; i++) {
    let isLow = true;
    for (let j = 1; j <= window; j++) {
      if (candles[i].low >= candles[i - j].low || candles[i].low >= candles[i + j].low) {
        isLow = false;
        break;
      }
    }
    if (isLow) indices.push(i);
  }
  return indices;
}

export function detectDoubleBottoms(
  candles: DetectorCandle[],
  config?: Partial<DoubleBottomConfig>
): { firstBottomIndex: number; secondBottomIndex: number; necklinePrice: number }[] {
  const { priceTolerance, minPullbackBars, maxPullbackBars, swingWindow } = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  if (candles.length < minPullbackBars + 2) return [];

  const swingLowIndices = findSwingLows(candles, swingWindow);
  const results: { firstBottomIndex: number; secondBottomIndex: number; necklinePrice: number }[] = [];

  for (let i = 0; i < swingLowIndices.length; i++) {
    for (let j = i + 1; j < swingLowIndices.length; j++) {
      const firstIdx = swingLowIndices[i];
      const secondIdx = swingLowIndices[j];
      const gap = secondIdx - firstIdx;

      if (gap < minPullbackBars || gap > maxPullbackBars) continue;

      const firstLow = candles[firstIdx].low;
      const secondLow = candles[secondIdx].low;
      const avgLow = (firstLow + secondLow) / 2;
      const diff = Math.abs(firstLow - secondLow) / avgLow;

      if (diff > priceTolerance) continue;

      let neckline = -Infinity;
      for (let k = firstIdx + 1; k < secondIdx; k++) {
        if (candles[k].high > neckline) neckline = candles[k].high;
      }

      results.push({
        firstBottomIndex: firstIdx,
        secondBottomIndex: secondIdx,
        necklinePrice: neckline,
      });
    }
  }

  return results;
}

export function calculateDoubleBottomLevels(
  pattern: { bottomPrice: number; necklinePrice: number },
  atr: number | null
): KeyPriceLevels {
  const buffer = atr !== null ? atr * 0.5 : (pattern.necklinePrice - pattern.bottomPrice) * 0.05;
  const patternHeight = pattern.necklinePrice - pattern.bottomPrice;

  const entry = pattern.necklinePrice;
  const stopLoss = pattern.bottomPrice - buffer;
  const takeProfit = entry + patternHeight;

  return {
    entry,
    stopLoss,
    takeProfit,
    anchorPrices: [
      { label: "bottom", price: pattern.bottomPrice },
      { label: "neckline", price: pattern.necklinePrice },
    ],
  };
}
