import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import type { PatternType, TrendState } from "@/types/trading";
import { findAllCandidates } from "@/lib/pipeline/patterns/candidate-finder";
import type { EnrichedDetectorCandle } from "@/lib/pipeline/patterns/candidate-finder";
import { calculateOutcome } from "@/lib/pipeline/outcome-calculator";
import { analyzeCandidate } from "@/lib/pipeline/pattern-analyzer";
import type { AnalysisCandle } from "@/lib/pipeline/pattern-analyzer";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const pair = searchParams.get("pair");

  if (!pair) {
    return NextResponse.json(
      { error: "pair parameter required" },
      { status: 400 },
    );
  }

  const patternTypeFilter = searchParams.get(
    "patternType",
  ) as PatternType | null;

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
    volume: c.volume,
    volumeSma: c.features?.volumeSma ?? null,
    timestamp: c.timestamp.toISOString(),
    trendState: (c.contextFeatures?.trendState as TrendState) ?? null,
    nearestSupport: c.contextFeatures?.nearestSupport ?? null,
    nearestResistance: c.contextFeatures?.nearestResistance ?? null,
    rsi: c.features?.rsi ?? null,
    adx: c.features?.adx ?? null,
  }));

  const analysisCandles: AnalysisCandle[] = candles.map((c) => ({
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.volume,
    atr: c.features?.atr ?? null,
    volumeSma: c.features?.volumeSma ?? null,
    sma20: c.features?.sma20 ?? null,
    sma50: c.features?.sma50 ?? null,
    ema200: c.features?.ema200 ?? null,
    rsi: c.features?.rsi ?? null,
    macd: c.features?.macd ?? null,
    macdSignal: c.features?.macdSignal ?? null,
    macdHistogram: c.features?.macdHistogram ?? null,
    adx: c.features?.adx ?? null,
    bbUpper: c.features?.bbUpper ?? null,
    bbLower: c.features?.bbLower ?? null,
    trendState: (c.contextFeatures?.trendState as TrendState) ?? null,
    nearestSupport: c.contextFeatures?.nearestSupport ?? null,
    nearestResistance: c.contextFeatures?.nearestResistance ?? null,
  }));

  let candidates = findAllCandidates(enriched, pair);

  if (patternTypeFilter) {
    candidates = candidates.filter((c) => c.patternType === patternTypeFilter);
  }

  const withAnalysis = candidates.map((candidate) => {
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

    const analysis = analyzeCandidate(
      { ...candidate, outcome },
      analysisCandles,
    );

    return {
      ...candidate,
      outcome,
      startTimestamp: candles[candidate.startIndex].timestamp.toISOString(),
      endTimestamp: candles[candidate.endIndex].timestamp.toISOString(),
      analysis,
    };
  });

  const approvedCount = withAnalysis.filter((c) => c.analysis.approved).length;
  const rejectedCount = withAnalysis.length - approvedCount;

  return NextResponse.json({
    candidates: withAnalysis,
    total: withAnalysis.length,
    approvedCount,
    rejectedCount,
  });
}
