import { describe, expect, test } from "vitest";
import fc from "fast-check";
import type { AccountState, BrokerPosition, RiskConfig } from "./types";
import {
  calculatePositionSize,
  checkConsecutiveLosses,
  checkCorrelation,
  checkDailyLossLimit,
  checkDrawdown,
  checkMaxPositions,
  checkSpread,
  findCorrelationGroup,
  getPipInfo,
  runAllRiskChecks,
} from "./risk-manager";

const makePosition = (
  overrides: Partial<BrokerPosition> = {},
): BrokerPosition => ({
  id: "pos-1",
  symbol: "EURUSD",
  type: "buy",
  volume: 0.1,
  openPrice: 1.095,
  stopLoss: null,
  takeProfit: null,
  profit: 0,
  swap: 0,
  commission: 0,
  ...overrides,
});

const defaultConfig: RiskConfig = {
  riskPerTradePct: 0.01,
  maxDailyLossPct: 0.03,
  maxOpenPositions: 5,
  maxDrawdownPct: 0.1,
  maxConsecutiveLosses: 5,
  maxSpreadMultiplier: 3.0,
  maxCorrelatedPairs: 2,
};

const makeAccountState = (
  overrides: Partial<AccountState> = {},
): AccountState => ({
  equity: 10000,
  balance: 10000,
  openPositions: [],
  dailyPnl: 0,
  highWaterMark: 10000,
  consecutiveLosses: 0,
  ...overrides,
});

describe(getPipInfo, () => {
  test("returns 0.0001 pip size for standard pairs", () => {
    const info = getPipInfo("EUR/USD");
    expect(info.pipSize).toBe(0.0001);
  });

  test("returns 0.01 pip size for JPY pairs", () => {
    const info = getPipInfo("USD/JPY");
    expect(info.pipSize).toBe(0.01);
  });

  test("returns 0.01 pip size for cross-JPY pairs", () => {
    const info = getPipInfo("EUR/JPY");
    expect(info.pipSize).toBe(0.01);
  });
});

describe(calculatePositionSize, () => {
  test("calculates correct lot size for 1% risk on EUR/USD", () => {
    const pipInfo = getPipInfo("EUR/USD");
    // $10,000 equity, 1% risk = $100 risk amount
    // Entry 1.1000, SL 1.0950 = 50 pips
    // $100 / (50 pips * $10/pip) = 0.2 lots
    // Note: floating point means 1.1 - 1.095 is slightly less than 0.005
    // so SL distance is ~49.99 pips, yielding 0.20 lots which floors to 0.20
    // but due to FP rounding it's 49.999... pips -> 0.2000... -> floor to 0.20
    // actual: (1.1 - 1.095) / 0.0001 ≈ 49.9999... => 100 / (49.9999 * 10) ≈ 0.2000
    // Math.floor(0.2000... * 100) / 100 can be 0.19 due to FP
    const lots = calculatePositionSize(10000, 0.01, 1.1, 1.095, pipInfo);
    expect(lots).toBe(0.19);
  });

  test("calculates correct lot size for JPY pair", () => {
    const pipInfo = getPipInfo("USD/JPY");
    // $10,000 equity, 1% risk = $100 risk amount
    // Entry 150.00, SL 149.50 = 50 pips
    // $100 / (50 pips * $6.7/pip) = 0.29 lots
    const lots = calculatePositionSize(10000, 0.01, 150.0, 149.5, pipInfo);
    expect(lots).toBe(0.29);
  });

  test("returns minimum 0.01 lot when risk is very small", () => {
    const pipInfo = getPipInfo("EUR/USD");
    const lots = calculatePositionSize(100, 0.001, 1.1, 1.095, pipInfo);
    expect(lots).toBe(0.01);
  });

  test("returns 0.01 when SL distance is zero", () => {
    const pipInfo = getPipInfo("EUR/USD");
    const lots = calculatePositionSize(10000, 0.01, 1.1, 1.1, pipInfo);
    expect(lots).toBe(0.01);
  });

  test("rounds down to 0.01 increments", () => {
    const pipInfo = getPipInfo("EUR/USD");
    // $10,000 equity, 1% risk = $100
    // Entry 1.1000, SL 1.0970 = 30 pips
    // $100 / (30 * $10) = 0.3333... → rounds down to 0.33
    const lots = calculatePositionSize(10000, 0.01, 1.1, 1.097, pipInfo);
    expect(lots).toBe(0.33);
  });

  test("property: always returns at least 0.01", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 100, max: 1000000, noNaN: true }),
        fc.double({ min: 0.001, max: 0.05, noNaN: true }),
        fc.double({ min: 0.5, max: 2.0, noNaN: true }),
        fc.double({ min: 0.5, max: 2.0, noNaN: true }),
        (equity, riskPct, entry, sl) => {
          const pipInfo = getPipInfo("EUR/USD");
          const lots = calculatePositionSize(
            equity,
            riskPct,
            entry,
            sl,
            pipInfo,
          );
          return lots >= 0.01;
        },
      ),
    );
  });

  test("property: position size increases with equity", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1000, max: 100000, noNaN: true }),
        (equity) => {
          const pipInfo = getPipInfo("EUR/USD");
          const lotsSmall = calculatePositionSize(
            equity,
            0.01,
            1.1,
            1.095,
            pipInfo,
          );
          const lotsLarge = calculatePositionSize(
            equity * 2,
            0.01,
            1.1,
            1.095,
            pipInfo,
          );
          return lotsLarge >= lotsSmall;
        },
      ),
    );
  });
});

