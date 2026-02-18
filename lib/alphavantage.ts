import type { Candle } from "@/types/trading";

const BASE_URL = "https://www.alphavantage.co/query";

function getApiKey(): string {
  const key = process.env.ALPHA_VANTAGE_API_KEY;
  if (!key) throw new Error("Missing ALPHA_VANTAGE_API_KEY in .env");
  return key;
}

// Free tier: 25 requests/day, 5 requests/minute
const RATE_LIMIT_DELAY_MS = 15000;

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

type AlphaVantageFxDailyResponse = {
  "Meta Data"?: {
    "1. Information": string;
    "2. From Symbol": string;
    "3. To Symbol": string;
  };
  "Time Series FX (Daily)"?: Record<
    string,
    {
      "1. open": string;
      "2. high": string;
      "3. low": string;
      "4. close": string;
    }
  >;
  Note?: string;
  Information?: string;
  "Error Message"?: string;
};

function parseSymbol(symbol: string): { from: string; to: string } {
  const parts = symbol.split("/");
  if (parts.length !== 2) throw new Error(`Invalid forex pair: ${symbol}`);
  return { from: parts[0], to: parts[1] };
}

export async function fetchHistoricalData(
  symbol: string,
  _interval: string = "1day",
  outputSize: "compact" | "full" = "full",
): Promise<Candle[]> {
  const { from, to } = parseSymbol(symbol);

  const params = new URLSearchParams({
    function: "FX_DAILY",
    from_symbol: from,
    to_symbol: to,
    outputsize: outputSize,
    apikey: getApiKey(),
  });

  const url = `${BASE_URL}?${params}`;
  const response = await rateLimitedFetch(url);

  if (!response.ok) {
    throw new Error(
      `Alpha Vantage API error: ${response.status} ${response.statusText}`,
    );
  }

  const data: AlphaVantageFxDailyResponse = await response.json();

  if (data["Error Message"]) {
    throw new Error(`Alpha Vantage API error: ${data["Error Message"]}`);
  }

  if (data.Note || data.Information) {
    throw new Error(
      `Alpha Vantage rate limit: ${data.Note ?? data.Information}`,
    );
  }

  const timeSeries = data["Time Series FX (Daily)"];
  if (!timeSeries) {
    throw new Error("Alpha Vantage returned no time series data");
  }

  const candles: Candle[] = Object.entries(timeSeries)
    .map(([date, values]) => ({
      pair: symbol,
      timestamp: date,
      open: parseFloat(values["1. open"]),
      high: parseFloat(values["2. high"]),
      low: parseFloat(values["3. low"]),
      close: parseFloat(values["4. close"]),
      volume: 0,
      timeframe: "1day",
    }))
    .sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );

  return candles;
}

export async function testConnection(): Promise<{
  success: boolean;
  message: string;
  data?: Candle[];
}> {
  try {
    const candles = await fetchHistoricalData("EUR/USD", "1day", "compact");
    return {
      success: true,
      message: `Connected. Fetched ${candles.length} candles.`,
      data: candles.slice(-5),
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
