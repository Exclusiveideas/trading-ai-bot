import type { DetectorCandle, KeyPriceLevels } from "@/types/trading";

export type DoubleTopConfig = {
  priceTolerance: number;
  minPullbackBars: number;
  maxPullbackBars: number;
  swingWindow: number;
  minHeightAtr: number;
};

const DEFAULT_CONFIG: DoubleTopConfig = {
  priceTolerance: 0.008,
  minPullbackBars: 5,
  maxPullbackBars: 80,
  swingWindow: 2,
  minHeightAtr: 0,
};

function findSwingHighs(candles: DetectorCandle[], window: number): number[] {
  const indices: number[] = [];
  for (let i = window; i < candles.length - window; i++) {
    let isHigh = true;
    for (let j = 1; j <= window; j++) {
      if (
        candles[i].high <= candles[i - j].high ||
        candles[i].high <= candles[i + j].high
      ) {
        isHigh = false;
        break;
      }
    }
    if (isHigh) indices.push(i);
  }
  return indices;
}

export type DoubleTopDetection = {
  firstTopIndex: number;
  secondTopIndex: number;
  necklinePrice: number;
};

export function detectDoubleTops(
  candles: DetectorCandle[],
  config?: Partial<DoubleTopConfig>,
): DoubleTopDetection[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  if (candles.length < cfg.minPullbackBars + 2) return [];

  const swingHighIndices = findSwingHighs(candles, cfg.swingWindow);
  const results: DoubleTopDetection[] = [];

  for (let i = 0; i < swingHighIndices.length; i++) {
    for (let j = i + 1; j < swingHighIndices.length; j++) {
      const firstIdx = swingHighIndices[i];
      const secondIdx = swingHighIndices[j];
      const gap = secondIdx - firstIdx;

      if (gap < cfg.minPullbackBars || gap > cfg.maxPullbackBars) continue;

      const firstHigh = candles[firstIdx].high;
      const secondHigh = candles[secondIdx].high;
      const avgHigh = (firstHigh + secondHigh) / 2;
      const diff = Math.abs(firstHigh - secondHigh) / avgHigh;

      if (diff > cfg.priceTolerance) continue;

      let neckline = Infinity;
      for (let k = firstIdx + 1; k < secondIdx; k++) {
        if (candles[k].low < neckline) neckline = candles[k].low;
      }

      const patternHeight = Math.max(firstHigh, secondHigh) - neckline;

      if (cfg.minHeightAtr > 0) {
        const atr = candles[secondIdx].atr;
        if (atr !== null && atr > 0 && patternHeight / atr < cfg.minHeightAtr)
          continue;
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

export type DoubleTopScoringContext = {
  rsiAtFirst?: number | null;
  rsiAtSecond?: number | null;
  volumeAtFirst?: number | null;
  volumeAtSecond?: number | null;
};

export function scoreDoubleTop(
  candles: DetectorCandle[],
  detection: DoubleTopDetection,
  context: DoubleTopScoringContext,
): number {
  let score = 5;

  const { firstTopIndex, secondTopIndex, necklinePrice } = detection;
  const firstHigh = candles[firstTopIndex].high;
  const secondHigh = candles[secondTopIndex].high;
  const avgHigh = (firstHigh + secondHigh) / 2;
  const tolerance = Math.abs(firstHigh - secondHigh) / avgHigh;

  if (tolerance <= 0.005) score += 1.5;
  else if (tolerance <= 0.015) score += 1;
  else if (tolerance <= 0.03) score += 0.5;

  const patternHeight = Math.max(firstHigh, secondHigh) - necklinePrice;
  const atr = candles[secondTopIndex].atr;
  if (atr !== null && atr > 0) {
    const heightRatio = patternHeight / atr;
    if (heightRatio >= 3.0) score += 1;
    else if (heightRatio >= 2.0) score += 0.5;
    else if (heightRatio < 1.5) score -= 1;
  }

  const timeBetween = secondTopIndex - firstTopIndex;
  if (timeBetween >= 15 && timeBetween <= 65) score += 1;
  else if (timeBetween >= 10 && timeBetween <= 100) score += 0.5;

  const rsi1 = context.rsiAtFirst ?? null;
  const rsi2 = context.rsiAtSecond ?? null;
  if (rsi1 !== null && rsi2 !== null) {
    const divergence = rsi1 - rsi2;
    if (divergence >= 8) score += 1.5;
    else if (divergence >= 3) score += 1;
  }

  if (secondHigh < firstHigh && tolerance >= 0.005) {
    score += 0.5;
  }

  if (
    context.volumeAtFirst != null &&
    context.volumeAtSecond != null &&
    context.volumeAtFirst > 0
  ) {
    const volRatio = context.volumeAtSecond / context.volumeAtFirst;
    if (volRatio < 0.85) score += 1;
    else if (volRatio > 1.2) score -= 1;
  }

  return Math.max(1, Math.min(10, Math.round(score)));
}

export function calculateDoubleTopLevels(
  pattern: { topPrice: number; necklinePrice: number },
  atr: number | null,
): KeyPriceLevels {
  const buffer =
    atr !== null
      ? atr * 0.5
      : (pattern.topPrice - pattern.necklinePrice) * 0.05;
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
