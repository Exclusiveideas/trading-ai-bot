import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const pair = searchParams.get("pair");

  if (!pair) {
    return NextResponse.json({ error: "pair parameter required" }, { status: 400 });
  }

  const start = searchParams.get("start");
  const end = searchParams.get("end");

  const where: Record<string, unknown> = { pair };
  if (start || end) {
    const timestamp: Record<string, Date> = {};
    if (start) timestamp.gte = new Date(start);
    if (end) timestamp.lte = new Date(end);
    where.timestamp = timestamp;
  }

  const candles = await prisma.rawCandle.findMany({
    where,
    orderBy: { timestamp: "asc" },
    include: { features: true, contextFeatures: true },
    take: 2000,
  });

  const result = candles.map((c) => ({
    id: c.id,
    pair: c.pair,
    timestamp: c.timestamp.toISOString(),
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.volume,
    timeframe: c.timeframe,
    features: c.features
      ? {
          sma20: c.features.sma20,
          sma50: c.features.sma50,
          ema200: c.features.ema200,
          rsi: c.features.rsi,
          macd: c.features.macd,
          macdSignal: c.features.macdSignal,
          macdHistogram: c.features.macdHistogram,
          adx: c.features.adx,
          atr: c.features.atr,
          bbUpper: c.features.bbUpper,
          bbMiddle: c.features.bbMiddle,
          bbLower: c.features.bbLower,
          volumeSma: c.features.volumeSma,
        }
      : null,
    context: c.contextFeatures
      ? {
          nearestSupport: c.contextFeatures.nearestSupport,
          nearestResistance: c.contextFeatures.nearestResistance,
          distToSupportPips: c.contextFeatures.distToSupportPips,
          distToResistancePips: c.contextFeatures.distToResistancePips,
          trendState: c.contextFeatures.trendState,
          tradingSession: c.contextFeatures.tradingSession,
          nearestRoundNumber: c.contextFeatures.nearestRoundNumber,
        }
      : null,
  }));

  return NextResponse.json({ candles: result });
}
