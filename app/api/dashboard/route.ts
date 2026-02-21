import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    allSignals,
    resolvedSignals,
    recentSnapshots,
    modelVersions,
  ] = await Promise.all([
    prisma.signal.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.signal.findMany({
      where: { status: "resolved" },
      orderBy: { resolvedAt: "desc" },
    }),
    prisma.accuracySnapshot.findMany({
      orderBy: { snapshotAt: "desc" },
      take: 50,
    }),
    prisma.modelVersion.findMany({
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const weekSignals = allSignals.filter(
    (s) => s.createdAt >= weekAgo,
  );
  const weekResolved = resolvedSignals.filter(
    (s) => s.resolvedAt && s.resolvedAt >= weekAgo,
  );
  const monthResolved = resolvedSignals.filter(
    (s) => s.resolvedAt && s.resolvedAt >= monthAgo,
  );

  const computeStats = (signals: typeof resolvedSignals) => {
    const wins = signals.filter((s) => s.outcome === "win");
    const losses = signals.filter((s) => s.outcome === "loss");
    const rMultiples = signals
      .map((s) => s.rMultiple)
      .filter((r): r is number => r !== null);
    const totalR = rMultiples.reduce((sum, r) => sum + r, 0);
    const grossProfit = rMultiples
      .filter((r) => r > 0)
      .reduce((s, r) => s + r, 0);
    const grossLoss = Math.abs(
      rMultiples.filter((r) => r < 0).reduce((s, r) => s + r, 0),
    );

    return {
      total: signals.length,
      wins: wins.length,
      losses: losses.length,
      winRate: signals.length > 0 ? wins.length / signals.length : null,
      totalR,
      avgR: rMultiples.length > 0 ? totalR / rMultiples.length : null,
      profitFactor: grossLoss > 0 ? grossProfit / grossLoss : null,
    };
  };

  const openCount = allSignals.filter((s) => s.status === "open").length;

  const byPair: Record<string, { wins: number; losses: number; totalR: number }> = {};
  const byPattern: Record<string, { wins: number; losses: number; totalR: number }> = {};
  const byTimeframe: Record<string, { wins: number; losses: number; totalR: number }> = {};

  for (const s of resolvedSignals) {
    const r = s.rMultiple ?? 0;
    const isWin = s.outcome === "win";

    for (const [map, key] of [
      [byPair, s.pair],
      [byPattern, s.patternType],
      [byTimeframe, s.timeframe],
    ] as const) {
      const entry = (map as Record<string, { wins: number; losses: number; totalR: number }>)[key] ?? {
        wins: 0,
        losses: 0,
        totalR: 0,
      };
      if (isWin) entry.wins++;
      else entry.losses++;
      entry.totalR += r;
      (map as Record<string, { wins: number; losses: number; totalR: number }>)[key] = entry;
    }
  }

  // Equity curve from resolved signals in chronological order
  const chronoResolved = [...resolvedSignals].reverse();
  let equity = 0;
  const equityCurve = chronoResolved
    .filter((s) => s.rMultiple !== null)
    .map((s) => {
      equity += s.rMultiple!;
      return {
        date: (s.resolvedAt ?? s.createdAt).toISOString(),
        equity,
        rMultiple: s.rMultiple!,
        pair: s.pair,
      };
    });

  return NextResponse.json({
    overview: {
      totalSignals: allSignals.length,
      openSignals: openCount,
      resolvedSignals: resolvedSignals.length,
    },
    weekStats: computeStats(weekResolved),
    monthStats: computeStats(monthResolved),
    allTimeStats: computeStats(resolvedSignals),
    signals: allSignals.map((s) => ({
      id: s.id,
      pair: s.pair,
      timeframe: s.timeframe,
      patternType: s.patternType,
      direction: s.direction,
      entryPrice: s.entryPrice,
      stopLoss: s.stopLoss,
      takeProfit: s.takeProfit,
      qualityRating: s.qualityRating,
      v1WinProb: s.v1WinProb,
      v2MfeBucket: s.v2MfeBucket,
      v3MfePrediction: s.v3MfePrediction,
      status: s.status,
      outcome: s.outcome,
      rMultiple: s.rMultiple,
      maxFavorableExcursion: s.maxFavorableExcursion,
      maxAdverseExcursion: s.maxAdverseExcursion,
      barsToOutcome: s.barsToOutcome,
      modelVersion: s.modelVersion,
      createdAt: s.createdAt.toISOString(),
      resolvedAt: s.resolvedAt?.toISOString() ?? null,
    })),
    accuracySnapshots: recentSnapshots.map((s) => ({
      modelVersion: s.modelVersion,
      windowSize: s.windowSize,
      v1Accuracy: s.v1Accuracy,
      v2BucketAccuracy: s.v2BucketAccuracy,
      v3MaeLive: s.v3MaeLive,
      snapshotAt: s.snapshotAt.toISOString(),
    })),
    modelVersions: modelVersions.map((m) => ({
      version: m.version,
      trainedAt: m.trainedAt.toISOString(),
      trainingSize: m.trainingSize,
      v1Auc: m.v1Auc,
      v2Accuracy: m.v2Accuracy,
      v3R2: m.v3R2,
      v3Mae: m.v3Mae,
      isActive: m.isActive,
    })),
    breakdowns: { byPair, byPattern, byTimeframe },
    equityCurve,
  });
}
