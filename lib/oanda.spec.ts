import { describe, expect, test } from "vitest";
import { computeChunks, pairToInstrument, instrumentToPair } from "./oanda";
import type { OandaGranularity } from "@/types/trading";

describe(pairToInstrument, () => {
  test("converts slash-separated pair to underscore", () => {
    expect(pairToInstrument("EUR/USD")).toBe("EUR_USD");
    expect(pairToInstrument("GBP/JPY")).toBe("GBP_JPY");
  });

  test("throws for invalid pair format", () => {
    expect(() => pairToInstrument("EURUSD")).toThrow("Invalid forex pair");
    expect(() => pairToInstrument("EUR/USD/GBP")).toThrow("Invalid forex pair");
  });
});

describe(instrumentToPair, () => {
  test("converts underscore instrument to slash pair", () => {
    expect(instrumentToPair("EUR_USD")).toBe("EUR/USD");
    expect(instrumentToPair("GBP_JPY")).toBe("GBP/JPY");
  });
});

describe(computeChunks, () => {
  test("returns empty array when start >= end", () => {
    const date = new Date("2024-01-01");
    expect(computeChunks(date, date, "D")).toEqual([]);
    expect(
      computeChunks(new Date("2024-02-01"), new Date("2024-01-01"), "D"),
    ).toEqual([]);
  });

  test("daily granularity produces single chunk for short range", () => {
    const start = new Date("2024-01-01");
    const end = new Date("2024-06-01");
    const chunks = computeChunks(start, end, "D");
    expect(chunks).toHaveLength(1);
    expect(chunks[0].start.toISOString()).toBe(start.toISOString());
    expect(chunks[0].end.toISOString()).toBe(end.toISOString());
  });

  test("daily granularity produces multiple chunks for 15 years", () => {
    const start = new Date("2011-01-01");
    const end = new Date("2026-01-01");
    const chunks = computeChunks(start, end, "D");
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks[0].start.toISOString()).toBe(start.toISOString());
    expect(chunks[chunks.length - 1].end.toISOString()).toBe(end.toISOString());
  });

  test("M15 granularity splits 1 year into many chunks", () => {
    const start = new Date("2024-01-01");
    const end = new Date("2025-01-01");
    const chunks = computeChunks(start, end, "M15");
    expect(chunks.length).toBeGreaterThanOrEqual(15);
  });

  test("chunks cover the full date range without gaps", () => {
    const granularities: OandaGranularity[] = ["D", "H4", "H1", "M15"];
    const start = new Date("2023-01-01");
    const end = new Date("2024-06-15");

    for (const granularity of granularities) {
      const chunks = computeChunks(start, end, granularity);
      expect(chunks[0].start.toISOString()).toBe(start.toISOString());
      expect(chunks[chunks.length - 1].end.toISOString()).toBe(
        end.toISOString(),
      );

      for (let i = 1; i < chunks.length; i++) {
        expect(chunks[i].start.toISOString()).toBe(
          chunks[i - 1].end.toISOString(),
        );
      }
    }
  });

  test("H1 produces reasonable chunk count for 5 years", () => {
    const start = new Date("2021-01-01");
    const end = new Date("2026-01-01");
    const chunks = computeChunks(start, end, "H1");
    expect(chunks.length).toBeGreaterThanOrEqual(20);
    expect(chunks.length).toBeLessThanOrEqual(30);
  });
});
