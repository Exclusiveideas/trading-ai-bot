import "dotenv/config";
import { prisma } from "../lib/prisma";
import { calculateAllIndicators } from "../lib/pipeline/indicators";
import { FOREX_PAIRS, TIMEFRAMES } from "../types/trading";

const BATCH_SIZE = 500;

async function calculateIndicators() {
  let totalInserted = 0;

  for (const pair of FOREX_PAIRS) {
    for (const timeframe of TIMEFRAMES) {
      console.log(`\n--- ${pair} ${timeframe} ---`);

      const candles = await prisma.rawCandle.findMany({
        where: { pair, timeframe },
        orderBy: { timestamp: "asc" },
      });

      if (candles.length === 0) {
        console.log("  No candles, skipping");
        continue;
      }

      console.log(`  Found ${candles.length} candles`);

      const existingFeatures = await prisma.calculatedFeature.findMany({
        where: { candleId: { in: candles.map((c) => c.id) } },
        select: { candleId: true },
      });
      const existingCandleIds = new Set(
        existingFeatures.map((f) => f.candleId),
      );

      const missingCount = candles.length - existingCandleIds.size;
      if (missingCount === 0) {
        console.log("  All indicators exist, skipping");
        continue;
      }

      console.log(`  Calculating for ${missingCount} new candles...`);
      const rows = calculateAllIndicators(candles);

      const toInsert = rows
        .map((row, i) => ({ ...row, candleId: candles[i].id }))
        .filter((row) => !existingCandleIds.has(row.candleId));

      let pairInserted = 0;
      for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
        const batch = toInsert.slice(i, i + BATCH_SIZE);
        const result = await prisma.calculatedFeature.createMany({
          data: batch,
          skipDuplicates: true,
        });
        pairInserted += result.count;
      }

      console.log(`  Inserted ${pairInserted} indicator rows`);
      totalInserted += pairInserted;
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Total indicator rows inserted: ${totalInserted}`);

  const total = await prisma.calculatedFeature.count();
  console.log(`Total calculated_features in DB: ${total}`);
}

calculateIndicators()
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
