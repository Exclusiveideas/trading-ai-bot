import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

function csvCell(value: unknown): string {
  if (value == null || value === "") return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

const HIGHER_TF_ORDER = ["D", "H4", "H1"] as const;

const HTF_FEATURE_SUFFIXES = [
  "trend_state",
  "rsi",
  "adx",
  "macd_histogram",
  "close",
  "sma_20",
  "sma_50",
  "ema_200",
  "bb_upper",
  "bb_lower",
  "atr",
] as const;

function buildHtfHeaders(): string[] {
  const headers: string[] = [];
  for (const tf of HIGHER_TF_ORDER) {
    const prefix = `htf_${tf.toLowerCase()}`;
    for (const suffix of HTF_FEATURE_SUFFIXES) {
      headers.push(`${prefix}_${suffix}`);
    }
  }
  return headers;
}

const HEADERS = [
  "id",
  "pair",
  "pattern_type",
  "timeframe",
  "start_timestamp",
  "end_timestamp",
  "entry_price",
  "stop_loss",
  "take_profit",
  "outcome",
  "r_multiple",
  "bars_to_outcome",
  "max_favorable_excursion",
  "quality_rating",
  // candle OHLCV
  "open",
  "high",
  "low",
  "close",
  "volume",
  // technical indicators
  "sma_20",
  "sma_50",
  "ema_200",
  "rsi",
  "macd",
  "macd_signal",
  "macd_histogram",
  "adx",
  "atr",
  "bb_upper",
  "bb_middle",
  "bb_lower",
  "volume_sma",
  // context features
  "trend_state",
  "trading_session",
  "nearest_support",
  "nearest_resistance",
  "dist_to_support_pips",
  "dist_to_resistance_pips",
  "dist_to_support_atr",
  "dist_to_resistance_atr",
  "nearest_round_number",
  "dist_to_round_number_pips",
  // derived features
  "body_ratio",
  "tail_ratio",
  "nose_ratio",
  "range_atr_ratio",
  "risk_reward_ratio",
  "trend_alignment",
  "volatility_regime",
  "bb_width",
  "rsi_zone",
  // higher-timeframe features
  ...buildHtfHeaders(),
  // notes
  "notes",
];

function getHigherTimeframes(tf: string): string[] {
  const hierarchy = ["D", "H4", "H1", "M15"];
  const idx = hierarchy.indexOf(tf);
  if (idx <= 0) return [];
  return hierarchy.slice(0, idx);
}

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

function computeRsiZone(rsi: number | null): string | null {
  if (rsi == null) return null;
  if (rsi < 30) return "oversold";
  if (rsi > 70) return "overbought";
  return "neutral";
}

type CandleWithRelations = NonNullable<
  Awaited<
    ReturnType<
      typeof prisma.rawCandle.findFirst<{
        include: { features: true; contextFeatures: true };
      }>
    >
  >
>;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const pair = searchParams.get("pair");

  const where: { pair?: string } = {};
  if (pair) where.pair = pair;

  const labels = await prisma.labeledPattern.findMany({
    where,
    orderBy: { startTimestamp: "asc" },
  });

  if (labels.length === 0) {
    return NextResponse.json({ error: "No labels to export" }, { status: 404 });
  }

  // Group labels by pair+timeframe for batch candle fetching
  const groupKey = (p: string, tf: string) => `${p}|${tf}`;
  const labelsByGroup = new Map<
    string,
    { pair: string; timeframe: string; timestamps: Date[] }
  >();

  for (const label of labels) {
    const key = groupKey(label.pair, label.timeframe);
    const group = labelsByGroup.get(key);
    if (group) {
      group.timestamps.push(label.endTimestamp);
    } else {
      labelsByGroup.set(key, {
        pair: label.pair,
        timeframe: label.timeframe,
        timestamps: [label.endTimestamp],
      });
    }
  }

  // Fetch same-TF candles for all labels
  const candleMap = new Map<string, CandleWithRelations>();

  for (const { pair: p, timeframe: tf, timestamps } of labelsByGroup.values()) {
    const candles = await prisma.rawCandle.findMany({
      where: { pair: p, timeframe: tf, timestamp: { in: timestamps } },
      include: { features: true, contextFeatures: true },
    });
    for (const c of candles) {
      candleMap.set(
        `${p}|${tf}|${c.timestamp.toISOString()}`,
        c as CandleWithRelations,
      );
    }
  }

  // Fetch HTF candles — for each label, find the most recent candle at each higher TF
  const htfCache = new Map<string, CandleWithRelations | null>();

  async function getHtfCandle(
    p: string,
    htf: string,
    beforeTimestamp: Date,
  ): Promise<CandleWithRelations | null> {
    const cacheKey = `${p}|${htf}|${beforeTimestamp.toISOString()}`;
    if (htfCache.has(cacheKey)) return htfCache.get(cacheKey)!;

    const candle = await prisma.rawCandle.findFirst({
      where: { pair: p, timeframe: htf, timestamp: { lte: beforeTimestamp } },
      orderBy: { timestamp: "desc" },
      include: { features: true, contextFeatures: true },
    });

    const result = candle as CandleWithRelations | null;
    htfCache.set(cacheKey, result);
    return result;
  }

  const enrichedRows: string[] = [];

  for (const label of labels) {
    const candle =
      candleMap.get(
        `${label.pair}|${label.timeframe}|${label.endTimestamp.toISOString()}`,
      ) ?? null;

    const o = candle?.open ?? null;
    const h = candle?.high ?? null;
    const l = candle?.low ?? null;
    const c = candle?.close ?? null;
    const v = candle?.volume ?? null;
    const f = candle?.features ?? null;
    const ctx = candle?.contextFeatures ?? null;

    const range = h != null && l != null ? h - l : null;
    const body = o != null && c != null ? Math.abs(c - o) : null;
    const isBullish = label.takeProfit > label.entryPrice;
    const upperWick =
      h != null && o != null && c != null ? h - Math.max(o, c) : null;
    const lowerWick =
      o != null && c != null && l != null ? Math.min(o, c) - l : null;
    const tail = isBullish ? lowerWick : upperWick;
    const nose = isBullish ? upperWick : lowerWick;

    const bodyRatio = range && range > 0 && body != null ? body / range : null;
    const tailRatio = range && range > 0 && tail != null ? tail / range : null;
    const noseRatio = range && range > 0 && nose != null ? nose / range : null;
    const rangeAtrRatio = range && f?.atr && f.atr > 0 ? range / f.atr : null;

    const riskDist = Math.abs(label.entryPrice - label.stopLoss);
    const rewardDist = Math.abs(label.takeProfit - label.entryPrice);
    const riskRewardRatio = riskDist > 0 ? rewardDist / riskDist : null;

    // Derived features
    const trendAlignment = computeTrendAlignment(
      label.patternType,
      ctx?.trendState ?? null,
    );
    const volatilityRegime =
      f?.atr != null && c != null && c > 0 ? +(f.atr / c).toFixed(6) : null;
    const bbWidth =
      f?.bbUpper != null && f?.bbLower != null && f?.bbMiddle && f.bbMiddle > 0
        ? +((f.bbUpper - f.bbLower) / f.bbMiddle).toFixed(6)
        : null;
    const rsiZone = computeRsiZone(f?.rsi ?? null);

    // HTF features — build values for all 3 possible higher TFs (D, H4, H1)
    const higherTfs = getHigherTimeframes(label.timeframe);
    const htfValues: (string | number | null)[] = [];

    for (const htf of HIGHER_TF_ORDER) {
      if (higherTfs.includes(htf)) {
        const htfCandle = await getHtfCandle(
          label.pair,
          htf,
          label.endTimestamp,
        );
        const hf = htfCandle?.features ?? null;
        const hctx = htfCandle?.contextFeatures ?? null;

        htfValues.push(
          hctx?.trendState ?? null,
          hf?.rsi ?? null,
          hf?.adx ?? null,
          hf?.macdHistogram ?? null,
          htfCandle?.close ?? null,
          hf?.sma20 ?? null,
          hf?.sma50 ?? null,
          hf?.ema200 ?? null,
          hf?.bbUpper ?? null,
          hf?.bbLower ?? null,
          hf?.atr ?? null,
        );
      } else {
        // Not applicable for this pattern's timeframe — fill with nulls
        htfValues.push(...Array(HTF_FEATURE_SUFFIXES.length).fill(null));
      }
    }

    const row = [
      label.id,
      label.pair,
      label.patternType,
      label.timeframe,
      label.startTimestamp.toISOString(),
      label.endTimestamp.toISOString(),
      label.entryPrice,
      label.stopLoss,
      label.takeProfit,
      label.outcome,
      label.rMultiple,
      label.barsToOutcome,
      label.maxFavorableExcursion,
      label.qualityRating,
      o,
      h,
      l,
      c,
      v,
      f?.sma20,
      f?.sma50,
      f?.ema200,
      f?.rsi,
      f?.macd,
      f?.macdSignal,
      f?.macdHistogram,
      f?.adx,
      f?.atr,
      f?.bbUpper,
      f?.bbMiddle,
      f?.bbLower,
      f?.volumeSma,
      ctx?.trendState,
      ctx?.tradingSession,
      ctx?.nearestSupport,
      ctx?.nearestResistance,
      ctx?.distToSupportPips,
      ctx?.distToResistancePips,
      ctx?.distToSupportAtr,
      ctx?.distToResistanceAtr,
      ctx?.nearestRoundNumber,
      ctx?.distToRoundNumberPips,
      bodyRatio != null ? +bodyRatio.toFixed(4) : null,
      tailRatio != null ? +tailRatio.toFixed(4) : null,
      noseRatio != null ? +noseRatio.toFixed(4) : null,
      rangeAtrRatio != null ? +rangeAtrRatio.toFixed(4) : null,
      riskRewardRatio != null ? +riskRewardRatio.toFixed(4) : null,
      trendAlignment,
      volatilityRegime,
      bbWidth,
      rsiZone,
      ...htfValues,
      label.notes,
    ].map(csvCell);

    enrichedRows.push(row.join(","));
  }

  const csv = [HEADERS.join(","), ...enrichedRows].join("\n");
  const filename = pair
    ? `training-${pair.replace("/", "-")}-${new Date().toISOString().split("T")[0]}.csv`
    : `training-all-${new Date().toISOString().split("T")[0]}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
