import "dotenv/config";
import { prisma } from "../lib/prisma";
import { FOREX_PAIRS, TIMEFRAMES } from "../types/trading";

async function verifyPipeline() {
  const filterPair = process.argv[2] ?? null;
  const filterTimeframe = process.argv[3] ?? null;

  const pairs = filterPair ? [filterPair] : [...FOREX_PAIRS];
  const timeframes = filterTimeframe ? [filterTimeframe] : [...TIMEFRAMES];

  console.log("=== Pipeline Verification ===\n");

  const summary = await prisma.rawCandle.groupBy({
    by: ["pair", "timeframe"],
    _count: { id: true },
    orderBy: [{ pair: "asc" }, { timeframe: "asc" }],
  });

  console.log("--- Candle Counts ---");
  for (const row of summary) {
    console.log(`  ${row.pair} ${row.timeframe}: ${row._count.id}`);
  }

  const totalCandles = await prisma.rawCandle.count();
  const totalFeatures = await prisma.calculatedFeature.count();
  const totalContext = await prisma.contextFeature.count();

  console.log(`\n--- Totals ---`);
  console.log(`  Raw candles:         ${totalCandles}`);
  console.log(`  Calculated features: ${totalFeatures}`);
  console.log(`  Context features:    ${totalContext}`);
  console.log(
    `  All match:           ${totalCandles === totalFeatures && totalFeatures === totalContext ? "YES" : "NO !!!"}`,
  );

  for (const pair of pairs) {
    for (const timeframe of timeframes) {
      const candleCount = await prisma.rawCandle.count({
        where: { pair, timeframe },
      });

      if (candleCount === 0) continue;

      const featureCount = await prisma.calculatedFeature.count({
        where: { candle: { pair, timeframe } },
      });
      const contextCount = await prisma.contextFeature.count({
        where: { candle: { pair, timeframe } },
      });

      const match =
        candleCount === featureCount && featureCount === contextCount;

      const dateRange = await prisma.rawCandle.aggregate({
        where: { pair, timeframe },
        _min: { timestamp: true },
        _max: { timestamp: true },
      });

      const from = dateRange._min.timestamp?.toISOString().split("T")[0];
      const to = dateRange._max.timestamp?.toISOString().split("T")[0];

      console.log(`\n--- ${pair} ${timeframe} (${from} → ${to}) ---`);
      console.log(
        `  Candles: ${candleCount}  Features: ${featureCount}  Context: ${contextCount}  Match: ${match ? "YES" : "NO !!!"}`,
      );

      if (filterPair) {
        const midIndex = Math.floor(candleCount / 2);
        const sampleCandle = await prisma.rawCandle.findFirst({
          where: { pair, timeframe },
          orderBy: { timestamp: "asc" },
          skip: midIndex,
          include: { features: true, contextFeatures: true },
        });

        if (sampleCandle) {
          console.log(
            `  Sample (index ${midIndex}): ${sampleCandle.timestamp.toISOString().split("T")[0]} O=${sampleCandle.open} H=${sampleCandle.high} L=${sampleCandle.low} C=${sampleCandle.close} V=${sampleCandle.volume}`,
          );

          if (sampleCandle.features) {
            const f = sampleCandle.features;
            console.log(
              `    SMA20=${f.sma20} SMA50=${f.sma50} EMA200=${f.ema200} RSI=${f.rsi} ATR=${f.atr} ADX=${f.adx}`,
            );
          }

          if (sampleCandle.contextFeatures) {
            const c = sampleCandle.contextFeatures;
            console.log(
              `    Trend=${c.trendState} Session=${c.tradingSession} Support=${c.nearestSupport} Resistance=${c.nearestResistance}`,
            );
          }
        }
      }
    }
  }

  const labelCount = await prisma.labeledPattern.count();
  console.log(`\n--- Labels: ${labelCount} ---`);

  console.log("\n=== Verification Complete ===");
}

verifyPipeline()
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
