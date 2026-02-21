import type { Brand } from "@/types/trading";

export type OrderId = Brand<number, "OrderId">;
export type RiskEventId = Brand<number, "RiskEventId">;
export type DailyPnlId = Brand<number, "DailyPnlId">;

export type OrderStatus =
  | "pending"
  | "filled"
  | "partially_filled"
  | "cancelled"
  | "closed"
  | "rejected";

export type ClosedReason =
  | "stop_loss"
  | "take_profit"
  | "manual"
  | "kill_switch"
  | "reconciliation"
  | "expired";

export type RiskEventType =
  | "daily_loss_limit"
  | "max_positions"
  | "max_drawdown"
  | "correlation_block"
  | "consecutive_losses"
  | "spread_too_wide"
  | "kill_switch_activated"
  | "kill_switch_deactivated";

export type ExecutionMode = "live" | "paper" | "disabled";

export type RiskConfig = {
  riskPerTradePct: number;
  maxDailyLossPct: number;
  maxOpenPositions: number;
  maxDrawdownPct: number;
  maxConsecutiveLosses: number;
  maxSpreadMultiplier: number;
  maxCorrelatedPairs: number;
};

export type AccountState = {
  equity: number;
  balance: number;
  openPositions: BrokerPosition[];
  dailyPnl: number;
  highWaterMark: number;
  consecutiveLosses: number;
};

export type BrokerPosition = {
  id: string;
  symbol: string;
  type: "buy" | "sell";
  volume: number;
  openPrice: number;
  stopLoss: number | null;
  takeProfit: number | null;
  profit: number;
  swap: number;
  commission: number;
};

export type RiskCheckResult = {
  approved: boolean;
  rejections: RiskRejection[];
};

export type RiskRejection = {
  check: RiskEventType;
  reason: string;
  value: number;
  limit: number;
};

export type ExecutionResult = {
  success: boolean;
  orderId: string | null;
  error: string | null;
};

export type PipInfo = {
  pipSize: number;
  pipValue: number;
};
