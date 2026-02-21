import "dotenv/config";
import { prisma } from "../lib/prisma";
import { sendTelegramMessage } from "../lib/scanner/telegram";

/**
 * Dynamic TP Backtesting
 *
 * Compares fixed TP (2R) against dynamic TP strategies that use V3 MFE predictions.
 * Uses labeled_patterns data with known MFE outcomes.
 *
 * Strategies:
 * - Fixed 2R: traditional fixed take-profit at 2R
 * - Conservative: TP at 70% of predicted MFE
 * - Moderate: TP at 80% of predicted MFE
 * - Aggressive: TP at 90% of predicted MFE
 * - Capped: min(predicted MFE * 80%, 3R) — moderate with a cap
 */

type TradeResult = {
  entryR: 0;
  tpR: number;
  actualMfe: number;
  hit: boolean;
  rMultiple: number;
};

type StrategyResult = {
  name: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalR: number;
  avgR: number;
  profitFactor: number | null;
  maxDrawdown: number;
  avgTpR: number;
};

function simulateTrade(
  actualMfe: number,
  tpR: number,
  stopR: number = 1,
): TradeResult {
  const hit = actualMfe >= tpR;
  const rMultiple = hit ? tpR : -stopR;
  return { entryR: 0, tpR, actualMfe, hit, rMultiple };
}

