export type DashboardSignal = {
  id: number;
  pair: string;
  timeframe: string;
  patternType: string;
  direction: string;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  qualityRating: number;
  v1WinProb: number | null;
  v2MfeBucket: string | null;
  v3MfePrediction: number | null;
  status: string;
  outcome: string | null;
  rMultiple: number | null;
  maxFavorableExcursion: number | null;
  maxAdverseExcursion: number | null;
  barsToOutcome: number | null;
  modelVersion: string | null;
  createdAt: string;
  resolvedAt: string | null;
};

export type PerformanceStats = {
  total: number;
  wins: number;
  losses: number;
  winRate: number | null;
  totalR: number;
  avgR: number | null;
  profitFactor: number | null;
};

export type AccuracyPoint = {
  modelVersion: string;
  windowSize: number;
  v1Accuracy: number | null;
  v2BucketAccuracy: number | null;
  v3MaeLive: number | null;
  snapshotAt: string;
};

export type ModelVersionInfo = {
  version: string;
  trainedAt: string;
  trainingSize: number;
  v1Auc: number | null;
  v2Accuracy: number | null;
  v3R2: number | null;
  v3Mae: number | null;
  isActive: boolean;
};

export type BreakdownEntry = {
  wins: number;
  losses: number;
  totalR: number;
};

export type EquityPoint = {
  date: string;
  equity: number;
  rMultiple: number;
  pair: string;
};

export type DashboardData = {
  overview: {
    totalSignals: number;
    openSignals: number;
    resolvedSignals: number;
  };
  weekStats: PerformanceStats;
  monthStats: PerformanceStats;
  allTimeStats: PerformanceStats;
  signals: DashboardSignal[];
  accuracySnapshots: AccuracyPoint[];
  modelVersions: ModelVersionInfo[];
  breakdowns: {
    byPair: Record<string, BreakdownEntry>;
    byPattern: Record<string, BreakdownEntry>;
    byTimeframe: Record<string, BreakdownEntry>;
  };
  equityCurve: EquityPoint[];
};
