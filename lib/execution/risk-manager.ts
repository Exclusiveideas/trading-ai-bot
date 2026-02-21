import type {
  AccountState,
  BrokerPosition,
  PipInfo,
  RiskCheckResult,
  RiskConfig,
  RiskRejection,
} from "./types";

export function getPipInfo(pair: string): PipInfo {
  const isJpy = pair.includes("JPY");
  return {
    pipSize: isJpy ? 0.01 : 0.0001,
    pipValue: isJpy ? 6.7 : 10.0,
  };
}

export function calculatePositionSize(
  equity: number,
  riskPct: number,
  entryPrice: number,
  slPrice: number,
  pipInfo: PipInfo,
): number {
  const riskAmount = equity * riskPct;
  const slDistancePips = Math.abs(entryPrice - slPrice) / pipInfo.pipSize;
  if (slDistancePips <= 0) return 0.01;
  const lots = riskAmount / (slDistancePips * pipInfo.pipValue);
  return Math.max(0.01, Math.floor(lots * 100) / 100);
}

export function checkDailyLossLimit(
  dailyPnl: number,
  equity: number,
  maxLossPct: number,
): RiskRejection | null {
  const maxLoss = equity * maxLossPct;
  if (dailyPnl <= -maxLoss) {
    return {
      check: "daily_loss_limit",
      reason: `Daily loss ${dailyPnl.toFixed(2)} exceeds limit ${(-maxLoss).toFixed(2)}`,
      value: Math.abs(dailyPnl),
      limit: maxLoss,
    };
  }
  return null;
}

export function checkMaxPositions(
  openPositionCount: number,
  maxPositions: number,
): RiskRejection | null {
  if (openPositionCount >= maxPositions) {
    return {
      check: "max_positions",
      reason: `${openPositionCount} positions open, max is ${maxPositions}`,
      value: openPositionCount,
      limit: maxPositions,
    };
  }
  return null;
}

export function checkDrawdown(
  currentEquity: number,
  highWaterMark: number,
  maxDrawdownPct: number,
): RiskRejection | null {
  if (highWaterMark <= 0) return null;
  const drawdownPct = (highWaterMark - currentEquity) / highWaterMark;
  if (drawdownPct >= maxDrawdownPct) {
    return {
      check: "max_drawdown",
      reason: `Drawdown ${(drawdownPct * 100).toFixed(1)}% exceeds limit ${(maxDrawdownPct * 100).toFixed(1)}%`,
      value: drawdownPct,
      limit: maxDrawdownPct,
    };
  }
  return null;
}

const CORRELATION_GROUPS: string[][] = [
  ["EUR/USD", "GBP/USD", "AUD/USD", "NZD/USD"],
  ["USD/JPY", "USD/CAD", "USD/CHF"],
  ["EUR/JPY", "GBP/JPY", "AUD/JPY", "NZD/JPY", "CAD/JPY", "CHF/JPY"],
  ["EUR/GBP", "EUR/AUD", "EUR/NZD", "EUR/CHF"],
  ["GBP/AUD", "GBP/CHF"],
  ["AUD/NZD"],
];

export function findCorrelationGroup(pair: string): string[] {
  for (const group of CORRELATION_GROUPS) {
    if (group.includes(pair)) return group;
  }
  return [pair];
}

export function checkCorrelation(
  newPair: string,
  openPositions: BrokerPosition[],
  maxCorrelated: number,
): RiskRejection | null {
  const group = findCorrelationGroup(newPair);
  const correlatedCount = openPositions.filter((p) =>
    group.includes(
      p.symbol.replace(/_/g, "/").replace(/^([A-Z]{3})([A-Z]{3})$/, "$1/$2"),
    ),
  ).length;

  if (correlatedCount >= maxCorrelated) {
    return {
      check: "correlation_block",
      reason: `${correlatedCount} correlated positions open for ${newPair} group, max ${maxCorrelated}`,
      value: correlatedCount,
      limit: maxCorrelated,
    };
  }
  return null;
}

export function checkConsecutiveLosses(
  consecutiveLosses: number,
  maxConsecutive: number,
): RiskRejection | null {
  if (consecutiveLosses >= maxConsecutive) {
    return {
      check: "consecutive_losses",
      reason: `${consecutiveLosses} consecutive losses, max is ${maxConsecutive}`,
      value: consecutiveLosses,
      limit: maxConsecutive,
    };
  }
  return null;
}

export function checkSpread(
  currentSpread: number,
  normalSpread: number,
  maxMultiplier: number,
): RiskRejection | null {
  if (normalSpread <= 0) return null;
  const ratio = currentSpread / normalSpread;
  if (ratio > maxMultiplier) {
    return {
      check: "spread_too_wide",
      reason: `Spread ${currentSpread.toFixed(1)} is ${ratio.toFixed(1)}x normal (${normalSpread.toFixed(1)}), max ${maxMultiplier}x`,
      value: ratio,
      limit: maxMultiplier,
    };
  }
  return null;
}

export function runAllRiskChecks(
  pair: string,
  accountState: AccountState,
  config: RiskConfig,
): RiskCheckResult {
  const rejections: RiskRejection[] = [];

  const checks = [
    checkDailyLossLimit(
      accountState.dailyPnl,
      accountState.equity,
      config.maxDailyLossPct,
    ),
    checkMaxPositions(
      accountState.openPositions.length,
      config.maxOpenPositions,
    ),
    checkDrawdown(
      accountState.equity,
      accountState.highWaterMark,
      config.maxDrawdownPct,
    ),
    checkCorrelation(
      pair,
      accountState.openPositions,
      config.maxCorrelatedPairs,
    ),
    checkConsecutiveLosses(
      accountState.consecutiveLosses,
      config.maxConsecutiveLosses,
    ),
  ];

  for (const result of checks) {
    if (result !== null) rejections.push(result);
  }

  return { approved: rejections.length === 0, rejections };
}
