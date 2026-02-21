import type { OandaGranularity } from "@/types/trading";
import type { HtfSnapshot } from "./feature-vector";

type FilterResult = {
  passed: boolean;
  reason: string;
};

export type SignalFilterConfig = {
  minQualityRating: number;
  minWinProb: number;
  requireBothMlModels: boolean;
  minRiskReward: number;
  minConfidence: number;
  minV3Mfe: number;
  rejectOffHours: boolean;
  rejectAsianForEurPairs: boolean;
  minCompositeScore: number;
};

export type SignalFilterInput = {
  qualityRating: number;
  confidence: number;
  v1WinProb: number;
  v2MfeBucket: string;
  v3MfePrediction: number | null;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  direction: string;
  pair: string;
  timeframe: OandaGranularity;
  tradingSession: string | null;
  htfContexts: Record<string, HtfSnapshot | null>;
};

export type SignalFilterResult = {
  passed: boolean;
  rejections: string[];
  compositeScore: number;
};

const DEFAULT_FILTER_CONFIG: SignalFilterConfig = {
  minQualityRating: 6,
  minWinProb: 0.55,
  requireBothMlModels: true,
  minRiskReward: 1.5,
  minConfidence: 0.55,
  minV3Mfe: 0.5,
  rejectOffHours: true,
  rejectAsianForEurPairs: true,
  minCompositeScore: 0.55,
};

const PROFITABLE_MFE_BUCKETS = ["1-1.5R", "1.5-2R", "2R+"];

const EUR_SESSION_PAIRS = [
  "EUR/USD",
  "EUR/GBP",
  "EUR/AUD",
  "EUR/NZD",
  "EUR/CHF",
  "EUR/JPY",
  "GBP/USD",
  "GBP/AUD",
  "GBP/CHF",
];

const TF_HIERARCHY: OandaGranularity[] = ["D", "H4", "H1", "M15"];

export function checkQualityThreshold(
  qualityRating: number,
  minQuality: number,
): FilterResult {
  if (qualityRating < minQuality) {
    return {
      passed: false,
      reason: `quality ${qualityRating} < ${minQuality}`,
    };
  }
  return { passed: true, reason: "" };
}

export function checkMlThresholds(
  v1WinProb: number,
  v2MfeBucket: string,
  minWinProb: number,
  requireBoth: boolean,
): FilterResult {
  const v1Passes = v1WinProb >= minWinProb;
  const v2Passes = PROFITABLE_MFE_BUCKETS.includes(v2MfeBucket);

  if (requireBoth) {
    if (!v1Passes || !v2Passes) {
      return {
        passed: false,
        reason: `ml_threshold: win=${(v1WinProb * 100).toFixed(0)}%${!v1Passes ? " FAIL" : ""}, bucket=${v2MfeBucket}${!v2Passes ? " FAIL" : ""}`,
      };
    }
  } else {
    if (!v1Passes && !v2Passes) {
      return {
        passed: false,
        reason: `ml_threshold: win=${(v1WinProb * 100).toFixed(0)}%, bucket=${v2MfeBucket}`,
      };
    }
  }
  return { passed: true, reason: "" };
}

export function calculateRiskRewardRatio(
  entryPrice: number,
  stopLoss: number,
  takeProfit: number,
): number {
  const risk = Math.abs(entryPrice - stopLoss);
  if (risk === 0) return 0;
  return Math.abs(takeProfit - entryPrice) / risk;
}

export function checkMinRiskReward(
  entryPrice: number,
  stopLoss: number,
  takeProfit: number,
  minRR: number,
): FilterResult {
  const rr = calculateRiskRewardRatio(entryPrice, stopLoss, takeProfit);
  if (rr === 0) {
    return { passed: false, reason: "rr: zero risk distance" };
  }
  if (rr < minRR) {
    return {
      passed: false,
      reason: `rr ${rr.toFixed(2)} < ${minRR}`,
    };
  }
  return { passed: true, reason: "" };
}

