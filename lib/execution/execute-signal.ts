import type { PrismaClient } from "../generated/prisma/client";
import type { ExecutionMode, RiskConfig } from "./types";
import { isTradingEnabled } from "./kill-switch";
import {
  calculatePositionSize,
  getPipInfo,
  runAllRiskChecks,
} from "./risk-manager";
import {
  getAccountInfo,
  getOpenPositions,
  placeMarketOrder,
} from "./metaapi-client";
import { createOrder } from "./order-manager";
import { sendTelegramMessage } from "../scanner/telegram";

const DEFAULT_RISK_CONFIG: RiskConfig = {
  riskPerTradePct: 0.01,
  maxDailyLossPct: 0.03,
  maxOpenPositions: 5,
  maxDrawdownPct: 0.1,
  maxConsecutiveLosses: 5,
  maxSpreadMultiplier: 3.0,
  maxCorrelatedPairs: 2,
};

export function getExecutionMode(): ExecutionMode {
  const mode = process.env.EXECUTION_MODE ?? "disabled";
  if (mode !== "live" && mode !== "paper" && mode !== "disabled") {
    throw new Error(
      `Invalid EXECUTION_MODE: ${mode}. Must be live, paper, or disabled`,
    );
  }
  return mode;
}

export function getRiskConfig(): RiskConfig {
  return {
    riskPerTradePct: parseFloat(
      process.env.RISK_PER_TRADE_PCT ??
        String(DEFAULT_RISK_CONFIG.riskPerTradePct),
    ),
    maxDailyLossPct: parseFloat(
      process.env.MAX_DAILY_LOSS_PCT ??
        String(DEFAULT_RISK_CONFIG.maxDailyLossPct),
    ),
    maxOpenPositions: parseInt(
      process.env.MAX_OPEN_POSITIONS ??
        String(DEFAULT_RISK_CONFIG.maxOpenPositions),
    ),
    maxDrawdownPct: parseFloat(
      process.env.MAX_DRAWDOWN_PCT ??
        String(DEFAULT_RISK_CONFIG.maxDrawdownPct),
    ),
    maxConsecutiveLosses: parseInt(
      process.env.MAX_CONSECUTIVE_LOSSES ??
        String(DEFAULT_RISK_CONFIG.maxConsecutiveLosses),
    ),
    maxSpreadMultiplier: parseFloat(
      process.env.MAX_SPREAD_MULTIPLIER ??
        String(DEFAULT_RISK_CONFIG.maxSpreadMultiplier),
    ),
    maxCorrelatedPairs: parseInt(
      process.env.MAX_CORRELATED_PAIRS ??
        String(DEFAULT_RISK_CONFIG.maxCorrelatedPairs),
    ),
  };
}

type SignalForExecution = {
  id: number;
  pair: string;
  direction: string;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  timeframe: string;
  patternType: string;
  v1WinProb: number | null;
};

export async function executeSignal(
  db: PrismaClient,
  signal: SignalForExecution,
): Promise<{ executed: boolean; reason: string }> {
  const mode = getExecutionMode();
  if (mode === "disabled") {
    return { executed: false, reason: "execution_disabled" };
  }

  const tradingEnabled = await isTradingEnabled(db);
  if (!tradingEnabled) {
    return {
      executed: false,
      reason: "trading_not_enabled_or_kill_switch_active",
    };
  }

  const riskConfig = getRiskConfig();

  const [accountInfo, openPositions, tradingState, dailyPnlRow] =
    await Promise.all([
      getAccountInfo(),
      getOpenPositions(),
      db.tradingState.findUnique({ where: { id: 1 } }),
      getDailyPnl(db),
    ]);

  const accountState = {
    equity: accountInfo.equity,
    balance: accountInfo.balance,
    openPositions,
    dailyPnl: dailyPnlRow?.realizedPnl ?? 0,
    highWaterMark: tradingState?.highWaterMark ?? accountInfo.equity,
    consecutiveLosses: tradingState?.consecutiveLosses ?? 0,
  };

  const riskResult = runAllRiskChecks(signal.pair, accountState, riskConfig);
  if (!riskResult.approved) {
    for (const rejection of riskResult.rejections) {
      await db.riskEvent.create({
        data: {
          eventType: rejection.check,
          details: { signalId: signal.id, ...rejection },
          action: "trade_rejected",
        },
      });
    }
    const reasons = riskResult.rejections.map((r) => r.check).join(", ");
    console.log(`  Execution blocked for signal #${signal.id}: ${reasons}`);
    return { executed: false, reason: `risk_rejected: ${reasons}` };
  }

  const pipInfo = getPipInfo(signal.pair);
  const volume = calculatePositionSize(
    accountState.equity,
    riskConfig.riskPerTradePct,
    signal.entryPrice,
    signal.stopLoss,
    pipInfo,
  );

  const direction =
    signal.direction === "bullish" ? ("buy" as const) : ("sell" as const);

  if (mode === "paper") {
    await createOrder(db, {
      signalId: signal.id,
      pair: signal.pair,
      direction: signal.direction,
      volume,
      entryPrice: signal.entryPrice,
      slPrice: signal.stopLoss,
      tpPrice: signal.takeProfit,
      brokerOrderId: `paper-${Date.now()}`,
      status: "filled",
      filledPrice: signal.entryPrice,
      filledAt: new Date(),
    });
    console.log(`  PAPER: ${signal.pair} ${signal.direction} ${volume} lots`);
    return { executed: true, reason: "paper_trade" };
  }

  const result = await placeMarketOrder(
    signal.pair,
    direction,
    volume,
    signal.stopLoss,
    signal.takeProfit,
  );

  if (!result.success) {
    console.error(
      `  Execution failed for signal #${signal.id}: ${result.error}`,
    );
    await db.riskEvent.create({
      data: {
        eventType: "kill_switch_activated",
        details: { signalId: signal.id, error: result.error },
        action: "order_failed",
      },
    });
    return { executed: false, reason: `broker_error: ${result.error}` };
  }

  await createOrder(db, {
    signalId: signal.id,
    pair: signal.pair,
    direction: signal.direction,
    volume,
    entryPrice: signal.entryPrice,
    slPrice: signal.stopLoss,
    tpPrice: signal.takeProfit,
    brokerOrderId: result.orderId,
    status: "filled",
    filledPrice: signal.entryPrice,
    filledAt: new Date(),
  });

  await sendTelegramMessage(
    `💰 *ORDER PLACED*\n${signal.pair} ${signal.direction.toUpperCase()} ${volume} lots\nEntry: ${signal.entryPrice} | SL: ${signal.stopLoss} | TP: ${signal.takeProfit}\nSignal #${signal.id} | ${signal.patternType} ${signal.timeframe}`,
  );

  console.log(
    `  LIVE: ${signal.pair} ${signal.direction} ${volume} lots (order ${result.orderId})`,
  );
  return { executed: true, reason: "live_trade" };
}

async function getDailyPnl(db: PrismaClient) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return db.dailyPnl.findUnique({ where: { date: today } });
}
