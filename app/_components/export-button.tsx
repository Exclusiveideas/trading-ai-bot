"use client";

import { useState } from "react";

type ExportButtonProps = {
  pair: string;
};

export function ExportButton({ pair }: ExportButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const res = await fetch(`/api/export?pair=${encodeURIComponent(pair)}`);
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Export failed");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `labeled-patterns-${pair.replace("/", "-")}-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="rounded-md bg-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-300 disabled:opacity-50 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600"
    >
      {loading ? "Exporting..." : "Export CSV"}
    </button>
  );
}
