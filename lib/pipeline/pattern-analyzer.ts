import type {
  PatternCandidate,
  OutcomeResult,
  TrendState,
} from "@/types/trading";

export type AnalysisCandle = {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  atr: number | null;
  volumeSma: number | null;
  sma20: number | null;
  sma50: number | null;
  ema200: number | null;
  rsi: number | null;
  macd: number | null;
  macdSignal: number | null;
  macdHistogram: number | null;
  adx: number | null;
  bbUpper: number | null;
  bbLower: number | null;
  trendState: TrendState | null;
  nearestSupport: number | null;
  nearestResistance: number | null;
};

export type AnalysisResult = {
  qualityRating: number;
  notes: string;
  approved: boolean;
};

const APPROVAL_THRESHOLD = 6;

export function analyzeCandidate(
  candidate: PatternCandidate & { outcome: OutcomeResult },
  candles: AnalysisCandle[],
): AnalysisResult {
  switch (candidate.patternType) {
    case "pin_bar":
      return analyzePinBar(candidate, candles);
    case "double_top":
      return analyzeDoubleTop(candidate, candles);
    case "double_bottom":
      return analyzeDoubleBottom(candidate, candles);
    case "head_and_shoulders":
      return analyzeHeadAndShoulders(candidate, candles);
    case "false_breakout":
      return analyzeFalseBreakout(candidate, candles);
  }
}

function inferDirection(candidate: PatternCandidate): "bullish" | "bearish" {
  return candidate.keyPriceLevels.takeProfit > candidate.keyPriceLevels.entry
    ? "bullish"
    : "bearish";
}

function safeAtr(c: AnalysisCandle): number {
  return c.atr != null && c.atr > 0 ? c.atr : c.high - c.low;
}

function formatPct(ratio: number): string {
  return (ratio * 100).toFixed(0);
}

function buildResult(score: number, notes: string[]): AnalysisResult {
  const qualityRating = Math.max(1, Math.min(10, Math.round(score)));
  return {
    qualityRating,
    notes: notes.join("\n"),
    approved: qualityRating >= APPROVAL_THRESHOLD,
  };
}

function appendOutcomeNote(notes: string[], outcome: OutcomeResult): void {
  if (outcome.outcome === "win") {
    notes.push(
      `◎ Outcome: Won ${outcome.rMultiple?.toFixed(1)}R in ${outcome.barsToOutcome} bars`,
    );
  } else if (outcome.outcome === "loss") {
    notes.push(
      `◎ Outcome: Lost ${outcome.rMultiple?.toFixed(1)}R in ${outcome.barsToOutcome} bars`,
    );
  } else if (outcome.outcome === "breakeven") {
    notes.push("◎ Outcome: Breakeven");
  } else {
    notes.push("◎ Outcome: Pending — trade hasn't resolved");
  }
}

function analyzeVolume(c: AnalysisCandle, notes: string[]): number {
  if (c.volume == null || c.volumeSma == null || c.volumeSma <= 0) return 0;
  const ratio = c.volume / c.volumeSma;
  if (ratio >= 2.0) {
    notes.push(
      `▲ Volume ${ratio.toFixed(1)}x average — strong conviction behind this move`,
    );
    return 1;
  }
  if (ratio >= 1.5) {
    notes.push(`▲ Volume ${ratio.toFixed(1)}x average — good confirmation`);
    return 0.5;
  }
  if (ratio < 0.5) {
    notes.push(`▼ Volume ${ratio.toFixed(1)}x average — very low conviction`);
    return -0.5;
  }
  return 0;
}

function analyzeBollingerBands(
  c: AnalysisCandle,
  direction: "bullish" | "bearish",
  notes: string[],
): number {
  if (c.bbUpper == null || c.bbLower == null) return 0;
  if (direction === "bullish" && c.low <= c.bbLower) {
    notes.push(
      "▲ Wick pierces lower Bollinger Band — extreme move, mean reversion likely",
    );
    return 0.5;
  }
  if (direction === "bearish" && c.high >= c.bbUpper) {
    notes.push(
      "▲ Wick pierces upper Bollinger Band — extreme move, mean reversion likely",
    );
    return 0.5;
  }
  return 0;
}

