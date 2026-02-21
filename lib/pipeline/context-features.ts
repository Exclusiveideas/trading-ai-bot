import type { TrendState, TradingSession } from "@/types/trading";

type PriceCandle = {
  high: number;
  low: number;
  close: number;
};

export type SupportResistanceLevel = {
  price: number;
  type: "support" | "resistance";
};

export type ScoredLevel = {
  price: number;
  touchCount: number;
  recencyScore: number;
  qualityScore: number;
};

export function detectSwingHighs(
  candles: PriceCandle[],
  windowSize: number = 5,
): number[] {
  const levels: number[] = [];
  for (let i = windowSize; i < candles.length - windowSize; i++) {
    let isSwingHigh = true;
    for (let j = 1; j <= windowSize; j++) {
      if (
        candles[i].high <= candles[i - j].high ||
        candles[i].high <= candles[i + j].high
      ) {
        isSwingHigh = false;
        break;
      }
    }
    if (isSwingHigh) levels.push(candles[i].high);
  }
  return levels;
}

export function detectSwingLows(
  candles: PriceCandle[],
  windowSize: number = 5,
): number[] {
  const levels: number[] = [];
  for (let i = windowSize; i < candles.length - windowSize; i++) {
    let isSwingLow = true;
    for (let j = 1; j <= windowSize; j++) {
      if (
        candles[i].low >= candles[i - j].low ||
        candles[i].low >= candles[i + j].low
      ) {
        isSwingLow = false;
        break;
      }
    }
    if (isSwingLow) levels.push(candles[i].low);
  }
  return levels;
}

export function clusterLevels(
  levels: number[],
  clusterThreshold: number,
): number[] {
  if (levels.length === 0) return [];

  const sorted = [...levels].sort((a, b) => a - b);
  const clusters: number[][] = [[sorted[0]]];

  for (let i = 1; i < sorted.length; i++) {
    const lastCluster = clusters[clusters.length - 1];
    const clusterAvg =
      lastCluster.reduce((s, v) => s + v, 0) / lastCluster.length;

    if (Math.abs(sorted[i] - clusterAvg) <= clusterThreshold) {
      lastCluster.push(sorted[i]);
    } else {
      clusters.push([sorted[i]]);
    }
  }

  return clusters.map(
    (cluster) => cluster.reduce((s, v) => s + v, 0) / cluster.length,
  );
}

export function detectSupportResistanceLevels(
  candles: PriceCandle[],
  lookback: number = 100,
  windowSize: number = 5,
  clusterThreshold: number = 0.002,
): number[] {
  const slice = candles.slice(-Math.min(lookback, candles.length));
  if (slice.length < windowSize * 2 + 1) return [];

  const highs = detectSwingHighs(slice, windowSize);
  const lows = detectSwingLows(slice, windowSize);
  const allLevels = [...highs, ...lows];

  return clusterLevels(allLevels, clusterThreshold);
}

export function scoreSupportResistanceLevels(
  candles: PriceCandle[],
  lookback: number = 100,
  windowSize: number = 5,
  clusterThreshold: number = 0.002,
): ScoredLevel[] {
  const slice = candles.slice(-Math.min(lookback, candles.length));
  if (slice.length < windowSize * 2 + 1) return [];

  const totalBars = slice.length;
  const swingHighIndices: { price: number; index: number }[] = [];
  const swingLowIndices: { price: number; index: number }[] = [];

  for (let i = windowSize; i < slice.length - windowSize; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = 1; j <= windowSize; j++) {
      if (
        slice[i].high <= slice[i - j].high ||
        slice[i].high <= slice[i + j].high
      )
        isHigh = false;
      if (slice[i].low >= slice[i - j].low || slice[i].low >= slice[i + j].low)
        isLow = false;
      if (!isHigh && !isLow) break;
    }
    if (isHigh) swingHighIndices.push({ price: slice[i].high, index: i });
    if (isLow) swingLowIndices.push({ price: slice[i].low, index: i });
  }

  const allSwings = [...swingHighIndices, ...swingLowIndices];
  if (allSwings.length === 0) return [];

  const sorted = [...allSwings].sort((a, b) => a.price - b.price);
  const clusters: { price: number; index: number }[][] = [[sorted[0]]];

  for (let i = 1; i < sorted.length; i++) {
    const lastCluster = clusters[clusters.length - 1];
    const clusterAvg =
      lastCluster.reduce((s, v) => s + v.price, 0) / lastCluster.length;
    if (Math.abs(sorted[i].price - clusterAvg) <= clusterThreshold) {
      lastCluster.push(sorted[i]);
    } else {
      clusters.push([sorted[i]]);
    }
  }

  return clusters.map((cluster) => {
    const avgPrice = cluster.reduce((s, v) => s + v.price, 0) / cluster.length;
    const touchCount = cluster.length;
    const mostRecentIndex = Math.max(...cluster.map((c) => c.index));
    const recencyScore = totalBars > 0 ? mostRecentIndex / totalBars : 0;
    const qualityScore =
      (Math.min(touchCount, 5) / 5) * 0.6 + recencyScore * 0.4;

    return { price: avgPrice, touchCount, recencyScore, qualityScore };
  });
}

export function findNearestLevels(
  price: number,
  levels: number[],
): { support: number | null; resistance: number | null } {
  if (levels.length === 0) return { support: null, resistance: null };

  const sorted = [...levels].sort((a, b) => a - b);

  let support: number | null = null;
  let resistance: number | null = null;

  for (const level of sorted) {
    if (level < price) support = level;
    if (level >= price && resistance === null) resistance = level;
  }

  return { support, resistance };
}

export function distanceInPips(
  price: number,
  level: number,
  pair?: string,
): number {
  const multiplier = pair?.includes("JPY") ? 100 : 10000;
  return Math.abs(price - level) * multiplier;
}

export function distanceInAtr(
  price: number,
  level: number,
  atr: number | null,
): number | null {
  if (atr === null || atr === 0) return null;
  return Math.abs(price - level) / atr;
}

export function classifyTrendState(
  sma20: number | null,
  sma50: number | null,
  ema200: number | null,
  adx: number | null,
  close: number,
): TrendState | null {
  if (ema200 === null || adx === null || sma20 === null || sma50 === null) {
    return null;
  }

  const aboveEma200 = close > ema200;
  const strongTrend = adx > 25;
  const smaAligned = sma20 > sma50;

  if (strongTrend && aboveEma200 && smaAligned) return "strong_uptrend";
  if (!strongTrend && aboveEma200) return "weak_uptrend";
  if (strongTrend && !aboveEma200 && !smaAligned) return "strong_downtrend";
  if (!strongTrend && !aboveEma200) return "weak_downtrend";
  return "ranging";
}

export function identifyTradingSession(
  timestamp: Date,
  timeframe?: string,
): TradingSession {
  if (timeframe === "D") return "daily";

  const hour = timestamp.getUTCHours();

  if (hour >= 21) return "off_hours";
  if (hour >= 13) return "new_york";
  if (hour >= 8) return "london";
  return "asian";
}

export function findNearestRoundNumber(price: number): number {
  const major = Math.round(price * 100) / 100;
  const halfUp = Math.ceil(price * 200) / 200;
  const halfDown = Math.floor(price * 200) / 200;

  const candidates = [major, halfUp, halfDown];

  let nearest = candidates[0];
  let minDist = Math.abs(price - nearest);

  for (const candidate of candidates) {
    const dist = Math.abs(price - candidate);
    if (dist < minDist) {
      minDist = dist;
      nearest = candidate;
    }
  }

  return nearest;
}
