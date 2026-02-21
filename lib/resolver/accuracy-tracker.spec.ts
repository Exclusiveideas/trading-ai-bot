import { describe, expect, test } from "vitest";
import { computeAccuracyMetrics, computeMfeBucket } from "./accuracy-tracker";

describe(computeMfeBucket, () => {
  test("maps MFE values to correct buckets", () => {
    expect(computeMfeBucket(0)).toBe("<0.5R");
    expect(computeMfeBucket(0.25)).toBe("<0.5R");
    expect(computeMfeBucket(0.49)).toBe("<0.5R");
    expect(computeMfeBucket(0.5)).toBe("0.5-1R");
    expect(computeMfeBucket(0.99)).toBe("0.5-1R");
    expect(computeMfeBucket(1.0)).toBe("1-1.5R");
    expect(computeMfeBucket(1.49)).toBe("1-1.5R");
    expect(computeMfeBucket(1.5)).toBe("1.5-2R");
    expect(computeMfeBucket(1.99)).toBe("1.5-2R");
    expect(computeMfeBucket(2.0)).toBe("2R+");
    expect(computeMfeBucket(5.0)).toBe("2R+");
  });
});

describe(computeAccuracyMetrics, () => {
  test("returns null metrics for empty input", () => {
    const result = computeAccuracyMetrics([]);
    expect(result).toEqual({
      windowSize: 0,
      v1Accuracy: null,
      v2BucketAccuracy: null,
      v3MaeLive: null,
    });
  });

  test("computes V1 accuracy correctly", () => {
    const signals = [
      { outcome: "win", v1WinProb: 0.7, v2MfeBucket: null, v3MfePrediction: null, maxFavorableExcursion: null },
      { outcome: "loss", v1WinProb: 0.3, v2MfeBucket: null, v3MfePrediction: null, maxFavorableExcursion: null },
      { outcome: "win", v1WinProb: 0.4, v2MfeBucket: null, v3MfePrediction: null, maxFavorableExcursion: null },
      { outcome: "loss", v1WinProb: 0.6, v2MfeBucket: null, v3MfePrediction: null, maxFavorableExcursion: null },
    ];
    const result = computeAccuracyMetrics(signals);
    // Correct: signal 0 (win, predicted win), signal 1 (loss, predicted loss)
    // Wrong: signal 2 (win, predicted loss), signal 3 (loss, predicted win)
    expect(result.v1Accuracy).toBe(0.5);
  });

  test("computes V2 bucket accuracy correctly", () => {
    const signals = [
      { outcome: "win", v1WinProb: null, v2MfeBucket: "0.5-1R", v3MfePrediction: null, maxFavorableExcursion: 0.8 },
      { outcome: "loss", v1WinProb: null, v2MfeBucket: "<0.5R", v3MfePrediction: null, maxFavorableExcursion: 0.2 },
      { outcome: "win", v1WinProb: null, v2MfeBucket: "2R+", v3MfePrediction: null, maxFavorableExcursion: 1.5 },
    ];
    const result = computeAccuracyMetrics(signals);
    // Signal 0: predicted "0.5-1R", actual 0.8 → "0.5-1R" ✓
    // Signal 1: predicted "<0.5R", actual 0.2 → "<0.5R" ✓
    // Signal 2: predicted "2R+", actual 1.5 → "1.5-2R" ✗
    expect(result.v2BucketAccuracy).toBeCloseTo(2 / 3, 5);
  });

  test("computes V3 MAE correctly", () => {
    const signals = [
      { outcome: "win", v1WinProb: null, v2MfeBucket: null, v3MfePrediction: 1.5, maxFavorableExcursion: 1.2 },
      { outcome: "win", v1WinProb: null, v2MfeBucket: null, v3MfePrediction: 0.8, maxFavorableExcursion: 1.0 },
    ];
    const result = computeAccuracyMetrics(signals);
    // |1.5 - 1.2| + |0.8 - 1.0| = 0.3 + 0.2 = 0.5, MAE = 0.25
    expect(result.v3MaeLive).toBeCloseTo(0.25, 5);
  });

  test("skips expired signals for V1 accuracy", () => {
    const signals = [
      { outcome: "expired", v1WinProb: 0.7, v2MfeBucket: null, v3MfePrediction: null, maxFavorableExcursion: null },
    ];
    const result = computeAccuracyMetrics(signals);
    expect(result.v1Accuracy).toBeNull();
  });

  test("handles mixed null predictions gracefully", () => {
    const signals = [
      { outcome: "win", v1WinProb: 0.8, v2MfeBucket: "1-1.5R", v3MfePrediction: 1.2, maxFavorableExcursion: 1.3 },
      { outcome: "loss", v1WinProb: null, v2MfeBucket: null, v3MfePrediction: null, maxFavorableExcursion: 0.1 },
    ];
    const result = computeAccuracyMetrics(signals);
    expect(result.windowSize).toBe(2);
    expect(result.v1Accuracy).toBe(1.0);
    expect(result.v2BucketAccuracy).toBe(1.0);
    expect(result.v3MaeLive).toBeCloseTo(0.1, 5);
  });
});
