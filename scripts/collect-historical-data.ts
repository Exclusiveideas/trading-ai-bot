import "dotenv/config";
import { prisma } from "../lib/prisma";
import { fetchCandles, computeChunks } from "../lib/oanda";
import { validateCandle } from "../lib/pipeline/collector";
import { FOREX_PAIRS, TIMEFRAMES } from "../types/trading";
import type { OandaGranularity } from "../types/trading";

const BATCH_SIZE = 500;
const YEARS_BACK = 15;

const PRIORITY_PAIRS_TOP8 = FOREX_PAIRS.slice(0, 8);
const PRIORITY_PAIRS_REST = FOREX_PAIRS.slice(8);

type CollectionJob = { pair: string; timeframe: OandaGranularity };

function buildJobQueue(): CollectionJob[] {
  const jobs: CollectionJob[] = [];

  for (const pair of FOREX_PAIRS) {
    jobs.push({ pair, timeframe: "D" });
  }
  for (const tf of ["H4", "H1", "M15"] as OandaGranularity[]) {
    for (const pair of PRIORITY_PAIRS_TOP8) {
      jobs.push({ pair, timeframe: tf });
    }
  }
  for (const tf of ["H4", "H1", "M15"] as OandaGranularity[]) {
    for (const pair of PRIORITY_PAIRS_REST) {
      jobs.push({ pair, timeframe: tf });
    }
  }

  return jobs;
}

async function getLatestTimestamp(
  pair: string,
  timeframe: string,
): Promise<Date | null> {
  const latest = await prisma.rawCandle.findFirst({
    where: { pair, timeframe },
    orderBy: { timestamp: "desc" },
    select: { timestamp: true },
  });
  return latest?.timestamp ?? null;
}

async function collectForJob(job: CollectionJob): Promise<number> {
  const { pair, timeframe } = job;

  const endDate = new Date();
  let startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - YEARS_BACK);

  const latestInDb = await getLatestTimestamp(pair, timeframe);
  if (latestInDb) {
    startDate = new Date(latestInDb.getTime() + 1);
    if (startDate >= endDate) {
      console.log(`  Already up to date`);
      return 0;
    }
    console.log(`  Resuming from ${latestInDb.toISOString().split("T")[0]}`);
  }

  const chunks = computeChunks(startDate, endDate, timeframe);
  let totalInserted = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const startStr = chunk.start.toISOString().split("T")[0];
    const endStr = chunk.end.toISOString().split("T")[0];
    process.stdout.write(
      `  Chunk ${i + 1}/${chunks.length} (${startStr} → ${endStr})...`,
    );

    let candles;
    try {
      candles = await fetchCandles(pair, timeframe, chunk.start, chunk.end);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.log(` ERROR: ${msg}`);
      continue;
    }

    const valid = candles.filter(validateCandle);

    let chunkInserted = 0;
    for (let b = 0; b < valid.length; b += BATCH_SIZE) {
      const batch = valid.slice(b, b + BATCH_SIZE);
      const result = await prisma.rawCandle.createMany({
        data: batch.map((c) => ({
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
      chunkInserted += result.count;
    }

    totalInserted += chunkInserted;
    console.log(` ${valid.length} fetched, ${chunkInserted} inserted`);
  }

  return totalInserted;
}

async function main() {
  console.log("=== OANDA v20 Historical Data Collection ===\n");
  console.log(`Pairs: ${FOREX_PAIRS.length}`);
  console.log(`Timeframes: ${TIMEFRAMES.join(", ")}`);
  console.log(`Looking back ${YEARS_BACK} years\n`);

  const jobs = buildJobQueue();
  let completedJobs = 0;
  let grandTotal = 0;
  const startTime = Date.now();

  for (const job of jobs) {
    completedJobs++;
    const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    console.log(
      `\n[${completedJobs}/${jobs.length}] ${job.pair} ${job.timeframe} (${elapsed}m elapsed)`,
    );

    try {
      const inserted = await collectForJob(job);
      grandTotal += inserted;
      console.log(
        `  Total this job: ${inserted} (running total: ${grandTotal})`,
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`  JOB FAILED: ${msg}`);
    }
  }

  const counts = await prisma.rawCandle.groupBy({
    by: ["timeframe"],
    _count: { id: true },
    orderBy: { timeframe: "asc" },
  });

  const totalElapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`\n=== Final Summary (${totalElapsed}m) ===`);
  console.log(`Total new candles this run: ${grandTotal}`);
  for (const row of counts) {
    console.log(`  ${row.timeframe}: ${row._count.id} candles`);
  }
}

main()
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
