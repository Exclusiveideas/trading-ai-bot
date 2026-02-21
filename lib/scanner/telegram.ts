type SignalAlert = {
  pair: string;
  timeframe: string;
  patternType: string;
  direction: string;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  qualityRating: number;
  v1WinProb: number | null;
  v2MfeBucket: string | null;
  v3MfePrediction: number | null;
};

function getBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("Missing TELEGRAM_BOT_TOKEN in .env");
  return token;
}

function getChatId(): string {
  const id = process.env.TELEGRAM_CHAT_ID;
  if (!id) throw new Error("Missing TELEGRAM_CHAT_ID in .env");
  return id;
}

function formatSignalMessage(signal: SignalAlert): string {
  const icon = signal.direction === "bullish" ? "\u{1F7E2}" : "\u{1F534}";
  const riskDist = Math.abs(signal.entryPrice - signal.stopLoss);
  const rewardDist = Math.abs(signal.takeProfit - signal.entryPrice);
  const rr = riskDist > 0 ? (rewardDist / riskDist).toFixed(1) : "?";

  const winPct =
    signal.v1WinProb != null ? `${(signal.v1WinProb * 100).toFixed(0)}%` : "—";
  const mfeBucket = signal.v2MfeBucket ?? "—";
  const mfePred =
    signal.v3MfePrediction != null
      ? `${signal.v3MfePrediction.toFixed(2)}R`
      : "—";

  const patternLabel = signal.patternType.replace(/_/g, " ");

  return [
    `${icon} *${signal.pair} ${signal.timeframe}*`,
    `Pattern: ${patternLabel} (${signal.direction})`,
    `Quality: ${signal.qualityRating}/10 | Win: ${winPct}`,
    `MFE Bucket: ${mfeBucket} | MFE: ${mfePred}`,
    `Entry: ${signal.entryPrice} | SL: ${signal.stopLoss} | TP: ${signal.takeProfit}`,
    `R:R = 1:${rr}`,
  ].join("\n");
}

export function isTelegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

export async function sendTelegramAlert(signal: SignalAlert): Promise<boolean> {
  if (!isTelegramConfigured()) return false;

  const token = getBotToken();
  const chatId = getChatId();
  const text = formatSignalMessage(signal);

  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`Telegram API error ${response.status}: ${body}`);
    return false;
  }

  return true;
}

export async function sendTelegramMessage(text: string): Promise<boolean> {
  if (!isTelegramConfigured()) return false;

  const token = getBotToken();
  const chatId = getChatId();

  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`Telegram API error ${response.status}: ${body}`);
    return false;
  }

  return true;
}
