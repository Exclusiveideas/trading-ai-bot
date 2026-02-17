type Brand<T, B extends string> = T & { readonly __brand: B };

export type RawCandleId = Brand<number, "RawCandleId">;
export type CalculatedFeatureId = Brand<number, "CalculatedFeatureId">;
export type ContextFeatureId = Brand<number, "ContextFeatureId">;

export type Candle = {
  id?: RawCandleId;
  pair: string;
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timeframe: string;
};

export type CalculatedFeatures = {
  id?: CalculatedFeatureId;
  candle_id: RawCandleId;
  sma_20: number | null;
  sma_50: number | null;
  ema_200: number | null;
  rsi: number | null;
  macd: number | null;
  macd_signal: number | null;
  macd_histogram: number | null;
  adx: number | null;
  atr: number | null;
  bb_upper: number | null;
  bb_middle: number | null;
  bb_lower: number | null;
  volume_sma: number | null;
};

export type TradingSession = "asian" | "london" | "new_york" | "off_hours" | "daily";

export type ContextFeatures = {
  id?: ContextFeatureId;
  candle_id: RawCandleId;
  nearest_support: number | null;
  nearest_resistance: number | null;
  dist_to_support_pips: number | null;
  dist_to_resistance_pips: number | null;
  dist_to_support_atr: number | null;
  dist_to_resistance_atr: number | null;
  trend_state: TrendState | null;
  trading_session: TradingSession | null;
  nearest_round_number: number | null;
  dist_to_round_number_pips: number | null;
};

export type PatternType =
  | "pin_bar"
  | "head_and_shoulders"
  | "double_top"
  | "double_bottom"
  | "false_breakout";

export type Outcome = "win" | "loss" | "breakeven" | "pending";

export type TrendState =
  | "strong_uptrend"
  | "weak_uptrend"
  | "ranging"
  | "weak_downtrend"
  | "strong_downtrend";

export type LabeledPatternId = Brand<number, "LabeledPatternId">;

export type LabeledPattern = {
  id?: LabeledPatternId;
  pair: string;
  pattern_type: PatternType;
  start_timestamp: string;
  end_timestamp: string;
  entry_price: number;
  stop_loss: number;
  take_profit: number;
  outcome: Outcome;
  r_multiple: number | null;
  bars_to_outcome: number | null;
  quality_rating: number;
  trend_state: TrendState | null;
  session: string | null;
  support_quality: number | null;
  notes: string | null;
  context_json: Record<string, unknown> | null;
  created_at?: string;
};

export type CandidateId = Brand<string, "CandidateId">;

export type DetectorCandle = {
  open: number;
  high: number;
  low: number;
  close: number;
  atr: number | null;
};

export type AnchorPrice = {
  label: string;
  price: number;
};

export type KeyPriceLevels = {
  entry: number;
  stopLoss: number;
  takeProfit: number;
  anchorPrices: AnchorPrice[];
};

export type CandidateContext = {
  trendState: TrendState | null;
  nearestSupport: number | null;
  nearestResistance: number | null;
  atr: number | null;
  rsi: number | null;
};

export type PatternCandidate = {
  id: CandidateId;
  pair: string;
  patternType: PatternType;
  startIndex: number;
  endIndex: number;
  keyPriceLevels: KeyPriceLevels;
  confidence: number;
  contextSnapshot: CandidateContext;
};

export type OutcomeResult = {
  outcome: Outcome;
  rMultiple: number | null;
  barsToOutcome: number | null;
  exitPrice: number | null;
};

export type TwelveDataCandle = {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
};

export type TwelveDataResponse = {
  meta: {
    symbol: string;
    interval: string;
    currency_base: string;
    currency_quote: string;
    type: string;
  };
  values: TwelveDataCandle[];
  status: string;
};
