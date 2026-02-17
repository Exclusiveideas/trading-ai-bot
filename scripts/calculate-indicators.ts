import "dotenv/config";
import { prisma } from "../lib/prisma";
import { calculateAllIndicators } from "../lib/pipeline/indicators";

const PAIRS = ["EUR/USD", "GBP/USD"];
const BATCH_SIZE = 500;

async function calculateIndicators() {
  let totalInserted = 0;

  for (const pair of PAIRS) {
    console.log(`\n--- ${pair} ---`);

    const candles = await prisma.rawCandle.findMany({
      where: { pair },
      orderBy: { timestamp: "asc" },
    });

    console.log(`Found ${candles.length} candles`);

    if (candles.length === 0) continue;

    const existingFeatures = await prisma.calculatedFeature.findMany({
      where: { candleId: { in: candles.map((c) => c.id) } },
      select: { candleId: true },
    });
    const existingCandleIds = new Set(existingFeatures.map((f) => f.candleId));

    const missingCount = candles.length - existingCandleIds.size;
    if (missingCount === 0) {
      console.log("All candles already have indicators, skipping");
      continue;
    }

    console.log(`Calculating indicators for ${candles.length} candles (${missingCount} new)...`);
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

    console.log(`${pair}: inserted ${pairInserted} indicator rows`);
    totalInserted += pairInserted;
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
