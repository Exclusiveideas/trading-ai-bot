import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const pair = searchParams.get("pair");
  const patternType = searchParams.get("patternType");

  const where: Record<string, string> = {};
  if (pair) where.pair = pair;
  if (patternType) where.patternType = patternType;

  const labels = await prisma.labeledPattern.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ labels });
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  const {
    pair,
    patternType,
    startTimestamp,
    endTimestamp,
    entryPrice,
    stopLoss,
    takeProfit,
    outcome,
    rMultiple,
    barsToOutcome,
    maxFavorableExcursion,
    qualityRating,
    trendState,
    session,
    supportQuality,
    notes,
    contextJson,
    timeframe,
  } = body;

  if (
    !pair ||
    !patternType ||
    !startTimestamp ||
    !endTimestamp ||
    !entryPrice ||
    !stopLoss ||
    !takeProfit ||
    !qualityRating
  ) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 },
    );
  }

  const existing = await prisma.labeledPattern.findFirst({
    where: {
      pair,
      patternType,
      startTimestamp: new Date(startTimestamp),
    },
  });

  if (existing) {
    return NextResponse.json(
      { label: existing, duplicate: true },
      { status: 200 },
    );
  }

  const label = await prisma.labeledPattern.create({
    data: {
      pair,
      patternType,
      startTimestamp: new Date(startTimestamp),
      endTimestamp: new Date(endTimestamp),
      entryPrice,
      stopLoss,
      takeProfit,
      outcome: outcome ?? "pending",
      rMultiple: rMultiple ?? null,
      barsToOutcome: barsToOutcome ?? null,
      maxFavorableExcursion: maxFavorableExcursion ?? null,
      qualityRating,
      trendState: trendState ?? null,
      session: session ?? null,
      supportQuality: supportQuality ?? null,
      notes: notes ?? null,
      contextJson: contextJson ?? null,
      timeframe: timeframe ?? "D",
    },
  });

  return NextResponse.json({ label }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const pair = searchParams.get("pair");
  const confirmAll = searchParams.get("confirmAll");

  if (!pair && confirmAll !== "true") {
    return NextResponse.json(
      { error: "Must specify ?pair= or ?confirmAll=true to delete all" },
      { status: 400 },
    );
  }

  const where: Record<string, string> = {};
  if (pair) where.pair = pair;

  const result = await prisma.labeledPattern.deleteMany({ where });

  return NextResponse.json({ deleted: result.count });
}
