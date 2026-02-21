import type { PrismaClient } from "../generated/prisma/client";
import type { ClosedReason, OrderId, OrderStatus } from "./types";

export type CreateOrderInput = {
  signalId: number;
  pair: string;
  direction: string;
  volume: number;
  entryPrice: number;
  slPrice: number;
  tpPrice: number;
  brokerOrderId: string | null;
  status: OrderStatus;
  filledPrice: number | null;
  filledAt: Date | null;
};

export async function createOrder(
  db: PrismaClient,
  input: CreateOrderInput,
): Promise<{ id: OrderId }> {
  const order = await db.order.create({
    data: {
      signalId: input.signalId,
      pair: input.pair,
      direction: input.direction,
      volume: input.volume,
      entryPrice: input.entryPrice,
      slPrice: input.slPrice,
      tpPrice: input.tpPrice,
      brokerOrderId: input.brokerOrderId,
      status: input.status,
      filledPrice: input.filledPrice,
      filledAt: input.filledAt,
    },
  });
  return { id: order.id as OrderId };
}

export async function updateOrderStatus(
  db: PrismaClient,
  orderId: number,
  status: OrderStatus,
  updates?: {
    filledPrice?: number;
    filledAt?: Date;
    closedPrice?: number;
    closedAt?: Date;
    closedReason?: ClosedReason;
    pnl?: number;
    commission?: number;
    swap?: number;
  },
): Promise<void> {
  await db.order.update({
    where: { id: orderId },
    data: { status, ...updates },
  });
}

export async function getOpenOrders(db: PrismaClient): Promise<
  Array<{
    id: number;
    signalId: number;
    brokerOrderId: string | null;
    pair: string;
    direction: string;
    volume: number;
    status: string;
  }>
> {
  return db.order.findMany({
    where: { status: { in: ["pending", "filled", "partially_filled"] } },
    select: {
      id: true,
      signalId: true,
      brokerOrderId: true,
      pair: true,
      direction: true,
      volume: true,
      status: true,
    },
  });
}

export async function getOrderHistory(
  db: PrismaClient,
  limit: number = 50,
): Promise<
  Array<{
    id: number;
    signalId: number;
    brokerOrderId: string | null;
    pair: string;
    direction: string;
    volume: number;
    status: string;
    entryPrice: number;
    slPrice: number;
    tpPrice: number;
    filledPrice: number | null;
    closedPrice: number | null;
    closedReason: string | null;
    pnl: number | null;
    createdAt: Date;
  }>
> {
  return db.order.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getOrderBySignalId(
  db: PrismaClient,
  signalId: number,
): Promise<{ id: number; status: string } | null> {
  return db.order.findFirst({
    where: { signalId },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true },
  });
}

export async function updateDailyPnl(
  db: PrismaClient,
  pnl: number,
  isNewTrade: boolean,
  isClosed: boolean,
): Promise<void> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  await db.dailyPnl.upsert({
    where: { date: today },
    update: {
      realizedPnl: isClosed ? { increment: pnl } : undefined,
      tradesOpened: isNewTrade ? { increment: 1 } : undefined,
      tradesClosed: isClosed ? { increment: 1 } : undefined,
    },
    create: {
      date: today,
      realizedPnl: isClosed ? pnl : 0,
      unrealizedPnl: 0,
      tradesOpened: isNewTrade ? 1 : 0,
      tradesClosed: isClosed ? 1 : 0,
      highWaterMark: 0,
    },
  });
}

export async function updateTradingStateAfterClose(
  db: PrismaClient,
  isWin: boolean,
  equity: number,
): Promise<void> {
  const state = await db.tradingState.findUnique({ where: { id: 1 } });
  if (!state) return;

  const newConsecutiveLosses = isWin ? 0 : state.consecutiveLosses + 1;
  const newHwm = Math.max(state.highWaterMark, equity);

  await db.tradingState.update({
    where: { id: 1 },
    data: {
      consecutiveLosses: newConsecutiveLosses,
      highWaterMark: newHwm,
    },
  });
}