function analyzeMacd(
  candles: AnalysisCandle[],
  idx: number,
  direction: "bullish" | "bearish",
  notes: string[],
): number {
  const c = candles[idx];
  if (c.macdHistogram == null || idx === 0) return 0;
  const prev = candles[idx - 1];
  if (prev.macdHistogram == null) return 0;

  if (
    direction === "bullish" &&
    c.macdHistogram > prev.macdHistogram &&
    prev.macdHistogram < 0
  ) {
    notes.push(
      "▲ MACD histogram turning up from negative — momentum shift supports reversal",
    );
    return 0.5;
  }
  if (
    direction === "bearish" &&
    c.macdHistogram < prev.macdHistogram &&
    prev.macdHistogram > 0
  ) {
    notes.push(
      "▲ MACD histogram turning down from positive — momentum shift supports reversal",
    );
    return 0.5;
  }
  return 0;
}

function analyzeMaConfluence(
  c: AnalysisCandle,
  atr: number,
  notes: string[],
): number {
  const nearby: string[] = [];
  if (c.sma20 != null && Math.abs(c.close - c.sma20) / atr <= 0.5)
    nearby.push("SMA20");
  if (c.sma50 != null && Math.abs(c.close - c.sma50) / atr <= 0.5)
    nearby.push("SMA50");
  if (c.ema200 != null && Math.abs(c.close - c.ema200) / atr <= 0.5)
    nearby.push("EMA200");

  if (nearby.length >= 2) {
    notes.push(
      `▲ Price near ${nearby.join(" & ")} — moving average confluence zone`,
    );
    return 0.5;
  }
  if (nearby.length === 1 && nearby[0] === "EMA200") {
    notes.push("▲ Price near EMA200 — key dynamic support/resistance");
    return 0.5;
  }
  return 0;
}

function analyzeTrendAlignment(
  trend: TrendState | null,
  direction: "bullish" | "bearish",
  patternLabel: string,
  notes: string[],
): number {
  if (!trend) return 0;

  if (direction === "bullish") {
    if (trend === "strong_uptrend" || trend === "weak_uptrend") {
      notes.push(
        `▲ Bullish ${patternLabel} in ${trend.replace(/_/g, " ")} — trend continuation, high probability`,
      );
      return 1;
    }
    if (trend === "weak_downtrend") {
      notes.push(
        `▲ Bullish ${patternLabel} in weak downtrend — potential reversal with S/R confirmation`,
      );
      return 0.75;
    }
    if (trend === "strong_downtrend") {
      notes.push(
        `— Bullish ${patternLabel} in strong downtrend — counter-trend, needs very strong S/R`,
      );
      return 0.25;
    }
    notes.push("— Ranging market — lower directional conviction");
    return 0.25;
  }

  if (trend === "strong_downtrend" || trend === "weak_downtrend") {
    notes.push(
      `▲ Bearish ${patternLabel} in ${trend.replace(/_/g, " ")} — trend continuation, high probability`,
    );
    return 1;
  }
  if (trend === "weak_uptrend") {
    notes.push(
      `▲ Bearish ${patternLabel} in weak uptrend — potential reversal with resistance confirmation`,
    );
    return 0.75;
  }
  if (trend === "strong_uptrend") {
    notes.push(
      `— Bearish ${patternLabel} in strong uptrend — counter-trend, needs very strong resistance`,
    );
    return 0.25;
  }
  notes.push("— Ranging market — lower directional conviction");
  return 0.25;
}

function analyzeSrProximity(
  c: AnalysisCandle,
  direction: "bullish" | "bearish",
  atr: number,
  notes: string[],
): number {
  const price = direction === "bullish" ? c.low : c.high;
  const level =
    direction === "bullish" ? c.nearestSupport : c.nearestResistance;
  const levelName = direction === "bullish" ? "support" : "resistance";

  if (level == null) {
    notes.push(
      `▼ No relevant ${levelName} level detected — pattern in no-man's land`,
    );
    return -1;
  }

  const dist = Math.abs(price - level);
  const distAtr = dist / atr;

  if (distAtr <= 0.3) {
    notes.push(
      `▲ Wick touches ${levelName} (${distAtr.toFixed(1)} ATR away) — high-probability rejection level`,
    );
    return 2;
  }
  if (distAtr <= 0.7) {
    notes.push(
      `▲ Near ${levelName} (${distAtr.toFixed(1)} ATR away) — decent level`,
    );
    return 1;
  }
  if (distAtr <= 1.5) {
    notes.push(`— Somewhat near ${levelName} (${distAtr.toFixed(1)} ATR)`);
    return 0.25;
  }
  notes.push(
    `▼ Far from ${levelName} (${distAtr.toFixed(1)} ATR) — no key level nearby`,
  );
  return -0.5;
}

