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
*Updated: February 21, 2026 — Updated after H1 backfill, re-labeling, and model retraining*

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
| Phase 8: Production Scanner | NOT STARTED | Next up |
| Phase 9: Paper Trading | NOT STARTED | |
| Phase 10: Live Trading | NOT STARTED | |

### Database State

| Table | Rows |
|---|---|
| raw_candles | 9,733,231 |
| calculated_features | 9,733,231 |
| context_features | 9,733,231 |
| labeled_patterns | 103,958 |

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
- [Phase 8: Production Scanner — NEXT](#phase-8-production-scanner)
- [Phase 9: Paper Trading](#phase-9-paper-trading)
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

## PHASE 8: PRODUCTION SCANNER

**Week 21-23 | Goal: Automated system to find setups in real-time**

### Task 8.1: Pattern Detection Logic

**What to do:**
- Build JavaScript functions to detect each pattern type
- Scan most recent 50-100 candles for pattern formation
- Flag potential setups
- Calculate all features needed for prediction

**Deliverable:** Pattern detection engine

*Success check: Can scan EUR/USD and identify pin bars automatically*

### Task 8.2: Python Prediction API

**What to do:**
- Build FastAPI endpoint
- Load trained models at startup:
  - **V1 classifier** (binary win/loss) — always available
  - **V2 classifier** (multi-R buckets) — if trained
  - **V3 regressor** (MFE prediction) — if trained
- Endpoints:
  - `POST /predict/classify` — returns win probability (V1) or R-bucket probabilities (V2)
  - `POST /predict/mfe` — returns predicted MFE and suggested TP level (V3)
  - `POST /predict/full` — returns combined recommendation from all available models
- Add health check endpoint
- Handle errors gracefully

**Deliverable:** Running API server serving all available model versions

*Success check: Can send test request, get back probability + suggested TP response*

### Task 8.3: Scanner Integration

**What to do:**
- Connect JS scanner to Python API
- For each detected pattern:
  - Calculate features
  - Send to `/predict/full` endpoint
  - Receive: win probability, predicted R-bucket, predicted MFE, suggested TP
- Filter for high-probability only (>65% or >70%)
- **If V3 available:** Use dynamic TP from MFE prediction instead of fixed 2R
- Log all detections with full prediction details

**Deliverable:** End-to-end detection → prediction pipeline with dynamic TP

*Success check: Scanner finds pattern, gets prediction + TP suggestion, displays result*

### Task 8.4: Alert System

**What to do:**
- Choose notification method (email, Telegram, Discord)
- Set up alerts for high-probability setups
- Include: pair, setup type, probability, entry/stop/target levels
- **If V3 available:** Include predicted MFE and dynamic TP level in alert
- Add chart screenshot if possible
- Test thoroughly

**Deliverable:** Alert system that notifies you of opportunities with optimal TP

*Success check: Receive test alert with all trade details including dynamic TP*

### Task 8.5: Scheduling & Automation

**What to do:**
- Set scanner to run automatically (e.g., every 4 hours for daily charts)
- Use cron job (Linux/Mac) or Task Scheduler (Windows)
- OR deploy to cloud (Heroku, Railway, AWS)
- Add logging and monitoring
- Set up error notifications

**Deliverable:** Fully automated scanner

*Success check: Runs without manual intervention for 1 week*

---

## PHASE 9: PAPER TRADING

**Week 24-36 (~3 months) | Goal: Validate system with fake money before going live**

### Task 9.1: Trade Tracking Spreadsheet

**What to do:**
- Create Google Sheet or Excel to log every signal
- Columns: date, pair, setup, probability, entry, stop, target, **predicted MFE**, **actual MFE**, outcome, R-multiple
- Calculate running statistics
- Track by setup type, pair, context conditions
- **Track dynamic TP vs fixed TP performance** side by side

**Deliverable:** Trade journal template with MFE tracking columns

### Task 9.2: Execute Paper Trades

**What to do:**
- Take every signal above threshold (e.g., 65% probability)
- Enter trades as if real (or use demo account)
- **If V3 available:** Use dynamic TP for half the trades, fixed 2R for the other half (A/B test)
- Follow system rules strictly
- No cherry-picking or second-guessing
- Record everything

**Deliverable:** 30+ paper trades executed

*Time: Minimum 2-3 months (need sample size)*

*Success check: Following system religiously*

### Task 9.3: Weekly Performance Review

**What to do:**
- Every Sunday, analyze past week
- Calculate: win rate, avg R-multiple, profit factor
- Compare actual outcomes to predicted probabilities
- **Compare dynamic TP trades vs fixed TP trades** — is V3 adding value?
- **Track predicted MFE vs actual MFE** — is the regression model calibrated?
- Identify what's working vs what's not
- Adjust filters if needed (e.g., raise threshold from 65% to 70%)

**Deliverable:** Weekly review notes with V3 comparison data

*Success check: Can explain why you won/lost each trade*

### Task 9.4: System Refinement

**What to do:**
- Based on paper trading results, refine:
  - Probability threshold
  - Position sizing rules
  - Risk management (max daily loss, correlation limits)
  - Which setups to trade vs skip
  - **Dynamic TP percentile** (70%, 80%, or 90% of predicted MFE)
- Update documentation
- Retrain model if finding systematic errors

**Deliverable:** Refined trading rules document

*Success check: Clear rules for every decision*

### Task 9.5: Final Validation

**What to do:**
- After 60-90 days of paper trading, calculate stats:
  - Win rate (target: 60-70%)
  - Average R-multiple (target: 1.5-2.0+)
  - Profit factor (target: 1.5+)
  - Max drawdown (target: <20%)
  - Sharpe ratio (target: >1.0)
- **Compare V1 (fixed TP) vs V3 (dynamic TP) performance**
- Decide if ready for live trading
- Decide which model version to deploy live

**Deliverable:** Performance report with model version comparison

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
| Scanner operational | NEXT | Phase 8 — real-time OANDA feed → model inference → alerts |
| 30 paper trades | PENDING | Phase 9 |
| Dynamic TP vs Fixed TP compared | PENDING | Phase 9 (A/B test during paper trading) |
| 60 paper trades | PENDING | Phase 9 |
| Go live | PENDING | Phase 10 |

---

## IMMEDIATE NEXT STEPS

### Phase 8 Prerequisites
- Dynamic TP strategy backtesting (deferred from Phase 6B)
- Ensemble decision system (V1 classifier + V3 regressor)
- FastAPI prediction server
- Real-time OANDA feed integration

### Maintenance
- **Database backup** — `pg_dump trading_ai | gzip > trading_ai_backup.sql.gz` (last backup: Feb 21, 2026)
- Re-run data collection + labeling periodically to keep models trained on recent data

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
| `docs/patterns/` | Pattern type definitions and detection criteria |

---

## REALISTIC TIMELINE

**Aggressive:** 6 months to live trading
**Realistic:** 9-12 months to live trading
**Conservative:** 12-18 months to consistent profitability

### Actual Progress
- Phases 1-7 + 6B completed in ~10 days (Feb 11-21, 2026)
- Remaining: Phase 8 (scanner), Phase 9 (paper trading, ~3 months), Phase 10 (live)
- Biggest bottleneck ahead: paper trading validation (minimum 60-90 days)

*Remember: This is a marathon, not a sprint. The traders who succeed are the ones who stay disciplined, track everything meticulously, and refuse to skip the validation phases. Trust the process.*
