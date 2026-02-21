import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import type {
  PatternCandidate,
  OutcomeResult,
  TrendState,
} from "@/types/trading";
import { analyzeCandidate } from "@/lib/pipeline/pattern-analyzer";
import type { AnalysisCandle } from "@/lib/pipeline/pattern-analyzer";

type CandidateWithOutcome = PatternCandidate & {
  outcome: OutcomeResult;
  startTimestamp: string;
  endTimestamp: string;
};

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { pair, timeframe, candidates: rawCandidates } = body as {
    pair: string;
    timeframe?: string;
    candidates: CandidateWithOutcome[];
  };

  if (!pair || !Array.isArray(rawCandidates) || rawCandidates.length === 0) {
    return NextResponse.json(
      { error: "pair and non-empty candidates array required" },
      { status: 400 },
    );
  }

  const candles = await prisma.rawCandle.findMany({
    where: { pair, timeframe: timeframe ?? "D" },
    orderBy: { timestamp: "asc" },
    include: { features: true, contextFeatures: true },
  });

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

  const withAnalysis = rawCandidates.map((candidate) => {
    const analysis = analyzeCandidate(
      { ...candidate, outcome: candidate.outcome },
      analysisCandles,
    );

    return {
      ...candidate,
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
