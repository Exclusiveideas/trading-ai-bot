-- Trading AI Database Schema
-- Run this in the Supabase SQL Editor (https://app.supabase.com → SQL Editor)

-- 1. Raw OHLCV candle data
CREATE TABLE IF NOT EXISTS raw_candles (
  id BIGSERIAL PRIMARY KEY,
  pair VARCHAR(20) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  open DOUBLE PRECISION NOT NULL,
  high DOUBLE PRECISION NOT NULL,
  low DOUBLE PRECISION NOT NULL,
  close DOUBLE PRECISION NOT NULL,
  volume DOUBLE PRECISION NOT NULL DEFAULT 0,
  timeframe VARCHAR(10) NOT NULL DEFAULT '1day',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(pair, timestamp, timeframe)
);

-- Index for fast lookups by pair + time range
CREATE INDEX IF NOT EXISTS idx_candles_pair_time
  ON raw_candles (pair, timestamp DESC);

-- 2. Calculated technical indicators per candle
CREATE TABLE IF NOT EXISTS calculated_features (
  id BIGSERIAL PRIMARY KEY,
  candle_id BIGINT NOT NULL REFERENCES raw_candles(id) ON DELETE CASCADE,
  sma_20 DOUBLE PRECISION,
  sma_50 DOUBLE PRECISION,
  ema_200 DOUBLE PRECISION,
  rsi DOUBLE PRECISION,
  macd DOUBLE PRECISION,
  macd_signal DOUBLE PRECISION,
  macd_histogram DOUBLE PRECISION,
  adx DOUBLE PRECISION,
  atr DOUBLE PRECISION,
  bb_upper DOUBLE PRECISION,
  bb_middle DOUBLE PRECISION,
  bb_lower DOUBLE PRECISION,
  volume_sma DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(candle_id)
);

CREATE INDEX IF NOT EXISTS idx_features_candle
  ON calculated_features (candle_id);

-- 3. Human-labeled patterns with context and outcomes
CREATE TABLE IF NOT EXISTS labeled_patterns (
  id BIGSERIAL PRIMARY KEY,
  pair VARCHAR(20) NOT NULL,
  pattern_type VARCHAR(30) NOT NULL,
  start_timestamp TIMESTAMPTZ NOT NULL,
  end_timestamp TIMESTAMPTZ NOT NULL,
  entry_price DOUBLE PRECISION NOT NULL,
  stop_loss DOUBLE PRECISION NOT NULL,
  take_profit DOUBLE PRECISION NOT NULL,
  outcome VARCHAR(15) NOT NULL DEFAULT 'pending',
  r_multiple DOUBLE PRECISION,
  bars_to_outcome INTEGER,
  quality_rating INTEGER NOT NULL CHECK (quality_rating BETWEEN 1 AND 10),
  trend_state VARCHAR(30),
  session VARCHAR(20),
  support_quality DOUBLE PRECISION,
  notes TEXT,
  context_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patterns_pair_type
  ON labeled_patterns (pair, pattern_type);

CREATE INDEX IF NOT EXISTS idx_patterns_outcome
  ON labeled_patterns (outcome);