export function checkConfidence(
  confidence: number,
  minConfidence: number,
): FilterResult {
  if (confidence < minConfidence) {
    return {
      passed: false,
      reason: `confidence ${confidence.toFixed(2)} < ${minConfidence}`,
    };
  }
  return { passed: true, reason: "" };
}

export function checkV3Mfe(
  v3MfePrediction: number | null,
  minV3Mfe: number,
): FilterResult {
  if (v3MfePrediction === null) {
    return { passed: true, reason: "" };
  }
  if (v3MfePrediction < minV3Mfe) {
    return {
      passed: false,
      reason: `v3_mfe ${v3MfePrediction.toFixed(2)} < ${minV3Mfe}`,
    };
  }
  return { passed: true, reason: "" };
}

export function checkTradingSession(
  pair: string,
  session: string | null,
  rejectOffHours: boolean,
  rejectAsianForEurPairs: boolean,
): FilterResult {
  if (session === null || session === "daily") {
    return { passed: true, reason: "" };
  }

  if (rejectOffHours && session === "off_hours") {
    return { passed: false, reason: "session: off_hours rejected" };
  }

  if (
    rejectAsianForEurPairs &&
    session === "asian" &&
    EUR_SESSION_PAIRS.includes(pair)
  ) {
    return {
      passed: false,
      reason: `session: asian rejected for ${pair}`,
    };
  }

  return { passed: true, reason: "" };
}

export function getImmediateHigherTf(
  timeframe: OandaGranularity,
): OandaGranularity | null {
  const idx = TF_HIERARCHY.indexOf(timeframe);
  if (idx <= 0) return null;
  return TF_HIERARCHY[idx - 1];
}

export function checkHtfAlignment(
  direction: string,
  timeframe: OandaGranularity,
  htfContexts: Record<string, HtfSnapshot | null>,
): FilterResult {
  const higherTf = getImmediateHigherTf(timeframe);
  if (higherTf === null) {
    return { passed: true, reason: "" };
  }

  const snapshot = htfContexts[higherTf.toLowerCase()] ?? null;
  if (snapshot === null || snapshot.trendState === null) {
    return { passed: true, reason: "" };
  }

  const trend = snapshot.trendState;
  const isBullish = direction === "bullish";

  if (isBullish && trend === "strong_downtrend") {
    return {
      passed: false,
      reason: `htf_alignment: bullish vs ${higherTf} strong_downtrend`,
    };
  }

  if (!isBullish && trend === "strong_uptrend") {
    return {
      passed: false,
      reason: `htf_alignment: bearish vs ${higherTf} strong_uptrend`,
    };
  }

  return { passed: true, reason: "" };
}

export function htfAlignmentScore(
  direction: string,
  timeframe: OandaGranularity,
  htfContexts: Record<string, HtfSnapshot | null>,
): number {
  const higherTf = getImmediateHigherTf(timeframe);
  if (higherTf === null) return 0.5;

  const snapshot = htfContexts[higherTf.toLowerCase()] ?? null;
  if (snapshot === null || snapshot.trendState === null) return 0.5;

  const trend = snapshot.trendState;
  const isBullish = direction === "bullish";

  if (isBullish) {
    if (trend === "strong_uptrend") return 1.0;
    if (trend === "weak_uptrend") return 0.75;
    if (trend === "ranging") return 0.5;
    if (trend === "weak_downtrend") return 0.25;
    return 0.0;
  }

  if (trend === "strong_downtrend") return 1.0;
  if (trend === "weak_downtrend") return 0.75;
  if (trend === "ranging") return 0.5;
  if (trend === "weak_uptrend") return 0.25;
  return 0.0;
}

export function calculateCompositeScore(
  qualityRating: number,
  v1WinProb: number,
  rrRatio: number,
  v3MfePrediction: number | null,
  htfScore: number,
): number {
  const qualityNorm = qualityRating / 10;
  const rrNorm = Math.min(rrRatio / 3, 1.0);
  const mfeNorm = Math.max(0, Math.min((v3MfePrediction ?? 0.5) / 2, 1.0));

  return (
    0.2 * qualityNorm +
    0.3 * v1WinProb +
    0.2 * rrNorm +
    0.15 * mfeNorm +
    0.15 * htfScore
  );
}

