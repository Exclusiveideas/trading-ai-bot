import "dotenv/config";
import { prisma } from "../lib/prisma";
import { FOREX_PAIRS, TIMEFRAMES } from "../types/trading";
import type { OandaGranularity, TrendState, PatternCandidate } from "../types/trading";
import { findAllCandidates } from "../lib/pipeline/patterns/candidate-finder";
import { deduplicateOverlapping } from "../lib/pipeline/patterns/candidate-finder";
import type { EnrichedDetectorCandle } from "../lib/pipeline/patterns/candidate-finder";
import { calculateOutcome } from "../lib/pipeline/outcome-calculator";
import { analyzeCandidate } from "../lib/pipeline/pattern-analyzer";
import type { AnalysisCandle } from "../lib/pipeline/pattern-analyzer";

const CHUNK_SIZE = 5000;
const CHUNK_OVERLAP = 500;

type Stats = {
  found: number;
  approved: number;
  rejected: number;
  saved: number;
  duplicates: number;
};

type CandleRow = Awaited<
  ReturnType<typeof prisma.rawCandle.findMany>
>[number] & {
  features: Awaited<ReturnType<typeof prisma.calculatedFeature.findFirst>>;
  contextFeatures: Awaited<ReturnType<typeof prisma.contextFeature.findFirst>>;
};

function toEnriched(c: CandleRow): EnrichedDetectorCandle {
  return {
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
  };
}

function toAnalysis(c: CandleRow): AnalysisCandle {
  return {
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
  };
}

function findCandidatesChunked(
  enriched: EnrichedDetectorCandle[],
  pair: string,
): PatternCandidate[] {
  if (enriched.length <= CHUNK_SIZE) {
    return findAllCandidates(enriched, pair, { maxCandidates: 1000 });
  }

  const allCandidates: PatternCandidate[] = [];

  for (let start = 0; start < enriched.length; start += CHUNK_SIZE - CHUNK_OVERLAP) {
    const end = Math.min(start + CHUNK_SIZE, enriched.length);
    const chunk = enriched.slice(start, end);

    const chunkCandidates = findAllCandidates(chunk, pair, {
      maxCandidates: 1000,
    });

    for (const c of chunkCandidates) {
      allCandidates.push({
        ...c,
        startIndex: c.startIndex + start,
        endIndex: c.endIndex + start,
      });
    }

    if (end >= enriched.length) break;
  }

  allCandidates.sort((a, b) => a.startIndex - b.startIndex);
  const deduped = deduplicateOverlapping(allCandidates);

  if (deduped.length <= 1000) return deduped;
  return deduped
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 1000)
    .sort((a, b) => a.startIndex - b.startIndex);
}

async function processPairTimeframe(
  pair: string,
  timeframe: OandaGranularity,
): Promise<Stats> {
  const stats: Stats = {
    found: 0,
    approved: 0,
    rejected: 0,
    saved: 0,
    duplicates: 0,
  };

  const candles = await prisma.rawCandle.findMany({
    where: { pair, timeframe },
    orderBy: { timestamp: "asc" },
    include: { features: true, contextFeatures: true },
  });

  if (candles.length === 0) {
    return stats;
  }

  const enriched = (candles as CandleRow[]).map(toEnriched);
  const candidates = findCandidatesChunked(enriched, pair);
  stats.found = candidates.length;

  if (candidates.length === 0) {
    return stats;
  }

  const outcomeCandles = candles.map((c) => ({
    high: c.high,
    low: c.low,
    close: c.close,
  }));

  const analysisCandles = (candles as CandleRow[]).map(toAnalysis);

  for (const candidate of candidates) {
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

    if (!analysis.approved) {
      stats.rejected++;
      continue;
    }

    stats.approved++;

    const startTimestamp = candles[candidate.startIndex].timestamp;
    const endTimestamp = candles[candidate.endIndex].timestamp;

    const existing = await prisma.labeledPattern.findFirst({
      where: {
        pair,
        patternType: candidate.patternType,
        startTimestamp,
      },
    });

    if (existing) {
      stats.duplicates++;
      continue;
    }

    await prisma.labeledPattern.create({
      data: {
        pair,
        patternType: candidate.patternType,
        startTimestamp,
        endTimestamp,
        entryPrice: candidate.keyPriceLevels.entry,
        stopLoss: candidate.keyPriceLevels.stopLoss,
        takeProfit: candidate.keyPriceLevels.takeProfit,
        outcome: outcome.outcome,
        rMultiple: outcome.rMultiple,
        barsToOutcome: outcome.barsToOutcome,
        maxFavorableExcursion: outcome.maxFavorableExcursion,
        qualityRating: analysis.qualityRating,
        trendState: candidate.contextSnapshot.trendState,
        session: null,
        supportQuality: null,
        notes: analysis.notes,
        contextJson: candidate.contextSnapshot,
        timeframe,
      },
    });

    stats.saved++;
  }

  return stats;
}

async function batchLabel() {
  const pairsArg = process.argv.find((a) => a.startsWith("--pairs="));
  const tfArg = process.argv.find((a) => a.startsWith("--timeframes="));

  const pairs = pairsArg
    ? pairsArg.replace("--pairs=", "").split(",")
    : [...FOREX_PAIRS];
  const timeframes = (
    tfArg
      ? tfArg.replace("--timeframes=", "").split(",")
      : [...TIMEFRAMES]
  ) as OandaGranularity[];

  const totalCombinations = pairs.length * timeframes.length;
  let processed = 0;
  let totalFound = 0;
  let totalApproved = 0;
  let totalRejected = 0;
  let totalSaved = 0;
  let totalDuplicates = 0;

  console.log(
    `Batch labeling: ${pairs.length} pairs x ${timeframes.length} timeframes = ${totalCombinations} combinations\n`,
  );

  for (const pair of pairs) {
    for (const tf of timeframes) {
      processed++;
      const pct = ((processed / totalCombinations) * 100).toFixed(0);
      process.stdout.write(`[${pct}%] ${pair} ${tf} ... `);

      try {
        const stats = await processPairTimeframe(pair, tf);

        if (stats.found === 0) {
          console.log("no candles or candidates");
        } else {
          console.log(
            `found=${stats.found} approved=${stats.approved} rejected=${stats.rejected} saved=${stats.saved} dups=${stats.duplicates}`,
          );
        }

        totalFound += stats.found;
        totalApproved += stats.approved;
        totalRejected += stats.rejected;
        totalSaved += stats.saved;
        totalDuplicates += stats.duplicates;
      } catch (err) {
        console.log(
          `ERROR: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  console.log(`\n=== Batch Label Summary ===`);
  console.log(`Combinations processed: ${processed}`);
  console.log(`Candidates found:       ${totalFound}`);
  console.log(`Approved by analyzer:   ${totalApproved}`);
  console.log(`Rejected by analyzer:   ${totalRejected}`);
  console.log(`Saved to DB:            ${totalSaved}`);
  console.log(`Duplicates skipped:     ${totalDuplicates}`);

  const totalLabels = await prisma.labeledPattern.count();
  console.log(`\nTotal labels in DB:     ${totalLabels}`);
}

batchLabel()
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
