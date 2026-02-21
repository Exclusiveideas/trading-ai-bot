import type {
  PatternCandidate,
  PatternType,
  TrendState,
  OandaGranularity,
} from "@/types/trading";
import type { IndicatorRow } from "@/lib/pipeline/indicators";

export type HtfSnapshot = {
  rsi: number | null;
  adx: number | null;
  macdHistogram: number | null;
  close: number | null;
  sma20: number | null;
  sma50: number | null;
  ema200: number | null;
  bbUpper: number | null;
  bbLower: number | null;
  atr: number | null;
  trendState: TrendState | null;
};

type CandleSnapshot = {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type ContextSnapshot = {
  distToSupportPips: number | null;
  distToResistancePips: number | null;
  distToSupportAtr: number | null;
  distToResistanceAtr: number | null;
  distToRoundNumberPips: number | null;
  trendState: TrendState | null;
  tradingSession: string | null;
};

const PATTERN_TYPES: PatternType[] = [
  "double_bottom",
  "double_top",
  "false_breakout",
  "head_and_shoulders",
  "pin_bar",
];

const TIMEFRAME_VALUES: OandaGranularity[] = ["D", "H1", "H4", "M15"];

const TREND_STATES: TrendState[] = [
  "ranging",
  "strong_downtrend",
  "strong_uptrend",
  "unknown" as TrendState,
  "weak_downtrend",
  "weak_uptrend",
];

const TRADING_SESSIONS = [
  "asian",
  "daily",
  "london",
  "new_york",
  "off_hours",
  "unknown",
];

const RSI_ZONES = ["neutral", "overbought", "oversold", "unknown"];

const HTF_ORDER = ["d", "h4", "h1"] as const;

function computeTrendAlignment(
  patternType: string,
  trendState: string | null,
): number | null {
  if (!trendState) return null;

  const bullishPatterns = ["double_bottom", "false_breakout"];
  const bearishPatterns = ["double_top", "head_and_shoulders"];
  const bullishTrends = ["strong_uptrend", "weak_uptrend"];
  const bearishTrends = ["strong_downtrend", "weak_downtrend"];

  if (trendState === "ranging") return 0;

  const isBullishPattern = bullishPatterns.includes(patternType);
  const isBearishPattern = bearishPatterns.includes(patternType);

  if (isBullishPattern) {
    if (bullishTrends.includes(trendState)) return 1;
    if (bearishTrends.includes(trendState)) return -1;
  }
  if (isBearishPattern) {
    if (bearishTrends.includes(trendState)) return 1;
    if (bullishTrends.includes(trendState)) return -1;
  }

  return 0;
}

function computeRsiZone(rsi: number | null): string {
  if (rsi == null) return "unknown";
  if (rsi < 30) return "oversold";
  if (rsi > 70) return "overbought";
  return "neutral";
}

function oneHot(
  value: string | null,
  categories: readonly string[] | string[],
  prefix: string,
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const cat of categories) {
    result[`${prefix}_${cat}`] = value === cat ? 1 : 0;
  }
  return result;
}

function getHigherTimeframes(tf: OandaGranularity): string[] {
  const hierarchy: OandaGranularity[] = ["D", "H4", "H1", "M15"];
  const idx = hierarchy.indexOf(tf);
  if (idx <= 0) return [];
  return hierarchy.slice(0, idx);
}

