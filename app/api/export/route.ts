import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const pair = searchParams.get("pair");

  const where: Record<string, string> = {};
  if (pair) where.pair = pair;

  const labels = await prisma.labeledPattern.findMany({
    where,
    orderBy: { startTimestamp: "asc" },
  });

  if (labels.length === 0) {
    return NextResponse.json({ error: "No labels to export" }, { status: 404 });
  }

  const headers = [
    "id",
    "pair",
    "pattern_type",
    "start_timestamp",
    "end_timestamp",
    "entry_price",
    "stop_loss",
    "take_profit",
    "outcome",
    "r_multiple",
    "bars_to_outcome",
    "quality_rating",
    "trend_state",
    "session",
    "support_quality",
    "notes",
    "context_json",
  ];

  const rows = labels.map((l) =>
    [
      l.id,
      l.pair,
      l.patternType,
      l.startTimestamp.toISOString(),
      l.endTimestamp.toISOString(),
      l.entryPrice,
      l.stopLoss,
      l.takeProfit,
      l.outcome,
      l.rMultiple ?? "",
      l.barsToOutcome ?? "",
      l.qualityRating,
      l.trendState ?? "",
      l.session ?? "",
      l.supportQuality ?? "",
      l.notes ? `"${l.notes.replace(/"/g, '""')}"` : "",
      l.contextJson
        ? `"${JSON.stringify(l.contextJson).replace(/"/g, '""')}"`
        : "",
    ].join(","),
  );

  const csv = [headers.join(","), ...rows].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="labeled-patterns-${new Date().toISOString().split("T")[0]}.csv"`,
    },
  });
}
