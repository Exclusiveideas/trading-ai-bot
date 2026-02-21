"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BreakdownEntry } from "./types";

type BreakdownTableProps = {
  title: string;
  data: Record<string, BreakdownEntry>;
};

export function BreakdownTable({ title, data }: BreakdownTableProps) {
  const entries = Object.entries(data).sort(
    ([, a], [, b]) => b.totalR - a.totalR,
  );

  if (entries.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Win Rate</TableHead>
              <TableHead>W/L</TableHead>
              <TableHead>Total R</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map(([key, entry]) => {
              const total = entry.wins + entry.losses;
              const wr = total > 0 ? (entry.wins / total) * 100 : 0;
              return (
                <TableRow key={key}>
                  <TableCell className="font-medium">
                    {key.replace(/_/g, " ")}
                  </TableCell>
                  <TableCell>{wr.toFixed(0)}%</TableCell>
                  <TableCell>
                    {entry.wins}W / {entry.losses}L
                  </TableCell>
                  <TableCell
                    className={
                      entry.totalR >= 0
                        ? "text-green-500 font-medium"
                        : "text-red-500 font-medium"
                    }
                  >
                    {entry.totalR >= 0 ? "+" : ""}
                    {entry.totalR.toFixed(1)}R
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
