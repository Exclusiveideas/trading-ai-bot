import type { PrismaClient } from "../generated/prisma/client";

const MFE_BUCKET_EDGES = [0, 0.5, 1.0, 1.5, 2.0, Infinity];
const MFE_BUCKET_LABELS = ["<0.5R", "0.5-1R", "1-1.5R", "1.5-2R", "2R+"];
const DEFAULT_WINDOW_SIZE = 100;

export type AccuracyMetrics = {
  windowSize: number;
  v1Accuracy: number | null;
  v2BucketAccuracy: number | null;
  v3MaeLive: number | null;
};

type ResolvedSignal = {
  outcome: string | null;
  v1WinProb: number | null;
  v2MfeBucket: string | null;
  v3MfePrediction: number | null;
  maxFavorableExcursion: number | null;
};

export function computeMfeBucket(mfe: number): string {
  for (let i = 0; i < MFE_BUCKET_EDGES.length - 1; i++) {
    if (mfe >= MFE_BUCKET_EDGES[i] && mfe < MFE_BUCKET_EDGES[i + 1]) {
      return MFE_BUCKET_LABELS[i];
    }
  }
  return MFE_BUCKET_LABELS[MFE_BUCKET_LABELS.length - 1];
}

export function computeAccuracyMetrics(
  signals: ResolvedSignal[],
): AccuracyMetrics {
  if (signals.length === 0) {
    return {
      windowSize: 0,
      v1Accuracy: null,
      v2BucketAccuracy: null,
      v3MaeLive: null,
    };
  }

  let v1Correct = 0;
  let v1Total = 0;
  let v2Correct = 0;
  let v2Total = 0;
  let v3ErrorSum = 0;
  let v3Total = 0;

  for (const s of signals) {
    const actualWin = s.outcome === "win";

    if (s.v1WinProb !== null && (s.outcome === "win" || s.outcome === "loss")) {
      const predictedWin = s.v1WinProb > 0.5;
      if (predictedWin === actualWin) v1Correct++;
      v1Total++;
    }

    if (
      s.v2MfeBucket !== null &&
      s.maxFavorableExcursion !== null &&
      s.maxFavorableExcursion >= 0
    ) {
      const actualBucket = computeMfeBucket(s.maxFavorableExcursion);
      if (s.v2MfeBucket === actualBucket) v2Correct++;
      v2Total++;
    }

    if (
      s.v3MfePrediction !== null &&
      s.maxFavorableExcursion !== null &&
      s.maxFavorableExcursion >= 0
    ) {
      v3ErrorSum += Math.abs(s.v3MfePrediction - s.maxFavorableExcursion);
      v3Total++;
    }
  }

  return {
    windowSize: signals.length,
    v1Accuracy: v1Total > 0 ? v1Correct / v1Total : null,
    v2BucketAccuracy: v2Total > 0 ? v2Correct / v2Total : null,
    v3MaeLive: v3Total > 0 ? v3ErrorSum / v3Total : null,
  };
}

export async function computeAndSaveAccuracy(
  db: PrismaClient,
  windowSize: number = DEFAULT_WINDOW_SIZE,
): Promise<AccuracyMetrics | null> {
  const resolvedSignals = await db.signal.findMany({
    where: { status: "resolved" },
    orderBy: { resolvedAt: "desc" },
    take: windowSize,
    select: {
      outcome: true,
      v1WinProb: true,
      v2MfeBucket: true,
      v3MfePrediction: true,
      maxFavorableExcursion: true,
      modelVersion: true,
    },
  });

  if (resolvedSignals.length === 0) return null;

  const metrics = computeAccuracyMetrics(resolvedSignals);

  const modelVersion = resolvedSignals[0].modelVersion ?? "v1.0";

  await db.accuracySnapshot.create({
    data: {
      modelVersion,
      windowSize: metrics.windowSize,
      v1Accuracy: metrics.v1Accuracy,
      v2BucketAccuracy: metrics.v2BucketAccuracy,
      v3MaeLive: metrics.v3MaeLive,
      snapshotAt: new Date(),
    },
  });

  return metrics;
}
