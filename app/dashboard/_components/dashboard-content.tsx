"use client";

import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "./stat-card";
import { SignalsTable } from "./signals-table";
import { EquityChart } from "./equity-chart";
import { AccuracyChart } from "./accuracy-chart";
import { BreakdownTable } from "./breakdown-table";
import type { DashboardData, PerformanceStats } from "./types";

function formatStats(stats: PerformanceStats) {
  return {
    winRate:
      stats.winRate !== null ? `${(stats.winRate * 100).toFixed(1)}%` : "—",
    totalR: `${stats.totalR >= 0 ? "+" : ""}${stats.totalR.toFixed(2)}R`,
    avgR: stats.avgR !== null ? `${stats.avgR.toFixed(2)}R` : "—",
    profitFactor:
      stats.profitFactor !== null ? stats.profitFactor.toFixed(2) : "—",
    record: `${stats.wins}W / ${stats.losses}L`,
  };
}

export function DashboardContent() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [signalFilter, setSignalFilter] = useState("all");
  const [statsPeriod, setStatsPeriod] = useState<"week" | "month" | "all">(
    "all",
  );

  const fetchData = async () => {
    setLoading(true);
    const res = await fetch("/api/dashboard");
    const json = await res.json();
    setData(json);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60_000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Loading dashboard...
      </div>
    );
  }

  if (!data) return null;

  const activeStats =
    statsPeriod === "week"
      ? data.weekStats
      : statsPeriod === "month"
        ? data.monthStats
        : data.allTimeStats;
  const stats = formatStats(activeStats);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Trading Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            Paper trading performance — Phase 9B
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-green-500 border-green-500/30">
            {data.overview.openSignals} open
          </Badge>
          <Badge variant="outline">
            {data.overview.resolvedSignals} resolved
          </Badge>
          <Button variant="outline" size="sm" onClick={fetchData}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Period selector */}
      <div className="flex gap-1">
        {(["week", "month", "all"] as const).map((p) => (
          <Button
            key={p}
            variant={statsPeriod === p ? "default" : "ghost"}
            size="sm"
            onClick={() => setStatsPeriod(p)}
          >
            {p === "week" ? "This Week" : p === "month" ? "30 Days" : "All Time"}
          </Button>
        ))}
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard
          title="Win Rate"
          value={stats.winRate}
          subtitle={stats.record}
          trend={
            activeStats.winRate !== null
              ? activeStats.winRate >= 0.55
                ? "up"
                : activeStats.winRate < 0.45
                  ? "down"
                  : "neutral"
              : "neutral"
          }
        />
        <StatCard
          title="Total R"
          value={stats.totalR}
          trend={activeStats.totalR >= 0 ? "up" : "down"}
        />
        <StatCard
          title="Avg R/Trade"
          value={stats.avgR}
          trend={
            activeStats.avgR !== null
              ? activeStats.avgR > 0
                ? "up"
                : "down"
              : "neutral"
          }
        />
        <StatCard
          title="Profit Factor"
          value={stats.profitFactor}
          trend={
            activeStats.profitFactor !== null
              ? activeStats.profitFactor >= 1.5
                ? "up"
                : activeStats.profitFactor < 1.0
                  ? "down"
                  : "neutral"
              : "neutral"
          }
        />
        <StatCard
          title="Total Signals"
          value={String(data.overview.totalSignals)}
          subtitle={`${activeStats.total} resolved in period`}
        />
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-4">
        <EquityChart data={data.equityCurve} />
        <AccuracyChart data={data.accuracySnapshots} />
      </div>

      {/* Tabs: Signals / Breakdowns / Models */}
      <Tabs defaultValue="signals">
        <TabsList>
          <TabsTrigger value="signals">Signals</TabsTrigger>
          <TabsTrigger value="breakdowns">Breakdowns</TabsTrigger>
          <TabsTrigger value="models">Models</TabsTrigger>
        </TabsList>

        <TabsContent value="signals" className="mt-4 space-y-3">
          <div className="flex gap-1">
            {["all", "open", "resolved", "expired"].map((f) => (
              <Button
                key={f}
                variant={signalFilter === f ? "default" : "ghost"}
                size="sm"
                onClick={() => setSignalFilter(f)}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Button>
            ))}
          </div>
          <SignalsTable signals={data.signals} filter={signalFilter} />
        </TabsContent>

        <TabsContent value="breakdowns" className="mt-4">
          <div className="grid md:grid-cols-3 gap-4">
            <BreakdownTable
              title="By Pattern"
              data={data.breakdowns.byPattern}
            />
            <BreakdownTable
              title="By Timeframe"
              data={data.breakdowns.byTimeframe}
            />
            <BreakdownTable title="By Pair" data={data.breakdowns.byPair} />
          </div>
        </TabsContent>

        <TabsContent value="models" className="mt-4 space-y-4">
          {data.modelVersions.map((m) => (
            <div
              key={m.version}
              className="flex items-center justify-between p-4 rounded-lg border"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold">{m.version}</span>
                  {m.isActive && (
                    <Badge className="bg-green-600 text-white hover:bg-green-600">
                      Active
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Trained{" "}
                  {new Date(m.trainedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}{" "}
                  on {m.trainingSize.toLocaleString()} samples
                </p>
              </div>
              <div className="flex gap-6 text-sm">
                {m.v1Auc !== null && (
                  <div className="text-center">
                    <div className="text-muted-foreground text-xs">V1 AUC</div>
                    <div className="font-mono">{m.v1Auc.toFixed(3)}</div>
                  </div>
                )}
                {m.v3R2 !== null && (
                  <div className="text-center">
                    <div className="text-muted-foreground text-xs">V3 R²</div>
                    <div className="font-mono">{m.v3R2.toFixed(3)}</div>
                  </div>
                )}
                {m.v3Mae !== null && (
                  <div className="text-center">
                    <div className="text-muted-foreground text-xs">V3 MAE</div>
                    <div className="font-mono">{m.v3Mae.toFixed(3)}R</div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
