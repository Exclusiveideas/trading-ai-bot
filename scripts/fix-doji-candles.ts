import "dotenv/config";
import { prisma } from "../lib/prisma";
import { fetchHistoricalData } from "../lib/alphavantage";

const PAIRS = ["EUR/USD", "GBP/USD"];

async function diagnoseAndFix() {
  console.log("=== Diagnosing candle data quality ===\n");

  for (const pair of PAIRS) {
    const total = await prisma.rawCandle.count({ where: { pair } });

    const dojiCandles = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*) as count FROM raw_candles WHERE pair = $1 AND open = close`,
      pair,
    );
    const dojiCount = Number(dojiCandles[0]?.count ?? 0);

    const flatCandles = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*) as count FROM raw_candles WHERE pair = $1 AND open = high AND high = low AND low = close`,
      pair,
    );
    const flatCount = Number(flatCandles[0]?.count ?? 0);

    console.log(`${pair}:`);
    console.log(`  Total candles: ${total}`);
    console.log(
      `  open === close (doji): ${dojiCount} (${((dojiCount / total) * 100).toFixed(1)}%)`,
    );
    console.log(`  open === high === low === close (flat): ${flatCount}`);

    const earliest = await prisma.rawCandle.findFirst({
      where: { pair },
      orderBy: { timestamp: "asc" },
      select: { timestamp: true },
    });
    const latestDoji = await prisma.$queryRawUnsafe<{ timestamp: Date }[]>(
      `SELECT timestamp FROM raw_candles WHERE pair = $1 AND open = close ORDER BY timestamp DESC LIMIT 1`,
      pair,
    );

    if (earliest)
      console.log(
        `  Earliest candle: ${earliest.timestamp.toISOString().split("T")[0]}`,
      );
    if (latestDoji[0])
      console.log(
        `  Latest doji: ${latestDoji[0].timestamp.toISOString().split("T")[0]}`,
      );
    console.log();
  }

  const args = process.argv.slice(2);
  if (!args.includes("--fix")) {
    console.log(
      "Run with --fix to re-fetch and repair bad candles from Alpha Vantage API.",
    );
    console.log("  npx tsx scripts/fix-doji-candles.ts --fix");
    return;
  }

  console.log("\n=== Fixing bad candles using Alpha Vantage ===\n");

  for (const pair of PAIRS) {
    const badCandles = await prisma.$queryRawUnsafe<
      {
        id: number;
        timestamp: Date;
        open: number;
        high: number;
        low: number;
        close: number;
      }[]
    >(
      `SELECT id, timestamp, open, high, low, close FROM raw_candles WHERE pair = $1 AND open = close ORDER BY timestamp ASC`,
      pair,
    );

    if (badCandles.length === 0) {
      console.log(`${pair}: No bad candles to fix.`);
      continue;
    }

    console.log(`${pair}: ${badCandles.length} candles to fix.`);
    console.log(
      `  Fetching full history from Alpha Vantage (outputsize=full)...`,
    );

    const freshCandles = await fetchHistoricalData(pair, "1day", "full");
    console.log(`  Fetched ${freshCandles.length} candles from Alpha Vantage.`);

    const freshByDate = new Map<string, (typeof freshCandles)[0]>();
    for (const c of freshCandles) {
      const dateKey = c.timestamp.split("T")[0].split(" ")[0];
      freshByDate.set(dateKey, c);
    }

    let fixedCount = 0;
    let stillBadCount = 0;
    let notFoundCount = 0;

    for (const bad of badCandles) {
      const dateKey = bad.timestamp.toISOString().split("T")[0];
      const fresh = freshByDate.get(dateKey);

      if (!fresh) {
        notFoundCount++;
        continue;
      }

      if (fresh.open === fresh.close) {
        stillBadCount++;
        continue;
      }

      await prisma.rawCandle.update({
        where: { id: bad.id },
        data: {
          open: fresh.open,
          high: fresh.high,
          low: fresh.low,
          close: fresh.close,
        },
      });
      fixedCount++;
    }

    console.log(`  Fixed: ${fixedCount}`);
    console.log(`  Not found in Alpha Vantage: ${notFoundCount}`);
    console.log(`  Still bad (Alpha Vantage also doji): ${stillBadCount}`);
  }

  console.log("\nDone. Re-run without --fix to verify.");
}

diagnoseAndFix()
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