function analyzeRsi(
  rsi: number | null,
  direction: "bullish" | "bearish",
  notes: string[],
): number {
  if (rsi == null) return 0;

  if (direction === "bullish") {
    if (rsi <= 30) {
      notes.push(
        `▲ RSI oversold (${rsi.toFixed(1)}) — confirms bullish exhaustion`,
      );
      return 1;
    }
    if (rsi <= 40) {
      notes.push(
        `▲ RSI in lower zone (${rsi.toFixed(1)}) — supports bullish reversal`,
      );
      return 0.5;
    }
    if (rsi >= 70) {
      notes.push(
        `▼ RSI overbought (${rsi.toFixed(1)}) — contradicts bullish bias`,
      );
      return -0.5;
    }
  } else {
    if (rsi >= 70) {
      notes.push(
        `▲ RSI overbought (${rsi.toFixed(1)}) — confirms bearish exhaustion`,
      );
      return 1;
    }
    if (rsi >= 60) {
      notes.push(
        `▲ RSI in upper zone (${rsi.toFixed(1)}) — supports bearish reversal`,
      );
      return 0.5;
    }
    if (rsi <= 30) {
      notes.push(
        `▼ RSI oversold (${rsi.toFixed(1)}) — contradicts bearish bias`,
      );
      return -0.5;
    }
  }
  return 0;
}

// ---------------------------------------------------------------------------
// PIN BAR
// ---------------------------------------------------------------------------

