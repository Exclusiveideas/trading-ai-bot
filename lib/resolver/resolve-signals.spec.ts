import { describe, expect, test } from "vitest";
import { findEntryIndex, timeframesToCheck } from "./resolve-signals";
import type { Candle } from "@/types/trading";

function makeCandle(timestamp: string): Candle {
  return {
    pair: "EUR/USD",
    timestamp,
    open: 1.1,
    high: 1.12,
    low: 1.08,
    close: 1.11,
    volume: 100,
    timeframe: "H1",
  };
}

describe(findEntryIndex, () => {
  test("finds exact timestamp match", () => {
    const candles = [
      makeCandle("2025-01-01T00:00:00Z"),
      makeCandle("2025-01-01T01:00:00Z"),
      makeCandle("2025-01-01T02:00:00Z"),
    ];
    const idx = findEntryIndex(candles, new Date("2025-01-01T01:00:00Z"));
    expect(idx).toBe(1);
  });

  test("finds closest candle when no exact match", () => {
    const candles = [
      makeCandle("2025-01-01T00:00:00Z"),
      makeCandle("2025-01-01T01:00:00Z"),
      makeCandle("2025-01-01T02:00:00Z"),
    ];
    const idx = findEntryIndex(candles, new Date("2025-01-01T01:30:00Z"));
    expect(idx).toBe(1);
  });

  test("returns -1 for empty candle array", () => {
    expect(findEntryIndex([], new Date("2025-01-01T00:00:00Z"))).toBe(-1);
  });

  test("returns 0 for single candle", () => {
    const candles = [makeCandle("2025-01-01T00:00:00Z")];
    expect(findEntryIndex(candles, new Date("2025-06-01T00:00:00Z"))).toBe(0);
  });
});

describe(timeframesToCheck, () => {
  test("always includes M15", () => {
    const tfs = timeframesToCheck(new Date("2025-01-01T03:30:00Z"));
    expect(tfs).toContain("M15");
  });

  test("includes H1 at top of hour", () => {
    const tfs = timeframesToCheck(new Date("2025-01-01T03:00:00Z"));
    expect(tfs).toEqual(expect.arrayContaining(["M15", "H1"]));
  });

  test("does not include H1 at :30", () => {
    const tfs = timeframesToCheck(new Date("2025-01-01T03:30:00Z"));
    expect(tfs).not.toContain("H1");
  });

  test("includes H4 at 4-hour boundaries", () => {
    const tfs = timeframesToCheck(new Date("2025-01-01T08:00:00Z"));
    expect(tfs).toEqual(expect.arrayContaining(["M15", "H1", "H4"]));
  });

  test("does not include H4 at non-4-hour boundary", () => {
    const tfs = timeframesToCheck(new Date("2025-01-01T03:00:00Z"));
    expect(tfs).not.toContain("H4");
  });

  test("includes D at midnight UTC", () => {
    const tfs = timeframesToCheck(new Date("2025-01-01T00:00:00Z"));
    expect(tfs).toEqual(
      expect.arrayContaining(["M15", "H1", "H4", "D"]),
    );
  });

  test("does not include D at non-midnight", () => {
    const tfs = timeframesToCheck(new Date("2025-01-01T12:00:00Z"));
    expect(tfs).not.toContain("D");
  });
});
