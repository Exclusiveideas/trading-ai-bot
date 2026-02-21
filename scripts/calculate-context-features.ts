import "dotenv/config";
import { prisma } from "../lib/prisma";
import {
  detectSupportResistanceLevels,
  findNearestLevels,
  distanceInPips,
  distanceInAtr,
  classifyTrendState,
  identifyTradingSession,
  findNearestRoundNumber,
} from "../lib/pipeline/context-features";
import { FOREX_PAIRS, TIMEFRAMES } from "../types/trading";

const LOOKBACK = 100;
const BATCH_SIZE = 500;

async function calculateContextFeatures() {
  let totalInserted = 0;

  for (const pair of FOREX_PAIRS) {
    for (const timeframe of TIMEFRAMES) {
      console.log(`\n--- ${pair} ${timeframe} ---`);

      const candles = await prisma.rawCandle.findMany({
        where: { pair, timeframe },
        orderBy: { timestamp: "asc" },
        include: { features: true, contextFeatures: true },
      });

      if (candles.length === 0) {
        console.log("  No candles, skipping");
        continue;
      }

      console.log(`  Found ${candles.length} candles`);

      const missingCandles = candles.filter((c) => !c.contextFeatures);
      if (missingCandles.length === 0) {
        console.log("  All context features exist, skipping");
        continue;
      }

      console.log(
        `  Calculating context features for ${missingCandles.length} candles...`,
      );

      const missingIds = new Set(missingCandles.map((c) => c.id));

      const toInsert: Array<{
        candleId: number;
        nearestSupport: number | null;
        nearestResistance: number | null;
        distToSupportPips: number | null;
        distToResistancePips: number | null;
        distToSupportAtr: number | null;
        distToResistanceAtr: number | null;
        trendState: string | null;
        tradingSession: string | null;
        nearestRoundNumber: number | null;
        distToRoundNumberPips: number | null;
      }> = [];

      for (let i = 0; i < candles.length; i++) {
        const candle = candles[i];
        if (!missingIds.has(candle.id)) continue;

        const priorCandles = candles.slice(Math.max(0, i - LOOKBACK), i);

        const levels =
          priorCandles.length >= 11
            ? detectSupportResistanceLevels(priorCandles, LOOKBACK)
            : [];

        const { support, resistance } = findNearestLevels(candle.close, levels);
        const atr = candle.features?.atr ?? null;

        const roundNumber = findNearestRoundNumber(candle.close);

        toInsert.push({
          candleId: candle.id,
          nearestSupport: support,
          nearestResistance: resistance,
          distToSupportPips:
            support !== null
              ? distanceInPips(candle.close, support, pair)
              : null,
          distToResistancePips:
            resistance !== null
              ? distanceInPips(candle.close, resistance, pair)
              : null,
          distToSupportAtr:
            support !== null ? distanceInAtr(candle.close, support, atr) : null,
          distToResistanceAtr:
            resistance !== null
              ? distanceInAtr(candle.close, resistance, atr)
              : null,
          trendState: classifyTrendState(
            candle.features?.sma20 ?? null,
            candle.features?.sma50 ?? null,
            candle.features?.ema200 ?? null,
            candle.features?.adx ?? null,
            candle.close,
          ),
          tradingSession: identifyTradingSession(candle.timestamp, timeframe),
          nearestRoundNumber: roundNumber,
          distToRoundNumberPips: distanceInPips(
            candle.close,
            roundNumber,
            pair,
          ),
        });
      }

      let pairInserted = 0;
      for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
        const batch = toInsert.slice(i, i + BATCH_SIZE);
        const result = await prisma.contextFeature.createMany({
          data: batch,
          skipDuplicates: true,
        });
        pairInserted += result.count;
      }

      console.log(`  Inserted ${pairInserted} context feature rows`);
      totalInserted += pairInserted;
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Total context feature rows inserted: ${totalInserted}`);
  const total = await prisma.contextFeature.count();
  console.log(`Total context_features in DB: ${total}`);
}

calculateContextFeatures()
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
