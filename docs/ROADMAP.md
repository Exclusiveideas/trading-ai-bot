# TRADING AI DEVELOPMENT

## Complete Roadmap

### From Zero to Production Trading System

**Project Guide**
Building a Context-Aware Machine Learning Trading System

**Timeline:** 9-12 months to live trading
**Patterns:** Pin Bars, Head & Shoulders, Double Tops/Bottoms, False Breakouts, Engulfing
**Technology Stack:** JavaScript/TypeScript + Python + XGBoost + Next.js + PostgreSQL + OANDA v20 API
**Pairs:** 20 forex pairs (EUR/USD, GBP/USD, USD/JPY, AUD/USD, EUR/GBP, USD/CAD, NZD/USD, USD/CHF, EUR/JPY, GBP/JPY, EUR/AUD, AUD/JPY, GBP/CHF, EUR/CHF, CAD/JPY, NZD/JPY, EUR/NZD, GBP/AUD, AUD/NZD, CHF/JPY)
**Timeframes:** D, H4, H1, M15

*Created: February 11, 2026*
*Updated: February 21, 2026 — Phase 8 complete (production scanner), Phase 9A complete (outcome tracking + auto-retrain)*

---

## PROGRESS OVERVIEW

| Phase | Status | Key Results |
|---|---|---|
| Phase 1: Foundation | COMPLETE | Node.js + Python + PostgreSQL + OANDA API |
| Phase 2: Data Pipeline | COMPLETE | 9.73M candles, 20 pairs, 4 timeframes, 15 years of data |
| Phase 3: Labeling Tool | COMPLETE | Next.js UI + automated batch labeling + enriched CSV export (85 columns) |
| Phase 4: Pattern Labeling | COMPLETE | 103,958 labels across 5 pattern types (massively exceeded 200-300 target) |
| Phase 5: V1 Model | COMPLETE | AUC-ROC 0.704, accuracy 63.5% |
| Phase 6: V2 Multi-Class | COMPLETE | Filtered strategy: +4,506R total, 0.389R/trade avg |
| Phase 6B: V3 Regression | COMPLETE | R² = 0.394, MAE = 0.635R |
| Phase 7: All Pattern Types | COMPLETE | All 5 types done (exceeded original 2-type target) |
| Phase 8: Production Scanner | COMPLETE | 20 pairs × 4 TFs, 3-model predictions, Telegram alerts |
| Phase 9A: Outcome Tracking | COMPLETE | Signal resolution, accuracy metrics, auto-retrain pipeline |
| Phase 9B: Paper Trading | NOT STARTED | Next up |
| Phase 10: Live Trading | NOT STARTED | |

### Database State

| Table | Rows |
|---|---|
| raw_candles | 9,733,231 |
| calculated_features | 9,733,231 |
| context_features | 9,733,231 |
| labeled_patterns | 103,958 |
| signals | 39+ (live, auto-resolved) |
| model_versions | 1 (v1.0 baseline) |
| accuracy_snapshots | rolling metrics |

### Model Performance

| Model | Key Metric | Value |
|---|---|---|
| V1b Binary Classifier | AUC-ROC | 0.704 |
| V1b Binary Classifier | Accuracy | 63.5% |
| V2 Multi-Class (Filtered) | Total R | +4,506R |
| V2 Multi-Class (Filtered) | Avg R/Trade | 0.389R |
| V2 Multi-Class (Filtered) | Max Drawdown | -49R |
| V3 MFE Regression | R² | 0.394 |
| V3 MFE Regression | MAE | 0.635R |

Top learned features: pattern_type_false_breakout, trend_alignment, risk_reward_ratio, dist_to_round_number_pips, trading_session_daily

Best strategy: V2 Filtered — takes 60% of trades (predicted >=1R MFE), +4,506R total, 0.389R avg/trade, -49R max drawdown.

---

## TABLE OF CONTENTS

