import "dotenv/config";
import { prisma } from "../lib/prisma";
import { identifyTradingSession } from "../lib/pipeline/context-features";

const BATCH_SIZE = 1000;

async function backfillTradingSessions() {
  console.log("Backfilling trading_session for all context_features...\n");

  const total = await prisma.contextFeature.count();
  console.log(`Total context_features rows: ${total}`);

  let updated = 0;
  let offset = 0;

  while (offset < total) {
    const rows = await prisma.contextFeature.findMany({
      skip: offset,
      take: BATCH_SIZE,
      orderBy: { id: "asc" },
      include: {
        candle: { select: { timestamp: true, timeframe: true } },
      },
    });

    if (rows.length === 0) break;

    for (const row of rows) {
      const newSession = identifyTradingSession(
        row.candle.timestamp,
        row.candle.timeframe,
      );

      if (row.tradingSession !== newSession) {
        await prisma.contextFeature.update({
          where: { id: row.id },
          data: { tradingSession: newSession },
        });
        updated++;
      }
    }

    offset += rows.length;
    if (offset % 10000 === 0 || offset >= total) {
      console.log(`  Processed ${offset}/${total} (${updated} updated)`);
    }
  }

  console.log(`\nDone. Updated ${updated} rows.`);
}

backfillTradingSessions()
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