function analyzePinBar(
  candidate: PatternCandidate & { outcome: OutcomeResult },
  candles: AnalysisCandle[],
): AnalysisResult {
  const idx = candidate.endIndex;
  const c = candles[idx];
  const notes: string[] = [];
  let score = 3;

  const range = c.high - c.low;
  if (range <= 0)
    return {
      qualityRating: 1,
      notes: "Invalid candle — zero range",
      approved: false,
    };

  const direction = inferDirection(candidate);
  const atr = safeAtr(c);

  const body = Math.abs(c.close - c.open);
  const upperWick = c.high - Math.max(c.open, c.close);
  const lowerWick = Math.min(c.open, c.close) - c.low;
  const tail = direction === "bullish" ? lowerWick : upperWick;
  const nose = direction === "bullish" ? upperWick : lowerWick;
  const tailRatio = tail / range;
  const bodyRatio = body / range;
  const noseRatio = nose / range;

  if (tailRatio >= 0.75) {
    score += 1;
    notes.push(
      `▲ Excellent tail (${formatPct(tailRatio)}% of range) — strong price rejection`,
    );
  } else if (tailRatio >= 0.66) {
    score += 0.5;
    notes.push(`▲ Good tail (${formatPct(tailRatio)}% of range)`);
  } else {
    notes.push(
      `— Moderate tail (${formatPct(tailRatio)}% of range) — acceptable but weaker rejection`,
    );
  }

  if (bodyRatio <= 0.1) {
    score += 0.5;
    notes.push(
      `▲ Tiny body (${formatPct(bodyRatio)}%) — strong indecision then rejection`,
    );
  } else if (bodyRatio <= 0.2) {
    score += 0.25;
  }

  if (noseRatio <= 0.05) {
    score += 0.5;
    notes.push(
      `▲ Minimal nose (${formatPct(noseRatio)}%) — clean one-sided rejection`,
    );
  } else if (noseRatio > 0.2) {
    score -= 0.5;
    notes.push(
      `▼ Large nose (${formatPct(noseRatio)}%) — weakens the rejection signal`,
    );
  }

  if (direction === "bullish" && c.close > c.open) {
    score += 0.25;
    notes.push("▲ Bullish close confirms rejection");
  } else if (direction === "bearish" && c.close < c.open) {
    score += 0.25;
    notes.push("▲ Bearish close confirms rejection");
  }

  const lookback = Math.min(idx, 5);
  let protrusionCount = 0;
  for (let j = 1; j <= lookback; j++) {
    const prior = candles[idx - j];
    if (direction === "bullish" && c.low < prior.low) protrusionCount++;
    if (direction === "bearish" && c.high > prior.high) protrusionCount++;
  }

  if (protrusionCount >= 4) {
    score += 1.5;
    notes.push(
      `▲ Strong protrusion — wick extends beyond ${protrusionCount} prior candles`,
    );
  } else if (protrusionCount >= 2) {
    score += 0.75;
    notes.push(
      `▲ Moderate protrusion — extends beyond ${protrusionCount} prior candles`,
    );
  } else if (protrusionCount === 1) {
    score += 0.25;
    notes.push("— Minimal protrusion — extends beyond only 1 prior candle");
  } else {
    score -= 1;
    notes.push(
      "▼ No protrusion — wick doesn't extend beyond any prior candle, weak rejection",
    );
  }

  score += analyzeTrendAlignment(c.trendState, direction, "pin", notes);
  score += analyzeSrProximity(c, direction, atr, notes);
  score += analyzeRsi(c.rsi, direction, notes);
  score += analyzeVolume(c, notes);
  score += analyzeBollingerBands(c, direction, notes);
  score += analyzeMacd(candles, idx, direction, notes);
  score += analyzeMaConfluence(c, atr, notes);

  if (c.atr != null && c.atr > 0) {
    const atrRatio = range / c.atr;
    if (atrRatio >= 1.2 && atrRatio <= 2.5) {
      score += 0.5;
      notes.push(
        `▲ Pin bar ${atrRatio.toFixed(1)}x ATR — significant but not extreme`,
      );
    } else if (atrRatio < 0.5) {
      score -= 0.5;
      notes.push(
        `▼ Small pin bar (${atrRatio.toFixed(1)}x ATR) — may lack significance`,
      );
    } else if (atrRatio > 3.0) {
      score -= 0.25;
      notes.push(
        `▼ Very large pin bar (${atrRatio.toFixed(1)}x ATR) — potential volatility spike`,
      );
    }
  }

  if (idx >= 3) {
    const lookStart = Math.max(0, idx - 3);
    const priorMove =
      direction === "bullish"
        ? candles[lookStart].close - candles[idx - 1].close
        : candles[idx - 1].close - candles[lookStart].close;
    const moveAtr = c.atr != null && c.atr > 0 ? priorMove / c.atr : 0;

    if (moveAtr >= 2.0) {
      score += 0.5;
      notes.push(
        "▲ Strong prior momentum into the level — clean impulse before rejection",
      );
    } else if (moveAtr >= 1.0) {
      score += 0.25;
    }
  }

  if (c.adx != null) {
    notes.push(
      c.adx >= 25
        ? `— ADX ${c.adx.toFixed(0)} — trending market, directional trades preferred`
        : `— ADX ${c.adx.toFixed(0)} — weak trend, range-bound conditions`,
    );
  }

  appendOutcomeNote(notes, candidate.outcome);
  return buildResult(score, notes);
}

// ---------------------------------------------------------------------------
// DOUBLE TOP
// ---------------------------------------------------------------------------