- [Phase 1: Foundation Setup — COMPLETE](#phase-1-foundation-setup)
- [Phase 2: Data Pipeline — COMPLETE](#phase-2-data-pipeline)
- [Phase 3: Labeling Tool & Automation — COMPLETE](#phase-3-labeling-tool--automation)
- [Phase 4: Pattern Labeling — COMPLETE](#phase-4-pattern-labeling)
- [Phase 5: Model Training V1 — COMPLETE](#phase-5-model-training-v1)
- [Phase 6: V2 Multi-Class — COMPLETE](#phase-6-v2-multi-class)
- [Phase 6B: V3 MFE Regression — COMPLETE](#phase-6b-mfe-regression-model-v3)
- [Phase 7: All Pattern Types — COMPLETE](#phase-7-all-pattern-types)
- [Phase 8: Production Scanner — COMPLETE](#phase-8-production-scanner)
- [Phase 9A: Outcome Tracking — COMPLETE](#phase-9a-outcome-tracking--auto-retrain)
- [Phase 9B: Paper Trading](#phase-9b-paper-trading)
- [Phase 10: Live Trading](#phase-10-live-trading)
- [Milestones & Checkpoints](#milestones--checkpoints)
- [Model Evolution Strategy (V1 → V2 → V3)](#model-evolution-strategy)
- [Critical Success Factors](#critical-success-factors)
- [Common Pitfalls to Avoid](#common-pitfalls-to-avoid)
- [Realistic Timeline](#realistic-timeline)

---

## PHASE 1: FOUNDATION SETUP — COMPLETE

**Completed | All infrastructure operational**

### Actual Results
- Node.js 18+ and Python 3.10+ installed
- Next.js 15 app with App Router (TypeScript)
- PostgreSQL database with Prisma ORM
- OANDA v20 API for data (migrated from Alpha Vantage/Twelve Data for accurate forex OHLC)
- Python environment with pandas, xgboost, scikit-learn, jupyter, matplotlib, seaborn
- 20 forex pairs configured (expanded from original 2-pair target)
- 4 timeframes: D, H4, H1, M15

---

## PHASE 2: DATA PIPELINE — COMPLETE

**Completed | 9.18M candles across 20 pairs and 4 timeframes**

### Actual Results
- **Data source:** OANDA v20 API (15 years of historical data)
- **Raw candles:** 9,733,231 rows in `raw_candles` table
- **Technical indicators:** 9,733,231 rows in `calculated_features` (SMA 20/50, EMA 200, RSI 14, MACD, ADX 14, ATR 14, Bollinger Bands 20/2, Volume SMA 20)
- **Context features:** 9,733,231 rows in `context_features` (support/resistance levels, trend state, trading session, round number proximity, distance metrics in pips and ATR)
- **Trading session distribution:** Asian 3.02M | New York 3.04M | London 1.87M | Off-hours 1.16M | Daily 82K
- **H1 gaps backfilled:** EUR/AUD, EUR/CHF, GBP/CHF, GBP/JPY, AUD/JPY, CAD/JPY, EUR/JPY — all 20 pairs now have full H1 coverage

### Pipeline Scripts
- `scripts/collect-historical-data.ts` — fetches OANDA candles with resume capability
- `scripts/calculate-indicators.ts` — computes all technical indicators
- `scripts/calculate-context-features.ts` — computes market context features
- `scripts/backfill-trading-session.ts` — one-time session classification backfill

---

## PHASE 3: LABELING TOOL & AUTOMATION — COMPLETE

**Completed | Visual UI + batch labeling + enriched 85-column export**

### Actual Results
- **Chart UI:** Next.js app with candlestick visualization, scrolling/zoom, indicator overlays
- **Pattern marking:** Click-to-mark with auto-calculated entry/SL/TP/outcome/MFE
- **Automated candidate finder:** Rule-based detectors for all 5 pattern types with quality scoring, ATR filters, and volume analysis
- **Batch labeling:** `scripts/batch-label.ts` — fully automated labeling across all pairs/timeframes with deduplication
- **Export:** `/api/export` endpoint producing 85-column CSV with:
  - Label fields + OHLCV + technical indicators + context features
  - Multi-timeframe context (33 HTF columns): H4→D, H1→D+H4, M15→D+H4+H1
  - Derived features: trend_alignment, volatility_regime, bb_width, rsi_zone
  - HTF fill rates: H4→D 96%, H1→D 85%, H1→H4 98%, M15→D 50%, M15→H4 91%

---

## PHASE 4: PATTERN LABELING — COMPLETE

**Completed | 98,406 labels across 5 pattern types (massively exceeded 200-300 target)**

### Actual Results
- **Total labeled patterns:** 103,958 (vs. original target of 200-300)
- **Pattern types:** Pin Bars, Head & Shoulders (573 labels, up from 1), Double Tops/Bottoms, False Breakouts (9,336 labels, up from 704), Engulfing
- **Coverage:** 20 forex pairs × 4 timeframes
- **Quality:** Automated quality scoring with pattern-specific validation rules
- **Exported dataset:** 103,958 rows × 85 columns (137MB CSV)

---

## PHASE 5: MODEL TRAINING V1 — COMPLETE

**Completed | AUC-ROC 0.704, accuracy 63.9%**

### Actual Results
- **Model:** XGBoost binary classifier (V1b)
- **Training data:** 104K labels (87x the original 1.2K)
- **AUC-ROC:** 0.704 (up from 0.51 random baseline)
- **Accuracy:** 63.5%
- **Top features:** pattern_type_false_breakout, trend_alignment, risk_reward_ratio, dist_to_round_number_pips, trading_session_daily
- **Notebook:** `python/notebooks/phase5_model_training_v1.ipynb`

---

## PHASE 6: V2 MULTI-CLASS — COMPLETE

**Completed | Best strategy: +4,290R total, 0.390R/trade**

### Actual Results
- **Model:** XGBoost multi-class classifier predicting MFE R-buckets
- **Filtered strategy:** Takes 60% of trades (predicted >=1R MFE)
  - Total R: +4,506R
  - Avg R/trade: 0.389R
  - Max drawdown: -49R
- **Notebook:** `python/notebooks/phase6_model_v2v3_mfe.ipynb`

---

## PHASE 6B: MFE REGRESSION MODEL (V3) — COMPLETE

**Completed | R² = 0.388, MAE = 0.637R**

### Actual Results
- **Model:** XGBoost regressor predicting continuous MFE values
- **R²:** 0.388 (meaningful predictive power)
- **MAE:** 0.637R
- **Notebook:** `python/notebooks/phase6_model_v2v3_mfe.ipynb`
- **Model files:** `python/models/`

### Remaining Work (Dynamic TP & Ensemble — deferred to Phase 8)
- Task 6B.3: Dynamic TP strategy backtesting (conservative/moderate/aggressive)
- Task 6B.4: Ensemble decision system combining V1 classifier + V3 regressor

---

## PHASE 7: ALL PATTERN TYPES — COMPLETE

**Completed | All 5 pattern types implemented (exceeded original 2-type target)**

### Actual Results
- **Pattern types implemented:** Pin Bars, Head & Shoulders, Double Tops/Bottoms, False Breakouts, Engulfing
- **All trained in a single combined model** (not separate per-type as originally planned)
- **Pattern-specific detectors** with quality scoring, ATR filters, and volume analysis
- **Pattern documentation:** `docs/patterns/` (per-type definitions and criteria)

---

## PHASE 8: PRODUCTION SCANNER — COMPLETE

**Completed | Real-time scanner: 20 pairs × 4 TFs → 3 model predictions → Telegram alerts**

### Actual Results
- **FastAPI prediction server** (`python/server/main.py`): loads 3 XGBoost models at startup, serves `/predict`, `/predict/batch`, `/health`
- **Scanner** (`scripts/scan.ts`): polls OANDA for 300 latest candles per pair/TF, detects patterns, builds 104-feature vectors, gets predictions, saves signals to DB
- **Telegram alerts** (`lib/scanner/telegram.ts`): formatted alerts with pair, pattern, quality, win probability, MFE bucket, R:R ratio
- **Feature vector builder** (`lib/scanner/feature-vector.ts`): 104 features matching trained models exactly (5 unit tests)
- **Signal filtering**: V1 win prob >= 55% OR V2 MFE bucket >= "1-1.5R"
- **Deduplication**: unique constraint on (pair, timeframe, patternType, patternEnd)
- **End-to-end tested**: 39 signals saved, ~2 min for all 20 pairs
- **Cron**: `*/15 * * * *` for M15 coverage

### Files Created
| File | Purpose |
|---|---|
| `lib/scanner/feature-vector.ts` | 104-feature vector builder |
| `lib/scanner/feature-vector.spec.ts` | 5 unit tests |
| `lib/scanner/telegram.ts` | Telegram Bot API alert sender |
| `python/server/main.py` | FastAPI prediction server (3 models) |
| `python/server/requirements.txt` | Python dependencies |
| `scripts/scan.ts` | Main scanner orchestrator |

---

## PHASE 9A: OUTCOME TRACKING & AUTO-RETRAIN — COMPLETE

**Completed | Signal resolution, accuracy metrics, model versioning, auto-retrain pipeline**

### Actual Results
- **Signal resolver** (`lib/resolver/resolve-signals.ts`): polls OANDA for open signals, resolves as win/loss/expired using `calculateOutcome()`
- **MAE tracking**: extended outcome calculator to track max adverse excursion alongside MFE
- **Accuracy tracker** (`lib/resolver/accuracy-tracker.ts`): computes rolling V1 accuracy, V2 bucket accuracy, V3 MAE from resolved signals
- **Retrain trigger** (`lib/resolver/retrain-trigger.ts`): fires when V1 accuracy < 55% on 100+ signals OR 500+ new resolved signals
- **Python training pipeline** (`python/server/train_models.py`): exports combined labeled_patterns + resolved signals, retrains all 3 models, saves versioned model files
- **Hot-reload**: `POST /retrain` endpoint on FastAPI retrains models and reloads them without restart
- **Model versioning**: `ModelVersion` table tracks version, metrics, active flag; each signal stores which model version predicted it
- **Telegram summaries**: resolution updates with win/loss counts and accuracy metrics
- **Smart timeframe scheduling**: M15 every 15 min, H1 on the hour, H4 every 4h, D at midnight UTC

### Schema Additions
- Signal: `status`, `outcome`, `exitPrice`, `rMultiple`, `barsToOutcome`, `maxFavorableExcursion`, `maxAdverseExcursion`, `resolvedAt`, `barsElapsed`, `lastCheckedAt`, `modelVersion`
- New tables: `ModelVersion`, `AccuracySnapshot`

### Files Created
| File | Purpose |
|---|---|
| `lib/resolver/resolve-signals.ts` | Core signal resolution logic |
| `lib/resolver/resolve-signals.spec.ts` | 11 unit tests |
| `lib/resolver/accuracy-tracker.ts` | Rolling accuracy metrics |
| `lib/resolver/accuracy-tracker.spec.ts` | 7 unit tests |
| `lib/resolver/retrain-trigger.ts` | Retrain decision logic |
| `python/server/train_models.py` | Reusable training pipeline |
| `scripts/resolve.ts` | CLI entry point for resolver |

### How to Run
```bash
# Start FastAPI server
source python/venv/bin/activate && python -m uvicorn python.server.main:app --port 8000

# Run scanner (every 15 min)
npx tsx scripts/scan.ts

# Run resolver (every 15 min, staggered +7 min)
npx tsx scripts/resolve.ts

# Cron setup
*/15 * * * * cd /path/to/trading-ai && npx tsx scripts/scan.ts >> logs/scanner.log 2>&1
7,22,37,52 * * * * cd /path/to/trading-ai && npx tsx scripts/resolve.ts >> logs/resolver.log 2>&1
```

---

## PHASE 9B: PAPER TRADING

**NOT STARTED | Goal: Validate system with fake money before going live**

### Task 9B.1: Execute Paper Trades

**What to do:**
- Take every signal above threshold (system is already automated)
- Monitor signals and resolutions via Telegram
- Track dynamic TP vs fixed TP performance side by side
- Record everything (auto-tracked in DB)

**Deliverable:** 30+ paper trades executed (auto-resolved by resolver)

*Time: Minimum 2-3 months (need sample size)*

### Task 9B.2: Weekly Performance Review

**What to do:**
- Every Sunday, analyze past week using AccuracySnapshot data
- Calculate: win rate, avg R-multiple, profit factor
- Compare predicted vs actual outcomes per model
- Compare predicted MFE vs actual MFE — is V3 calibrated?
- Identify what's working vs what's not

**Deliverable:** Weekly review notes

### Task 9B.3: System Refinement

**What to do:**
- Based on live accuracy tracking:
  - Adjust probability threshold (currently 55%)
  - Adjust quality threshold (currently 5/10)
  - Refine pattern-specific filters
- Auto-retrain handles model drift automatically
- Manual review of retrain results

**Deliverable:** Refined trading rules

### Task 9B.4: Final Validation

**What to do:**
- After 60-90 days, review cumulative stats:
  - Win rate (target: 60-70%)
  - Average R-multiple (target: 1.5-2.0+)
  - Profit factor (target: 1.5+)
  - Max drawdown (target: <20%)
- Compare model versions (accuracy tracked per version)
- Decide if ready for live trading

**Deliverable:** Performance report with go/no-go decision

*Success check: Meets minimum profitability standards for 3 consecutive months*

---

## PHASE 10: LIVE TRADING

**Month 10+ | Goal: Trade real money with strict risk management**

### Task 10.1: Broker Selection & Account Setup

**What to do:**
- Choose regulated broker (Oanda, FXCM, IG, etc.)
- Open account with small capital ($500-1000 to start)
- Verify API access for automation
- Test deposits/withdrawals

**Deliverable:** Funded live account

### Task 10.2: Conservative Launch

**What to do:**
- Start with 25-50% of normal position size
- Take only highest probability setups (75%+)
- Limit to 1-2 pairs initially
- Max 1-2 trades per week
- Monitor like a hawk

**Deliverable:** First live trades

*Success check: Following risk limits exactly*

### Task 10.3: Scale Gradually

**What to do:**
- After 1 month profitable → increase to 50% position size
- After 2 months profitable → increase to 75% position size
- After 3 months profitable → full position size
- Add pairs slowly
- Never rush

**Deliverable:** Scaled trading operation

*Success check: Profitable for 3+ consecutive months before scaling*

### Task 10.4: Continuous Improvement

**What to do:**
- Keep labeling new patterns (50/month)
- Retrain models quarterly (classifier + regressor)
- Track market regime changes
- **Continuously improve V3 regression** with new MFE data from live trades
- Adjust to evolving conditions
- Never stop learning

**Deliverable:** Living, breathing system that adapts

---

## MILESTONES & CHECKPOINTS

| Milestone | Status | Actual Result |
|---|---|---|
| Dev environment ready | DONE | Node.js + Python + PostgreSQL + OANDA |
| 1000+ candles in database | DONE | 9,733,231 candles (9,733x target) |
| Labeling tool working | DONE | Next.js UI + batch labeling + 85-column export |
| 100 patterns labeled | DONE | 103,958 patterns (1,040x target) |
| First model trained (V1) | DONE | AUC 0.704, accuracy 63.9% |
| 200+ patterns labeled | DONE | 103,958 patterns |
| Model V2 improved | DONE | +4,290R filtered strategy, 0.390R/trade |
| V3 MFE regression trained | DONE | R² = 0.388, MAE = 0.637R |
| All pattern types | DONE | 5 types (exceeded 2-type target) |
| Scanner operational | DONE | 20 pairs × 4 TFs, 39 signals in first run, Telegram alerts |
| Outcome tracking | DONE | Auto-resolve signals, accuracy metrics, auto-retrain pipeline |
| 30 paper trades | PENDING | Phase 9B |
| Dynamic TP vs Fixed TP compared | PENDING | Phase 9B (tracked automatically via resolver) |
| 60 paper trades | PENDING | Phase 9 |
| Go live | PENDING | Phase 10 |

---

## IMMEDIATE NEXT STEPS

### Phase 9B: Paper Trading Validation
- Set up cron for scanner + resolver (see Phase 9A for commands)
- Monitor Telegram for signal alerts and resolution summaries
- Let system run for 60-90 days to accumulate resolved signals
- Review AccuracySnapshot data weekly

### Optional Enhancements
- Dashboard UI (Next.js pages showing signals, accuracy, model performance)
- OANDA practice account integration for automated paper trade execution
- Dynamic TP strategy backtesting (deferred from Phase 6B)

### Maintenance
- **Database backup** — `pg_dump trading_ai | gzip > trading_ai_backup.sql.gz` (last backup: Feb 21, 2026)
- Auto-retrain handles model drift (triggers at 500 resolved signals or accuracy < 55%)
- Install new Python deps: `pip install psycopg2-binary pandas scikit-learn` (in venv)

---

## MODEL EVOLUTION STRATEGY

The model evolves in three stages. All three are now trained:

### V1: Binary Classification — TRAINED
- **Question:** "Will this fixed-2R trade win or lose?"
- **Target:** Binary (win/loss)
- **Result:** AUC 0.704, accuracy 63.5% on 104K labels
- **Model file:** `python/models/` (XGBoost)

### V2: Multi-R Classification — TRAINED
- **Question:** "How far will price move in my favor?"
- **Target:** Multi-class buckets `[loss, 1R, 1.5R, 2R, 3R+]` derived from MFE data
- **Result:** Filtered strategy +4,506R total, 0.389R/trade, -49R max drawdown
- **Best use:** Take 60% of trades (predicted >=1R MFE)

### V3: MFE Regression — TRAINED
- **Question:** "Exactly how many R will price move favorably?"
- **Target:** Continuous MFE value (e.g., 2.37R)
- **Result:** R² = 0.394, MAE = 0.635R
- **Next:** Backtest dynamic TP strategies (70%/80%/90% of predicted MFE)

### Why This Order Matters
1. **Classification is forgiving** — works with small datasets, binary target is easy to learn
2. **MFE data accumulates passively** — every label you create already includes MFE
3. **Regression needs volume** — 500+ examples to learn meaningful continuous relationships
4. **Each stage validates the next** — V1 feature importance tells you what V3 will use

---

## CRITICAL SUCCESS FACTORS

**Don't skip these or you'll fail:**

**Use semi-automated labeling**
Rule-based finder + human review saves 70% of time

**Label quality > quantity**
100 perfect labels beats 300 sloppy ones

**Time-based splits ALWAYS**
Never shuffle time-series data

**Paper trade minimum 60 days**
No shortcuts to live money

**Follow system blindly**
No discretion during paper trading

**Start small live**
25% position size for first month

**Track everything**
If it's not logged, it didn't happen

**MFE accumulates automatically**
Every label you save builds toward V3 — no extra work needed

---

## COMMON PITFALLS TO AVOID

- Manually scrolling through all data (use semi-automated finder instead)
- Skipping context features (thinking pattern alone is enough)
- Training on too little data (<100 examples)
- Not testing model on unseen data
- Cherry-picking trades during paper trading
- Going live too quickly
- Oversizing positions
- Adding too many patterns too fast
- Giving up after first losses
- **Using MFE as a training feature in the classifier** (it's future-leaking — MFE is only known after the trade)
- **Jumping to V3 regression too early** (need 500+ labels for meaningful results)
- **Over-optimizing TP percentile on backtests** (leads to curve-fitting)

---

## KEY FILES

| File | Purpose |
|---|---|
| `scripts/collect-historical-data.ts` | Fetch OANDA candles with resume capability |
| `scripts/calculate-indicators.ts` | Compute technical indicators for all candles |
| `scripts/calculate-context-features.ts` | Compute market context features |
| `scripts/batch-label.ts` | Automated pattern detection and labeling |
| `scripts/backfill-trading-session.ts` | One-time session classification backfill |
| `app/api/export/route.ts` | 85-column enriched CSV export with HTF + derived features |
| `lib/pipeline/context-features.ts` | Session classification, pip distance, context calculations |
| `lib/pipeline/indicators.ts` | Technical indicator calculation library |
| `lib/oanda.ts` | OANDA v20 API client |
| `types/trading.ts` | Forex pairs, timeframes, and type definitions |
| `python/notebooks/phase5_model_training_v1.ipynb` | V1b binary classifier training |
| `python/notebooks/phase6_model_v2v3_mfe.ipynb` | V2 multi-class + V3 regression training |
| `python/models/` | Trained XGBoost model files |
| `python/data/training-all.csv` | 98K × 85 column training data (gitignored) |
| `python/server/main.py` | FastAPI prediction server (3 models + retrain endpoint) |
| `python/server/train_models.py` | Reusable training pipeline for auto-retrain |
| `scripts/scan.ts` | Production scanner (20 pairs × 4 TFs → predictions → alerts) |
| `scripts/resolve.ts` | Signal resolver (outcome tracking + accuracy + retrain trigger) |
| `lib/scanner/feature-vector.ts` | 104-feature vector builder for live predictions |
| `lib/scanner/telegram.ts` | Telegram Bot API (signal alerts + resolution summaries) |
| `lib/resolver/resolve-signals.ts` | Core signal resolution logic |
| `lib/resolver/accuracy-tracker.ts` | Rolling model accuracy metrics |
| `lib/resolver/retrain-trigger.ts` | Auto-retrain decision logic |
| `docs/patterns/` | Pattern type definitions and detection criteria |

---

## REALISTIC TIMELINE

**Aggressive:** 6 months to live trading
**Realistic:** 9-12 months to live trading
**Conservative:** 12-18 months to consistent profitability

### Actual Progress
- Phases 1-7 + 6B completed in ~10 days (Feb 11-21, 2026)
- Phase 8 (production scanner) + Phase 9A (outcome tracking + auto-retrain) completed Feb 21, 2026
- Remaining: Phase 9B (paper trading, ~3 months), Phase 10 (live)
- Biggest bottleneck ahead: paper trading validation (minimum 60-90 days)
- System is fully automated: scanner → signals → resolution → accuracy → retrain

*Remember: This is a marathon, not a sprint. The traders who succeed are the ones who stay disciplined, track everything meticulously, and refuse to skip the validation phases. Trust the process.*