function runStrategy(
  name: string,
  mfeData: { actualMfe: number; predictedMfe: number }[],
  tpFn: (predicted: number) => number,
): StrategyResult {
  const trades: TradeResult[] = [];

  for (const { actualMfe, predictedMfe } of mfeData) {
    const tpR = Math.max(tpFn(predictedMfe), 0.5);
    trades.push(simulateTrade(actualMfe, tpR));
  }

  const wins = trades.filter((t) => t.hit);
  const losses = trades.filter((t) => !t.hit);
  const totalR = trades.reduce((sum, t) => sum + t.rMultiple, 0);
  const grossProfit = wins.reduce((sum, t) => sum + t.rMultiple, 0);
  const grossLoss = Math.abs(losses.reduce((sum, t) => sum + t.rMultiple, 0));

  let maxDrawdown = 0;
  let peak = 0;
  let equity = 0;
  for (const t of trades) {
    equity += t.rMultiple;
    if (equity > peak) peak = equity;
    const dd = peak - equity;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  const avgTpR =
    trades.length > 0
      ? trades.reduce((sum, t) => sum + t.tpR, 0) / trades.length
      : 0;

  return {
    name,
    trades: trades.length,
    wins: wins.length,
    losses: losses.length,
    winRate: trades.length > 0 ? wins.length / trades.length : 0,
    totalR,
    avgR: trades.length > 0 ? totalR / trades.length : 0,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : null,
    maxDrawdown,
    avgTpR,
  };
}

async function main(): Promise<void> {
  console.log("\n=== Dynamic TP Backtesting ===\n");

  // Get all labeled patterns with MFE data (win or loss, with known MFE)
  const patterns = await prisma.labeledPattern.findMany({
    where: {
      outcome: { in: ["win", "loss"] },
      maxFavorableExcursion: { not: null },
    },
    select: {
      pair: true,
      patternType: true,
      timeframe: true,
      outcome: true,
      rMultiple: true,
      maxFavorableExcursion: true,
      entryPrice: true,
      stopLoss: true,
      takeProfit: true,
    },
  });

  console.log(`Loaded ${patterns.length} labeled patterns with MFE data\n`);

  if (patterns.length === 0) {
    console.log("No patterns with MFE data found. Nothing to backtest.");
    return;
  }

  // For the dynamic TP strategies, we simulate using V3's predicted MFE.
  // Since we don't have V3 predictions for historical labels, we use the actual MFE
  // with noise added to simulate prediction error (MAE ~0.635R).
  // For a fair test, we also run a "perfect prediction" variant.

  const actualMfes = patterns
    .map((p) => p.maxFavorableExcursion!)
    .filter((mfe) => mfe >= 0);

  // Simulate V3 predictions with realistic noise (MAE = 0.635)
  const V3_MAE = 0.635;
  const mfeDataWithNoise = actualMfes.map((actualMfe) => {
    const noise = (Math.random() - 0.5) * 2 * V3_MAE;
    return {
      actualMfe,
      predictedMfe: Math.max(0, actualMfe + noise),
    };
  });

  // Perfect prediction baseline
  const mfeDataPerfect = actualMfes.map((actualMfe) => ({
    actualMfe,
    predictedMfe: actualMfe,
  }));

  const strategies: StrategyResult[] = [
    // Fixed TP baselines
    runStrategy("Fixed 1R", mfeDataWithNoise, () => 1),
    runStrategy("Fixed 1.5R", mfeDataWithNoise, () => 1.5),
    runStrategy("Fixed 2R", mfeDataWithNoise, () => 2),
    runStrategy("Fixed 3R", mfeDataWithNoise, () => 3),

    // Dynamic TP with V3-like predictions (noisy)
    runStrategy("Dynamic 70%", mfeDataWithNoise, (pred) => pred * 0.7),
    runStrategy("Dynamic 80%", mfeDataWithNoise, (pred) => pred * 0.8),
    runStrategy("Dynamic 90%", mfeDataWithNoise, (pred) => pred * 0.9),
    runStrategy("Capped 80%/3R", mfeDataWithNoise, (pred) =>
      Math.min(pred * 0.8, 3),
    ),

    // Perfect prediction upper bound
    runStrategy("Perfect 70%", mfeDataPerfect, (pred) => pred * 0.7),
    runStrategy("Perfect 80%", mfeDataPerfect, (pred) => pred * 0.8),
    runStrategy("Perfect 90%", mfeDataPerfect, (pred) => pred * 0.9),
  ];

  // Print results
  console.log(
    "Strategy           | Trades | Win%  | Total R    | Avg R  | PF   | MaxDD  | Avg TP",
  );
  console.log(
    "-------------------|--------|-------|------------|--------|------|--------|-------",
  );

  const lines: string[] = [
    "📊 *Dynamic TP Backtest Results*",
    `_${patterns.length} labeled patterns with MFE data_`,
    "",
    "```",
    "Strategy        | Win%  | Total R  | Avg R | PF",
    "----------------|-------|----------|-------|----",
  ];

  for (const s of strategies) {
    const wr = (s.winRate * 100).toFixed(1).padStart(5);
    const tr = (s.totalR >= 0 ? "+" : "") + s.totalR.toFixed(1);
    const ar = s.avgR.toFixed(3);
    const pf = s.profitFactor !== null ? s.profitFactor.toFixed(2) : " N/A";
    const dd = s.maxDrawdown.toFixed(1);
    const tp = s.avgTpR.toFixed(2);

    console.log(
      `${s.name.padEnd(19)}| ${String(s.trades).padStart(6)} | ${wr}% | ${tr.padStart(10)}R | ${ar.padStart(6)}R | ${pf.padStart(4)} | ${dd.padStart(6)}R | ${tp}R`,
    );

    lines.push(
      `${s.name.padEnd(16)}| ${wr}% | ${tr.padStart(7)}R | ${ar.padStart(5)}R | ${pf}`,
    );
  }

  lines.push("```");
  lines.push("");
  lines.push("_V3 MAE = 0.635R noise applied to dynamic strategies_");

  // Find best strategy
  const best = strategies.reduce((a, b) => (a.totalR > b.totalR ? a : b));
  lines.push(`\nBest: *${best.name}* (+${best.totalR.toFixed(1)}R, ${(best.winRate * 100).toFixed(1)}% WR)`);

  console.log(`\nBest strategy: ${best.name} (+${best.totalR.toFixed(1)}R)`);

  // MFE distribution stats
  const sorted = [...actualMfes].sort((a, b) => a - b);
  const p25 = sorted[Math.floor(sorted.length * 0.25)];
  const p50 = sorted[Math.floor(sorted.length * 0.5)];
  const p75 = sorted[Math.floor(sorted.length * 0.75)];
  const mean = actualMfes.reduce((s, v) => s + v, 0) / actualMfes.length;

  console.log("\nMFE Distribution:");
  console.log(`  Mean: ${mean.toFixed(2)}R`);
  console.log(`  P25: ${p25.toFixed(2)}R | P50: ${p50.toFixed(2)}R | P75: ${p75.toFixed(2)}R`);

  await sendTelegramMessage(lines.join("\n"));
  console.log("\n=== Backtest complete ===\n");
}

main()
  .catch((err) => {
    console.error("Backtest failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
