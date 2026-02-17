import type { DetectorCandle, KeyPriceLevels } from "@/types/trading";

export type HaSConfig = {
  swingWindow: number;
  shoulderTolerance: number;
  minPatternBars: number;
  maxPatternBars: number;
};

const DEFAULT_CONFIG: HaSConfig = {
  swingWindow: 3,
  shoulderTolerance: 0.02,
  minPatternBars: 10,
  maxPatternBars: 80,
};

function findSwingHighIndices(candles: DetectorCandle[], window: number): number[] {
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

function findSwingLowIndices(candles: DetectorCandle[], window: number): number[] {
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
  config?: Partial<HaSConfig>
): HaSDetection[] {
  const { swingWindow, shoulderTolerance, minPatternBars, maxPatternBars } = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  const results: HaSDetection[] = [];

  const bearishPatterns = findBearishHaS(
    candles, swingWindow, shoulderTolerance, minPatternBars, maxPatternBars
  );
  results.push(...bearishPatterns);

  const bullishPatterns = findBullishHaS(
    candles, swingWindow, shoulderTolerance, minPatternBars, maxPatternBars
  );
  results.push(...bullishPatterns);

  return results;
}

function findBearishHaS(
  candles: DetectorCandle[],
  swingWindow: number,
  shoulderTolerance: number,
  minPatternBars: number,
  maxPatternBars: number
): HaSDetection[] {
  const swingHighs = findSwingHighIndices(candles, swingWindow);
  const swingLows = findSwingLowIndices(candles, swingWindow);
  const results: HaSDetection[] = [];

  for (let i = 0; i < swingHighs.length; i++) {
    for (let j = i + 1; j < swingHighs.length; j++) {
      for (let k = j + 1; k < swingHighs.length; k++) {
        const leftIdx = swingHighs[i];
        const headIdx = swingHighs[j];
        const rightIdx = swingHighs[k];

        const span = rightIdx - leftIdx;
        if (span < minPatternBars || span > maxPatternBars) continue;

        const leftHigh = candles[leftIdx].high;
        const headHigh = candles[headIdx].high;
        const rightHigh = candles[rightIdx].high;

        if (headHigh <= leftHigh || headHigh <= rightHigh) continue;

        const shoulderDiff = Math.abs(leftHigh - rightHigh) / ((leftHigh + rightHigh) / 2);
        if (shoulderDiff > shoulderTolerance) continue;

        const necklineLows = swingLows.filter((l) => l > leftIdx && l < rightIdx);
        if (necklineLows.length === 0) continue;

        const necklinePrice = Math.min(...necklineLows.map((l) => candles[l].low));

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
  swingWindow: number,
  shoulderTolerance: number,
  minPatternBars: number,
  maxPatternBars: number
): HaSDetection[] {
  const swingLows = findSwingLowIndices(candles, swingWindow);
  const swingHighs = findSwingHighIndices(candles, swingWindow);
  const results: HaSDetection[] = [];

  for (let i = 0; i < swingLows.length; i++) {
    for (let j = i + 1; j < swingLows.length; j++) {
      for (let k = j + 1; k < swingLows.length; k++) {
        const leftIdx = swingLows[i];
        const headIdx = swingLows[j];
        const rightIdx = swingLows[k];

        const span = rightIdx - leftIdx;
        if (span < minPatternBars || span > maxPatternBars) continue;

        const leftLow = candles[leftIdx].low;
        const headLow = candles[headIdx].low;
        const rightLow = candles[rightIdx].low;

        if (headLow >= leftLow || headLow >= rightLow) continue;

        const shoulderDiff = Math.abs(leftLow - rightLow) / ((leftLow + rightLow) / 2);
        if (shoulderDiff > shoulderTolerance) continue;

        const necklineHighs = swingHighs.filter((h) => h > leftIdx && h < rightIdx);
        if (necklineHighs.length === 0) continue;

        const necklinePrice = Math.max(...necklineHighs.map((h) => candles[h].high));

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

export function calculateHaSLevels(
  pattern: { headPrice: number; necklinePrice: number; direction: "bearish" | "bullish" },
  atr: number | null
): KeyPriceLevels {
  const buffer = atr !== null ? atr * 0.5 : Math.abs(pattern.headPrice - pattern.necklinePrice) * 0.05;
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
