import type { DetectorCandle, KeyPriceLevels } from "@/types/trading";

export type DoubleBottomConfig = {
  priceTolerance: number;
  minPullbackBars: number;
  maxPullbackBars: number;
  swingWindow: number;
  minHeightAtr: number;
};

const DEFAULT_CONFIG: DoubleBottomConfig = {
  priceTolerance: 0.003,
  minPullbackBars: 5,
  maxPullbackBars: 50,
  swingWindow: 3,
  minHeightAtr: 0,
};

function findSwingLows(candles: DetectorCandle[], window: number): number[] {
  const indices: number[] = [];
  for (let i = window; i < candles.length - window; i++) {
    let isLow = true;
    for (let j = 1; j <= window; j++) {
      if (
        candles[i].low >= candles[i - j].low ||
        candles[i].low >= candles[i + j].low
      ) {
        isLow = false;
        break;
      }
    }
    if (isLow) indices.push(i);
  }
  return indices;
}

export type DoubleBottomDetection = {
  firstBottomIndex: number;
  secondBottomIndex: number;
  necklinePrice: number;
};

export function detectDoubleBottoms(
  candles: DetectorCandle[],
  config?: Partial<DoubleBottomConfig>,
): DoubleBottomDetection[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  if (candles.length < cfg.minPullbackBars + 2) return [];

  const swingLowIndices = findSwingLows(candles, cfg.swingWindow);
  const results: DoubleBottomDetection[] = [];

  for (let i = 0; i < swingLowIndices.length; i++) {
    for (let j = i + 1; j < swingLowIndices.length; j++) {
      const firstIdx = swingLowIndices[i];
      const secondIdx = swingLowIndices[j];
      const gap = secondIdx - firstIdx;

      if (gap < cfg.minPullbackBars || gap > cfg.maxPullbackBars) continue;

      const firstLow = candles[firstIdx].low;
      const secondLow = candles[secondIdx].low;
      const avgLow = (firstLow + secondLow) / 2;
      const diff = Math.abs(firstLow - secondLow) / avgLow;

      if (diff > cfg.priceTolerance) continue;

      let neckline = -Infinity;
      for (let k = firstIdx + 1; k < secondIdx; k++) {
        if (candles[k].high > neckline) neckline = candles[k].high;
      }

      const patternHeight = neckline - Math.min(firstLow, secondLow);

      if (cfg.minHeightAtr > 0) {
        const atr = candles[secondIdx].atr;
        if (atr !== null && atr > 0 && patternHeight / atr < cfg.minHeightAtr)
          continue;
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

export type DoubleBottomScoringContext = {
  rsiAtFirst?: number | null;
  rsiAtSecond?: number | null;
  volumeAtFirst?: number | null;
  volumeAtSecond?: number | null;
};

export function scoreDoubleBottom(
  candles: DetectorCandle[],
  detection: DoubleBottomDetection,
  context: DoubleBottomScoringContext,
): number {
  let score = 5;

  const { firstBottomIndex, secondBottomIndex, necklinePrice } = detection;
  const firstLow = candles[firstBottomIndex].low;
  const secondLow = candles[secondBottomIndex].low;
  const avgLow = (firstLow + secondLow) / 2;
  const tolerance = Math.abs(firstLow - secondLow) / avgLow;

  if (tolerance <= 0.005) score += 1.5;
  else if (tolerance <= 0.015) score += 1;
  else if (tolerance <= 0.03) score += 0.5;

  const patternHeight = necklinePrice - Math.min(firstLow, secondLow);
  const atr = candles[secondBottomIndex].atr;
  if (atr !== null && atr > 0) {
    const heightRatio = patternHeight / atr;
    if (heightRatio >= 3.0) score += 1;
    else if (heightRatio >= 2.0) score += 0.5;
    else if (heightRatio < 1.5) score -= 1;
  }

  const timeBetween = secondBottomIndex - firstBottomIndex;
  if (timeBetween >= 15 && timeBetween <= 65) score += 1;
  else if (timeBetween >= 10 && timeBetween <= 100) score += 0.5;

  const rsi1 = context.rsiAtFirst ?? null;
  const rsi2 = context.rsiAtSecond ?? null;
  if (rsi1 !== null && rsi2 !== null) {
    const divergence = rsi2 - rsi1;
    if (divergence >= 8) score += 1.5;
    else if (divergence >= 3) score += 1;
  }

  if (secondLow > firstLow && tolerance >= 0.005) {
    score += 0.5;
  }

  if (
    context.volumeAtFirst != null &&
    context.volumeAtSecond != null &&
    context.volumeAtFirst > 0
  ) {
    const volRatio = context.volumeAtSecond / context.volumeAtFirst;
    if (volRatio <= 1.0) score += 0.5;
    else if (volRatio > 1.2) score -= 0.5;
  }

  return Math.max(1, Math.min(10, Math.round(score)));
}

export function calculateDoubleBottomLevels(
  pattern: { bottomPrice: number; necklinePrice: number },
  atr: number | null,
): KeyPriceLevels {
  const buffer =
    atr !== null
      ? atr * 0.5
      : (pattern.necklinePrice - pattern.bottomPrice) * 0.05;
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
