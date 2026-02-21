import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const [tradingState, todayPnl, openOrders, recentRiskEvents] =
    await Promise.all([
      prisma.tradingState.findUnique({ where: { id: 1 } }),
      prisma.dailyPnl.findFirst({ orderBy: { date: "desc" } }),
      prisma.order.count({
        where: { status: { in: ["pending", "filled", "partially_filled"] } },
      }),
      prisma.riskEvent.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);

  return NextResponse.json({
    tradingState: tradingState ?? {
      enabled: false,
      killSwitchActive: false,
      consecutiveLosses: 0,
      highWaterMark: 0,
    },
    dailyPnl: todayPnl ?? {
      realizedPnl: 0,
      unrealizedPnl: 0,
      tradesOpened: 0,
      tradesClosed: 0,
    },
    openOrders,
    recentRiskEvents,
  });
}
