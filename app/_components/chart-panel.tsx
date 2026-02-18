"use client";

import { useRef, useEffect, useCallback } from "react";
import { useTheme } from "next-themes";
import { createChart, CandlestickSeries, LineSeries } from "lightweight-charts";
import type {
  IChartApi,
  ISeriesApi,
  CandlestickData,
  LineData,
  Time,
  LogicalRange,
} from "lightweight-charts";

type CandleData = {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  features: {
    sma20: number | null;
    sma50: number | null;
    ema200: number | null;
    bbUpper: number | null;
    bbMiddle: number | null;
    bbLower: number | null;
  } | null;
};

type ChartPanelProps = {
  candles: CandleData[];
  focusTimestamp?: string;
  entryPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  onCandleClick?: (timestamp: string, index: number) => void;
  onLoadMore?: () => void;
};

const CHART_THEMES = {
  dark: {
    background: "#09090b",
    text: "#a1a1aa",
    grid: "#27272a",
    border: "#3f3f46",
    bbColor: "#6b7280",
  },
  light: {
    background: "#ffffff",
    text: "#71717a",
    grid: "#e4e4e7",
    border: "#d4d4d8",
    bbColor: "#a1a1aa",
  },
} as const;

const SCROLL_LOAD_THRESHOLD = 10;
const INITIAL_VISIBLE_BARS = 40;

function toChartTime(timestamp: string): Time {
  return timestamp.split("T")[0] as Time;
}

function buildCandleData(candles: CandleData[]): CandlestickData[] {
  return candles.map((c) => ({
    time: toChartTime(c.timestamp),
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
  }));
}

function buildIndicatorData(candles: CandleData[]) {
  const sma20: LineData[] = [];
  const sma50: LineData[] = [];
  const ema200: LineData[] = [];
  const bbUpper: LineData[] = [];
  const bbLower: LineData[] = [];

  for (const c of candles) {
    const time = toChartTime(c.timestamp);
    if (c.features?.sma20 != null)
      sma20.push({ time, value: c.features.sma20 });
    if (c.features?.sma50 != null)
      sma50.push({ time, value: c.features.sma50 });
    if (c.features?.ema200 != null)
      ema200.push({ time, value: c.features.ema200 });
    if (c.features?.bbUpper != null)
      bbUpper.push({ time, value: c.features.bbUpper });
    if (c.features?.bbLower != null)
      bbLower.push({ time, value: c.features.bbLower });
  }

  return { sma20, sma50, ema200, bbUpper, bbLower };
}

type SeriesRefs = {
  candle: ISeriesApi<"Candlestick">;
  sma20: ISeriesApi<"Line">;
  sma50: ISeriesApi<"Line">;
  ema200: ISeriesApi<"Line">;
  bbUpper: ISeriesApi<"Line">;
  bbLower: ISeriesApi<"Line">;
};

