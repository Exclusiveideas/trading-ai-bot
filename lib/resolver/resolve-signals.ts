import type { PrismaClient } from "../generated/prisma/client";
import type { OandaGranularity, Candle } from "@/types/trading";
import { fetchLatestCandles } from "../oanda";
import { calculateOutcome } from "../pipeline/outcome-calculator";

const MAX_BARS_TO_HOLD = 100;

type ResolutionSummary = {
  resolved: number;
  expired: number;
  stillOpen: number;
  errors: number;
};

export function timeframesToCheck(now: Date): OandaGranularity[] {
  const hour = now.getUTCHours();
  const minute = now.getUTCMinutes();

  const tfs: OandaGranularity[] = ["M15"];

  if (minute < 15) {
    tfs.push("H1");
  }

  if (hour % 4 === 0 && minute < 15) {
    tfs.push("H4");
  }

  if (hour === 0 && minute < 15) {
    tfs.push("D");
  }

  return tfs;
}

export function findEntryIndex(
  candles: Candle[],
  patternEndTimestamp: Date,
): number {
  const targetMs = patternEndTimestamp.getTime();
  let bestIdx = -1;
  let bestDiff = Infinity;

  for (let i = 0; i < candles.length; i++) {
    const candleMs = new Date(candles[i].timestamp).getTime();
    const diff = Math.abs(candleMs - targetMs);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIdx = i;
    }
  }

  return bestIdx;
}

function timeframeDurationMs(tf: OandaGranularity): number {
  switch (tf) {
    case "D":
      return 24 * 60 * 60 * 1000;
    case "H4":
      return 4 * 60 * 60 * 1000;
    case "H1":
      return 60 * 60 * 1000;
    case "M15":
      return 15 * 60 * 1000;
  }
}

type OpenSignal = {
  id: number;
  pair: string;
  timeframe: string;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  patternEnd: Date;
  barsElapsed: number | null;
};

export async function resolveOpenSignals(
  db: PrismaClient,
  timeframes: OandaGranularity[],
): Promise<ResolutionSummary> {
  const summary: ResolutionSummary = {
    resolved: 0,
    expired: 0,
    stillOpen: 0,
    errors: 0,
  };

  const openSignals = await db.signal.findMany({
    where: {
      status: "open",
      timeframe: { in: timeframes },
    },
    select: {
      id: true,
      pair: true,
      timeframe: true,
      entryPrice: true,
      stopLoss: true,
      takeProfit: true,
      patternEnd: true,
      barsElapsed: true,
    },
  });

  if (openSignals.length === 0) {
    console.log("  No open signals to resolve");
    return summary;
  }

  console.log(
    `  Found ${openSignals.length} open signal(s) across ${timeframes.join(", ")}`,
  );

  const grouped = groupByPairTimeframe(openSignals);

  for (const [key, signals] of grouped.entries()) {
    const [pair, tf] = key.split("|") as [string, OandaGranularity];

    const oldestSignal = signals.reduce((oldest, s) =>
      s.patternEnd < oldest.patternEnd ? s : oldest,
    );
    const barsSinceOldest = Math.ceil(
      (Date.now() - oldestSignal.patternEnd.getTime()) /
        timeframeDurationMs(tf),
    );
    const candlesToFetch = Math.min(barsSinceOldest + 20, 500);

    let candles: Candle[];
    try {
      candles = await fetchLatestCandles(pair, tf, candlesToFetch);
    } catch (err) {
      console.error(
        `  Failed to fetch candles for ${pair} ${tf}:`,
        err instanceof Error ? err.message : err,
      );
      summary.errors += signals.length;
      continue;
    }

    if (candles.length < 10) {
      console.log(
        `  ${pair} ${tf}: Only ${candles.length} candles, skipping`,
      );
      summary.errors += signals.length;
      continue;
    }

    for (const signal of signals) {
      try {
        const entryIdx = findEntryIndex(candles, signal.patternEnd);
        if (entryIdx < 0) {
          summary.errors++;
          continue;
        }

        const result = calculateOutcome(
          candles,
          {
            entryPrice: signal.entryPrice,
            stopLoss: signal.stopLoss,
            takeProfit: signal.takeProfit,
            entryIndex: entryIdx,
          },
          MAX_BARS_TO_HOLD,
        );

        const barsElapsed = result.barsToOutcome ?? 0;

        if (result.outcome === "win" || result.outcome === "loss") {
          await db.signal.update({
            where: { id: signal.id },
            data: {
              status: "resolved",
              outcome: result.outcome,
              exitPrice: result.exitPrice,
              rMultiple: result.rMultiple,
              barsToOutcome: result.barsToOutcome,
              maxFavorableExcursion: result.maxFavorableExcursion,
              maxAdverseExcursion: result.maxAdverseExcursion,
              resolvedAt: new Date(),
              barsElapsed,
              lastCheckedAt: new Date(),
            },
          });
          summary.resolved++;
          console.log(
            `  Resolved ${pair} ${tf} #${signal.id}: ${result.outcome} (${result.rMultiple?.toFixed(2)}R, ${result.barsToOutcome} bars)`,
          );
        } else if (barsElapsed >= MAX_BARS_TO_HOLD) {
          await db.signal.update({
            where: { id: signal.id },
            data: {
              status: "expired",
              outcome: "expired",
              rMultiple: result.rMultiple,
              maxFavorableExcursion: result.maxFavorableExcursion,
              maxAdverseExcursion: result.maxAdverseExcursion,
              resolvedAt: new Date(),
              barsElapsed,
              lastCheckedAt: new Date(),
            },
          });
          summary.expired++;
          console.log(
            `  Expired ${pair} ${tf} #${signal.id}: ${barsElapsed} bars, unrealized ${result.rMultiple?.toFixed(2)}R`,
          );
        } else {
          await db.signal.update({
            where: { id: signal.id },
            data: {
              barsElapsed,
              maxFavorableExcursion: result.maxFavorableExcursion,
              maxAdverseExcursion: result.maxAdverseExcursion,
              lastCheckedAt: new Date(),
            },
          });
          summary.stillOpen++;
        }
      } catch (err) {
        console.error(
          `  Error resolving signal #${signal.id}:`,
          err instanceof Error ? err.message : err,
        );
        summary.errors++;
      }
    }
  }

  return summary;
}

function groupByPairTimeframe(
  signals: OpenSignal[],
): Map<string, OpenSignal[]> {
  const map = new Map<string, OpenSignal[]>();
  for (const s of signals) {
    const key = `${s.pair}|${s.timeframe}`;
    const group = map.get(key);
    if (group) {
      group.push(s);
    } else {
      map.set(key, [s]);
    }
  }
  return map;
}