export function buildFeatureVector(
  candidate: PatternCandidate,
  candle: CandleSnapshot,
  indicators: IndicatorRow,
  context: ContextSnapshot,
  timeframe: OandaGranularity,
  htfContexts: Record<string, HtfSnapshot | null>,
): Record<string, number | null> {
  const o = candle.open;
  const h = candle.high;
  const l = candle.low;
  const c = candle.close;
  const v = candle.volume;
  const f = indicators;

  const range = h - l;
  const body = Math.abs(c - o);
  const isBullish =
    candidate.keyPriceLevels.takeProfit > candidate.keyPriceLevels.entry;
  const upperWick = h - Math.max(o, c);
  const lowerWick = Math.min(o, c) - l;
  const tail = isBullish ? lowerWick : upperWick;
  const nose = isBullish ? upperWick : lowerWick;

  const bodyRatio = range > 0 ? body / range : null;
  const tailRatio = range > 0 ? tail / range : null;
  const noseRatio = range > 0 ? nose / range : null;
  const rangeAtrRatio = f.atr && f.atr > 0 ? range / f.atr : null;

  const riskDist = Math.abs(
    candidate.keyPriceLevels.entry - candidate.keyPriceLevels.stopLoss,
  );
  const rewardDist = Math.abs(
    candidate.keyPriceLevels.takeProfit - candidate.keyPriceLevels.entry,
  );
  const riskRewardRatio = riskDist > 0 ? rewardDist / riskDist : null;

  const trendAlignment = computeTrendAlignment(
    candidate.patternType,
    context.trendState,
  );
  const volatilityRegime =
    f.atr != null && c > 0 ? +(f.atr / c).toFixed(6) : null;
  const bbWidth =
    f.bbUpper != null && f.bbLower != null && f.bbMiddle && f.bbMiddle > 0
      ? +((f.bbUpper - f.bbLower) / f.bbMiddle).toFixed(6)
      : null;
  const rsiZone = computeRsiZone(f.rsi);

  const features: Record<string, number | null> = {
    open: o,
    high: h,
    low: l,
    close: c,
    volume: v,
    sma_20: f.sma20,
    sma_50: f.sma50,
    ema_200: f.ema200,
    rsi: f.rsi,
    macd: f.macd,
    macd_signal: f.macdSignal,
    macd_histogram: f.macdHistogram,
    adx: f.adx,
    atr: f.atr,
    bb_upper: f.bbUpper,
    bb_middle: f.bbMiddle,
    bb_lower: f.bbLower,
    volume_sma: f.volumeSma,
    dist_to_support_pips: context.distToSupportPips,
    dist_to_resistance_pips: context.distToResistancePips,
    dist_to_support_atr: context.distToSupportAtr,
    dist_to_resistance_atr: context.distToResistanceAtr,
    dist_to_round_number_pips: context.distToRoundNumberPips,
    body_ratio: bodyRatio != null ? +bodyRatio.toFixed(4) : null,
    tail_ratio: tailRatio != null ? +tailRatio.toFixed(4) : null,
    nose_ratio: noseRatio != null ? +noseRatio.toFixed(4) : null,
    range_atr_ratio: rangeAtrRatio != null ? +rangeAtrRatio.toFixed(4) : null,
    risk_reward_ratio:
      riskRewardRatio != null ? +riskRewardRatio.toFixed(4) : null,
    trend_alignment: trendAlignment,
    volatility_regime: volatilityRegime,
    bb_width: bbWidth,
  };

  // HTF numeric features
  const higherTfs = getHigherTimeframes(timeframe);
  for (const htf of HTF_ORDER) {
    const prefix = `htf_${htf}`;
    const snapshot =
      higherTfs.includes(htf.toUpperCase()) ? htfContexts[htf] ?? null : null;

    features[`${prefix}_rsi`] = snapshot?.rsi ?? null;
    features[`${prefix}_adx`] = snapshot?.adx ?? null;
    features[`${prefix}_macd_histogram`] = snapshot?.macdHistogram ?? null;
    features[`${prefix}_close`] = snapshot?.close ?? null;
    features[`${prefix}_sma_20`] = snapshot?.sma20 ?? null;
    features[`${prefix}_sma_50`] = snapshot?.sma50 ?? null;
    features[`${prefix}_ema_200`] = snapshot?.ema200 ?? null;
    features[`${prefix}_bb_upper`] = snapshot?.bbUpper ?? null;
    features[`${prefix}_bb_lower`] = snapshot?.bbLower ?? null;
    features[`${prefix}_atr`] = snapshot?.atr ?? null;
  }

  // One-hot: pattern_type
  Object.assign(
    features,
    oneHot(candidate.patternType, PATTERN_TYPES, "pattern_type"),
  );

  // One-hot: timeframe
  Object.assign(features, oneHot(timeframe, TIMEFRAME_VALUES, "timeframe"));

  // One-hot: trend_state
  Object.assign(
    features,
    oneHot(context.trendState ?? "unknown", TREND_STATES, "trend_state"),
  );

  // One-hot: trading_session
  Object.assign(
    features,
    oneHot(
      context.tradingSession ?? "unknown",
      TRADING_SESSIONS,
      "trading_session",
    ),
  );

  // One-hot: rsi_zone
  Object.assign(features, oneHot(rsiZone, RSI_ZONES, "rsi_zone"));

  // One-hot: HTF trend states
  for (const htf of HTF_ORDER) {
    const snapshot =
      higherTfs.includes(htf.toUpperCase()) ? htfContexts[htf] ?? null : null;
    const trendVal = snapshot?.trendState ?? "unknown";
    Object.assign(
      features,
      oneHot(trendVal, TREND_STATES, `htf_${htf}_trend_state`),
    );
  }

  return features;
}
