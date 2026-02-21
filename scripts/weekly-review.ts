import "dotenv/config";
import { prisma } from "../lib/prisma";
import { computeAccuracyMetrics } from "../lib/resolver/accuracy-tracker";
import { sendTelegramMessage } from "../lib/scanner/telegram";

type WeeklyStats = {
  totalSignals: number;
  resolved: number;
  wins: number;
  losses: number;
  expired: number;
  stillOpen: number;
  winRate: number | null;
  avgRMultiple: number | null;
  totalR: number;
  profitFactor: number | null;
  maxDrawdown: number;
  bestTrade: { pair: string; rMultiple: number } | null;
  worstTrade: { pair: string; rMultiple: number } | null;
  byPair: Map<string, { wins: number; losses: number; totalR: number }>;
  byPattern: Map<string, { wins: number; losses: number; totalR: number }>;
  byTimeframe: Map<string, { wins: number; losses: number; totalR: number }>;
};

async function computeWeeklyStats(
  since: Date,
  until: Date,
): Promise<WeeklyStats> {
  const signals = await prisma.signal.findMany({
    where: {
      createdAt: { gte: since, lte: until },
    },
    orderBy: { createdAt: "asc" },
  });

  const resolved = signals.filter((s) => s.status === "resolved");
  const wins = resolved.filter((s) => s.outcome === "win");
  const losses = resolved.filter((s) => s.outcome === "loss");
  const expired = signals.filter((s) => s.status === "expired");
  const stillOpen = signals.filter((s) => s.status === "open");

  const rMultiples = resolved
    .map((s) => s.rMultiple)
    .filter((r): r is number => r !== null);

  const totalR = rMultiples.reduce((sum, r) => sum + r, 0);
  const avgR = rMultiples.length > 0 ? totalR / rMultiples.length : null;

  const grossProfit = rMultiples.filter((r) => r > 0).reduce((s, r) => s + r, 0);
  const grossLoss = Math.abs(
    rMultiples.filter((r) => r < 0).reduce((s, r) => s + r, 0),
  );
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : null;

  let maxDrawdown = 0;
  let peak = 0;
  let equity = 0;
  for (const r of rMultiples) {
    equity += r;
    if (equity > peak) peak = equity;
    const dd = peak - equity;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  const bestTrade = resolved.reduce<WeeklyStats["bestTrade"]>((best, s) => {
    if (s.rMultiple !== null && (best === null || s.rMultiple > best.rMultiple)) {
      return { pair: `${s.pair} ${s.timeframe}`, rMultiple: s.rMultiple };
    }
    return best;
  }, null);

  const worstTrade = resolved.reduce<WeeklyStats["worstTrade"]>((worst, s) => {
    if (
      s.rMultiple !== null &&
      (worst === null || s.rMultiple < worst.rMultiple)
    ) {
      return { pair: `${s.pair} ${s.timeframe}`, rMultiple: s.rMultiple };
    }
    return worst;
  }, null);

  const byPair = new Map<string, { wins: number; losses: number; totalR: number }>();
  const byPattern = new Map<string, { wins: number; losses: number; totalR: number }>();
  const byTimeframe = new Map<string, { wins: number; losses: number; totalR: number }>();

  for (const s of resolved) {
    const r = s.rMultiple ?? 0;
    const isWin = s.outcome === "win";

    for (const [map, key] of [
      [byPair, s.pair],
      [byPattern, s.patternType],
      [byTimeframe, s.timeframe],
    ] as const) {
      const entry = (map as Map<string, { wins: number; losses: number; totalR: number }>).get(key) ?? {
        wins: 0,
        losses: 0,
        totalR: 0,
      };
      if (isWin) entry.wins++;
      else entry.losses++;
      entry.totalR += r;
      (map as Map<string, { wins: number; losses: number; totalR: number }>).set(key, entry);
    }
  }

  return {
    totalSignals: signals.length,
    resolved: resolved.length,
    wins: wins.length,
    losses: losses.length,
    expired: expired.length,
    stillOpen: stillOpen.length,
    winRate: resolved.length > 0 ? wins.length / resolved.length : null,
    avgRMultiple: avgR,
    totalR,
    profitFactor,
    maxDrawdown,
    bestTrade,
    worstTrade,
    byPair,
    byPattern,
    byTimeframe,
  };
}

function formatWeeklyReport(stats: WeeklyStats, weekLabel: string): string {
  const lines: string[] = [
    `📈 *Weekly Trading Review — ${weekLabel}*`,
    "",
    "*Overview*",
    `Signals: ${stats.totalSignals} total | ${stats.resolved} resolved | ${stats.stillOpen} open | ${stats.expired} expired`,
    "",
  ];

  if (stats.resolved > 0) {
    const wr = stats.winRate !== null ? (stats.winRate * 100).toFixed(1) : "N/A";
    const avgR = stats.avgRMultiple !== null ? stats.avgRMultiple.toFixed(2) : "N/A";
    const pf = stats.profitFactor !== null ? stats.profitFactor.toFixed(2) : "N/A";

    lines.push("*Performance*");
    lines.push(`Win Rate: ${wr}% (${stats.wins}W / ${stats.losses}L)`);
    lines.push(`Total R: ${stats.totalR >= 0 ? "+" : ""}${stats.totalR.toFixed(2)}R`);
    lines.push(`Avg R/Trade: ${avgR}R`);
    lines.push(`Profit Factor: ${pf}`);
    lines.push(`Max Drawdown: -${stats.maxDrawdown.toFixed(2)}R`);

    if (stats.bestTrade) {
      lines.push(`Best: ${stats.bestTrade.pair} (+${stats.bestTrade.rMultiple.toFixed(2)}R)`);
    }
    if (stats.worstTrade) {
      lines.push(`Worst: ${stats.worstTrade.pair} (${stats.worstTrade.rMultiple.toFixed(2)}R)`);
    }

    lines.push("");
    lines.push("*By Pattern*");
    for (const [pattern, data] of stats.byPattern) {
      const label = pattern.replace(/_/g, " ");
      const total = data.wins + data.losses;
      const wr = total > 0 ? ((data.wins / total) * 100).toFixed(0) : "0";
      lines.push(`  ${label}: ${wr}% (${data.wins}W/${data.losses}L) ${data.totalR >= 0 ? "+" : ""}${data.totalR.toFixed(1)}R`);
    }

    lines.push("");
    lines.push("*By Timeframe*");
    for (const [tf, data] of stats.byTimeframe) {
      const total = data.wins + data.losses;
      const wr = total > 0 ? ((data.wins / total) * 100).toFixed(0) : "0";
      lines.push(`  ${tf}: ${wr}% (${data.wins}W/${data.losses}L) ${data.totalR >= 0 ? "+" : ""}${data.totalR.toFixed(1)}R`);
    }

    if (stats.byPair.size <= 10) {
      lines.push("");
      lines.push("*Top Pairs*");
      const sortedPairs = [...stats.byPair.entries()].sort(
        (a, b) => b[1].totalR - a[1].totalR,
      );
      for (const [pair, data] of sortedPairs.slice(0, 5)) {
        lines.push(`  ${pair}: ${data.totalR >= 0 ? "+" : ""}${data.totalR.toFixed(1)}R (${data.wins}W/${data.losses}L)`);
      }
    }
  } else {
    lines.push("_No resolved signals this week._");
  }

  return lines.join("\n");
}

async function main(): Promise<void> {
  const now = new Date();
  console.log(`\n=== Weekly Review at ${now.toISOString()} ===\n`);

  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const weekLabel = `${weekAgo.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${now.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

  const stats = await computeWeeklyStats(weekAgo, now);
  const report = formatWeeklyReport(stats, weekLabel);

  console.log(report);

  // Model accuracy (all-time rolling)
  const allResolved = await prisma.signal.findMany({
    where: { status: "resolved" },
    orderBy: { resolvedAt: "desc" },
    take: 100,
    select: {
      outcome: true,
      v1WinProb: true,
      v2MfeBucket: true,
      v3MfePrediction: true,
      maxFavorableExcursion: true,
    },
  });

  if (allResolved.length > 0) {
    const accuracy = computeAccuracyMetrics(allResolved);
    const accLines = [
      "",
      `*Model Accuracy (last ${accuracy.windowSize})*`,
    ];
    if (accuracy.v1Accuracy !== null) {
      accLines.push(`V1 Win/Loss: ${(accuracy.v1Accuracy * 100).toFixed(1)}%`);
    }
    if (accuracy.v2BucketAccuracy !== null) {
      accLines.push(`V2 Bucket: ${(accuracy.v2BucketAccuracy * 100).toFixed(1)}%`);
    }
    if (accuracy.v3MaeLive !== null) {
      accLines.push(`V3 MAE: ${accuracy.v3MaeLive.toFixed(3)}R`);
    }

    const accSection = accLines.join("\n");
    console.log(accSection);

    await sendTelegramMessage(report + "\n" + accSection);
  } else {
    await sendTelegramMessage(report);
  }

  console.log("\n=== Weekly Review done ===\n");
}

main()
  .catch((err) => {
    console.error("Weekly review failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