function analyzeDoubleTop(
  candidate: PatternCandidate & { outcome: OutcomeResult },
  candles: AnalysisCandle[],
): AnalysisResult {
  const startIdx = candidate.startIndex;
  const endIdx = candidate.endIndex;
  const notes: string[] = [];
  let score = 3;

  const firstCandle = candles[startIdx];
  const secondCandle = candles[endIdx];
  const atr = safeAtr(secondCandle);

  const firstHigh = firstCandle.high;
  const secondHigh = secondCandle.high;
  const avgHigh = (firstHigh + secondHigh) / 2;
  const tolerance = Math.abs(firstHigh - secondHigh) / avgHigh;

  if (tolerance <= 0.005) {
    score += 2;
    notes.push(
      `▲ Excellent peak symmetry (${(tolerance * 100).toFixed(2)}% diff) — textbook double top`,
    );
  } else if (tolerance <= 0.015) {
    score += 1;
    notes.push(`▲ Good peak symmetry (${(tolerance * 100).toFixed(2)}% diff)`);
  } else {
    score += 0.25;
    notes.push(
      `— Moderate peak symmetry (${(tolerance * 100).toFixed(2)}% diff)`,
    );
  }

  const necklinePrice = candidate.keyPriceLevels.entry;
  const patternHeight = Math.max(firstHigh, secondHigh) - necklinePrice;
  const heightAtr = patternHeight / atr;

  if (heightAtr >= 3.0) {
    score += 1;
    notes.push(
      `▲ Large pattern (${heightAtr.toFixed(1)}x ATR) — significant reversal structure`,
    );
  } else if (heightAtr >= 2.0) {
    score += 0.5;
    notes.push(`▲ Decent pattern height (${heightAtr.toFixed(1)}x ATR)`);
  } else if (heightAtr < 1.5) {
    score -= 0.5;
    notes.push(
      `▼ Small pattern (${heightAtr.toFixed(1)}x ATR) — may lack significance`,
    );
  }

  const timeBetween = endIdx - startIdx;
  if (timeBetween >= 15 && timeBetween <= 65) {
    score += 1;
    notes.push(
      `▲ Ideal spacing (${timeBetween} bars between peaks) — well-formed`,
    );
  } else if (timeBetween >= 10 && timeBetween <= 100) {
    score += 0.5;
    notes.push(`— Acceptable spacing (${timeBetween} bars)`);
  } else {
    score -= 0.5;
    notes.push(`▼ Unusual spacing (${timeBetween} bars) — may be unreliable`);
  }

  if (firstCandle.rsi != null && secondCandle.rsi != null) {
    const divergence = firstCandle.rsi - secondCandle.rsi;
    if (divergence >= 8) {
      score += 1.5;
      notes.push(
        `▲ Strong RSI divergence (${divergence.toFixed(0)} pts lower at second peak) — bearish momentum fading`,
      );
    } else if (divergence >= 3) {
      score += 0.75;
      notes.push(
        `▲ Mild RSI divergence (${divergence.toFixed(0)} pts) — momentum weakening`,
      );
    } else if (divergence < -5) {
      score -= 0.5;
      notes.push(
        "▼ Negative divergence — RSI higher at second peak, bulls still strong",
      );
    }
  }

  if (
    firstCandle.volume != null &&
    secondCandle.volume != null &&
    firstCandle.volume > 0
  ) {
    const volRatio = secondCandle.volume / firstCandle.volume;
    if (volRatio < 0.7) {
      score += 1;
      notes.push(
        `▲ Declining volume at second peak (${(volRatio * 100).toFixed(0)}% of first) — conviction fading`,
      );
    } else if (volRatio < 0.85) {
      score += 0.5;
      notes.push("▲ Slightly lower volume at second peak");
    } else if (volRatio > 1.3) {
      score -= 0.5;
      notes.push("▼ Increasing volume at second peak — bulls still pushing");
    }
  }

  if (secondHigh < firstHigh && tolerance >= 0.003) {
    score += 0.5;
    notes.push("▲ Second peak slightly lower — sellers gaining control");
  }

  if (secondCandle.trendState) {
    if (
      secondCandle.trendState === "strong_uptrend" ||
      secondCandle.trendState === "weak_uptrend"
    ) {
      score += 0.5;
      notes.push("▲ Forms in uptrend — classic reversal at trend exhaustion");
    } else if (
      secondCandle.trendState === "strong_downtrend" ||
      secondCandle.trendState === "weak_downtrend"
    ) {
      score -= 0.5;
      notes.push("▼ Already in downtrend — may be consolidation, not reversal");
    }
  }

  score += analyzeBollingerBands(secondCandle, "bearish", notes);
  score += analyzeMaConfluence(secondCandle, atr, notes);

  appendOutcomeNote(notes, candidate.outcome);
  return buildResult(score, notes);
}

// ---------------------------------------------------------------------------
// DOUBLE BOTTOM
// ---------------------------------------------------------------------------

