"use client";

import { useRef, useEffect } from "react";
import { useTheme } from "next-themes";
import { createChart, CandlestickSeries, LineSeries } from "lightweight-charts";
import type {
  IChartApi,
  ISeriesApi,
  CandlestickData,
  LineData,
  Time,
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

function toChartTime(timestamp: string): Time {
  return timestamp.split("T")[0] as Time;
}

export function ChartPanel({
  candles,
  focusTimestamp,
  entryPrice,
  stopLoss,
  takeProfit,
  onCandleClick,
}: ChartPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const { resolvedTheme } = useTheme();

  const isDark = resolvedTheme !== "light";
  const colors = isDark ? CHART_THEMES.dark : CHART_THEMES.light;

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
      crosshair: {
        mode: 0,
      },
      rightPriceScale: {
        borderColor: colors.border,
        autoScale: true,
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: colors.border,
        timeVisible: false,
        barSpacing: 12,
        minBarSpacing: 8,
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
    candleSeriesRef.current = candleSeries;

    const indicatorScaleId = "indicators";

    const sma20Series = chart.addSeries(LineSeries, {
      color: "#3b82f6",
      lineWidth: 1,
      title: "SMA20",
      priceScaleId: indicatorScaleId,
    });

    const sma50Series = chart.addSeries(LineSeries, {
      color: "#f59e0b",
      lineWidth: 1,
      title: "SMA50",
      priceScaleId: indicatorScaleId,
    });

    const ema200Series = chart.addSeries(LineSeries, {
      color: "#a855f7",
      lineWidth: 1,
      title: "EMA200",
      priceScaleId: indicatorScaleId,
    });

    const bbUpperSeries = chart.addSeries(LineSeries, {
      color: colors.bbColor,
      lineWidth: 1,
      lineStyle: 2,
      priceScaleId: indicatorScaleId,
    });

    const bbLowerSeries = chart.addSeries(LineSeries, {
      color: colors.bbColor,
      lineWidth: 1,
      lineStyle: 2,
      priceScaleId: indicatorScaleId,
    });

    chart.priceScale(indicatorScaleId).applyOptions({ visible: false });

    const candleChartData: CandlestickData[] = candles.map((c) => ({
      time: toChartTime(c.timestamp),
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    candleSeries.setData(candleChartData);

    const sma20Data: LineData[] = [];
    const sma50Data: LineData[] = [];
    const ema200Data: LineData[] = [];
    const bbUpperData: LineData[] = [];
    const bbLowerData: LineData[] = [];

    for (const c of candles) {
      const time = toChartTime(c.timestamp);
      if (c.features?.sma20 != null)
        sma20Data.push({ time, value: c.features.sma20 });
      if (c.features?.sma50 != null)
        sma50Data.push({ time, value: c.features.sma50 });
      if (c.features?.ema200 != null)
        ema200Data.push({ time, value: c.features.ema200 });
      if (c.features?.bbUpper != null)
        bbUpperData.push({ time, value: c.features.bbUpper });
      if (c.features?.bbLower != null)
        bbLowerData.push({ time, value: c.features.bbLower });
    }

    sma20Series.setData(sma20Data);
    sma50Series.setData(sma50Data);
    ema200Series.setData(ema200Data);
    bbUpperSeries.setData(bbUpperData);
    bbLowerSeries.setData(bbLowerData);

    if (candles.length > 100) {
      const startIdx = candles.length - 100;
      const from = toChartTime(candles[startIdx].timestamp);
      const to = toChartTime(candles[candles.length - 1].timestamp);
      chart.timeScale().setVisibleRange({ from, to });
    } else {
      chart.timeScale().fitContent();
    }

    chart.subscribeCrosshairMove(() => {});
    chart.subscribeClick((param) => {
      if (!onCandleClick || !param.time) return;
      const timeStr = String(param.time);
      const idx = candles.findIndex(
        (c) => c.timestamp.split("T")[0] === timeStr,
      );
      if (idx !== -1) onCandleClick(candles[idx].timestamp, idx);
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
      candleSeriesRef.current = null;
    };
  }, [candles, colors]);

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

  useEffect(() => {
    if (!candleSeriesRef.current) return;

    const pricelines = candleSeriesRef.current.priceLines?.() ?? [];
    for (const line of pricelines) {
      candleSeriesRef.current.removePriceLine(line);
    }

    if (entryPrice != null) {
      candleSeriesRef.current.createPriceLine({
        price: entryPrice,
        color: "#3b82f6",
        lineWidth: 1,
        lineStyle: 2,
        title: "Entry",
      });
    }
    if (stopLoss != null) {
      candleSeriesRef.current.createPriceLine({
        price: stopLoss,
        color: "#ef4444",
        lineWidth: 1,
        lineStyle: 2,
        title: "Stop",
      });
    }
    if (takeProfit != null) {
      candleSeriesRef.current.createPriceLine({
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
