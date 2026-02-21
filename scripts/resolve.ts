import "dotenv/config";
import { prisma } from "../lib/prisma";
import {
  resolveOpenSignals,
  timeframesToCheck,
} from "../lib/resolver/resolve-signals";
import { computeAndSaveAccuracy } from "../lib/resolver/accuracy-tracker";
import { shouldRetrain, triggerRetrain } from "../lib/resolver/retrain-trigger";
import { sendTelegramMessage } from "../lib/scanner/telegram";

const FASTAPI_URL = process.env.FASTAPI_URL ?? "http://localhost:8000";

async function main(): Promise<void> {
  const now = new Date();
  console.log(`\n=== Resolver run at ${now.toISOString()} ===\n`);

  const tfs = timeframesToCheck(now);
  console.log(`Timeframes to check: ${tfs.join(", ")}`);

  const summary = await resolveOpenSignals(prisma, tfs);

  console.log(
    `\nResolution summary: ${summary.resolved} resolved, ${summary.expired} expired, ${summary.stillOpen} still open, ${summary.errors} errors`,
  );

  if (summary.resolved > 0) {
    const accuracy = await computeAndSaveAccuracy(prisma);

    if (accuracy) {
      console.log(
        `Accuracy (last ${accuracy.windowSize}): V1=${accuracy.v1Accuracy !== null ? (accuracy.v1Accuracy * 100).toFixed(1) + "%" : "N/A"}, V2=${accuracy.v2BucketAccuracy !== null ? (accuracy.v2BucketAccuracy * 100).toFixed(1) + "%" : "N/A"}, V3 MAE=${accuracy.v3MaeLive?.toFixed(3) ?? "N/A"}R`,
      );
    }

    const decision = await shouldRetrain(prisma);
    if (decision.shouldRetrain) {
      console.log(`\nRetrain triggered: ${decision.reason}`);
      try {
        const result = await triggerRetrain(FASTAPI_URL);
        console.log(
          `Retrain complete: version ${result.version}, training size ${result.trainingSize}`,
        );
      } catch (err) {
        console.error(
          "Retrain failed:",
          err instanceof Error ? err.message : err,
        );
      }
    }

    await sendResolutionSummary(summary, accuracy);
  }

  console.log("\n=== Resolver done ===\n");
}

type AccuracyInfo = {
  windowSize: number;
  v1Accuracy: number | null;
  v2BucketAccuracy: number | null;
  v3MaeLive: number | null;
} | null;

async function sendResolutionSummary(
  summary: { resolved: number; expired: number; stillOpen: number },
  accuracy: AccuracyInfo,
): Promise<void> {
  const lines = [
    "📊 *Signal Resolution Update*",
    "",
    `Resolved: ${summary.resolved} | Expired: ${summary.expired} | Open: ${summary.stillOpen}`,
  ];

  if (accuracy) {
    lines.push("");
    lines.push(
      `Model accuracy (last ${accuracy.windowSize}):`,
    );
    if (accuracy.v1Accuracy !== null) {
      lines.push(
        `  V1 Win/Loss: ${(accuracy.v1Accuracy * 100).toFixed(1)}%`,
      );
    }
    if (accuracy.v2BucketAccuracy !== null) {
      lines.push(
        `  V2 Bucket: ${(accuracy.v2BucketAccuracy * 100).toFixed(1)}%`,
      );
    }
    if (accuracy.v3MaeLive !== null) {
      lines.push(`  V3 MAE: ${accuracy.v3MaeLive.toFixed(3)}R`);
    }
  }

  await sendTelegramMessage(lines.join("\n"));
}

main()
  .catch((err) => {
    console.error("Resolver failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
