import type {
  DetectorCandle,
  PatternCandidate,
  CandidateId,
  CandidateContext,
  TrendState,
} from "@/types/trading";
import { detectPinBars, calculatePinBarLevels } from "./pin-bar";
import { detectDoubleTops, calculateDoubleTopLevels } from "./double-top";
import {
  detectDoubleBottoms,
  calculateDoubleBottomLevels,
} from "./double-bottom";
import {
  detectHeadAndShoulders,
  calculateHaSLevels,
} from "./head-and-shoulders";
import {
  detectFalseBreakouts,
  calculateFalseBreakoutLevels,
} from "./false-breakout";
import { detectSupportResistanceLevels } from "../context-features";

export type EnrichedDetectorCandle = DetectorCandle & {
  timestamp: string;
  trendState: TrendState | null;
  nearestSupport: number | null;
  nearestResistance: number | null;
  rsi: number | null;
};

let candidateCounter = 0;

function nextCandidateId(): CandidateId {
  candidateCounter++;
  return `candidate-${candidateCounter}` as CandidateId;
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
    candidates.push({
      id: nextCandidateId(),
      pair,
      patternType: "pin_bar",
      startIndex: pb.index,
      endIndex: pb.index,
      keyPriceLevels: levels,
      confidence: calculatePinBarConfidence(c),
      contextSnapshot: buildContext(c),
    });
  }

  const doubleTops = detectDoubleTops(candles);
  for (const dt of doubleTops) {
    const endCandle = candles[dt.secondTopIndex];
    const topPrice = Math.max(
      candles[dt.firstTopIndex].high,
      candles[dt.secondTopIndex].high,
    );
    const levels = calculateDoubleTopLevels(
      { topPrice, necklinePrice: dt.necklinePrice },
      endCandle.atr,
    );
    candidates.push({
      id: nextCandidateId(),
      pair,
      patternType: "double_top",
      startIndex: dt.firstTopIndex,
      endIndex: dt.secondTopIndex,
      keyPriceLevels: levels,
      confidence: 0.6,
      contextSnapshot: buildContext(endCandle),
    });
  }

  const doubleBottoms = detectDoubleBottoms(candles);
  for (const db of doubleBottoms) {
    const endCandle = candles[db.secondBottomIndex];
    const bottomPrice = Math.min(
      candles[db.firstBottomIndex].low,
      candles[db.secondBottomIndex].low,
    );
    const levels = calculateDoubleBottomLevels(
      { bottomPrice, necklinePrice: db.necklinePrice },
      endCandle.atr,
    );
    candidates.push({
      id: nextCandidateId(),
      pair,
      patternType: "double_bottom",
      startIndex: db.firstBottomIndex,
      endIndex: db.secondBottomIndex,
      keyPriceLevels: levels,
      confidence: 0.6,
      contextSnapshot: buildContext(endCandle),
    });
  }

  const hasPatterns = detectHeadAndShoulders(candles);
  for (const has of hasPatterns) {
    const endCandle = candles[has.endIndex];
    const headPrice =
      has.direction === "bearish"
        ? candles[has.headIndex].high
        : candles[has.headIndex].low;
    const levels = calculateHaSLevels(
      { headPrice, necklinePrice: has.necklinePrice, direction: has.direction },
      endCandle.atr,
    );
    candidates.push({
      id: nextCandidateId(),
      pair,
      patternType: "head_and_shoulders",
      startIndex: has.startIndex,
      endIndex: has.endIndex,
      keyPriceLevels: levels,
      confidence: 0.7,
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
    const extremePrice =
      fb.direction === "bullish"
        ? candles[fb.breakIndex].low
        : candles[fb.breakIndex].high;
    const levels = calculateFalseBreakoutLevels(
      { brokenLevel: fb.brokenLevel, extremePrice, direction: fb.direction },
      endCandle.atr,
    );
    candidates.push({
      id: nextCandidateId(),
      pair,
      patternType: "false_breakout",
      startIndex: fb.breakIndex,
      endIndex: fb.reversalIndex,
      keyPriceLevels: levels,
      confidence: 0.5,
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

function calculatePinBarConfidence(candle: DetectorCandle): number {
  const range = candle.high - candle.low;
  if (range <= 0) return 0;

  const body = Math.abs(candle.close - candle.open);
  const bodyRatio = body / range;
  const upperWick = candle.high - Math.max(candle.open, candle.close);
  const lowerWick = Math.min(candle.open, candle.close) - candle.low;
  const dominantWick = Math.max(upperWick, lowerWick);
  const wickRatio = dominantWick / range;

  const wickScore = Math.min(wickRatio / 0.8, 1);
  const bodyScore = Math.min((0.35 - bodyRatio) / 0.35, 1);
  return Math.max(0, Math.min(1, (wickScore + bodyScore) / 2));
}

export function resetCandidateCounter(): void {
  candidateCounter = 0;
}
