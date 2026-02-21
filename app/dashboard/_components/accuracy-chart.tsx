"use client";

import { useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AccuracyPoint } from "./types";

type AccuracyChartProps = {
  data: AccuracyPoint[];
};

export function AccuracyChart({ data }: AccuracyChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const padding = { top: 20, right: 20, bottom: 30, left: 50 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const reversed = [...data].reverse();

    ctx.clearRect(0, 0, width, height);

    // Grid
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    for (let pct = 0; pct <= 100; pct += 25) {
      const y = padding.top + ((100 - pct) / 100) * chartH;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();

      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.font = "11px monospace";
      ctx.textAlign = "right";
      ctx.fillText(`${pct}%`, padding.left - 6, y + 4);
    }

    // 55% threshold line
    const threshY = padding.top + ((100 - 55) / 100) * chartH;
    ctx.strokeStyle = "rgba(239,68,68,0.4)";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(padding.left, threshY);
    ctx.lineTo(width - padding.right, threshY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(239,68,68,0.5)";
    ctx.font = "10px monospace";
    ctx.textAlign = "left";
    ctx.fillText("55% retrain", width - padding.right - 70, threshY - 4);

    const drawLine = (
      values: (number | null)[],
      color: string,
      label: string,
    ) => {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      let started = false;

      for (let i = 0; i < values.length; i++) {
        const v = values[i];
        if (v === null) continue;
        const x =
          padding.left + (i / Math.max(values.length - 1, 1)) * chartW;
        const y = padding.top + ((1 - v) * chartH);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      // Legend dot
      const legendY = label === "V1" ? 12 : label === "V2" ? 24 : 36;
      ctx.beginPath();
      ctx.arc(padding.left + 10, legendY, 4, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.font = "11px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(label, padding.left + 20, legendY + 4);
    };

    drawLine(
      reversed.map((d) => d.v1Accuracy),
      "#3b82f6",
      "V1 Win/Loss",
    );
    drawLine(
      reversed.map((d) => d.v2BucketAccuracy),
      "#f59e0b",
      "V2 Bucket",
    );
  }, [data]);

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Accuracy Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            No accuracy snapshots yet
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Model Accuracy Over Time</CardTitle>
      </CardHeader>
      <CardContent>
        <canvas
          ref={canvasRef}
          className="w-full"
          style={{ height: "250px" }}
        />
      </CardContent>
    </Card>
  );
}
