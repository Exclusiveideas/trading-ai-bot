import "dotenv/config";
import { prisma } from "../lib/prisma";
import { fetchLatestCandles } from "../lib/oanda";
import { calculateAllIndicators } from "../lib/pipeline/indicators";
import type { IndicatorRow } from "../lib/pipeline/indicators";
import {
  detectSupportResistanceLevels,
  findNearestLevels,
  distanceInPips,
  distanceInAtr,
  classifyTrendState,
  identifyTradingSession,
  findNearestRoundNumber,
} from "../lib/pipeline/context-features";
import { findAllCandidates } from "../lib/pipeline/patterns/candidate-finder";
import type { EnrichedDetectorCandle } from "../lib/pipeline/patterns/candidate-finder";
import { analyzeCandidate } from "../lib/pipeline/pattern-analyzer";
import type { AnalysisCandle } from "../lib/pipeline/pattern-analyzer";
import {
  buildFeatureVector,
  type HtfSnapshot,
} from "../lib/scanner/feature-vector";
import { sendTelegramAlert, isTelegramConfigured } from "../lib/scanner/telegram";
import {
  FOREX_PAIRS,
  TIMEFRAMES,
  type OandaGranularity,
  type TrendState,
  type Candle,
  type PatternCandidate,
} from "../types/trading";

const FASTAPI_URL = process.env.FASTAPI_URL ?? "http://localhost:8000";
const QUALITY_THRESHOLD = 5;
const WIN_PROB_THRESHOLD = 0.55;
const RECENT_CANDLES = 3;

type PredictionResponse = {
  v1_win_prob: number;
  v2_mfe_bucket: string;
  v2_bucket_probs: Record<string, number>;
  v3_mfe_prediction: number;
};

type ScanCandidate = {
  candidate: PatternCandidate;
  candle: Candle;
  startCandle: Candle;
  indicators: IndicatorRow;
  context: {
    distToSupportPips: number | null;
    distToResistancePips: number | null;
    distToSupportAtr: number | null;
    distToResistanceAtr: number | null;
    distToRoundNumberPips: number | null;
    trendState: TrendState | null;
    tradingSession: string | null;
  };
  timeframe: OandaGranularity;
  qualityRating: number;
  notes: string;
};

