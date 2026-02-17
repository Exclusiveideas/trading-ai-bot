"use client";

import { useState } from "react";

interface StatusResult {
  success: boolean;
  message: string;
  [key: string]: unknown;
}

function StatusCard({
  title,
  endpoint,
  description,
}: {
  title: string;
  endpoint: string;
  description: string;
}) {
  const [status, setStatus] = useState<StatusResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function testConnection() {
    setLoading(true);
    try {
      const res = await fetch(endpoint);
      const data = await res.json();
      setStatus(data);
    } catch {
      setStatus({ success: false, message: "Failed to reach endpoint" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        {title}
      </h2>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        {description}
      </p>
      <button
        onClick={testConnection}
        disabled={loading}
        className="mt-4 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {loading ? "Testing..." : "Test Connection"}
      </button>
      {status && (
        <div
          className={`mt-4 rounded-md p-3 text-sm ${
            status.success
              ? "bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400"
              : "bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400"
          }`}
        >
          <span className="font-medium">
            {status.success ? "Connected" : "Failed"}:
          </span>{" "}
          {status.message}
        </div>
      )}
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          Trading AI
        </h1>
        <p className="mt-2 text-zinc-500 dark:text-zinc-400">
          Context-aware ML trading system — Phase 1 Setup
        </p>

        <div className="mt-10 space-y-6">
          <StatusCard
            title="Supabase Database"
            endpoint="/api/test-db"
            description="PostgreSQL database for candles, features, and labeled patterns."
          />
          <StatusCard
            title="Twelve Data API"
            endpoint="/api/test-api"
            description="Historical OHLCV data for EUR/USD, GBP/USD, and more."
          />
        </div>

        <div className="mt-10 rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Setup Checklist
          </h2>
          <ul className="mt-4 space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
            <li>1. Create a Supabase project and add URL + service role key to .env.local</li>
            <li>2. Run scripts/setup-tables.sql in the Supabase SQL Editor</li>
            <li>3. Sign up at twelvedata.com and add your API key to .env.local</li>
            <li>4. Click &quot;Test Connection&quot; above to verify both are working</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
