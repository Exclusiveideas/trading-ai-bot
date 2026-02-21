"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "sonner";

type ExportButtonProps = {
  pair: string;
};

export function ExportButton({ pair }: ExportButtonProps) {
  const [loading, setLoading] = useState(false);

  async function downloadCsv(url: string, filename: string) {
    const res = await fetch(url);
    if (!res.ok) {
      const data = await res.json();
      toast.error(data.error || "Export failed");
      return;
    }
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(blobUrl);
  }

  async function handleExportPair() {
    setLoading(true);
    try {
      const date = new Date().toISOString().split("T")[0];
      await downloadCsv(
        `/api/export?pair=${encodeURIComponent(pair)}`,
        `training-${pair.replace("/", "-")}-${date}.csv`,
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleExportAll() {
    setLoading(true);
    try {
      const date = new Date().toISOString().split("T")[0];
      await downloadCsv(`/api/export`, `training-all-${date}.csv`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="outline"
        size="sm"
        onClick={handleExportPair}
        disabled={loading}
      >
        <Download className="mr-1.5 h-3.5 w-3.5" />
        {loading ? "Exporting..." : "Export"}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleExportAll}
        disabled={loading}
      >
        <Download className="mr-1.5 h-3.5 w-3.5" />
        {loading ? "Exporting..." : "Export All"}
      </Button>
    </div>
  );
}
