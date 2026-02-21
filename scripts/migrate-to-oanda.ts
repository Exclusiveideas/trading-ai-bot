import "dotenv/config";
import { prisma } from "../lib/prisma";

async function migrate() {
  console.log("=== Migrating to OANDA v20 ===\n");

  const labelCount = await prisma.labeledPattern.count();
  console.log(`Preserving ${labelCount} labeled patterns\n`);

  const candleCount = await prisma.rawCandle.count();
  const featureCount = await prisma.calculatedFeature.count();
  const contextCount = await prisma.contextFeature.count();

  console.log(`Current data to wipe:`);
  console.log(`  Raw candles: ${candleCount}`);
  console.log(`  Calculated features: ${featureCount}`);
  console.log(`  Context features: ${contextCount}\n`);

  console.log("Deleting context features...");
  const ctxResult = await prisma.contextFeature.deleteMany({});
  console.log(`  Deleted ${ctxResult.count}`);

  console.log("Deleting calculated features...");
  const featResult = await prisma.calculatedFeature.deleteMany({});
  console.log(`  Deleted ${featResult.count}`);

  console.log("Deleting raw candles...");
  const candleResult = await prisma.rawCandle.deleteMany({});
  console.log(`  Deleted ${candleResult.count}`);

  const remainingLabels = await prisma.labeledPattern.count();
  console.log(`\nLabeled patterns preserved: ${remainingLabels}`);
  console.log("\nDone. Ready for OANDA v20 data collection.");
}

migrate()
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
