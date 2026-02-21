import "dotenv/config";
import pg from "pg";

const BATCH_SIZE = 5000;

const supabaseUrl = process.env.SUPABASE_DIRECT_URL;
const localUrl = process.env.DATABASE_URL;

if (!supabaseUrl) throw new Error("Missing SUPABASE_DIRECT_URL");
if (!localUrl) throw new Error("Missing DATABASE_URL");

async function transferTable(
  tableName: string,
  columns: string[],
  source: pg.Client,
  dest: pg.Client,
) {
  const countResult = await source.query(
    `SELECT count(*) as total FROM ${tableName}`,
  );
  const total = parseInt(countResult.rows[0].total);

  // Check how many already exist in dest (for resume)
  const destCount = await dest.query(
    `SELECT count(*) as total FROM ${tableName}`,
  );
  const alreadyTransferred = parseInt(destCount.rows[0].total);

  // Get the max id already in dest for cursor-based resume
  const maxIdResult = await dest.query(
    `SELECT COALESCE(MAX(id), 0) as max_id FROM ${tableName}`,
  );
  let lastId = parseInt(maxIdResult.rows[0].max_id);

  console.log(
    `\n--- ${tableName}: ${total} rows (${alreadyTransferred} already transferred, resuming from id ${lastId}) ---`,
  );

  if (total === 0) return;
  if (alreadyTransferred >= total) {
    console.log(`  Already complete, skipping.`);
    return;
  }

  let inserted = alreadyTransferred;

  while (true) {
    // Cursor-based pagination: WHERE id > lastId instead of OFFSET
    const result = await source.query(
      `SELECT ${columns.join(", ")} FROM ${tableName} WHERE id > $1 ORDER BY id LIMIT ${BATCH_SIZE}`,
      [lastId],
    );

    if (result.rows.length === 0) break;

    const placeholders = result.rows
      .map(
        (_, rowIdx) =>
          `(${columns.map((_, colIdx) => `$${rowIdx * columns.length + colIdx + 1}`).join(", ")})`,
      )
      .join(", ");

    const values = result.rows.flatMap((row) =>
      columns.map((col) => row[col]),
    );

    await dest.query(
      `INSERT INTO ${tableName} (${columns.join(", ")}) VALUES ${placeholders} ON CONFLICT DO NOTHING`,
      values,
    );

    inserted += result.rows.length;
    lastId = result.rows[result.rows.length - 1].id;
    process.stdout.write(
      `\r  Transferred ${inserted}/${total} (${((inserted / total) * 100).toFixed(1)}%)`,
    );
  }

  // Reset sequence to max id
  await dest.query(
    `SELECT setval(pg_get_serial_sequence('${tableName}', 'id'), COALESCE((SELECT MAX(id) FROM ${tableName}), 1))`,
  );

  console.log(`\n  Done: ${inserted} rows`);
}

async function main() {
  console.log(
    "=== Transferring data from Supabase to local PostgreSQL ===\n",
  );

  const source = new pg.Client({
    connectionString: supabaseUrl,
    statement_timeout: 60000,
    query_timeout: 60000,
  });
  const dest = new pg.Client({ connectionString: localUrl });

  await source.connect();
  console.log("Connected to Supabase");
  await dest.connect();
  console.log("Connected to local PostgreSQL");

  await transferTable(
    "raw_candles",
    [
      "id",
      "pair",
      "timestamp",
      "open",
      "high",
      "low",
      "close",
      "volume",
      "timeframe",
      "created_at",
    ],
    source,
    dest,
  );

  await transferTable(
    "labeled_patterns",
    [
      "id",
      "pair",
      "pattern_type",
      "start_timestamp",
      "end_timestamp",
      "entry_price",
      "stop_loss",
      "take_profit",
      "outcome",
      "r_multiple",
      "bars_to_outcome",
      "max_favorable_excursion",
      "quality_rating",
      "trend_state",
      "session",
      "support_quality",
      "notes",
      "context_json",
      "timeframe",
      "created_at",
    ],
    source,
    dest,
  );

  await source.end();
  await dest.end();

  console.log("\n=== Transfer complete ===");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
