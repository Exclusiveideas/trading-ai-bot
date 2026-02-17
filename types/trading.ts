export interface Candle {
  id?: number;
  pair: string;
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timeframe: string;
}

export interface CalculatedFeatures {
  id?: number;
  candle_id: number;
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
}

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

export interface LabeledPattern {
  id?: number;
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
}

export interface TwelveDataCandle {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}

export interface TwelveDataResponse {
  meta: {
    symbol: string;
    interval: string;
    currency_base: string;
    currency_quote: string;
    type: string;
  };
  values: TwelveDataCandle[];
  status: string;
}