function analyzeDoubleBottom(
  candidate: PatternCandidate & { outcome: OutcomeResult },
  candles: AnalysisCandle[],
): AnalysisResult {
  const startIdx = candidate.startIndex;
  const endIdx = candidate.endIndex;
  const notes: string[] = [];
  let score = 3;

  const firstCandle = candles[startIdx];
  const secondCandle = candles[endIdx];
  const atr = safeAtr(secondCandle);

  const firstLow = firstCandle.low;
  const secondLow = secondCandle.low;
  const avgLow = (firstLow + secondLow) / 2;
  const tolerance = Math.abs(firstLow - secondLow) / avgLow;

  if (tolerance <= 0.005) {
    score += 2;
    notes.push(
      `▲ Excellent trough symmetry (${(tolerance * 100).toFixed(2)}% diff) — textbook double bottom`,
    );
  } else if (tolerance <= 0.015) {
    score += 1;
    notes.push(
      `▲ Good trough symmetry (${(tolerance * 100).toFixed(2)}% diff)`,
    );
  } else {
    score += 0.25;
    notes.push(
      `— Moderate trough symmetry (${(tolerance * 100).toFixed(2)}% diff)`,
    );
  }

  const necklinePrice = candidate.keyPriceLevels.entry;
  const patternHeight = necklinePrice - Math.min(firstLow, secondLow);
  const heightAtr = patternHeight / atr;

  if (heightAtr >= 3.0) {
    score += 1;
    notes.push(
      `▲ Large pattern (${heightAtr.toFixed(1)}x ATR) — significant structure`,
    );
  } else if (heightAtr >= 2.0) {
    score += 0.5;
    notes.push(`▲ Decent pattern height (${heightAtr.toFixed(1)}x ATR)`);
  } else if (heightAtr < 1.5) {
    score -= 0.5;
    notes.push(
      `▼ Small pattern (${heightAtr.toFixed(1)}x ATR) — may lack significance`,
    );
  }

  const timeBetween = endIdx - startIdx;
  if (timeBetween >= 15 && timeBetween <= 65) {
    score += 1;
    notes.push(`▲ Ideal spacing (${timeBetween} bars)`);
  } else if (timeBetween >= 10 && timeBetween <= 100) {
    score += 0.5;
    notes.push(`— Acceptable spacing (${timeBetween} bars)`);
  } else {
    score -= 0.5;
    notes.push(`▼ Unusual spacing (${timeBetween} bars)`);
  }

  if (firstCandle.rsi != null && secondCandle.rsi != null) {
    const divergence = secondCandle.rsi - firstCandle.rsi;
    if (divergence >= 8) {
      score += 1.5;
      notes.push(
        `▲ Strong bullish RSI divergence (${divergence.toFixed(0)} pts higher at second trough)`,
      );
    } else if (divergence >= 3) {
      score += 0.75;
      notes.push(
        `▲ Mild bullish RSI divergence (${divergence.toFixed(0)} pts)`,
      );
    } else if (divergence < -5) {
      score -= 0.5;
      notes.push(
        "▼ Negative divergence — momentum still weak at second trough",
      );
    }
  }

  if (
    firstCandle.volume != null &&
    secondCandle.volume != null &&
    firstCandle.volume > 0
  ) {
    const volRatio = secondCandle.volume / firstCandle.volume;
    if (volRatio < 0.7) {
      score += 1;
      notes.push(
        "▲ Declining volume at second trough — selling pressure drying up",
      );
    } else if (volRatio > 1.3) {
      score -= 0.5;
      notes.push("▼ Increasing volume at second trough — sellers still active");
    }
  }

  if (secondLow > firstLow && tolerance >= 0.003) {
    score += 0.5;
    notes.push("▲ Second trough slightly higher — bullish inclination");
  }

  if (secondCandle.trendState) {
    if (
      secondCandle.trendState === "strong_downtrend" ||
      secondCandle.trendState === "weak_downtrend"
    ) {
      score += 0.5;
      notes.push("▲ Forms in downtrend — classic reversal at exhaustion");
    } else if (
      secondCandle.trendState === "strong_uptrend" ||
      secondCandle.trendState === "weak_uptrend"
    ) {
      score -= 0.5;
      notes.push("▼ Already in uptrend — may be consolidation, not reversal");
    }
  }

  score += analyzeBollingerBands(secondCandle, "bullish", notes);
  score += analyzeMaConfluence(secondCandle, atr, notes);

  appendOutcomeNote(notes, candidate.outcome);
  return buildResult(score, notes);
}

// ---------------------------------------------------------------------------
// HEAD & SHOULDERS
// ---------------------------------------------------------------------------

