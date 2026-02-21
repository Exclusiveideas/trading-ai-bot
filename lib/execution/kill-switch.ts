import type { PrismaClient } from "../generated/prisma/client";
import type { RiskEventType } from "./types";
import { closeAllPositions } from "./metaapi-client";
import { sendTelegramMessage } from "../scanner/telegram";

export async function isKillSwitchActive(db: PrismaClient): Promise<boolean> {
  const state = await db.tradingState.findUnique({ where: { id: 1 } });
  if (!state) return true;
  return state.killSwitchActive;
}

export async function isTradingEnabled(db: PrismaClient): Promise<boolean> {
  const state = await db.tradingState.findUnique({ where: { id: 1 } });
  if (!state) return false;
  return state.enabled && !state.killSwitchActive;
}

export async function activateKillSwitch(
  db: PrismaClient,
  reason: string,
): Promise<{ closed: number; errors: string[] }> {
  await db.tradingState.upsert({
    where: { id: 1 },
    update: {
      killSwitchActive: true,
      killSwitchReason: reason,
      lastKillSwitchAt: new Date(),
    },
    create: {
      id: 1,
      enabled: false,
      killSwitchActive: true,
      killSwitchReason: reason,
      lastKillSwitchAt: new Date(),
    },
  });

  const closeResult = await closeAllPositions();

  await db.riskEvent.create({
    data: {
      eventType: "kill_switch_activated" satisfies RiskEventType,
      details: {
        reason,
        positionsClosed: closeResult.closed,
        errors: closeResult.errors,
      },
      action: "close_all_positions",
    },
  });

  await sendTelegramMessage(
    `🚨 *KILL SWITCH ACTIVATED*\nReason: ${reason}\nPositions closed: ${closeResult.closed}${closeResult.errors.length > 0 ? `\nErrors: ${closeResult.errors.join(", ")}` : ""}`,
  );

  return closeResult;
}

export async function deactivateKillSwitch(db: PrismaClient): Promise<void> {
  await db.tradingState.update({
    where: { id: 1 },
    data: {
      killSwitchActive: false,
      killSwitchReason: null,
    },
  });

  await db.riskEvent.create({
    data: {
      eventType: "kill_switch_deactivated" satisfies RiskEventType,
      details: {},
      action: "resume_trading",
    },
  });

  await sendTelegramMessage("✅ *Kill switch deactivated* — trading resumed");
}

export async function ensureTradingStateExists(
  db: PrismaClient,
): Promise<void> {
  await db.tradingState.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      enabled: false,
      killSwitchActive: false,
      consecutiveLosses: 0,
      highWaterMark: 0,
    },
  });
}
