import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import type { PatternType, TrendState } from "@/types/trading";
import { findAllCandidates, resetCandidateCounter } from "@/lib/pipeline/patterns/candidate-finder";
import type { EnrichedDetectorCandle } from "@/lib/pipeline/patterns/candidate-finder";
import { calculateOutcome } from "@/lib/pipeline/outcome-calculator";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const pair = searchParams.get("pair");

  if (!pair) {
    return NextResponse.json({ error: "pair parameter required" }, { status: 400 });
  }

  const patternTypeFilter = searchParams.get("patternType") as PatternType | null;

  const candles = await prisma.rawCandle.findMany({
    where: { pair },
    orderBy: { timestamp: "asc" },
    include: { features: true, contextFeatures: true },
  });

  const enriched: EnrichedDetectorCandle[] = candles.map((c) => ({
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    atr: c.features?.atr ?? null,
    timestamp: c.timestamp.toISOString(),
    trendState: (c.contextFeatures?.trendState as TrendState) ?? null,
    nearestSupport: c.contextFeatures?.nearestSupport ?? null,
    nearestResistance: c.contextFeatures?.nearestResistance ?? null,
    rsi: c.features?.rsi ?? null,
  }));

  resetCandidateCounter();
  let candidates = findAllCandidates(enriched, pair);

  if (patternTypeFilter) {
    candidates = candidates.filter((c) => c.patternType === patternTypeFilter);
  }

  const withOutcomes = candidates.map((candidate) => {
    const outcomeCandles = candles.map((c) => ({
      high: c.high,
      low: c.low,
      close: c.close,
    }));

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