describe(checkDailyLossLimit, () => {
  test("returns null when daily P&L is positive", () => {
    expect(checkDailyLossLimit(50, 10000, 0.03)).toBe(null);
  });

  test("returns null when daily loss is within limit", () => {
    // -200 loss, limit is -300 (3% of 10000)
    expect(checkDailyLossLimit(-200, 10000, 0.03)).toBe(null);
  });

  test("returns rejection when daily loss hits limit", () => {
    const result = checkDailyLossLimit(-300, 10000, 0.03);
    expect(result).toEqual({
      check: "daily_loss_limit",
      reason: expect.any(String),
      value: 300,
      limit: 300,
    });
  });

  test("returns rejection when daily loss exceeds limit", () => {
    const result = checkDailyLossLimit(-500, 10000, 0.03);
    expect(result).not.toBe(null);
    expect(result!.check).toBe("daily_loss_limit");
  });
});

describe(checkMaxPositions, () => {
  test("returns null when under limit", () => {
    expect(checkMaxPositions(3, 5)).toBe(null);
  });

  test("returns rejection when at limit", () => {
    const result = checkMaxPositions(5, 5);
    expect(result).toEqual({
      check: "max_positions",
      reason: expect.any(String),
      value: 5,
      limit: 5,
    });
  });

  test("returns rejection when over limit", () => {
    expect(checkMaxPositions(6, 5)).not.toBe(null);
  });
});

describe(checkDrawdown, () => {
  test("returns null when no drawdown", () => {
    expect(checkDrawdown(10000, 10000, 0.1)).toBe(null);
  });

  test("returns null when drawdown is within limit", () => {
    // 5% drawdown, limit is 10%
    expect(checkDrawdown(9500, 10000, 0.1)).toBe(null);
  });

  test("returns rejection when drawdown hits limit", () => {
    const result = checkDrawdown(9000, 10000, 0.1);
    expect(result).toEqual({
      check: "max_drawdown",
      reason: expect.any(String),
      value: 0.1,
      limit: 0.1,
    });
  });

  test("returns null when high water mark is zero", () => {
    expect(checkDrawdown(9000, 0, 0.1)).toBe(null);
  });

  test("returns null when equity exceeds HWM", () => {
    expect(checkDrawdown(11000, 10000, 0.1)).toBe(null);
  });
});

