import "dotenv/config";
import { prisma } from "../lib/prisma";
import { fetchHistoricalData } from "../lib/twelvedata";
import { computeDateChunks, validateCandle, fetchWithRetry } from "../lib/pipeline/collector";

const PAIRS = ["EUR/USD", "GBP/USD"];
const YEARS_BACK = 5;

async function collectHistoricalData() {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - YEARS_BACK);

  const startStr = startDate.toISOString().split("T")[0];
  const endStr = endDate.toISOString().split("T")[0];

  console.log(`Collecting ${YEARS_BACK} years of daily data: ${startStr} to ${endStr}`);

  let totalInserted = 0;

  for (const pair of PAIRS) {
    console.log(`\n--- ${pair} ---`);
    const chunks = computeDateChunks(startStr, endStr);
    console.log(`Split into ${chunks.length} chunk(s)`);

    let pairInserted = 0;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`Fetching chunk ${i + 1}/${chunks.length}: ${chunk.start} to ${chunk.end}...`);

      const candles = await fetchWithRetry(() =>
        fetchHistoricalData(pair, "1day", 5000, chunk.start, chunk.end)
      );

      const valid = candles.filter(validateCandle);
      const invalid = candles.length - valid.length;
      if (invalid > 0) {
        console.log(`  Filtered out ${invalid} invalid candle(s)`);
      }

      const result = await prisma.rawCandle.createMany({
        data: valid.map((c) => ({
          pair: c.pair,
          timestamp: new Date(c.timestamp),
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          volume: c.volume,
          timeframe: c.timeframe,
        })),
        skipDuplicates: true,
      });

      console.log(`  Fetched ${candles.length}, inserted ${result.count} new candle(s)`);
      pairInserted += result.count;
    }

    console.log(`${pair}: ${pairInserted} total new candles`);
    totalInserted += pairInserted;
  }

  const counts = await prisma.rawCandle.groupBy({
    by: ["pair"],
    _count: { id: true },
  });

  console.log("\n=== Summary ===");
  console.log(`New candles inserted this run: ${totalInserted}`);
  for (const row of counts) {
    console.log(`  ${row.pair}: ${row._count.id} total candles in DB`);
  }
}

collectHistoricalData()
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
