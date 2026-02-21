import { afterEach, describe, expect, test, vi } from "vitest";
import { getExecutionMode, getRiskConfig } from "./execute-signal";

describe(getExecutionMode, () => {
  afterEach(() => {
    delete process.env.EXECUTION_MODE;
  });

  test("defaults to disabled when env var is not set", () => {
    delete process.env.EXECUTION_MODE;
    expect(getExecutionMode()).toBe("disabled");
  });

  test("returns live when EXECUTION_MODE is live", () => {
    process.env.EXECUTION_MODE = "live";
    expect(getExecutionMode()).toBe("live");
  });

  test("returns paper when EXECUTION_MODE is paper", () => {
    process.env.EXECUTION_MODE = "paper";
    expect(getExecutionMode()).toBe("paper");
  });

  test("throws on invalid EXECUTION_MODE", () => {
    process.env.EXECUTION_MODE = "invalid";
    expect(() => getExecutionMode()).toThrow("Invalid EXECUTION_MODE");
  });
});

describe(getRiskConfig, () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("returns defaults when no env vars set", () => {
    const config = getRiskConfig();
    expect(config).toEqual({
      riskPerTradePct: 0.01,
      maxDailyLossPct: 0.03,
      maxOpenPositions: 5,
      maxDrawdownPct: 0.1,
      maxConsecutiveLosses: 5,
      maxSpreadMultiplier: 3.0,
      maxCorrelatedPairs: 2,
    });
  });

  test("reads custom values from env vars", () => {
    vi.stubEnv("RISK_PER_TRADE_PCT", "0.02");
    vi.stubEnv("MAX_DAILY_LOSS_PCT", "0.05");
    vi.stubEnv("MAX_OPEN_POSITIONS", "3");
    const config = getRiskConfig();
    expect(config.riskPerTradePct).toBe(0.02);
    expect(config.maxDailyLossPct).toBe(0.05);
    expect(config.maxOpenPositions).toBe(3);
  });
});
