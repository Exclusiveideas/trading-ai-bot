import type { PrismaClient } from "../generated/prisma/client";
import { getOpenPositions } from "./metaapi-client";
import { getOpenOrders, updateOrderStatus } from "./order-manager";
import { sendTelegramMessage } from "../scanner/telegram";

export type ReconciliationResult = {
  matched: number;
  orphanedBroker: string[];
  orphanedDb: number[];
};

export async function reconcilePositions(
  db: PrismaClient,
): Promise<ReconciliationResult> {
  const brokerPositions = await getOpenPositions();
  const dbOrders = await getOpenOrders(db);

  const result: ReconciliationResult = {
    matched: 0,
    orphanedBroker: [],
    orphanedDb: [],
  };

  const matchedBrokerIds = new Set<string>();

  for (const order of dbOrders) {
    if (!order.brokerOrderId) {
      result.orphanedDb.push(order.id);
      continue;
    }

    const brokerPos = brokerPositions.find((p) => p.id === order.brokerOrderId);
    if (!brokerPos) {
      result.orphanedDb.push(order.id);
      await updateOrderStatus(db, order.id, "closed", {
        closedAt: new Date(),
        closedReason: "reconciliation",
      });
    } else {
      matchedBrokerIds.add(order.brokerOrderId);
      result.matched++;
    }
  }

  for (const pos of brokerPositions) {
    if (!matchedBrokerIds.has(pos.id)) {
      result.orphanedBroker.push(`${pos.symbol} ${pos.id} vol=${pos.volume}`);
    }
  }

  if (result.orphanedBroker.length > 0 || result.orphanedDb.length > 0) {
    await sendTelegramMessage(
      `⚠️ *Position Reconciliation*\nMatched: ${result.matched}\nOrphaned (broker): ${result.orphanedBroker.length}\nOrphaned (DB): ${result.orphanedDb.length}`,
    );
  }

  return result;
}