async function fetchPredictions(
  featureVectors: Record<string, number | null>[],
): Promise<PredictionResponse[]> {
  const response = await fetch(`${FASTAPI_URL}/predict/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items: featureVectors }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`FastAPI error ${response.status}: ${text}`);
  }

  return response.json();
}

function buildEnrichedCandles(
  candles: Candle[],
  indicators: IndicatorRow[],
  srLevels: number[],
): { enriched: EnrichedDetectorCandle[]; analysis: AnalysisCandle[] } {
  const enriched: EnrichedDetectorCandle[] = [];
  const analysis: AnalysisCandle[] = [];

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const ind = indicators[i];
    const { support, resistance } = findNearestLevels(c.close, srLevels);
    const trendState = classifyTrendState(
      ind.sma20,
      ind.sma50,
      ind.ema200,
      ind.adx,
      c.close,
    );

    enriched.push({
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      atr: ind.atr,
      volume: c.volume,
      volumeSma: ind.volumeSma,
      timestamp: c.timestamp,
      trendState,
      nearestSupport: support,
      nearestResistance: resistance,
      rsi: ind.rsi,
      adx: ind.adx,
    });

    analysis.push({
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
      atr: ind.atr,
      volumeSma: ind.volumeSma,
      sma20: ind.sma20,
      sma50: ind.sma50,
      ema200: ind.ema200,
      rsi: ind.rsi,
      macd: ind.macd,
      macdSignal: ind.macdSignal,
      macdHistogram: ind.macdHistogram,
      adx: ind.adx,
      bbUpper: ind.bbUpper,
      bbLower: ind.bbLower,
      trendState,
      nearestSupport: support,
      nearestResistance: resistance,
    });
  }

  return { enriched, analysis };
}

function extractHtfSnapshot(
  candles: Candle[],
  indicators: IndicatorRow[],
  srLevels: number[],
): HtfSnapshot | null {
  if (candles.length === 0) return null;

  const lastIdx = candles.length - 1;
  const c = candles[lastIdx];
  const ind = indicators[lastIdx];
  const trendState = classifyTrendState(
    ind.sma20,
    ind.sma50,
    ind.ema200,
    ind.adx,
    c.close,
  );

  return {
    rsi: ind.rsi,
    adx: ind.adx,
    macdHistogram: ind.macdHistogram,
    close: c.close,
    sma20: ind.sma20,
    sma50: ind.sma50,
    ema200: ind.ema200,
    bbUpper: ind.bbUpper,
    bbLower: ind.bbLower,
    atr: ind.atr,
    trendState,
  };
}

async function scanPairTimeframe(
  pair: string,
  tf: OandaGranularity,
  htfContexts: Record<string, HtfSnapshot | null>,
): Promise<ScanCandidate[]> {
  const candles = await fetchLatestCandles(pair, tf, 300);
  if (candles.length < 50) {
    console.log(`  ${pair} ${tf}: Only ${candles.length} candles, skipping`);
    return [];
  }

  const indicators = calculateAllIndicators(candles);
  const srLevels = detectSupportResistanceLevels(candles, 100);
  const { enriched, analysis } = buildEnrichedCandles(
    candles,
    indicators,
    srLevels,
  );

  // Cache HTF snapshot for lower timeframes
  const tfKey = tf.toLowerCase();
  htfContexts[tfKey] = extractHtfSnapshot(candles, indicators, srLevels);

  const candidates = findAllCandidates(enriched, pair, { maxCandidates: 100 });

  // Filter to recent patterns only (endIndex within last N candles)
  const minEndIndex = candles.length - RECENT_CANDLES;
  const recentCandidates = candidates.filter(
    (c) => c.endIndex >= minEndIndex,
  );

  if (recentCandidates.length === 0) return [];

  const results: ScanCandidate[] = [];

  for (const candidate of recentCandidates) {
    // analyzeCandidate needs an outcome — use a dummy pending outcome for live scanning
    const candidateWithOutcome = {
      ...candidate,
      outcome: {
        outcome: "pending" as const,
        rMultiple: null,
        barsToOutcome: null,
        exitPrice: null,
        maxFavorableExcursion: null,
      },
    };

    const result = analyzeCandidate(candidateWithOutcome, analysis);
    if (!result.approved || result.qualityRating < QUALITY_THRESHOLD) continue;

    const endIdx = candidate.endIndex;
    const endCandle = candles[endIdx];
    const endIndicators = indicators[endIdx];
    const { support, resistance } = findNearestLevels(
      endCandle.close,
      srLevels,
    );
    const trendState = classifyTrendState(
      endIndicators.sma20,
      endIndicators.sma50,
      endIndicators.ema200,
      endIndicators.adx,
      endCandle.close,
    );
    const session = identifyTradingSession(
      new Date(endCandle.timestamp),
      tf,
    );
    const roundNum = findNearestRoundNumber(endCandle.close);

    const context = {
      distToSupportPips:
        support != null ? distanceInPips(endCandle.close, support, pair) : null,
      distToResistancePips:
        resistance != null
          ? distanceInPips(endCandle.close, resistance, pair)
          : null,
      distToSupportAtr:
        support != null
          ? distanceInAtr(endCandle.close, support, endIndicators.atr)
          : null,
      distToResistanceAtr:
        resistance != null
          ? distanceInAtr(endCandle.close, resistance, endIndicators.atr)
          : null,
      distToRoundNumberPips: distanceInPips(endCandle.close, roundNum, pair),
      trendState,
      tradingSession: session,
    };

    results.push({
      candidate,
      candle: endCandle,
      startCandle: candles[candidate.startIndex],
      indicators: endIndicators,
      context,
      timeframe: tf,
      qualityRating: result.qualityRating,
      notes: result.notes,
    });
  }

  return results;
}

async function main(): Promise<void> {
  console.log(`\n=== Scanner run at ${new Date().toISOString()} ===\n`);

  // Health check FastAPI
  try {
    const healthRes = await fetch(`${FASTAPI_URL}/health`);
    if (!healthRes.ok) throw new Error(`Status ${healthRes.status}`);
    const health = await healthRes.json();
    console.log(
      `FastAPI: ${health.status}, ${health.models_loaded} models, ${health.n_features} features`,
    );
  } catch (err) {
    console.error(
      `FastAPI not reachable at ${FASTAPI_URL}:`,
      err instanceof Error ? err.message : err,
    );
    process.exit(1);
  }

  const telegramReady = isTelegramConfigured();
  console.log(`Telegram: ${telegramReady ? "configured" : "not configured (skipping alerts)"}`);

  let totalSignals = 0;
  let totalAlerts = 0;

  for (const pair of FOREX_PAIRS) {
    console.log(`\nScanning ${pair}...`);
    const htfContexts: Record<string, HtfSnapshot | null> = {};
    const allCandidates: ScanCandidate[] = [];

    // Process timeframes in order: D → H4 → H1 → M15
    // so HTF snapshots are available for lower timeframes
    for (const tf of TIMEFRAMES) {
      try {
        const candidates = await scanPairTimeframe(pair, tf, htfContexts);
        if (candidates.length > 0) {
          console.log(`  ${tf}: ${candidates.length} candidate(s)`);
          allCandidates.push(...candidates);
        }
      } catch (err) {
        console.error(
          `  ${tf}: Error -`,
          err instanceof Error ? err.message : err,
        );
      }
    }

    if (allCandidates.length === 0) continue;

    // Build feature vectors
    const featureVectors = allCandidates.map((sc) =>
      buildFeatureVector(
        sc.candidate,
        sc.candle,
        sc.indicators,
        sc.context,
        sc.timeframe,
        htfContexts,
      ),
    );

    // Get predictions from FastAPI
    let predictions: PredictionResponse[];
    try {
      predictions = await fetchPredictions(featureVectors);
    } catch (err) {
      console.error(
        `  Prediction error:`,
        err instanceof Error ? err.message : err,
      );
      continue;
    }

    // Process each candidate + prediction
    for (let i = 0; i < allCandidates.length; i++) {
      const sc = allCandidates[i];
      const pred = predictions[i];
      const { candidate } = sc;

      // Filter by threshold
      const meetsThreshold =
        pred.v1_win_prob >= WIN_PROB_THRESHOLD ||
        ["1-1.5R", "1.5-2R", "2R+"].includes(pred.v2_mfe_bucket);

      if (!meetsThreshold) {
        console.log(
          `  Skip ${candidate.patternType} ${sc.timeframe}: win=${(pred.v1_win_prob * 100).toFixed(0)}%, bucket=${pred.v2_mfe_bucket}`,
        );
        continue;
      }

      const isBullish =
        candidate.keyPriceLevels.takeProfit > candidate.keyPriceLevels.entry;
      const direction = isBullish ? "bullish" : "bearish";

      // Upsert into signals table (dedup on unique constraint)
      try {
        const signal = await prisma.signal.upsert({
          where: {
            pair_timeframe_patternType_patternEnd: {
              pair,
              timeframe: sc.timeframe,
              patternType: candidate.patternType,
              patternEnd: new Date(sc.candle.timestamp),
            },
          },
          update: {},
          create: {
            pair,
            timeframe: sc.timeframe,
            patternType: candidate.patternType,
            direction,
            entryPrice: candidate.keyPriceLevels.entry,
            stopLoss: candidate.keyPriceLevels.stopLoss,
            takeProfit: candidate.keyPriceLevels.takeProfit,
            patternStart: new Date(sc.startCandle.timestamp),
            patternEnd: new Date(sc.candle.timestamp),
            qualityRating: sc.qualityRating,
            confidence: candidate.confidence,
            v1WinProb: pred.v1_win_prob,
            v2MfeBucket: pred.v2_mfe_bucket,
            v2BucketProbs: pred.v2_bucket_probs,
            v3MfePrediction: pred.v3_mfe_prediction,
            featureVector: featureVectors[i] as unknown as Record<string, number>,
          },
        });

        totalSignals++;

        // Send alert only for newly created signals (not duplicates)
        if (!signal.alertSent) {
          const sent = await sendTelegramAlert({
            pair,
            timeframe: sc.timeframe,
            patternType: candidate.patternType,
            direction,
            entryPrice: candidate.keyPriceLevels.entry,
            stopLoss: candidate.keyPriceLevels.stopLoss,
            takeProfit: candidate.keyPriceLevels.takeProfit,
            qualityRating: sc.qualityRating,
            v1WinProb: pred.v1_win_prob,
            v2MfeBucket: pred.v2_mfe_bucket,
            v3MfePrediction: pred.v3_mfe_prediction,
          });

          if (sent) {
            await prisma.signal.update({
              where: { id: signal.id },
              data: { alertSent: true, alertSentAt: new Date() },
            });
            totalAlerts++;
            console.log(
              `  ALERT: ${candidate.patternType} ${sc.timeframe} (win=${(pred.v1_win_prob * 100).toFixed(0)}%, bucket=${pred.v2_mfe_bucket})`,
            );
          }
        } else {
          console.log(
            `  Duplicate: ${candidate.patternType} ${sc.timeframe} (already alerted)`,
          );
        }
      } catch (err) {
        // Unique constraint violation = duplicate, safe to ignore
        if (
          err instanceof Error &&
          err.message.includes("Unique constraint")
        ) {
          console.log(
            `  Duplicate: ${candidate.patternType} ${sc.timeframe}`,
          );
        } else {
          console.error(
            `  DB error:`,
            err instanceof Error ? err.message : err,
          );
        }
      }
    }
  }

  console.log(
    `\n=== Done: ${totalSignals} signals, ${totalAlerts} alerts sent ===\n`,
  );
}

main()
  .catch((err) => {
    console.error("Scanner failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
