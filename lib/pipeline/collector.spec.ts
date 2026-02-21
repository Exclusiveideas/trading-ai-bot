import { describe, expect, test } from "vitest";
import { computeDateChunks, validateCandle, fetchWithRetry } from "./collector";
import type { Candle } from "@/types/trading";

const validCandle: Candle = {
  pair: "EUR/USD",
  timestamp: "2024-01-15",
  open: 1.095,
  high: 1.098,
  low: 1.093,
  close: 1.096,
  volume: 0,
  timeframe: "D",
};

describe(computeDateChunks, () => {
  test("returns single chunk for small date range", () => {
    const chunks = computeDateChunks("2023-01-01", "2024-01-01");
    expect(chunks).toEqual([{ start: "2023-01-01", end: "2024-01-01" }]);
  });

  test("returns empty array when start >= end", () => {
    expect(computeDateChunks("2024-01-01", "2023-01-01")).toEqual([]);
    expect(computeDateChunks("2024-01-01", "2024-01-01")).toEqual([]);
  });

  test("splits large range into multiple chunks", () => {
    const chunks = computeDateChunks("2000-01-01", "2024-01-01", 500);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].start).toBe("2000-01-01");
    expect(chunks[chunks.length - 1].end).toBe("2024-01-01");
  });

  test("chunks are contiguous with no gaps or overlaps", () => {
    const chunks = computeDateChunks("2000-01-01", "2024-01-01", 500);
    for (let i = 1; i < chunks.length; i++) {
      const prevEnd = new Date(chunks[i - 1].end);
      const currStart = new Date(chunks[i].start);
      const diffDays =
        (currStart.getTime() - prevEnd.getTime()) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBe(1);
    }
  });

  test("5 years of daily data fits in a single chunk at default max", () => {
    const chunks = computeDateChunks("2021-01-01", "2026-01-01");
    expect(chunks).toHaveLength(1);
  });
});

describe(validateCandle, () => {
  test("accepts valid candle", () => {
    expect(validateCandle(validCandle)).toBe(true);
  });

  test("rejects candle with zero open", () => {
    expect(validateCandle({ ...validCandle, open: 0 })).toBe(false);
  });

  test("rejects candle with negative close", () => {
    expect(validateCandle({ ...validCandle, close: -1 })).toBe(false);
  });

  test("rejects candle where high < low", () => {
    expect(validateCandle({ ...validCandle, high: 1.09, low: 1.1 })).toBe(
      false,
    );
  });

  test("rejects candle where high < open", () => {
    expect(
      validateCandle({
        ...validCandle,
        open: 1.1,
        high: 1.09,
        low: 1.08,
        close: 1.085,
      }),
    ).toBe(false);
  });

  test("rejects candle where low > close", () => {
    expect(
      validateCandle({ ...validCandle, low: 1.1, close: 1.09, high: 1.12 }),
    ).toBe(false);
  });

  test("rejects candle with empty timestamp", () => {
    expect(validateCandle({ ...validCandle, timestamp: "" })).toBe(false);
  });

  test("rejects candle with invalid timestamp", () => {
    expect(validateCandle({ ...validCandle, timestamp: "not-a-date" })).toBe(
      false,
    );
  });

  test("rejects candle with empty pair", () => {
    expect(validateCandle({ ...validCandle, pair: "" })).toBe(false);
  });

  test("accepts candle with zero volume (forex)", () => {
    expect(validateCandle({ ...validCandle, volume: 0 })).toBe(true);
  });
});

describe(fetchWithRetry, () => {
  test("returns result on first success", async () => {
    const candles = [validCandle];
    const result = await fetchWithRetry(() => Promise.resolve(candles));
    expect(result).toBe(candles);
  });

  test("retries on failure and returns on eventual success", async () => {
    let attempt = 0;
    const result = await fetchWithRetry(
      () => {
        attempt++;
        if (attempt < 3) throw new Error("temporary failure");
        return Promise.resolve([validCandle]);
      },
      3,
      10,
    );
    expect(result).toEqual([validCandle]);
    expect(attempt).toBe(3);
  });

  test("throws after max retries exhausted", async () => {
    await expect(
      fetchWithRetry(
        () => Promise.reject(new Error("persistent failure")),
        2,
        10,
      ),
    ).rejects.toThrow("persistent failure");
  });
});
