import { TwelveDataResponse, Candle } from "@/types/trading";

const BASE_URL = "https://api.twelvedata.com";

function getApiKey(): string {
  const key = process.env.TWELVE_DATA_API_KEY;
  if (!key) throw new Error("Missing TWELVE_DATA_API_KEY in .env.local");
  return key;
}

// Free tier: 8 requests/minute, 800 requests/day
const RATE_LIMIT_DELAY_MS = 8000; // 8 seconds between requests to stay safe

let lastRequestTime = 0;

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < RATE_LIMIT_DELAY_MS) {
    const waitTime = RATE_LIMIT_DELAY_MS - timeSinceLastRequest;
    await new Promise((resolve) => setTimeout(resolve, waitTime));
  }

  lastRequestTime = Date.now();
  return fetch(url);
}

export async function fetchHistoricalData(
  symbol: string,
  interval: string = "1day",
  outputSize: number = 100,
  startDate?: string,
  endDate?: string
): Promise<Candle[]> {
  const params = new URLSearchParams({
    symbol,
    interval,
    outputsize: outputSize.toString(),
    apikey: getApiKey(),
    format: "JSON",
  });

  if (startDate) params.set("start_date", startDate);
  if (endDate) params.set("end_date", endDate);

  const url = `${BASE_URL}/time_series?${params}`;
  const response = await rateLimitedFetch(url);

  if (!response.ok) {
    throw new Error(`Twelve Data API error: ${response.status} ${response.statusText}`);
  }

  const data: TwelveDataResponse = await response.json();

  if (data.status === "error") {
    throw new Error(`Twelve Data API error: ${JSON.stringify(data)}`);
  }

  return data.values.map((v) => ({
    pair: symbol,
    timestamp: v.datetime,
    open: parseFloat(v.open),
    high: parseFloat(v.high),
    low: parseFloat(v.low),
    close: parseFloat(v.close),
    volume: parseFloat(v.volume),
    timeframe: interval,
  }));
}

export async function testConnection(): Promise<{
  success: boolean;
  message: string;
  data?: Candle[];
}> {
  try {
    const candles = await fetchHistoricalData("EUR/USD", "1day", 5);
    return {
      success: true,
      message: `Connected. Fetched ${candles.length} candles.`,
      data: candles,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
