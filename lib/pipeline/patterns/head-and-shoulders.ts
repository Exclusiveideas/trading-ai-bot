import type { DetectorCandle, KeyPriceLevels } from "@/types/trading";

export type HaSConfig = {
  swingWindow: number;
  shoulderTolerance: number;
  minPatternBars: number;
  maxPatternBars: number;
  minHeadProminence: number;
  maxNecklineSlope: number;
};

const DEFAULT_CONFIG: HaSConfig = {
  swingWindow: 3,
  shoulderTolerance: 0.02,
  minPatternBars: 10,
  maxPatternBars: 80,
  minHeadProminence: 0,
  maxNecklineSlope: Infinity,
};

function findSwingHighIndices(
  candles: DetectorCandle[],
  window: number,
): number[] {
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

function findSwingLowIndices(
  candles: DetectorCandle[],
  window: number,
): number[] {
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

export type HaSDetection = {
  startIndex: number;
  endIndex: number;
  headIndex: number;
  leftShoulderIndex: number;
  rightShoulderIndex: number;
  necklinePrice: number;
  direction: "bearish" | "bullish";
};

export function detectHeadAndShoulders(
  candles: DetectorCandle[],
  config?: Partial<HaSConfig>,
): HaSDetection[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const results: HaSDetection[] = [];

  results.push(
    ...findBearishHaS(candles, cfg),
    ...findBullishHaS(candles, cfg),
  );

  return results;
}

function findBearishHaS(
  candles: DetectorCandle[],
  cfg: HaSConfig,
): HaSDetection[] {
  const swingHighs = findSwingHighIndices(candles, cfg.swingWindow);
  const swingLows = findSwingLowIndices(candles, cfg.swingWindow);
  const results: HaSDetection[] = [];

  for (let i = 0; i < swingHighs.length; i++) {
    for (let j = i + 1; j < swingHighs.length; j++) {
      for (let k = j + 1; k < swingHighs.length; k++) {
        const leftIdx = swingHighs[i];
        const headIdx = swingHighs[j];
        const rightIdx = swingHighs[k];

        const span = rightIdx - leftIdx;
        if (span < cfg.minPatternBars || span > cfg.maxPatternBars) continue;

        const leftHigh = candles[leftIdx].high;
        const headHigh = candles[headIdx].high;
        const rightHigh = candles[rightIdx].high;

        if (headHigh <= leftHigh || headHigh <= rightHigh) continue;

        const shoulderDiff =
          Math.abs(leftHigh - rightHigh) / ((leftHigh + rightHigh) / 2);
        if (shoulderDiff > cfg.shoulderTolerance) continue;

        const necklineLows = swingLows.filter(
          (l) => l > leftIdx && l < rightIdx,
        );
        if (necklineLows.length === 0) continue;

        const necklinePrice = Math.min(
          ...necklineLows.map((l) => candles[l].low),
        );

        if (cfg.minHeadProminence > 0) {
          const avgShoulder = (leftHigh + rightHigh) / 2;
          const headHeight = headHigh - necklinePrice;
          const avgShoulderHeight = avgShoulder - necklinePrice;
          if (
            avgShoulderHeight > 0 &&
            headHeight / avgShoulderHeight < cfg.minHeadProminence
          )
            continue;
        }

        if (necklineLows.length >= 2 && cfg.maxNecklineSlope !== Infinity) {
          const firstLow = necklineLows[0];
          const lastLow = necklineLows[necklineLows.length - 1];
          const atr = candles[rightIdx].atr;
          if (atr !== null && atr > 0) {
            const slope =
              Math.abs(candles[lastLow].low - candles[firstLow].low) /
              (lastLow - firstLow) /
              atr;
            if (slope > cfg.maxNecklineSlope) continue;
          }
        }

        results.push({
          startIndex: leftIdx,
          endIndex: rightIdx,
          headIndex: headIdx,
          leftShoulderIndex: leftIdx,
          rightShoulderIndex: rightIdx,
          necklinePrice,
          direction: "bearish",
        });
      }
    }
  }

  return results;
}

function findBullishHaS(
  candles: DetectorCandle[],
  cfg: HaSConfig,
): HaSDetection[] {
  const swingLows = findSwingLowIndices(candles, cfg.swingWindow);
  const swingHighs = findSwingHighIndices(candles, cfg.swingWindow);
  const results: HaSDetection[] = [];

  for (let i = 0; i < swingLows.length; i++) {
    for (let j = i + 1; j < swingLows.length; j++) {
      for (let k = j + 1; k < swingLows.length; k++) {
        const leftIdx = swingLows[i];
        const headIdx = swingLows[j];
        const rightIdx = swingLows[k];

        const span = rightIdx - leftIdx;
        if (span < cfg.minPatternBars || span > cfg.maxPatternBars) continue;

        const leftLow = candles[leftIdx].low;
        const headLow = candles[headIdx].low;
        const rightLow = candles[rightIdx].low;

        if (headLow >= leftLow || headLow >= rightLow) continue;

        const shoulderDiff =
          Math.abs(leftLow - rightLow) / ((leftLow + rightLow) / 2);
        if (shoulderDiff > cfg.shoulderTolerance) continue;

        const necklineHighs = swingHighs.filter(
          (h) => h > leftIdx && h < rightIdx,
        );
        if (necklineHighs.length === 0) continue;

        const necklinePrice = Math.max(
          ...necklineHighs.map((h) => candles[h].high),
        );

        if (cfg.minHeadProminence > 0) {
          const avgShoulder = (leftLow + rightLow) / 2;
          const headHeight = necklinePrice - headLow;
          const avgShoulderHeight = necklinePrice - avgShoulder;
          if (
            avgShoulderHeight > 0 &&
            headHeight / avgShoulderHeight < cfg.minHeadProminence
          )
            continue;
        }

        if (necklineHighs.length >= 2 && cfg.maxNecklineSlope !== Infinity) {
          const firstHigh = necklineHighs[0];
          const lastHigh = necklineHighs[necklineHighs.length - 1];
          const atr = candles[rightIdx].atr;
          if (atr !== null && atr > 0) {
            const slope =
              Math.abs(candles[lastHigh].high - candles[firstHigh].high) /
              (lastHigh - firstHigh) /
              atr;
            if (slope > cfg.maxNecklineSlope) continue;
          }
        }

        results.push({
          startIndex: leftIdx,
          endIndex: rightIdx,
          headIndex: headIdx,
          leftShoulderIndex: leftIdx,
          rightShoulderIndex: rightIdx,
          necklinePrice,
          direction: "bullish",
        });
      }
    }
  }

  return results;
}

export type HaSScoringContext = {
  rsiAtHead?: number | null;
  rsiAtShoulder?: number | null;
};

export function scoreHeadAndShoulders(
  candles: DetectorCandle[],
  detection: HaSDetection,
  context: HaSScoringContext,
): number {
  let score = 5;
  const {
    headIndex,
    leftShoulderIndex,
    rightShoulderIndex,
    necklinePrice,
    direction,
  } = detection;

  if (direction === "bearish") {
    const leftHeight = candles[leftShoulderIndex].high - necklinePrice;
    const rightHeight = candles[rightShoulderIndex].high - necklinePrice;
    const headHeight = candles[headIndex].high - necklinePrice;
    const avgShoulderHeight = (leftHeight + rightHeight) / 2;

    if (avgShoulderHeight > 0) {
      const symmetry = Math.abs(leftHeight - rightHeight) / avgShoulderHeight;
      if (symmetry <= 0.15) score += 1.5;
      else if (symmetry <= 0.3) score += 0.5;
      else if (symmetry > 0.4) score -= 1;

      const prominence = headHeight / avgShoulderHeight;
      if (prominence >= 1.5 && prominence <= 2.5) score += 1;
      else if (prominence >= 1.15 && prominence <= 3.0) score += 0.5;
    }
  } else {
    const leftHeight = necklinePrice - candles[leftShoulderIndex].low;
    const rightHeight = necklinePrice - candles[rightShoulderIndex].low;
    const headHeight = necklinePrice - candles[headIndex].low;
    const avgShoulderHeight = (leftHeight + rightHeight) / 2;

    if (avgShoulderHeight > 0) {
      const symmetry = Math.abs(leftHeight - rightHeight) / avgShoulderHeight;
      if (symmetry <= 0.15) score += 1.5;
      else if (symmetry <= 0.3) score += 0.5;
      else if (symmetry > 0.4) score -= 1;

      const prominence = headHeight / avgShoulderHeight;
      if (prominence >= 1.5 && prominence <= 2.5) score += 1;
      else if (prominence >= 1.15 && prominence <= 3.0) score += 0.5;
    }
  }

  const rsiHead = context.rsiAtHead ?? null;
  const rsiShoulder = context.rsiAtShoulder ?? null;
  if (rsiHead !== null && rsiShoulder !== null) {
    const divergence =
      direction === "bearish" ? rsiShoulder - rsiHead : rsiHead - rsiShoulder;
    if (divergence >= 8) score += 1;
    else if (divergence >= 3) score += 0.5;
  }

  const leftDuration = headIndex - leftShoulderIndex;
  const rightDuration = rightShoulderIndex - headIndex;
  if (leftDuration > 0 && rightDuration > 0) {
    const timeRatio = rightDuration / leftDuration;
    if (timeRatio >= 0.75 && timeRatio <= 1.25) score += 0.5;
  }

  return Math.max(1, Math.min(10, Math.round(score)));
}

export function calculateHaSLevels(
  pattern: {
    headPrice: number;
    necklinePrice: number;
    direction: "bearish" | "bullish";
  },
  atr: number | null,
): KeyPriceLevels {
  const buffer =
    atr !== null
      ? atr * 0.5
      : Math.abs(pattern.headPrice - pattern.necklinePrice) * 0.05;
  const patternHeight = Math.abs(pattern.headPrice - pattern.necklinePrice);

  if (pattern.direction === "bearish") {
    const entry = pattern.necklinePrice;
    const stopLoss = pattern.headPrice + buffer;
    const takeProfit = entry - patternHeight;

    return {
      entry,
      stopLoss,
      takeProfit,
      anchorPrices: [
        { label: "head", price: pattern.headPrice },
        { label: "neckline", price: pattern.necklinePrice },
      ],
    };
  }

  const entry = pattern.necklinePrice;
  const stopLoss = pattern.headPrice - buffer;
  const takeProfit = entry + patternHeight;

  return {
    entry,
    stopLoss,
    takeProfit,
    anchorPrices: [
      { label: "head", price: pattern.headPrice },
      { label: "neckline", price: pattern.necklinePrice },
    ],
  };
}
