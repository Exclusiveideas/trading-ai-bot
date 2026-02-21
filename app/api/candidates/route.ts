import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import type { PatternType, TrendState } from "@/types/trading";
import { findAllCandidates } from "@/lib/pipeline/patterns/candidate-finder";
import type { EnrichedDetectorCandle } from "@/lib/pipeline/patterns/candidate-finder";
import { calculateOutcome } from "@/lib/pipeline/outcome-calculator";

const VALID_PATTERN_TYPES: Set<string> = new Set([
  "pin_bar",
  "double_top",
  "double_bottom",
  "head_and_shoulders",
  "false_breakout",
]);

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const pair = searchParams.get("pair");

  if (!pair) {
    return NextResponse.json(
      { error: "pair parameter required" },
      { status: 400 },
    );
  }

  const rawPatternType = searchParams.get("patternType");
  if (rawPatternType && !VALID_PATTERN_TYPES.has(rawPatternType)) {
    return NextResponse.json(
      { error: "Invalid patternType parameter" },
      { status: 400 },
    );
  }
  const patternTypeFilter = rawPatternType as PatternType | null;

  const timeframe = searchParams.get("timeframe") ?? "D";

  const candles = await prisma.rawCandle.findMany({
    where: { pair, timeframe },
    orderBy: { timestamp: "asc" },
    include: { features: true, contextFeatures: true },
  });

  const enriched: EnrichedDetectorCandle[] = candles.map((c) => ({
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    atr: c.features?.atr ?? null,
    volume: c.volume,
    volumeSma: c.features?.volumeSma ?? null,
    timestamp: c.timestamp.toISOString(),
    trendState: (c.contextFeatures?.trendState as TrendState) ?? null,
    nearestSupport: c.contextFeatures?.nearestSupport ?? null,
    nearestResistance: c.contextFeatures?.nearestResistance ?? null,
    rsi: c.features?.rsi ?? null,
    adx: c.features?.adx ?? null,
  }));

  let candidates = findAllCandidates(enriched, pair);

  if (patternTypeFilter) {
    candidates = candidates.filter((c) => c.patternType === patternTypeFilter);
  }

  const outcomeCandles = candles.map((c) => ({
    high: c.high,
    low: c.low,
    close: c.close,
  }));

  const withOutcomes = candidates.map((candidate) => {
    const outcome = calculateOutcome(outcomeCandles, {
      entryPrice: candidate.keyPriceLevels.entry,
      stopLoss: candidate.keyPriceLevels.stopLoss,
      takeProfit: candidate.keyPriceLevels.takeProfit,
      entryIndex: candidate.endIndex,
    });

    return {
      ...candidate,
      outcome,
      startTimestamp: candles[candidate.startIndex].timestamp.toISOString(),
      endTimestamp: candles[candidate.endIndex].timestamp.toISOString(),
    };
  });

  return NextResponse.json({
    candidates: withOutcomes,
    total: withOutcomes.length,
  });
}
