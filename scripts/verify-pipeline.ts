import "dotenv/config";
import { prisma } from "../lib/prisma";

async function verifyPipeline() {
  console.log("=== Phase 2 Pipeline Verification ===\n");

  const pairs = ["EUR/USD", "GBP/USD"];

  for (const pair of pairs) {
    console.log(`--- ${pair} ---`);

    const candleCount = await prisma.rawCandle.count({ where: { pair } });
    const featureCount = await prisma.calculatedFeature.count({
      where: { candle: { pair } },
    });
    const contextCount = await prisma.contextFeature.count({
      where: { candle: { pair } },
    });

    console.log(`  Raw candles:        ${candleCount}`);
    console.log(`  Calculated features: ${featureCount}`);
    console.log(`  Context features:    ${contextCount}`);

    const match = candleCount === featureCount && featureCount === contextCount;
    console.log(`  All counts match:    ${match ? "YES" : "NO !!!"}`);

    const dateRange = await prisma.rawCandle.aggregate({
      where: { pair },
      _min: { timestamp: true },
      _max: { timestamp: true },
    });
    console.log(
      `  Date range:          ${dateRange._min.timestamp?.toISOString().split("T")[0]} to ${dateRange._max.timestamp?.toISOString().split("T")[0]}`
    );

    const midIndex = Math.floor(candleCount / 2);
    const sampleCandle = await prisma.rawCandle.findFirst({
      where: { pair },
      orderBy: { timestamp: "asc" },
      skip: midIndex,
      include: { features: true, contextFeatures: true },
    });

    if (sampleCandle) {
      console.log(`\n  Sample candle (mid-range, index ${midIndex}):`);
      console.log(`    Date:       ${sampleCandle.timestamp.toISOString().split("T")[0]}`);
      console.log(`    OHLCV:      O=${sampleCandle.open} H=${sampleCandle.high} L=${sampleCandle.low} C=${sampleCandle.close} V=${sampleCandle.volume}`);

      if (sampleCandle.features) {
        const f = sampleCandle.features;
        console.log(`    SMA 20:     ${f.sma20}`);
        console.log(`    SMA 50:     ${f.sma50}`);
        console.log(`    EMA 200:    ${f.ema200}`);
        console.log(`    RSI:        ${f.rsi}`);
        console.log(`    MACD:       ${f.macd} / Signal: ${f.macdSignal} / Hist: ${f.macdHistogram}`);
        console.log(`    ADX:        ${f.adx}`);
        console.log(`    ATR:        ${f.atr}`);
        console.log(`    BB:         Upper=${f.bbUpper} Mid=${f.bbMiddle} Lower=${f.bbLower}`);
        console.log(`    Vol SMA:    ${f.volumeSma}`);
      }

      if (sampleCandle.contextFeatures) {
        const c = sampleCandle.contextFeatures;
        console.log(`    Support:    ${c.nearestSupport} (${c.distToSupportPips?.toFixed(1)} pips, ${c.distToSupportAtr?.toFixed(2)} ATR)`);
        console.log(`    Resistance: ${c.nearestResistance} (${c.distToResistancePips?.toFixed(1)} pips, ${c.distToResistanceAtr?.toFixed(2)} ATR)`);
        console.log(`    Trend:      ${c.trendState}`);
        console.log(`    Session:    ${c.tradingSession}`);
        console.log(`    Round #:    ${c.nearestRoundNumber} (${c.distToRoundNumberPips?.toFixed(1)} pips)`);
      }
    }

    const earlyCandle = await prisma.rawCandle.findFirst({
      where: { pair },
      orderBy: { timestamp: "asc" },
      include: { features: true },
    });

    const lateCandle = await prisma.rawCandle.findFirst({
      where: { pair },
      orderBy: { timestamp: "desc" },
      include: { features: true },
    });

    console.log(`\n  EMA200 check:`);
    console.log(`    First candle EMA200: ${earlyCandle?.features?.ema200 ?? "null"} (expected: null)`);
    console.log(`    Last candle EMA200:  ${lateCandle?.features?.ema200 ?? "null"} (expected: number)`);
    console.log("");
  }

  console.log("=== Verification Complete ===");
}

verifyPipeline()
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
