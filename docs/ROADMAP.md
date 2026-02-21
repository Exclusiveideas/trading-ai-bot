# TRADING AI DEVELOPMENT

## Complete Roadmap

### From Zero to Production Trading System

**Project Guide**
Building a Context-Aware Machine Learning Trading System

**Timeline:** 9-12 months to live trading
**Patterns:** Pin Bars, Head & Shoulders, Double Tops/Bottoms, False Breakouts, Engulfing
**Technology Stack:** JavaScript/TypeScript + Python + XGBoost + Next.js + PostgreSQL + OANDA v20 API (data) + MetaApi/MT4/MT5 (execution) + ccxt (crypto)
**Pairs:** 20 forex pairs (EUR/USD, GBP/USD, USD/JPY, AUD/USD, EUR/GBP, USD/CAD, NZD/USD, USD/CHF, EUR/JPY, GBP/JPY, EUR/AUD, AUD/JPY, GBP/CHF, EUR/CHF, CAD/JPY, NZD/JPY, EUR/NZD, GBP/AUD, AUD/NZD, CHF/JPY)
**Timeframes:** D, H4, H1, M15

*Created: February 11, 2026*
*Updated: February 21, 2026 — Phase 10 complete (execution engine), Phase 10B complete (signal quality filters), Phases 11-13 expanded with automated trading roadmap*

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
| Phase 10: Execution Engine | COMPLETE | MetaApi + risk management + order lifecycle |
| Phase 10B: Signal Quality Filters | COMPLETE | 8 quality gates + composite scoring |
| Phase 11: Automated Paper Trading | NOT STARTED | MT5 demo account, full auto-execution loop |
| Phase 12: Live Trading | NOT STARTED | Real money, conservative ramp-up |
| Phase 13: Crypto Expansion | NOT STARTED | ccxt + Binance/Bybit integration |

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
- [Phase 10: Execution Engine](#phase-10-execution-engine)
- [Phase 11: Automated Paper Trading](#phase-11-automated-paper-trading)
- [Phase 12: Live Trading](#phase-12-live-trading)
- [Phase 13: Crypto Expansion](#phase-13-crypto-expansion)
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

## PHASE 10: EXECUTION ENGINE

**COMPLETE | Goal: Build the automated trading infrastructure using MetaApi + MT4/MT5**

### Why MetaApi

- Works with **any MT4/MT5 broker** — connect your existing or preferred broker account
- Cloud-hosted REST + WebSocket API — no need to run MT4/MT5 locally
- Identical API for both MT4 and MT5
- Python SDK: `metaapi-cloud-sdk` (pip install)
- Includes CopyFactory and risk management SDK
- Free tier available; paid plans ~$5-10/month per account
- OANDA remains the **data source** for candles, indicators, and signal generation

### Task 10.1: MetaApi Integration Layer

**What to do:**
- Install `metaapi-cloud-sdk` in Python environment
- Create `lib/execution/metaapi-client.ts` (or Python equivalent) wrapping MetaApi SDK
- Implement core functions:
  - `connectAccount(accountId, token)` — connect to MT4/MT5 broker account
  - `getAccountInfo()` — equity, balance, margin, open positions
  - `placeMarketOrder(pair, direction, volume, sl, tp)` — execute trade
  - `placeLimitOrder(pair, direction, volume, price, sl, tp, expiry)` — pending order
  - `modifyOrder(orderId, sl?, tp?)` — update SL/TP
  - `closePosition(positionId)` — close a trade
  - `getOpenPositions()` — list current positions
  - `getPendingOrders()` — list pending orders
  - `cancelOrder(orderId)` — cancel pending order
- Handle authentication, reconnection, and error states
- Add environment variables: `METAAPI_TOKEN`, `METAAPI_ACCOUNT_ID`

**Deliverable:** Working MetaApi client that can connect and place/close orders

### Task 10.2: Risk Management Layer

**What to do:**
- Create `lib/execution/risk-manager.ts` with these checks (all run BEFORE order placement):
  - **Position sizing:** `calcPositionSize(equity, riskPct, entryPrice, slPrice, pipValue)` — never risk more than 1-2% per trade
  - **Daily loss limit:** Stop trading if daily P&L drops below -3% of equity. Reset at midnight UTC.
  - **Max concurrent positions:** Cap at 3-5 open positions at any time
  - **Max total exposure:** Cap total margin usage at 10-20% of equity
  - **Correlation filter:** Block opening correlated positions (e.g., EUR/USD + GBP/USD both long)
  - **Consecutive loss breaker:** Pause after 5 consecutive losses. Require manual re-enable via Telegram or dashboard.
  - **Drawdown breaker:** Stop trading if account drops 10% below high-water mark
  - **Spread filter:** Skip trade if current spread exceeds 2× normal (avoid news spikes)
- Store risk parameters in config (not hardcoded) so they can be tuned per-phase
- Log every risk check decision (pass/reject with reason) to database

**Deliverable:** Risk management middleware that sits between signal generator and order executor

### Task 10.3: Order Management System (OMS)

**What to do:**
- Create `lib/execution/order-manager.ts` with order lifecycle tracking:
  - Order state machine: `PENDING → SUBMITTED → FILLED → CLOSED` (also: `CANCELLED`, `REJECTED`, `PARTIALLY_FILLED`)
  - Track every state transition with timestamp in DB
  - Link orders to signals (foreign key: `signalId`)
- New database tables:
  - **Order:** id, signalId, brokerOrderId, pair, direction, volume, entryPrice, slPrice, tpPrice, status, filledPrice, filledAt, closedPrice, closedAt, closedReason (tp/sl/manual/killswitch), pnl, commission, swap
  - **RiskEvent:** id, timestamp, eventType (daily_limit_hit, consecutive_losses, drawdown_breach, correlation_block, spread_filter), details (JSON), action (paused/rejected/killswitch)
  - **DailyPnl:** date, realizedPnl, unrealizedPnl, tradesOpened, tradesClosed, highWaterMark
- Position reconciliation: every 60 seconds, query MetaApi for actual positions and compare with internal state. Log discrepancies.
- Handle partial fills: if < 100% filled after 30 seconds, decide whether to keep partial or cancel remainder

**Deliverable:** Order tracking system with full audit trail

### Task 10.4: Kill Switch

**What to do:**
- Global emergency stop that can be triggered via:
  - Telegram command: `/killswitch` or `/stop`
  - Dashboard button (red "EMERGENCY STOP" button)
  - Automatic: any circuit breaker threshold breach
- Kill switch actions (in order):
  1. Set global `TRADING_ENABLED = false`
  2. Cancel all pending orders
  3. Close all open positions at market
  4. Send Telegram alert: "🚨 KILL SWITCH ACTIVATED — all positions closed, trading disabled"
  5. Log to RiskEvent table
- Require manual re-enable via Telegram `/start` command or dashboard toggle
- Test kill switch regularly on demo account

**Deliverable:** Working kill switch with multiple trigger methods

### Task 10.5: Signal-to-Execution Pipeline

**What to do:**
- Modify `scripts/scan.ts` to optionally trigger execution after signal generation
- Pipeline flow:
  ```
  Signal Generated → Risk Manager Check → Position Sizing → Order Placement → Fill Confirmation → Telegram Notification
  ```
- Add `EXECUTION_MODE` env variable: `disabled` | `paper` | `live`
  - `disabled`: current behavior (signal + alert only)
  - `paper`: place orders on MT5 demo account via MetaApi
  - `live`: place orders on real MT5 account via MetaApi
- SL/TP placement: use the signal's calculated SL and TP levels directly
- Add trade open/close notifications to Telegram with execution details (fill price, slippage, volume)

**Deliverable:** End-to-end automated pipeline from signal detection to order execution

### Task 10.6: Monitoring & Observability

**What to do:**
- **Heartbeat:** Every 60 seconds, verify bot is alive + MetaApi connection is active. Alert on failure.
- **Position sync:** Every 60 seconds, reconcile internal positions with broker positions
- **Daily summary:** Automated Telegram message at market close with:
  - Trades opened/closed today
  - Daily P&L (realized + unrealized)
  - Current open positions
  - Risk status (daily limit remaining, drawdown from HWM)
  - System health (API errors, reconnections)
- **Dashboard updates:** Extend existing dashboard with:
  - Live positions panel (pair, direction, volume, unrealized P&L)
  - Order history with execution details
  - Risk status indicators (daily limit %, drawdown %, active circuit breakers)
  - Equity curve from actual broker data (not just signal-based)
- **Error alerting:** Immediate Telegram notification on API errors, failed orders, or unexpected states

**Deliverable:** Real-time monitoring via Telegram + dashboard

### Files to Create (Phase 10)

| File | Purpose |
|---|---|
| `lib/execution/metaapi-client.ts` | MetaApi SDK wrapper for MT4/MT5 |
| `lib/execution/risk-manager.ts` | Pre-trade risk checks and position sizing |
| `lib/execution/order-manager.ts` | Order lifecycle and state machine |
| `lib/execution/kill-switch.ts` | Emergency stop with multi-trigger support |
| `lib/execution/position-reconciler.ts` | Broker ↔ internal state sync |
| `lib/execution/types.ts` | Execution domain types (OrderStatus, RiskEvent, etc.) |
| `scripts/execute.ts` | Standalone execution runner (can be cron'd separately) |
| `prisma/migrations/*/` | New tables: Order, RiskEvent, DailyPnl |

### Dependencies to Install

```bash
# Python
pip install metaapi-cloud-sdk

# Node.js (if using TS wrapper)
npm install metaapi.cloud-sdk
```

### Environment Variables

```bash
METAAPI_TOKEN="your-metaapi-token"
METAAPI_ACCOUNT_ID="your-mt5-account-id"
EXECUTION_MODE="disabled"          # disabled | paper | live
RISK_PCT_PER_TRADE=0.01            # 1% risk per trade
MAX_CONCURRENT_POSITIONS=3
MAX_DAILY_LOSS_PCT=0.03            # 3% daily loss limit
MAX_DRAWDOWN_PCT=0.10              # 10% drawdown circuit breaker
MAX_CONSECUTIVE_LOSSES=5
```

---

## PHASE 10B: SIGNAL QUALITY FILTERS

**COMPLETE | Goal: Add 8 quality gates between signal generation and trade execution to ensure only high-conviction signals produce orders**

### Problem

The scanner's original filters were too loose: pattern quality >= 5/10 and ML win probability >= 55% **OR** MFE bucket >= 1R. This allowed mediocre signals (barely-passing quality, low confidence, poor risk/reward, counter-trend on higher timeframes, off-hours sessions) to reach the execution engine.

### Implementation: `lib/scanner/signal-quality-filter.ts`

8 pure, testable filter functions + composite scoring, all configurable via environment variables:

| # | Filter | Threshold | Default | Rationale |
|---|--------|-----------|---------|-----------|
| 1 | ML Thresholds (tightened) | v1 win prob >= X **AND** v2 bucket >= 1R | 0.55 | Changed from OR to AND — both models must agree |
| 2 | Quality Rating (raised) | quality >= X | 6 (was 5) | Require above-average pattern structure |
| 3 | Minimum Risk:Reward | R:R >= X | 1.5 | Reject trades with poor reward relative to risk |
| 4 | Confidence Threshold | confidence >= X | 0.55 | Use the pattern detector's confidence score as a gate |
| 5 | V3 MFE Minimum | v3_mfe >= X | 0.5R | Predicted MFE must justify the trade (skip if model unavailable) |
| 6 | Trading Session | Reject off_hours + Asian for EUR pairs | on | Avoid low-liquidity periods for session-inappropriate pairs |
| 7 | HTF Alignment | No strong counter-trend on higher TF | on | Bullish blocked by strong_downtrend HTF, bearish by strong_uptrend |
| 8 | Composite Score | Weighted combination >= X | 0.55 | Final gate combining all quality metrics |

### Composite Score Formula

```
score = 0.20 * (qualityRating / 10)
      + 0.30 * v1WinProb
      + 0.20 * min(rrRatio / 3, 1.0)
      + 0.15 * max(0, min(v3Mfe / 2, 1.0))
      + 0.15 * htfAlignmentScore
```

Where `htfAlignmentScore`: 1.0 (fully aligned), 0.75 (weakly aligned), 0.5 (ranging/unknown), 0.25 (weakly counter), 0.0 (strongly counter).

### Session Filtering Logic

- **Reject off_hours (21:00-23:59 UTC)** for all pairs — low liquidity, wide spreads
- **Reject Asian session (00:00-07:59 UTC)** for EUR/GBP-dominated pairs: EUR/USD, EUR/GBP, EUR/AUD, EUR/NZD, EUR/CHF, EUR/JPY, GBP/USD, GBP/AUD, GBP/CHF
- **Allow Asian session** for JPY/AUD/NZD pairs (their home session)
- **Daily timeframe** and null session skip session checks

### Environment Variables

```bash
FILTER_MIN_QUALITY_RATING=6
FILTER_MIN_WIN_PROB=0.55
FILTER_REQUIRE_BOTH_ML=true
FILTER_MIN_RISK_REWARD=1.5
FILTER_MIN_CONFIDENCE=0.55
FILTER_MIN_V3_MFE=0.5
FILTER_REJECT_OFF_HOURS=true
FILTER_REJECT_ASIAN_EUR=true
FILTER_MIN_COMPOSITE_SCORE=0.55
```

### Signal Flow After Phase 10B

```
Pattern Detection → Quality >= 5 (pre-filter)
  → ML Predictions (FastAPI)
  → Signal Quality Filters (8 checks + composite)
  → DB Upsert → Telegram Alert → Execution Engine
```

Filtered signals are never saved to the DB — keeping it clean for analysis.

### Files

- **Created:** `lib/scanner/signal-quality-filter.ts` (8 filter functions + orchestrator)
- **Created:** `lib/scanner/signal-quality-filter.spec.ts` (57 unit tests including fast-check property tests)
- **Modified:** `scripts/scan.ts` (replaced simple threshold check with full filter pipeline)

---

## PHASE 11: AUTOMATED PAPER TRADING

**NOT STARTED | Goal: Validate the full execution pipeline on a demo account before real money**

### Task 11.1: MT5 Demo Account Setup

**What to do:**
- Open an MT5 demo account with your preferred broker (e.g., Pepperstone, IC Markets, Exness, XM, etc.)
- Connect the demo account to MetaApi (cloud-hosted, no local MT5 needed)
- Verify connectivity: `getAccountInfo()` returns correct balance/equity
- Verify order placement: manually place and close a test trade via the API
- Set `EXECUTION_MODE=paper` in environment

**Deliverable:** Connected MT5 demo account executing via MetaApi

### Task 11.2: Full Pipeline Test

**What to do:**
- Run the scanner with execution enabled
- Verify the complete flow: signal → risk check → order → fill → position tracking → SL/TP hit → close → P&L recorded
- Test edge cases:
  - Signal generated during weekend (should queue, not execute)
  - Risk limit hit (should reject with logged reason)
  - Kill switch activation (should close all positions)
  - MetaApi disconnection and reconnection
  - Scanner crash and restart (should reconcile positions on startup)
- Run for minimum 1 week monitoring closely

**Deliverable:** Full pipeline working end-to-end on demo account

### Task 11.3: Extended Paper Trading Validation

**What to do:**
- Let the system run fully automated for 30-60 days on demo
- Compare execution results with signal-only results:
  - Slippage analysis (signal entry price vs actual fill price)
  - Timing analysis (signal time vs execution time)
  - Missed trades (signals that couldn't be executed — why?)
- Track all risk events and circuit breaker activations
- Weekly review of execution quality alongside model accuracy
- Target metrics (same as Phase 9B):
  - Win rate: 60-70%
  - Avg R/trade: positive
  - Profit factor: >1.5
  - Max drawdown: <20%

**Deliverable:** 30-60 days of automated paper trading data proving the execution pipeline works

*Success check: Execution results closely match signal-only backtested expectations. No unexpected risk events.*

---

## PHASE 12: LIVE TRADING

**NOT STARTED | Goal: Trade real money with strict risk management and gradual scaling**

### Task 12.1: Live Account Setup

**What to do:**
- Open a live MT5 account with your chosen broker
- Fund with small capital ($500-1000 to start — only money you can afford to lose)
- Connect to MetaApi (same as demo, just different account ID)
- Set `EXECUTION_MODE=live`
- Double-check all risk parameters are correctly configured:
  - 1% risk per trade
  - 3% daily loss limit
  - 10% drawdown circuit breaker
  - Max 3 concurrent positions
  - Kill switch tested and working

**Deliverable:** Funded, connected live account with verified risk controls

### Task 12.2: Conservative Launch (Month 1)

**What to do:**
- Start with **micro lots** (0.01 lot = ~$1,000 notional for forex)
- Risk only 0.5% per trade initially (half the normal 1%)
- Take only highest-conviction signals: V1 win prob ≥ 65% AND V2 bucket ≥ "1.5-2R"
- Limit to 5-8 of your best-performing pairs (based on paper trading data)
- Monitor every trade closely
- Daily Telegram summary review
- Weekly deep-dive on dashboard

**Deliverable:** First month of live trading with minimal capital

*Success check: Following risk limits exactly, no emotional overrides*

### Task 12.3: Gradual Scaling

**What to do:**
- **After 1 month profitable:** Increase to 1% risk per trade, loosen to normal signal thresholds
- **After 2 months profitable:** Increase to full 20-pair coverage
- **After 3 months profitable:** Consider increasing capital allocation
- **Never increase position size after a losing streak** — only after sustained profitability
- Scale down immediately if drawdown exceeds 7%

**Scaling formula:**
```
Month 1: 0.5% risk, top 5 pairs, strict thresholds
Month 2: 1.0% risk, top 10 pairs, normal thresholds
Month 3: 1.0% risk, all 20 pairs, normal thresholds
Month 4+: Consider additional capital if 3 consecutive profitable months
```

**Deliverable:** Scaled trading operation with proven track record

*Success check: Profitable for 3+ consecutive months before any capital increase*

### Task 12.4: Continuous Improvement

**What to do:**
- Keep labeling new patterns (50/month minimum)
- Auto-retrain handles model drift (existing pipeline)
- Track market regime changes via accuracy snapshots
- Continuously improve V3 regression with new MFE data from live trades
- Monthly review: which pairs, patterns, timeframes are performing best/worst
- Quarterly strategy review: should thresholds be adjusted?
- Consider adding new pattern types if existing ones plateau

**Deliverable:** Living system that adapts to changing markets

---

## PHASE 13: CRYPTO EXPANSION (OPTIONAL)

**NOT STARTED | Goal: Extend automated trading to crypto markets via ccxt**

### Why ccxt

- Unified API across 100+ exchanges (Binance, Bybit, OKX, Coinbase, Kraken, etc.)
- Python SDK with both REST and WebSocket support
- Handles authentication, rate limiting, and data normalization
- Can reuse the same risk management layer built in Phase 10

### Task 13.1: ccxt Integration

**What to do:**
- Install `ccxt` in Python environment
- Create `lib/execution/ccxt-client.ts` (or Python) wrapping ccxt
- Implement same interface as MetaApi client: connect, placeOrder, closePosition, getPositions
- Add crypto pairs to scanner (BTC/USD, ETH/USD, etc.)
- Fetch crypto candles via ccxt (or keep using OANDA if they offer crypto pairs)

**Deliverable:** Working ccxt client for crypto exchanges

### Task 13.2: Crypto-Specific Adaptations

**What to do:**
- Adjust risk management for crypto volatility (larger ATR, wider stops)
- Handle 24/7 market hours (no session-based filtering)
- Account for higher fees and funding rates (perpetual futures)
- Paper trade on exchange testnet (Binance testnet, Bybit testnet)
- Adapt position sizing for crypto lot sizes (fractional units)

**Deliverable:** Crypto-adapted risk management and execution

### Task 13.3: Crypto Paper Trading

**What to do:**
- Run on exchange testnet for 30+ days
- Validate signal quality for crypto pairs
- May need crypto-specific model training (different market dynamics)

**Deliverable:** Validated crypto trading pipeline

### Dependencies

```bash
pip install ccxt
# Performance optimizers:
pip install coincurve   # ECDSA signing: 45ms → 0.05ms
pip install orjson      # Faster JSON parsing for WebSocket
```

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
| 60 paper trades | PENDING | Phase 9B |
| Execution engine built | PENDING | Phase 10 (MetaApi + risk mgmt + OMS) |
| Kill switch tested | PENDING | Phase 10 |
| Automated paper trading (30-60 days) | PENDING | Phase 11 (MT5 demo via MetaApi) |
| Go live (micro lots) | PENDING | Phase 12 |
| 3 consecutive profitable months | PENDING | Phase 12 |
| Crypto expansion | PENDING | Phase 13 (optional) |

---

## IMMEDIATE NEXT STEPS

### Phase 9B: Paper Trading Validation (Current)
- Set up cron for scanner + resolver (see Phase 9A for commands)
- Monitor Telegram for signal alerts and resolution summaries
- Let system run for 60-90 days to accumulate resolved signals
- Review AccuracySnapshot data weekly

### Phase 10: Execution Engine (Next)
- Sign up for MetaApi account (free tier available)
- Open MT5 demo account with preferred broker
- Build execution pipeline: MetaApi client → risk manager → order manager → kill switch
- Wire scanner output to execution pipeline

### Optional Enhancements
- Dashboard UI extensions (live positions, order history, risk status)
- Dynamic TP strategy backtesting (deferred from Phase 6B)
- Crypto expansion via ccxt (Phase 13)

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
- **Skipping paper trading with the execution engine** — signal backtests ≠ live execution results; slippage, latency, and partial fills are real
- **No kill switch** — always have an emergency stop before going live
- **Not reconciling positions on restart** — after a crash, always query broker for actual positions before resuming
- **Ignoring spread widening during news** — a 2-pip spread can become 20 pips during NFP; use spread filters
- **Trading correlated pairs simultaneously** — 3 long EUR positions is really 1 big EUR bet
- **Scaling up after a winning streak** — size based on account equity and fixed risk %, not emotions

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
| `lib/execution/metaapi-client.ts` | MetaApi SDK wrapper for MT4/MT5 (Phase 10) |
| `lib/execution/risk-manager.ts` | Pre-trade risk checks and position sizing (Phase 10) |
| `lib/execution/order-manager.ts` | Order lifecycle and state machine (Phase 10) |
| `lib/execution/kill-switch.ts` | Emergency stop with multi-trigger support (Phase 10) |
| `lib/execution/position-reconciler.ts` | Broker ↔ internal state sync (Phase 10) |
| `scripts/execute.ts` | Standalone execution runner (Phase 10) |

---

## REALISTIC TIMELINE

**Aggressive:** 6 months to live trading
**Realistic:** 9-12 months to live trading
**Conservative:** 12-18 months to consistent profitability

### Actual Progress
- Phases 1-7 + 6B completed in ~10 days (Feb 11-21, 2026)
- Phase 8 (production scanner) + Phase 9A (outcome tracking + auto-retrain) completed Feb 21, 2026
- Remaining phases to live trading:
  - Phase 9B: Signal-only paper trading validation (60-90 days)
  - Phase 10: Build execution engine (MetaApi + risk management + OMS)
  - Phase 11: Automated paper trading on MT5 demo (30-60 days)
  - Phase 12: Live trading with gradual scaling
  - Phase 13: Crypto expansion (optional, can run in parallel)
- Biggest bottleneck: validation periods (Phase 9B + Phase 11 = 3-5 months minimum)
- System is fully automated: scanner → signals → resolution → accuracy → retrain
- Phase 10 (execution engine build) can start in parallel with Phase 9B validation

### Automated Trading Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        SIGNAL GENERATION                         │
│  OANDA Data → Indicators → Pattern Detection → ML Predictions   │
│                    (existing pipeline, unchanged)                 │
└──────────────────────────┬──────────────────────────────────────┘
                           │ Signal
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      RISK MANAGEMENT LAYER                       │
│  Position Sizing │ Daily Loss Limit │ Drawdown Check │ Spread   │
│  Correlation     │ Max Positions    │ Consecutive Losses         │
└──────────────────────────┬──────────────────────────────────────┘
                           │ Approved Signal + Size
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                     ORDER MANAGEMENT SYSTEM                      │
│  Order State Machine │ Fill Tracking │ Position Reconciliation   │
└──────────────────────────┬──────────────────────────────────────┘
                           │ Order
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BROKER EXECUTION LAYER                         │
│  MetaApi Cloud ──→ MT4/MT5 Broker (forex)                        │
│  ccxt           ──→ Binance/Bybit  (crypto, Phase 13)           │
└──────────────────────────┬──────────────────────────────────────┘
                           │ Fill/Status
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      MONITORING & ALERTS                          │
│  Telegram Notifications │ Dashboard │ Heartbeat │ Kill Switch    │
└─────────────────────────────────────────────────────────────────┘
```

*Remember: This is a marathon, not a sprint. The traders who succeed are the ones who stay disciplined, track everything meticulously, and refuse to skip the validation phases. Trust the process.*
