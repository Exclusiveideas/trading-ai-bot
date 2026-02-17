import type { Candle } from "@/types/trading";

export type DateChunk = {
  start: string;
  end: string;
};

export function computeDateChunks(
  startDate: string,
  endDate: string,
  maxTradingDaysPerChunk: number = 5000
): DateChunk[] {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (start >= end) return [];

  const totalMs = end.getTime() - start.getTime();
  const totalCalendarDays = totalMs / (1000 * 60 * 60 * 24);
  const estimatedTradingDays = totalCalendarDays * (5 / 7);

  if (estimatedTradingDays <= maxTradingDaysPerChunk) {
    return [{ start: startDate, end: endDate }];
  }

  const calendarDaysPerChunk = Math.floor(
    (maxTradingDaysPerChunk / estimatedTradingDays) * totalCalendarDays
  );

  const chunks: DateChunk[] = [];
  let chunkStart = new Date(start);

  while (chunkStart < end) {
    const chunkEnd = new Date(chunkStart);
    chunkEnd.setDate(chunkEnd.getDate() + calendarDaysPerChunk);

    if (chunkEnd > end) {
      chunks.push({
        start: formatDate(chunkStart),
        end: formatDate(end),
      });
    } else {
      chunks.push({
        start: formatDate(chunkStart),
        end: formatDate(chunkEnd),
      });
    }

    chunkStart = new Date(chunkEnd);
    chunkStart.setDate(chunkStart.getDate() + 1);
  }

  return chunks;
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export function validateCandle(candle: Candle): boolean {
  if (candle.open <= 0 || candle.high <= 0 || candle.low <= 0 || candle.close <= 0) {
    return false;
  }
  if (candle.high < candle.low) return false;
  if (candle.high < candle.open || candle.high < candle.close) return false;
  if (candle.low > candle.open || candle.low > candle.close) return false;
  if (!candle.timestamp || isNaN(Date.parse(candle.timestamp))) return false;
  if (!candle.pair) return false;
  return true;
}

export async function fetchWithRetry(
  fetchFn: () => Promise<Candle[]>,
  maxRetries: number = 3,
  baseDelayMs: number = 10000
): Promise<Candle[]> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fetchFn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const isRateLimit = lastError.message.includes("429") || lastError.message.includes("rate");
      const delay = isRateLimit ? 60000 : baseDelayMs * Math.pow(2, attempt);
      console.log(`Attempt ${attempt + 1} failed: ${lastError.message}. Retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