function analyzeHeadAndShoulders(
  candidate: PatternCandidate & { outcome: OutcomeResult },
  candles: AnalysisCandle[],
): AnalysisResult {
  const notes: string[] = [];
  let score = 3;
  const direction = inferDirection(candidate);

  const startIdx = candidate.startIndex;
  const endIdx = candidate.endIndex;
  const headIdx = Math.round((startIdx + endIdx) / 2);
  const leftCandle = candles[startIdx];
  const endCandle = candles[endIdx];
  const headCandle = candles[Math.min(headIdx, candles.length - 1)];
  const atr = safeAtr(endCandle);
  const neckline = candidate.keyPriceLevels.entry;

  if (direction === "bearish") {
    const leftHeight = leftCandle.high - neckline;
    const rightHeight = endCandle.high - neckline;
    const avgHeight = (leftHeight + rightHeight) / 2;
    if (avgHeight > 0) {
      const symmetry = Math.abs(leftHeight - rightHeight) / avgHeight;
      if (symmetry <= 0.15) {
        score += 2;
        notes.push(
          `▲ Excellent shoulder symmetry (${(symmetry * 100).toFixed(0)}% diff) — textbook H&S`,
        );
      } else if (symmetry <= 0.3) {
        score += 1;
        notes.push(
          `▲ Good shoulder symmetry (${(symmetry * 100).toFixed(0)}% diff)`,
        );
      } else {
        score -= 0.5;
        notes.push(
          `▼ Poor shoulder symmetry (${(symmetry * 100).toFixed(0)}% diff)`,
        );
      }
    }
  } else {
    const leftHeight = neckline - leftCandle.low;
    const rightHeight = neckline - endCandle.low;
    const avgHeight = (leftHeight + rightHeight) / 2;
    if (avgHeight > 0) {
      const symmetry = Math.abs(leftHeight - rightHeight) / avgHeight;
      if (symmetry <= 0.15) {
        score += 2;
        notes.push(
          `▲ Excellent shoulder symmetry (${(symmetry * 100).toFixed(0)}% diff) — textbook inverse H&S`,
        );
      } else if (symmetry <= 0.3) {
        score += 1;
        notes.push(
          `▲ Good shoulder symmetry (${(symmetry * 100).toFixed(0)}% diff)`,
        );
      } else {
        score -= 0.5;
        notes.push(
          `▼ Poor shoulder symmetry (${(symmetry * 100).toFixed(0)}% diff)`,
        );
      }
    }
  }

  const patternHeight = Math.abs(
    (direction === "bearish" ? headCandle.high : headCandle.low) - neckline,
  );
  const heightAtr = patternHeight / atr;
  if (heightAtr >= 3.0) {
    score += 1;
    notes.push(`▲ Large H&S pattern (${heightAtr.toFixed(1)}x ATR)`);
  } else if (heightAtr >= 2.0) {
    score += 0.5;
  } else if (heightAtr < 1.5) {
    score -= 0.5;
    notes.push(`▼ Small pattern (${heightAtr.toFixed(1)}x ATR)`);
  }

  const leftDuration = headIdx - startIdx;
  const rightDuration = endIdx - headIdx;
  if (leftDuration > 0 && rightDuration > 0) {
    const timeRatio = rightDuration / leftDuration;
    if (timeRatio >= 0.7 && timeRatio <= 1.3) {
      score += 1;
      notes.push("▲ Good time symmetry between shoulders");
    } else {
      score -= 0.25;
      notes.push("— Asymmetric timing between shoulders");
    }
  }

  if (headCandle.rsi != null && leftCandle.rsi != null) {
    if (direction === "bearish") {
      const div = leftCandle.rsi - headCandle.rsi;
      if (div >= 5) {
        score += 1;
        notes.push(
          `▲ RSI divergence at head (${div.toFixed(0)} pts lower) — momentum exhaustion`,
        );
      }
    } else {
      const div = headCandle.rsi - leftCandle.rsi;
      if (div >= 5) {
        score += 1;
        notes.push(
          `▲ RSI divergence at head (${div.toFixed(0)} pts higher) — selling exhaustion`,
        );
      }
    }
  }

  if (endCandle.trendState) {
    const isTrendReversal =
      (direction === "bearish" &&
        (endCandle.trendState === "strong_uptrend" ||
          endCandle.trendState === "weak_uptrend")) ||
      (direction === "bullish" &&
        (endCandle.trendState === "strong_downtrend" ||
          endCandle.trendState === "weak_downtrend"));

    if (isTrendReversal) {
      score += 0.5;
      notes.push("▲ Pattern forms as trend reversal — classic H&S context");
    }
  }

  score += analyzeVolume(endCandle, notes);
  score += analyzeMaConfluence(endCandle, atr, notes);

  appendOutcomeNote(notes, candidate.outcome);
  return buildResult(score, notes);
}

