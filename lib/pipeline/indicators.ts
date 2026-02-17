import { sma, ema, rsi, macd, adx, atr, bollingerbands } from "technicalindicators";

export type IndicatorRow = {
  sma20: number | null;
  sma50: number | null;
  ema200: number | null;
  rsi: number | null;
  macd: number | null;
  macdSignal: number | null;
  macdHistogram: number | null;
  adx: number | null;
  atr: number | null;
  bbUpper: number | null;
  bbMiddle: number | null;
  bbLower: number | null;
  volumeSma: number | null;
};

export function alignIndicatorResult(
  values: number[],
  inputLength: number
): (number | null)[] {
  const padding = inputLength - values.length;
  const nulls: (number | null)[] = Array(padding).fill(null);
  return [...nulls, ...values];
}

type OhlcCandle = {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export function calculateAllIndicators(candles: OhlcCandle[]): IndicatorRow[] {
  const len = candles.length;
  if (len === 0) return [];

  const closes = candles.map((c) => c.close);
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const volumes = candles.map((c) => c.volume);

  const sma20Raw = sma({ period: 20, values: closes });
  const sma50Raw = sma({ period: 50, values: closes });
  const ema200Raw = ema({ period: 200, values: closes });
  const rsiRaw = rsi({ period: 14, values: closes });
  const volumeSmaRaw = sma({ period: 20, values: volumes });

  const macdRaw = macd({
    values: closes,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false,
  });

  const adxRaw = adx({ period: 14, high: highs, low: lows, close: closes });
  const atrRaw = atr({ period: 14, high: highs, low: lows, close: closes });
  const bbRaw = bollingerbands({ period: 20, stdDev: 2, values: closes });

  const sma20Aligned = alignIndicatorResult(sma20Raw, len);
  const sma50Aligned = alignIndicatorResult(sma50Raw, len);
  const ema200Aligned = alignIndicatorResult(ema200Raw, len);
  const rsiAligned = alignIndicatorResult(rsiRaw, len);
  const volumeSmaAligned = alignIndicatorResult(volumeSmaRaw, len);

  const macdPadding = len - macdRaw.length;
  const adxPadding = len - adxRaw.length;
  const atrPadding = len - atrRaw.length;
  const bbPadding = len - bbRaw.length;

  const rows: IndicatorRow[] = [];

  for (let i = 0; i < len; i++) {
    const macdIdx = i - macdPadding;
    const adxIdx = i - adxPadding;
    const atrIdx = i - atrPadding;
    const bbIdx = i - bbPadding;

    const macdVal = macdIdx >= 0 ? macdRaw[macdIdx] : null;
    const adxVal = adxIdx >= 0 ? adxRaw[adxIdx] : null;
    const atrVal = atrIdx >= 0 ? atrRaw[atrIdx] : null;
    const bbVal = bbIdx >= 0 ? bbRaw[bbIdx] : null;

    rows.push({
      sma20: sma20Aligned[i],
      sma50: sma50Aligned[i],
      ema200: ema200Aligned[i],
      rsi: rsiAligned[i],
      macd: macdVal?.MACD ?? null,
      macdSignal: macdVal?.signal ?? null,
      macdHistogram: macdVal?.histogram ?? null,
      adx: adxVal?.adx ?? null,
      atr: atrVal ?? null,
      bbUpper: bbVal?.upper ?? null,
      bbMiddle: bbVal?.middle ?? null,
      bbLower: bbVal?.lower ?? null,
      volumeSma: volumeSmaAligned[i],
    });
  }

  return rows;
}
