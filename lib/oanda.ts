import type { Candle, OandaGranularity } from "@/types/trading";

const BASE_URL = "https://api-fxpractice.oanda.com/v3";
const MIN_REQUEST_INTERVAL_MS = 200;
const MAX_CANDLES_PER_REQUEST = 5000;

type OandaCandlestick = {
  time: string;
  volume: number;
  mid: {
    o: string;
    h: string;
    l: string;
    c: string;
  };
  complete: boolean;
};

type OandaCandlesResponse = {
  instrument: string;
  granularity: string;
  candles: OandaCandlestick[];
};

function getApiKey(): string {
  const key = process.env.OANDA_V20_API_KEY;
  if (!key) throw new Error("Missing OANDA_V20_API_KEY in .env");
  return key;
}

export function pairToInstrument(pair: string): string {
  const parts = pair.split("/");
  if (parts.length !== 2) throw new Error(`Invalid forex pair: ${pair}`);
  return `${parts[0]}_${parts[1]}`;
}

export function instrumentToPair(instrument: string): string {
  return instrument.replace("_", "/");
}

function getChunkDays(granularity: OandaGranularity): number {
  switch (granularity) {
    case "D":
      return 3650;
    case "H4":
      return 345;
    case "H1":
      return 83;
    case "M15":
      return 20;
  }
}

export type DateRange = { start: Date; end: Date };

export function computeChunks(
  startDate: Date,
  endDate: Date,
  granularity: OandaGranularity,
): DateRange[] {
  if (startDate >= endDate) return [];

  const chunkDays = getChunkDays(granularity);
  const chunks: DateRange[] = [];
  let current = new Date(startDate);

  while (current < endDate) {
    const chunkEnd = new Date(current);
    chunkEnd.setDate(chunkEnd.getDate() + chunkDays);

    const effectiveEnd = chunkEnd > endDate ? endDate : chunkEnd;
    chunks.push({ start: new Date(current), end: new Date(effectiveEnd) });

    current = new Date(effectiveEnd);
  }

  return chunks;
}

let lastRequestTime = 0;

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_REQUEST_INTERVAL_MS) {
    await new Promise((r) => setTimeout(r, MIN_REQUEST_INTERVAL_MS - elapsed));
  }
  lastRequestTime = Date.now();

  return fetch(url, {
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
    },
  });
}

export async function fetchCandles(
  pair: string,
  granularity: OandaGranularity,
  startTime: Date,
  endTime: Date,
): Promise<Candle[]> {
  const instrument = pairToInstrument(pair);

  const params = new URLSearchParams({
    granularity,
    price: "M",
    from: startTime.toISOString(),
    to: endTime.toISOString(),
  });

  const url = `${BASE_URL}/instruments/${instrument}/candles?${params}`;
  const response = await rateLimitedFetch(url);

  if (response.status === 429) {
    console.log("  Rate limited, waiting 60s...");
    await new Promise((r) => setTimeout(r, 60000));
    return fetchCandles(pair, granularity, startTime, endTime);
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OANDA v20 API error ${response.status}: ${text}`);
  }

  const data: OandaCandlesResponse = await response.json();

  return data.candles
    .filter((c) => c.complete)
    .map((c) => ({
      pair,
      timestamp: c.time,
      open: parseFloat(c.mid.o),
      high: parseFloat(c.mid.h),
      low: parseFloat(c.mid.l),
      close: parseFloat(c.mid.c),
      volume: c.volume,
      timeframe: granularity,
    }));
}

export async function fetchLatestCandles(
  pair: string,
  granularity: OandaGranularity,
  count: number = 300,
): Promise<Candle[]> {
  const instrument = pairToInstrument(pair);

  const params = new URLSearchParams({
    granularity,
    price: "M",
    count: String(Math.min(count, MAX_CANDLES_PER_REQUEST)),
  });

  const url = `${BASE_URL}/instruments/${instrument}/candles?${params}`;
  const response = await rateLimitedFetch(url);

  if (response.status === 429) {
    console.log("  Rate limited, waiting 60s...");
    await new Promise((r) => setTimeout(r, 60000));
    return fetchLatestCandles(pair, granularity, count);
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OANDA v20 API error ${response.status}: ${text}`);
  }

  const data: OandaCandlesResponse = await response.json();

  return data.candles
    .filter((c) => c.complete)
    .map((c) => ({
      pair,
      timestamp: c.time,
      open: parseFloat(c.mid.o),
      high: parseFloat(c.mid.h),
      low: parseFloat(c.mid.l),
      close: parseFloat(c.mid.c),
      volume: c.volume,
      timeframe: granularity,
    }));
}

export async function testConnection(): Promise<{
  success: boolean;
  message: string;
  data?: Candle[];
}> {
  try {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 7);
    const candles = await fetchCandles("EUR/USD", "D", start, end);
    return {
      success: true,
      message: `Connected to OANDA v20. Fetched ${candles.length} candles.`,
      data: candles,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