export function getSignalFilterConfig(): SignalFilterConfig {
  return {
    minQualityRating:
      Number(process.env.FILTER_MIN_QUALITY_RATING) ||
      DEFAULT_FILTER_CONFIG.minQualityRating,
    minWinProb:
      Number(process.env.FILTER_MIN_WIN_PROB) ||
      DEFAULT_FILTER_CONFIG.minWinProb,
    requireBothMlModels: process.env.FILTER_REQUIRE_BOTH_ML !== "false",
    minRiskReward:
      Number(process.env.FILTER_MIN_RISK_REWARD) ||
      DEFAULT_FILTER_CONFIG.minRiskReward,
    minConfidence:
      Number(process.env.FILTER_MIN_CONFIDENCE) ||
      DEFAULT_FILTER_CONFIG.minConfidence,
    minV3Mfe:
      Number(process.env.FILTER_MIN_V3_MFE) || DEFAULT_FILTER_CONFIG.minV3Mfe,
    rejectOffHours: process.env.FILTER_REJECT_OFF_HOURS !== "false",
    rejectAsianForEurPairs: process.env.FILTER_REJECT_ASIAN_EUR !== "false",
    minCompositeScore:
      Number(process.env.FILTER_MIN_COMPOSITE_SCORE) ||
      DEFAULT_FILTER_CONFIG.minCompositeScore,
  };
}

export function runSignalQualityFilters(
  input: SignalFilterInput,
  config: SignalFilterConfig = getSignalFilterConfig(),
): SignalFilterResult {
  const rejections: string[] = [];

  const qualityCheck = checkQualityThreshold(
    input.qualityRating,
    config.minQualityRating,
  );
  if (!qualityCheck.passed) rejections.push(qualityCheck.reason);

  const mlCheck = checkMlThresholds(
    input.v1WinProb,
    input.v2MfeBucket,
    config.minWinProb,
    config.requireBothMlModels,
  );
  if (!mlCheck.passed) rejections.push(mlCheck.reason);

  const rrCheck = checkMinRiskReward(
    input.entryPrice,
    input.stopLoss,
    input.takeProfit,
    config.minRiskReward,
  );
  if (!rrCheck.passed) rejections.push(rrCheck.reason);

  const confidenceCheck = checkConfidence(
    input.confidence,
    config.minConfidence,
  );
  if (!confidenceCheck.passed) rejections.push(confidenceCheck.reason);

  const v3Check = checkV3Mfe(input.v3MfePrediction, config.minV3Mfe);
  if (!v3Check.passed) rejections.push(v3Check.reason);

  const sessionCheck = checkTradingSession(
    input.pair,
    input.tradingSession,
    config.rejectOffHours,
    config.rejectAsianForEurPairs,
  );
  if (!sessionCheck.passed) rejections.push(sessionCheck.reason);

  const htfCheck = checkHtfAlignment(
    input.direction,
    input.timeframe,
    input.htfContexts,
  );
  if (!htfCheck.passed) rejections.push(htfCheck.reason);

  const rrRatio = calculateRiskRewardRatio(
    input.entryPrice,
    input.stopLoss,
    input.takeProfit,
  );

  const htfScore = htfAlignmentScore(
    input.direction,
    input.timeframe,
    input.htfContexts,
  );

  const compositeScore = calculateCompositeScore(
    input.qualityRating,
    input.v1WinProb,
    rrRatio,
    input.v3MfePrediction,
    htfScore,
  );

  if (compositeScore < config.minCompositeScore) {
    rejections.push(
      `composite ${compositeScore.toFixed(2)} < ${config.minCompositeScore}`,
    );
  }

  return {
    passed: rejections.length === 0,
    rejections,
    compositeScore,
  };
}
