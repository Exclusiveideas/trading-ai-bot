import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateOutcome } from "@/lib/pipeline/outcome-calculator";

export async function POST() {
  const labels = await prisma.labeledPattern.findMany({
    where: { maxFavorableExcursion: null },
    orderBy: { startTimestamp: "asc" },
  });

  if (labels.length === 0) {
    return NextResponse.json({
      updated: 0,
      message: "All labels already have MFE",
    });
  }

  const pairs = [...new Set(labels.map((l) => l.pair))];

  const candlesByPair: Record<
    string,
    { high: number; low: number; close: number; timestamp: Date }[]
  > = {};
  for (const pair of pairs) {
    const candles = await prisma.rawCandle.findMany({
      where: { pair },
      orderBy: { timestamp: "asc" },
      select: { high: true, low: true, close: true, timestamp: true },
    });
    candlesByPair[pair] = candles;
  }

  let updated = 0;
  const errors: string[] = [];

  for (const label of labels) {
    const candles = candlesByPair[label.pair];
    if (!candles) {
      errors.push(`No candles for pair ${label.pair} (label ${label.id})`);
      continue;
    }

    const entryIndex = candles.findIndex(
      (c) => c.timestamp.getTime() === label.endTimestamp.getTime(),
    );

    if (entryIndex === -1) {
      errors.push(
        `No matching candle for label ${label.id} at ${label.endTimestamp.toISOString()}`,
      );
      continue;
    }

    const result = calculateOutcome(candles, {
      entryPrice: label.entryPrice,
      stopLoss: label.stopLoss,
      takeProfit: label.takeProfit,
      entryIndex,
    });

    if (result.maxFavorableExcursion != null) {
      await prisma.labeledPattern.update({
        where: { id: label.id },
        data: { maxFavorableExcursion: result.maxFavorableExcursion },
      });
      updated++;
    }
  }

  return NextResponse.json({ updated, total: labels.length, errors });
}