// ---------------------------------------------------------------------------
// FALSE BREAKOUT
// ---------------------------------------------------------------------------

function analyzeFalseBreakout(
  candidate: PatternCandidate & { outcome: OutcomeResult },
  candles: AnalysisCandle[],
): AnalysisResult {
  const notes: string[] = [];
  let score = 3;
  const direction = inferDirection(candidate);

  const breakIdx = candidate.startIndex;
  const reversalIdx = candidate.endIndex;
  const breakCandle = candles[breakIdx];
  const reversalCandle = candles[reversalIdx];
  const brokenLevel = candidate.keyPriceLevels.anchorPrices.find(
    (a) => a.label === "broken_level",
  )?.price;
  const atr = safeAtr(breakCandle);

  const reversalSpeed = reversalIdx - breakIdx;
  if (reversalSpeed <= 1) {
    score += 1.5;
    notes.push(
      `▲ Immediate reversal (${reversalSpeed} bar) — strong rejection of breakout`,
    );
  } else if (reversalSpeed <= 2) {
    score += 0.75;
    notes.push(`▲ Quick reversal (${reversalSpeed} bars)`);
  } else {
    score -= 0.5;
    notes.push(`▼ Slow reversal (${reversalSpeed} bars) — weaker rejection`);
  }

  if (brokenLevel != null) {
    const penetration =
      direction === "bullish"
        ? brokenLevel - breakCandle.low
        : breakCandle.high - brokenLevel;
    const penAtr = penetration / atr;

    if (penAtr <= 0.3) {
      score += 1;
      notes.push(
        `▲ Shallow false break (${penAtr.toFixed(1)}x ATR) — quick trap, strong level`,
      );
    } else if (penAtr <= 0.7) {
      score += 0.5;
      notes.push(`▲ Moderate penetration (${penAtr.toFixed(1)}x ATR)`);
    } else if (penAtr > 1.0) {
      score -= 0.5;
      notes.push(
        `▼ Deep penetration (${penAtr.toFixed(1)}x ATR) — may be legitimate breakout`,
      );
    }

    const bodyBeyond =
      direction === "bullish"
        ? breakCandle.close < brokenLevel
        : breakCandle.close > brokenLevel;
    if (!bodyBeyond) {
      score += 0.5;
      notes.push(
        "▲ Body closed back inside the level — classic false break signal",
      );
    } else {
      score -= 0.5;
      notes.push("▼ Body closed beyond level — break may be legitimate");
    }
  }

  if (
    breakCandle.volume != null &&
    breakCandle.volumeSma != null &&
    breakCandle.volumeSma > 0
  ) {
    const breakVol = breakCandle.volume / breakCandle.volumeSma;
    if (breakVol < 0.8) {
      score += 1;
      notes.push(
        `▲ Low volume on break (${breakVol.toFixed(1)}x avg) — unconvincing breakout`,
      );
    } else if (breakVol > 1.5) {
      score -= 0.5;
      notes.push(
        `▼ High volume on break (${breakVol.toFixed(1)}x avg) — breakout had conviction`,
      );
    }
  }

  if (
    reversalCandle.volume != null &&
    breakCandle.volume != null &&
    breakCandle.volume > 0
  ) {
    const revRatio = reversalCandle.volume / breakCandle.volume;
    if (revRatio >= 1.5) {
      score += 1;
      notes.push(
        `▲ Reversal volume ${revRatio.toFixed(1)}x break volume — strong rejection`,
      );
    }
  }

  if (reversalCandle.trendState) {
    if (direction === "bullish") {
      if (
        reversalCandle.trendState === "strong_uptrend" ||
        reversalCandle.trendState === "weak_uptrend"
      ) {
        score += 0.75;
        notes.push(
          "▲ False break below support in uptrend — trend continuation trap",
        );
      }
    } else {
      if (
        reversalCandle.trendState === "strong_downtrend" ||
        reversalCandle.trendState === "weak_downtrend"
      ) {
        score += 0.75;
        notes.push(
          "▲ False break above resistance in downtrend — trend continuation trap",
        );
      }
    }
  }

  score += analyzeRsi(breakCandle.rsi, direction, notes);
  score += analyzeBollingerBands(breakCandle, direction, notes);
  score += analyzeMaConfluence(reversalCandle, atr, notes);

  appendOutcomeNote(notes, candidate.outcome);
  return buildResult(score, notes);
}