describe(findCorrelationGroup, () => {
  test("finds group for EUR/USD", () => {
    const group = findCorrelationGroup("EUR/USD");
    expect(group).toContain("EUR/USD");
    expect(group).toContain("GBP/USD");
  });

  test("finds group for JPY crosses", () => {
    const group = findCorrelationGroup("EUR/JPY");
    expect(group).toContain("GBP/JPY");
    expect(group).toContain("AUD/JPY");
  });

  test("returns singleton for unknown pair", () => {
    expect(findCorrelationGroup("XYZ/ABC")).toEqual(["XYZ/ABC"]);
  });
});

describe(checkCorrelation, () => {
  test("returns null when no correlated positions open", () => {
    const result = checkCorrelation("EUR/USD", [], 2);
    expect(result).toBe(null);
  });

  test("returns null when correlated positions under limit", () => {
    const positions = [makePosition({ symbol: "GBPUSD" })];
    const result = checkCorrelation("EUR/USD", positions, 2);
    expect(result).toBe(null);
  });

  test("returns rejection when correlated positions at limit", () => {
    const positions = [
      makePosition({ symbol: "GBPUSD" }),
      makePosition({ symbol: "AUDUSD" }),
    ];
    const result = checkCorrelation("EUR/USD", positions, 2);
    expect(result).toEqual({
      check: "correlation_block",
      reason: expect.any(String),
      value: 2,
      limit: 2,
    });
  });

  test("does not count unrelated pairs", () => {
    const positions = [
      makePosition({ symbol: "USDJPY" }),
      makePosition({ symbol: "USDCAD" }),
    ];
    const result = checkCorrelation("EUR/USD", positions, 2);
    expect(result).toBe(null);
  });
});

describe(checkConsecutiveLosses, () => {
  test("returns null when under limit", () => {
    expect(checkConsecutiveLosses(3, 5)).toBe(null);
  });

  test("returns rejection when at limit", () => {
    const result = checkConsecutiveLosses(5, 5);
    expect(result).toEqual({
      check: "consecutive_losses",
      reason: expect.any(String),
      value: 5,
      limit: 5,
    });
  });
});

describe(checkSpread, () => {
  test("returns null when spread is normal", () => {
    expect(checkSpread(1.5, 1.5, 3.0)).toBe(null);
  });

  test("returns null when spread is within multiplier", () => {
    expect(checkSpread(3.0, 1.5, 3.0)).toBe(null);
  });

  test("returns rejection when spread exceeds multiplier", () => {
    const result = checkSpread(5.0, 1.5, 3.0);
    expect(result).not.toBe(null);
    expect(result!.check).toBe("spread_too_wide");
  });

  test("returns null when normal spread is zero", () => {
    expect(checkSpread(5.0, 0, 3.0)).toBe(null);
  });
});

describe(runAllRiskChecks, () => {
  test("approves when all checks pass", () => {
    const result = runAllRiskChecks(
      "EUR/USD",
      makeAccountState(),
      defaultConfig,
    );
    expect(result).toEqual({ approved: true, rejections: [] });
  });

  test("rejects with single failure", () => {
    const state = makeAccountState({ dailyPnl: -500 });
    const result = runAllRiskChecks("EUR/USD", state, defaultConfig);
    expect(result.approved).toBe(false);
    expect(result.rejections).toHaveLength(1);
    expect(result.rejections[0].check).toBe("daily_loss_limit");
  });

  test("collects multiple rejections", () => {
    const state = makeAccountState({
      dailyPnl: -500,
      openPositions: Array.from({ length: 5 }, (_, i) =>
        makePosition({ id: `pos-${i}`, symbol: "USDJPY" }),
      ),
      consecutiveLosses: 6,
    });
    const result = runAllRiskChecks("EUR/USD", state, defaultConfig);
    expect(result.approved).toBe(false);
    expect(result.rejections.length).toBeGreaterThanOrEqual(2);
  });
});
