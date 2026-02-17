import type {
  DetectorCandle,
  PatternCandidate,
  CandidateId,
  CandidateContext,
  TrendState,
} from "@/types/trading";
import { detectPinBars, calculatePinBarLevels, scorePinBar } from "./pin-bar";
import {
  detectDoubleTops,
  calculateDoubleTopLevels,
  scoreDoubleTop,
} from "./double-top";
import {
  detectDoubleBottoms,
  calculateDoubleBottomLevels,
  scoreDoubleBottom,
} from "./double-bottom";
import {
  detectHeadAndShoulders,
  calculateHaSLevels,
  scoreHeadAndShoulders,
} from "./head-and-shoulders";
import {
  detectFalseBreakouts,
  calculateFalseBreakoutLevels,
  scoreFalseBreakout,
} from "./false-breakout";
import { detectSupportResistanceLevels } from "../context-features";

export type EnrichedDetectorCandle = DetectorCandle & {
  timestamp: string;
  trendState: TrendState | null;
  nearestSupport: number | null;
  nearestResistance: number | null;
  rsi: number | null;
  adx: number | null;
};

function nextCandidateId(): CandidateId {
  return crypto.randomUUID() as CandidateId;
}

function buildContext(candle: EnrichedDetectorCandle): CandidateContext {
  return {
    trendState: candle.trendState,
    nearestSupport: candle.nearestSupport,
    nearestResistance: candle.nearestResistance,
    atr: candle.atr,
    rsi: candle.rsi,
  };
}

export type FindCandidatesOptions = {
  maxCandidates?: number;
};

const DEFAULT_MAX_CANDIDATES = 120;

export function deduplicateOverlapping(
  candidates: PatternCandidate[],
): PatternCandidate[] {
  if (candidates.length === 0) return [];

  const sorted = [...candidates].sort((a, b) => a.startIndex - b.startIndex);
  const kept: PatternCandidate[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = kept[kept.length - 1];
    const overlaps = current.startIndex <= last.endIndex;

    if (overlaps) {
      if (current.confidence > last.confidence) {
        kept[kept.length - 1] = current;
      }
    } else {
      kept.push(current);
    }
  }

  return kept;
}

export function findAllCandidates(
  candles: EnrichedDetectorCandle[],
  pair: string,
  options?: FindCandidatesOptions,
): PatternCandidate[] {
  if (candles.length === 0) return [];

  const candidates: PatternCandidate[] = [];

  const pinBars = detectPinBars(candles);
  for (const pb of pinBars) {
    const c = candles[pb.index];
    const levels = calculatePinBarLevels(c, pb.direction);
    const qualityScore = scorePinBar(candles, pb.index, pb.direction, {
      nearestSupport: c.nearestSupport,
      nearestResistance: c.nearestResistance,
      volume: c.volume,
      volumeSma: c.volumeSma,
    });
    candidates.push({
      id: nextCandidateId(),
      pair,
      patternType: "pin_bar",
      startIndex: pb.index,
      endIndex: pb.index,
      keyPriceLevels: levels,
      confidence: qualityScore / 10,
      contextSnapshot: buildContext(c),
    });
  }

  const doubleTops = detectDoubleTops(candles);
  for (const dt of doubleTops) {
    const endCandle = candles[dt.secondTopIndex];
    const startCandle = candles[dt.firstTopIndex];
    const topPrice = Math.max(startCandle.high, endCandle.high);
    const levels = calculateDoubleTopLevels(
      { topPrice, necklinePrice: dt.necklinePrice },
      endCandle.atr,
    );
    const qualityScore = scoreDoubleTop(candles, dt, {
      rsiAtFirst: startCandle.rsi,
      rsiAtSecond: endCandle.rsi,
      volumeAtFirst: startCandle.volume,
      volumeAtSecond: endCandle.volume,
    });
    candidates.push({
      id: nextCandidateId(),
      pair,
      patternType: "double_top",
      startIndex: dt.firstTopIndex,
      endIndex: dt.secondTopIndex,
      keyPriceLevels: levels,
      confidence: qualityScore / 10,
      contextSnapshot: buildContext(endCandle),
    });
  }

  const doubleBottoms = detectDoubleBottoms(candles);
  for (const db of doubleBottoms) {
    const endCandle = candles[db.secondBottomIndex];
    const startCandle = candles[db.firstBottomIndex];
    const bottomPrice = Math.min(startCandle.low, endCandle.low);
    const levels = calculateDoubleBottomLevels(
      { bottomPrice, necklinePrice: db.necklinePrice },
      endCandle.atr,
    );
    const qualityScore = scoreDoubleBottom(candles, db, {
      rsiAtFirst: startCandle.rsi,
      rsiAtSecond: endCandle.rsi,
      volumeAtFirst: startCandle.volume,
      volumeAtSecond: endCandle.volume,
    });
    candidates.push({
      id: nextCandidateId(),
      pair,
      patternType: "double_bottom",
      startIndex: db.firstBottomIndex,
      endIndex: db.secondBottomIndex,
      keyPriceLevels: levels,
      confidence: qualityScore / 10,
      contextSnapshot: buildContext(endCandle),
    });
  }

  const hasPatterns = detectHeadAndShoulders(candles);
  for (const has of hasPatterns) {
    const endCandle = candles[has.endIndex];
    const headCandle = candles[has.headIndex];
    const headPrice =
      has.direction === "bearish" ? headCandle.high : headCandle.low;
    const levels = calculateHaSLevels(
      {
        headPrice,
        necklinePrice: has.necklinePrice,
        direction: has.direction,
      },
      endCandle.atr,
    );
    const qualityScore = scoreHeadAndShoulders(candles, has, {
      rsiAtHead: headCandle.rsi,
      rsiAtShoulder: candles[has.leftShoulderIndex].rsi,
    });
    candidates.push({
      id: nextCandidateId(),
      pair,
      patternType: "head_and_shoulders",
      startIndex: has.startIndex,
      endIndex: has.endIndex,
      keyPriceLevels: levels,
      confidence: qualityScore / 10,
      contextSnapshot: buildContext(endCandle),
    });
  }

  const priceCandles = candles.map((c) => ({
    high: c.high,
    low: c.low,
    close: c.close,
  }));
  const srLevels = detectSupportResistanceLevels(priceCandles);
  const falseBreakouts = detectFalseBreakouts(candles, srLevels);
  for (const fb of falseBreakouts) {
    const endCandle = candles[fb.reversalIndex];
    const breakCandle = candles[fb.breakIndex];
    const extremePrice =
      fb.direction === "bullish" ? breakCandle.low : breakCandle.high;
    const levels = calculateFalseBreakoutLevels(
      { brokenLevel: fb.brokenLevel, extremePrice, direction: fb.direction },
      endCandle.atr,
    );
    const qualityScore = scoreFalseBreakout(candles, fb, {
      volume: breakCandle.volume,
      volumeSma: breakCandle.volumeSma,
      reversalVolume: endCandle.volume,
    });
    candidates.push({
      id: nextCandidateId(),
      pair,
      patternType: "false_breakout",
      startIndex: fb.breakIndex,
      endIndex: fb.reversalIndex,
      keyPriceLevels: levels,
      confidence: qualityScore / 10,
      contextSnapshot: buildContext(endCandle),
    });
  }

  candidates.sort((a, b) => a.startIndex - b.startIndex);

  const deduped = deduplicateOverlapping(candidates);
  const max = options?.maxCandidates ?? DEFAULT_MAX_CANDIDATES;

  if (deduped.length <= max) return deduped;

  return deduped
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, max)
    .sort((a, b) => a.startIndex - b.startIndex);
}