export function ChartPanel({
  candles,
  focusTimestamp,
  entryPrice,
  stopLoss,
  takeProfit,
  onCandleClick,
  onLoadMore,
}: ChartPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<SeriesRefs | null>(null);
  const prevDataLengthRef = useRef(0);
  const loadingMoreRef = useRef(false);
  const onCandleClickRef = useRef(onCandleClick);
  const onLoadMoreRef = useRef(onLoadMore);
  const candlesRef = useRef(candles);
  const { resolvedTheme } = useTheme();

  const isDark = resolvedTheme !== "light";
  const colors = isDark ? CHART_THEMES.dark : CHART_THEMES.light;

  onCandleClickRef.current = onCandleClick;
  onLoadMoreRef.current = onLoadMore;
  candlesRef.current = candles;

  const handleVisibleRangeChange = useCallback((range: LogicalRange | null) => {
    if (!range || loadingMoreRef.current) return;
    if (range.from < SCROLL_LOAD_THRESHOLD && onLoadMoreRef.current) {
      loadingMoreRef.current = true;
      onLoadMoreRef.current();
      setTimeout(() => {
        loadingMoreRef.current = false;
      }, 300);
    }
  }, []);

  // Chart creation (mount only)
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: colors.background },
        textColor: colors.text,
      },
      grid: {
        vertLines: { color: colors.grid },
        horzLines: { color: colors.grid },
      },
      crosshair: { mode: 0 },
      rightPriceScale: {
        borderColor: colors.border,
        autoScale: true,
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: colors.border,
        timeVisible: false,
        barSpacing: 14,
        minBarSpacing: 14,
      },
    });

    chartRef.current = chart;

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderDownColor: "#ef4444",
      borderUpColor: "#22c55e",
      wickDownColor: "#ef4444",
      wickUpColor: "#22c55e",
    });

    const noAutoscale = {
      autoscaleInfoProvider: () => null,
    };

    const sma20Series = chart.addSeries(LineSeries, {
      color: "#3b82f6",
      lineWidth: 1,
      title: "SMA20",
      ...noAutoscale,
    });

    const sma50Series = chart.addSeries(LineSeries, {
      color: "#f59e0b",
      lineWidth: 1,
      title: "SMA50",
      ...noAutoscale,
    });

    const ema200Series = chart.addSeries(LineSeries, {
      color: "#a855f7",
      lineWidth: 1,
      title: "EMA200",
      ...noAutoscale,
    });

    const bbUpperSeries = chart.addSeries(LineSeries, {
      color: colors.bbColor,
      lineWidth: 1,
      lineStyle: 2,
      ...noAutoscale,
    });

    const bbLowerSeries = chart.addSeries(LineSeries, {
      color: colors.bbColor,
      lineWidth: 1,
      lineStyle: 2,
      ...noAutoscale,
    });

    seriesRef.current = {
      candle: candleSeries,
      sma20: sma20Series,
      sma50: sma50Series,
      ema200: ema200Series,
      bbUpper: bbUpperSeries,
      bbLower: bbLowerSeries,
    };

    chart
      .timeScale()
      .subscribeVisibleLogicalRangeChange(handleVisibleRangeChange);

    chart.subscribeClick((param) => {
      if (!onCandleClickRef.current || !param.time) return;
      const timeStr = String(param.time);
      const currentCandles = candlesRef.current;
      const idx = currentCandles.findIndex(
        (c) => c.timestamp.split("T")[0] === timeStr,
      );
      if (idx !== -1)
        onCandleClickRef.current(currentCandles[idx].timestamp, idx);
    });

    const resizeObserver = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      prevDataLengthRef.current = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Theme updates
  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.applyOptions({
      layout: {
        background: { color: colors.background },
        textColor: colors.text,
      },
      grid: {
        vertLines: { color: colors.grid },
        horzLines: { color: colors.grid },
      },
      rightPriceScale: { borderColor: colors.border },
      timeScale: { borderColor: colors.border },
    });
  }, [colors]);

  // Data updates
  useEffect(() => {
    if (!seriesRef.current || !chartRef.current || candles.length === 0) return;

    const prevLength = prevDataLengthRef.current;
    const currentRange = chartRef.current.timeScale().getVisibleLogicalRange();

    const candleData = buildCandleData(candles);
    const indicators = buildIndicatorData(candles);

    seriesRef.current.candle.setData(candleData);
    seriesRef.current.sma20.setData(indicators.sma20);
    seriesRef.current.sma50.setData(indicators.sma50);
    seriesRef.current.ema200.setData(indicators.ema200);
    seriesRef.current.bbUpper.setData(indicators.bbUpper);
    seriesRef.current.bbLower.setData(indicators.bbLower);

    if (prevLength > 0 && candles.length > prevLength && currentRange) {
      // Data was prepended — shift visible range to preserve scroll position
      const added = candles.length - prevLength;
      chartRef.current.timeScale().setVisibleLogicalRange({
        from: currentRange.from + added,
        to: currentRange.to + added,
      });
    } else if (prevLength === 0 && candles.length > INITIAL_VISIBLE_BARS) {
      // Initial load — show last N candles
      const startIdx = candles.length - INITIAL_VISIBLE_BARS;
      const from = toChartTime(candles[startIdx].timestamp);
      const to = toChartTime(candles[candles.length - 1].timestamp);
      chartRef.current.timeScale().setVisibleRange({ from, to });
    } else if (prevLength === 0) {
      chartRef.current.timeScale().fitContent();
    }

    prevDataLengthRef.current = candles.length;
  }, [candles]);

  // Focus timestamp
  useEffect(() => {
    if (!chartRef.current || !focusTimestamp || candles.length === 0) return;

    const focusDate = focusTimestamp.split("T")[0];
    const focusIdx = candles.findIndex(
      (c) => c.timestamp.split("T")[0] === focusDate,
    );
    if (focusIdx === -1) return;

    const startIdx = Math.max(0, focusIdx - 20);
    const endIdx = Math.min(candles.length - 1, focusIdx + 20);

    const from = toChartTime(candles[startIdx].timestamp);
    const to = toChartTime(candles[endIdx].timestamp);

    chartRef.current.timeScale().setVisibleRange({ from, to });
  }, [focusTimestamp, candles]);

  // Price lines
  useEffect(() => {
    if (!seriesRef.current) return;
    const candleSeries = seriesRef.current.candle;

    const pricelines = candleSeries.priceLines?.() ?? [];
    for (const line of pricelines) {
      candleSeries.removePriceLine(line);
    }

    if (entryPrice != null) {
      candleSeries.createPriceLine({
        price: entryPrice,
        color: "#3b82f6",
        lineWidth: 1,
        lineStyle: 2,
        title: "Entry",
      });
    }
    if (stopLoss != null) {
      candleSeries.createPriceLine({
        price: stopLoss,
        color: "#ef4444",
        lineWidth: 1,
        lineStyle: 2,
        title: "Stop",
      });
    }
    if (takeProfit != null) {
      candleSeries.createPriceLine({
        price: takeProfit,
        color: "#22c55e",
        lineWidth: 1,
        lineStyle: 2,
        title: "Target",
      });
    }
  }, [entryPrice, stopLoss, takeProfit]);

  return <div ref={containerRef} className="h-full w-full min-h-[400px]" />;
}
