import "dotenv/config";
import { prisma } from "../lib/prisma";
import { fetchHistoricalData } from "../lib/alphavantage";
import { validateCandle } from "../lib/pipeline/collector";

const PAIRS = ["EUR/USD", "GBP/USD"];

async function collectHistoricalData() {
  console.log("Collecting full daily history from Alpha Vantage...\n");

  let totalInserted = 0;

  for (const pair of PAIRS) {
    console.log(`--- ${pair} ---`);
    console.log("  Fetching full history (outputsize=full)...");

    const candles = await fetchHistoricalData(pair, "1day", "full");
    console.log(`  Fetched ${candles.length} candles from API.`);

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

    console.log(`  Inserted ${result.count} new candle(s)`);
    totalInserted += result.count;
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
