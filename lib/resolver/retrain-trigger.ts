import type { PrismaClient } from "../generated/prisma/client";
import { computeAccuracyMetrics } from "./accuracy-tracker";

const V1_ACCURACY_THRESHOLD = 0.55;
const MIN_SAMPLE_SIZE = 100;
const NEW_SIGNALS_THRESHOLD = 500;

export type RetrainDecision = {
  shouldRetrain: boolean;
  reason: string | null;
  currentV1Accuracy: number | null;
  resolvedSinceLastRetrain: number;
};

export type RetrainResult = {
  version: string;
  trainingSize: number;
  v1Auc: number;
  v2Accuracy: number;
  v3R2: number;
  v3Mae: number;
};

export async function shouldRetrain(
  db: PrismaClient,
): Promise<RetrainDecision> {
  const activeVersion = await db.modelVersion.findFirst({
    where: { isActive: true },
    orderBy: { trainedAt: "desc" },
  });

  const sinceDate = activeVersion?.trainedAt ?? new Date(0);

  const resolvedSinceRetrain = await db.signal.count({
    where: {
      status: "resolved",
      resolvedAt: { gt: sinceDate },
    },
  });

  if (resolvedSinceRetrain >= NEW_SIGNALS_THRESHOLD) {
    return {
      shouldRetrain: true,
      reason: `${resolvedSinceRetrain} resolved signals since last retrain (threshold: ${NEW_SIGNALS_THRESHOLD})`,
      currentV1Accuracy: null,
      resolvedSinceLastRetrain: resolvedSinceRetrain,
    };
  }

  const recentSignals = await db.signal.findMany({
    where: { status: "resolved" },
    orderBy: { resolvedAt: "desc" },
    take: MIN_SAMPLE_SIZE,
    select: {
      outcome: true,
      v1WinProb: true,
      v2MfeBucket: true,
      v3MfePrediction: true,
      maxFavorableExcursion: true,
    },
  });

  if (recentSignals.length < MIN_SAMPLE_SIZE) {
    return {
      shouldRetrain: false,
      reason: null,
      currentV1Accuracy: null,
      resolvedSinceLastRetrain: resolvedSinceRetrain,
    };
  }

  const metrics = computeAccuracyMetrics(recentSignals);

  if (
    metrics.v1Accuracy !== null &&
    metrics.v1Accuracy < V1_ACCURACY_THRESHOLD
  ) {
    return {
      shouldRetrain: true,
      reason: `V1 accuracy ${(metrics.v1Accuracy * 100).toFixed(1)}% below threshold ${(V1_ACCURACY_THRESHOLD * 100).toFixed(1)}%`,
      currentV1Accuracy: metrics.v1Accuracy,
      resolvedSinceLastRetrain: resolvedSinceRetrain,
    };
  }

  return {
    shouldRetrain: false,
    reason: null,
    currentV1Accuracy: metrics.v1Accuracy,
    resolvedSinceLastRetrain: resolvedSinceRetrain,
  };
}

export async function triggerRetrain(
  fastapiUrl: string,
): Promise<RetrainResult> {
  const response = await fetch(`${fastapiUrl}/retrain`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Retrain failed (${response.status}): ${text}`);
  }

  return response.json();
}
