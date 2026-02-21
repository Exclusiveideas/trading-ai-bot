"use client";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DashboardSignal } from "./types";

type SignalsTableProps = {
  signals: DashboardSignal[];
  filter: string;
};

function statusBadge(status: string, outcome: string | null) {
  if (status === "open") return <Badge variant="outline">Open</Badge>;
  if (status === "expired") return <Badge variant="secondary">Expired</Badge>;
  if (outcome === "win")
    return (
      <Badge className="bg-green-600 text-white hover:bg-green-600">Win</Badge>
    );
  return (
    <Badge className="bg-red-600 text-white hover:bg-red-600">Loss</Badge>
  );
}

export function SignalsTable({ signals, filter }: SignalsTableProps) {
  const filtered =
    filter === "all"
      ? signals
      : signals.filter((s) => s.status === filter);

  return (
    <div className="rounded-md border overflow-auto max-h-[600px]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[60px]">ID</TableHead>
            <TableHead>Pair</TableHead>
            <TableHead>TF</TableHead>
            <TableHead>Pattern</TableHead>
            <TableHead>Dir</TableHead>
            <TableHead>Quality</TableHead>
            <TableHead>Win%</TableHead>
            <TableHead>MFE Bucket</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>R Multiple</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 ? (
            <TableRow>
              <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                No signals found
              </TableCell>
            </TableRow>
          ) : (
            filtered.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-mono text-xs">{s.id}</TableCell>
                <TableCell className="font-medium">{s.pair}</TableCell>
                <TableCell>{s.timeframe}</TableCell>
                <TableCell className="text-xs">
                  {s.patternType.replace(/_/g, " ")}
                </TableCell>
                <TableCell>
                  <span
                    className={
                      s.direction === "bullish"
                        ? "text-green-500"
                        : "text-red-500"
                    }
                  >
                    {s.direction === "bullish" ? "LONG" : "SHORT"}
                  </span>
                </TableCell>
                <TableCell>{s.qualityRating}/10</TableCell>
                <TableCell>
                  {s.v1WinProb !== null
                    ? `${(s.v1WinProb * 100).toFixed(0)}%`
                    : "—"}
                </TableCell>
                <TableCell>{s.v2MfeBucket ?? "—"}</TableCell>
                <TableCell>{statusBadge(s.status, s.outcome)}</TableCell>
                <TableCell
                  className={
                    s.rMultiple !== null
                      ? s.rMultiple >= 0
                        ? "text-green-500 font-medium"
                        : "text-red-500 font-medium"
                      : "text-muted-foreground"
                  }
                >
                  {s.rMultiple !== null
                    ? `${s.rMultiple >= 0 ? "+" : ""}${s.rMultiple.toFixed(2)}R`
                    : "—"}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(s.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
