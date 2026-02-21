# TRADING AI DEVELOPMENT

## Complete Roadmap

### From Zero to Production Trading System

**Project Guide**
Building a Context-Aware Machine Learning Trading System

**Timeline:** 9-12 months to live trading
**Patterns:** Pin Bars, Head & Shoulders, Double Tops/Bottoms, False Breakouts
**Technology Stack:** JavaScript + Python + XGBoost

*Created: February 11, 2026*
*Updated: February 19, 2026 — Added V2 (Multi-R Classification) and V3 (MFE Regression) model evolution path*

---

## TABLE OF CONTENTS

- [Phase 1: Foundation Setup — Week 1](#phase-1-foundation-setup)
- [Phase 2: Data Pipeline — Week 2-3](#phase-2-data-pipeline)
- [Phase 3: Labeling Tool & Automation — Week 4-5](#phase-3-labeling-tool--automation)
- [Phase 4: Pattern Labeling (Semi-Automated) — Week 6-10](#phase-4-pattern-labeling-semi-automated)
- [Phase 5: Model Training V1 — Week 11-12](#phase-5-model-training-v1)
- [Phase 6: Iteration & Improvement — Week 13-15](#phase-6-iteration--improvement)
- [Phase 6B: MFE Regression Model (V3) — Week 16-17](#phase-6b-mfe-regression-model-v3)
- [Phase 7: Second Setup Type — Week 18-20](#phase-7-second-setup-type)
- [Phase 8: Production Scanner — Week 21-23](#phase-8-production-scanner)
- [Phase 9: Paper Trading — Week 24-36 (~3 months)](#phase-9-paper-trading)
- [Phase 10: Live Trading — Month 10+](#phase-10-live-trading)
- [Milestones & Checkpoints](#milestones--checkpoints)
- [Model Evolution Strategy (V1 → V2 → V3)](#model-evolution-strategy)
- [Critical Success Factors](#critical-success-factors)
- [Common Pitfalls to Avoid](#common-pitfalls-to-avoid)
- [Realistic Timeline](#realistic-timeline)

---

## PHASE 1: FOUNDATION SETUP

**Week 1 | Goal: Get all tools and infrastructure ready**

### Task 1.1: Development Environment Setup

**What to do:**
- Install Node.js (v18+) and Python (3.10+)
- Set up code editor (VS Code recommended)
- Create project folder structure
- Install Python virtual environment
- Install key Python libraries: pandas, xgboost, scikit-learn, jupyter

**Deliverable:** Working dev environment where you can run both JS and Python

*Success check: Can run 'node --version' and 'python --version' successfully*

### Task 1.2: Data Source Selection

**What to do:**
- Sign up for Alpha Vantage API (or Oanda practice account)
- Get API credentials
- Test API access with a single request
- Choose 2 currency pairs to start (recommended: EUR/USD, GBP/USD)

**Deliverable:** Working API key, can fetch sample data

*Success check: Successfully retrieve 1 day of historical price data*

### Task 1.3: Database Setup

**What to do:**
- Choose storage: SQLite (easiest) or PostgreSQL (production-ready)
- Design schema for: raw OHLCV data, calculated features, labeled patterns
- Create tables
- Test insert/query operations

**Deliverable:** Database ready to store historical data

*Success check: Can store and retrieve a week of price data*

---

## PHASE 2: DATA PIPELINE

**Week 2-3 | Goal: Automated system to collect and process market data**

### Task 2.1: Historical Data Collector

**What to do:**
- Build Node.js script to fetch historical data from API
- Fetch 3-5 years of daily data for your chosen pairs
- Handle rate limiting (API call delays)
- Store raw OHLCV in database
- Add error handling and retry logic

**Deliverable:** Database filled with 3-5 years of clean historical data

*Success check: 1000+ daily candles per pair stored successfully*

### Task 2.2: Technical Indicator Calculator

**What to do:**
- Install technicalindicators library in Node.js
- Create script to calculate ALL indicators for each candle:
  - Moving averages (SMA 20/50, EMA 200)
  - RSI, MACD, ADX
  - ATR, Bollinger Bands
  - Volume metrics
- Update database with calculated values

**Deliverable:** Every candle has 15-20 technical indicator values

*Success check: Can query any date and see complete indicator set*

### Task 2.3: Context Feature Engineering

**What to do:**
- Build functions to identify support/resistance levels
- Calculate distance to key levels (in pips and ATR-normalized)
- Determine trend state (strong up/down, weak up/down, ranging)
- Identify trading session for each candle
- Calculate support/resistance quality scores
- Detect round number proximity
- Add all context features to database

**Deliverable:** Rich context data for every candle

*Success check: Can look at any candle and see: trend state, nearest support, session, volatility regime, etc.*

---

## PHASE 3: LABELING TOOL & AUTOMATION

**Week 4-5 | Goal: Visual interface + automated candidate finder**

### Task 3.1: Chart Visualization

**What to do:**
- Build React/Next.js app with chart component
- Use Lightweight Charts library or similar
- Display candlestick data with scrolling/zoom
- Show technical indicators as overlays
- Add date range selector

**Deliverable:** Working chart that displays your historical data beautifully

*Success check: Can view and navigate 5 years of EUR/USD daily data*

### Task 3.2: Pattern Marking Interface

**What to do:**
- Add click-to-mark functionality on chart
- Create workflow: click start → click end → auto-calculate outcome
- Build form to capture:
  - Pattern type (pin bar, H&S, double top, etc.)
  - All context at pattern formation (auto-filled from database)
  - Manual quality rating (1-10)
  - Notes field
- Auto-calculate: entry price, stop loss, take profit, outcome

**Deliverable:** Can mark patterns visually and save to database

*Success check: Mark 10 test patterns and verify they save correctly*

### Task 3.3: Outcome Calculator

**What to do:**
- Build logic to scan forward after pattern marked
- Detect if stop hit or target hit (which came first)
- Calculate R-multiple achieved
- Count bars to outcome
- **Track Max Favorable Excursion (MFE)** — the furthest price moves in your favor (in R units) before the trade resolves. This is critical for V2/V3 model training.
- Handle edge cases (pattern at end of data, neither target nor stop hit, both hit on same bar)

**Deliverable:** Automatic outcome calculation with MFE tracking for every pattern

*Success check: Mark a pattern, system correctly identifies win/loss, R-multiple, and MFE*

### Task 3.4: Automated Candidate Finder

**What to do:**
- Build rule-based pattern detection algorithm (intentionally loose criteria)
- For pin bars: detect long wicks (>60%), small bodies (<35%)
- For other patterns: build similar simple detectors
- Scan historical data and flag 80-120 candidates
- Pre-calculate context for each candidate
- Display only candidates in review interface (not all 1000 candles)

**Deliverable:** Automated scanner that finds pattern candidates in seconds

*Success check: Scan 1000 candles, flag 80-120 candidates in <5 seconds*

### Task 3.5: Export Functionality

**What to do:**
- Create enriched CSV export function
- Include all 47 columns: label fields + OHLCV + technical indicators + context features + derived ratios + MFE
- Derived features computed at export: body_ratio, tail_ratio, nose_ratio, range_atr_ratio, risk_reward_ratio
- Ensure proper formatting for Python import
- Add export button to interface (per-pair and export-all)

**Deliverable:** One-click export of all labeled data to enriched CSV

*Success check: Export labels, open in Excel, verify all 47 columns present with indicator data populated*

---

## PHASE 4: PATTERN LABELING (SEMI-AUTOMATED)

**Week 6-10 | Goal: Create high-quality training dataset efficiently**

### Task 4.1: Choose Your First Setup Type

**What to do:**
- Pick ONE pattern type to start (recommended: Pin Bars)
- Study pattern definition thoroughly
- Decide strict criteria (what qualifies as a valid pattern)
- Write down your rules in a document

**Deliverable:** Clear definition document for your chosen pattern

*Success check: Can explain to someone what makes a valid pin bar vs invalid*

### Task 4.2: Label First 50 Examples (Semi-Automated)

**What to do:**
- Run automated candidate finder on historical data (finds 80-120 candidates)
- Review ONLY the flagged candidates (not all 1000 candles)
- For each candidate:
  - Look at pre-zoomed chart
  - Decide: Valid pattern? [APPROVE] or [REJECT]
  - If approved: Rate quality (1-10)
  - System auto-calculates context, outcome, and MFE
- Keep best 50 from the 80-120 candidates

**Deliverable:** 50 high-quality labeled patterns with outcomes and MFE data

*Time estimate: 45-60 minutes (30-45 seconds per review, 70% time savings)*

*Success check: Have at least 20 wins and 20 losses (need both outcomes)*

### Task 4.3: Quality Review & Refinement

**What to do:**
- Review your first 50 approved labels
- Check for consistency in quality ratings
- Remove any you're uncertain about
- Identify which contexts led to wins vs losses
- Refine automated finder rules if needed (adjust thresholds)

**Deliverable:** Clean set of 40-50 high-confidence labels

*Success check: Win rate is between 40-70% (not too perfect, not too random)*

### Task 4.4: Label to 100-150 Total (Semi-Automated)

**What to do:**
- Run candidate finder on additional historical periods
- Continue reviewing flagged candidates with refined criteria
- Aim for variety in context conditions
- Ensure you have examples across different:
  - Trend states
  - Sessions
  - Volatility regimes
  - Support quality levels
- Track your labeling stats and approval rate

**Deliverable:** 100-150 labeled patterns

*Time estimate: 2-4 hours total (70% faster than manual)*

*Success check: Roughly balanced distribution of context conditions*

---

## PHASE 5: MODEL TRAINING V1

**Week 11-12 | Goal: Train first working binary classification model**

> **V1 Approach:** Binary classification — "Will this fixed-2R trade win or lose?"
> Uses 195+ pin bar labels with 47 feature columns including MFE.
> MFE is included as a training feature in V1 only for feature importance analysis — it will NOT be available at prediction time (since MFE is only known after the trade). It helps identify which patterns have high movement potential.

### Task 5.1: Learn Python Basics

**What to do:**
- Complete 'Python for JavaScript Developers' tutorial (search online)
- Focus on: variables, functions, loops, importing libraries
- Learn pandas basics (reading CSV, selecting columns, filtering rows)
- Don't overthink it — you only need fundamentals

**Deliverable:** Comfortable reading/writing basic Python

*Time estimate: 8-12 hours*

*Success check: Can load a CSV and print first 10 rows in Python*

### Task 5.2: First Training Script

**What to do:**
- Create Jupyter notebook or .py file
- Load your labeled CSV into pandas
- Separate features (X) from target (y = win/loss at 2R)
- **Important:** Exclude MFE and outcome-derived columns from training features (they're future-leaking). Use them only for analysis.
- Split into train/test (80/20 time-based split — never shuffle time-series)
- Train simple XGBoost classifier
- Evaluate accuracy

**Deliverable:** Working training script that produces accuracy score

*Success check: Test accuracy above 55% (better than random)*

### Task 5.3: Feature Importance Analysis

**What to do:**
- Extract feature importances from trained model
- Create visualization (bar chart)
- Identify top 10 most important features
- Check if they make intuitive sense
- **Analyze MFE distribution:** Plot MFE by win/loss, by quality rating, by context. This informs V2/V3 development.
- Document findings

**Deliverable:** Report showing which features matter most + MFE distribution analysis

*Success check: Context features (trend, support quality) rank highly*

### Task 5.4: Context Performance Analysis

**What to do:**
- Group test results by context conditions
- Calculate win rate for:
  - Each trend alignment type
  - Each session
  - Support quality buckets
  - Combined high-quality contexts
- Compare actual vs predicted probabilities
- **Analyze MFE by context:** Which contexts produce the largest favorable excursions? This identifies where V3 regression will add the most value.

**Deliverable:** Report showing model performance by context + MFE context analysis

*Success check: Model predictions match reality (70% prediction ≈ 70% actual)*

---

## PHASE 6: ITERATION & IMPROVEMENT

**Week 13-15 | Goal: Improve model to 65%+ accuracy, evolve to V2 multi-R classification**

### Task 6.1: Error Analysis

**What to do:**
- Review all false positives (predicted win, actual loss)
- Review all false negatives (predicted loss, actual win)
- Look for patterns in mistakes
- Identify missing features or mislabeled data
- **Analyze MFE of misclassified trades:** Did false negatives have high MFE (price moved favorably but didn't reach 2R)? This suggests variable TP would have won.

**Deliverable:** List of insights on why model fails + MFE analysis of errors

*Success check: Find at least 3 clear patterns in failures*

### Task 6.2: Add More Labels (Target: 200-300)

**What to do:**
- Run candidate finder on additional data or different pairs
- Label 100+ more examples using semi-automated workflow
- Focus on scenarios where model struggled
- Ensure diverse contexts represented
- Maintain label quality standards
- **All new labels automatically include MFE** (already tracked by outcome calculator)

**Deliverable:** 200-300 total labeled patterns with MFE data

*Time estimate: 2-4 additional hours (semi-automated)*

*Success check: Dataset has good coverage of edge cases*

### Task 6.3: Feature Engineering Improvements

**What to do:**
- Based on error analysis, add new features
- Examples:
  - Interaction features (support_quality x trend_alignment)
  - Ratio features (current_ATR / 90day_avg_ATR)
  - Rolling statistics (win rate of last 10 patterns)
- Re-calculate features for all data

**Deliverable:** Enhanced feature set

*Success check: 5-10 new meaningful features added*

### Task 6.4: Model Retraining & Tuning (V2: Multi-R Classification)

**What to do:**
- Retrain on expanded dataset
- **V2 Evolution:** Instead of binary win/loss at fixed 2R, train a multi-class classifier:
  - Classes: `[loss, 1R, 1.5R, 2R, 3R+]` based on actual MFE data
  - Use MFE buckets as labels: MFE < 1 = loss, 1 <= MFE < 1.5 = 1R, etc.
  - This tells you not just IF a trade will win, but HOW FAR price is likely to move
- Experiment with hyperparameters:
  - max_depth (try 3, 5, 7)
  - learning_rate (try 0.01, 0.05, 0.1)
  - n_estimators (try 100, 200, 300)
- Use cross-validation to find best settings
- Compare V2 multi-class to V1 binary baseline

**Deliverable:** V2 model with multi-R-target classification

*Success check: V2 accuracy improves 3-5% over V1; MFE bucket predictions are meaningful*

---

## PHASE 6B: MFE REGRESSION MODEL (V3)

**Week 16-17 | Goal: Train regression model to predict optimal take-profit levels**

> **Prerequisites:** 500+ labeled patterns with MFE data. If you don't have enough labels yet, continue labeling in Phase 7 and return to this phase when ready.

### Task 6B.1: MFE Data Analysis

**What to do:**
- Load all labeled data with MFE values
- Analyze MFE distribution: mean, median, std dev, percentiles
- Plot MFE vs each feature to identify correlations
- Identify which features most strongly predict high MFE
- Check if MFE distribution is normal or skewed (affects model choice)

**Deliverable:** MFE statistical profile and feature correlation report

*Success check: Can identify 5+ features that correlate with MFE > 2.0*

### Task 6B.2: Train MFE Regression Model

**What to do:**
- Create new training script for regression (not classification)
- Target variable: MFE (continuous, in R units)
- Use XGBoost regressor (or try LightGBM)
- Features: same 47 columns minus outcome-derived fields
- Time-based train/test split
- Evaluate with MAE (Mean Absolute Error) and R-squared
- Compare predicted MFE vs actual MFE scatter plot

**Deliverable:** Working MFE regression model

*Success check: R-squared > 0.3 (meaningful predictive power beyond random)*

### Task 6B.3: Dynamic Take-Profit Strategy

**What to do:**
- Use predicted MFE to set dynamic TP levels:
  - Conservative: TP = 70% of predicted MFE
  - Moderate: TP = 80% of predicted MFE
  - Aggressive: TP = 90% of predicted MFE
- Backtest each strategy against fixed-2R approach
- Calculate: win rate, average R, profit factor for each
- Determine which percentile performs best

**Deliverable:** Dynamic TP strategy with backtested performance comparison

*Success check: Dynamic TP outperforms fixed-2R on profit factor*

### Task 6B.4: Ensemble Decision System

**What to do:**
- Combine V1 classifier + V3 regressor into unified decision:
  - V1 classifier says "take this trade" (probability > threshold)
  - V3 regressor says "set TP at X pips" (based on predicted MFE)
- Build decision logic:
  - If classifier probability > 65% AND predicted MFE > 1.5R → strong signal
  - Set TP = 80% of predicted MFE (or minimum 1.5R)
  - Set SL as normal (pattern-defined)
- Test ensemble vs individual models

**Deliverable:** Combined classifier + regressor trading system

*Success check: Ensemble produces higher profit factor than either model alone*

---

## PHASE 7: SECOND SETUP TYPE

**Week 18-20 | Goal: Add diversity to your signal generation**

### Task 7.1: Choose Second Pattern

**What to do:**
- Select complementary pattern (e.g., if did Pin Bars, now do Head & Shoulders)
- Study pattern thoroughly
- Define strict criteria
- Decide if you'll train separate model or combined model (recommend separate)

**Deliverable:** Definition document for second pattern

### Task 7.2: Label Second Pattern (100+ examples)

**What to do:**
- Build/adapt candidate finder for second pattern type
- Use same semi-automated labeling workflow
- Apply same rigor to context capture
- Aim for 100-150 labels
- Track pattern-specific insights
- **MFE is automatically captured** for all new labels

**Deliverable:** 100-150 labels of second pattern type (with MFE)

*Time estimate: 2-4 hours (semi-automated)*

### Task 7.3: Train Second Model

**What to do:**
- Use same training approach as first pattern
- May need different features (H&S has shoulder heights, pin bars don't)
- Train V1 classifier first, then V2 multi-class if enough data
- **If total labels across all patterns exceed 500:** Train V3 regression model for this pattern type too
- Train, evaluate, iterate
- Aim for 60%+ accuracy

**Deliverable:** Second trained model (V1 classifier minimum, V2/V3 if data permits)

*Success check: Both models performing at 60%+ on test data*

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

| Milestone | Target Date | Success Criteria |
|---|---|---|
| Dev environment ready | End Week 1 | Can run JS and Python code |
| 1000+ candles in database | End Week 3 | Clean historical data stored |
| Labeling tool working | End Week 5 | Can mark and export patterns with MFE |
| 100 patterns labeled | End Week 8 | First training dataset ready |
| First model trained (V1) | End Week 12 | 60%+ test accuracy (binary classification) |
| 200+ patterns labeled | End Week 15 | Expanded dataset with MFE |
| Model V2 improved | End Week 16 | 65%+ accuracy, multi-R classification working |
| **V3 MFE regression trained** | **End Week 17** | **R-squared > 0.3, dynamic TP backtested** |
| Scanner operational | End Week 23 | Automatic pattern detection + dynamic TP |
| 30 paper trades | End Month 6 | System validated with fake money |
| **Dynamic TP vs Fixed TP compared** | **End Month 7** | **V3 dynamic TP outperforms fixed 2R** |
| 60 paper trades | End Month 8 | Consistent performance |
| Go live | Month 10+ | 3 months profitable paper trading |

---

## MODEL EVOLUTION STRATEGY

The model evolves in three stages. Each stage builds on the previous one and requires more data:

### V1: Binary Classification (200+ labels)
- **Question:** "Will this fixed-2R trade win or lose?"
- **Target:** Binary (win/loss)
- **TP Strategy:** Fixed at 2R for all trades
- **When:** Phase 5 (first training)
- **Data needed:** 200+ labels minimum

### V2: Multi-R Classification (300+ labels)
- **Question:** "How far will price move in my favor?"
- **Target:** Multi-class buckets `[loss, 1R, 1.5R, 2R, 3R+]` derived from MFE data
- **TP Strategy:** Set TP based on predicted R-bucket (e.g., if model predicts 3R+, use 2.5R TP)
- **When:** Phase 6 iteration (after error analysis)
- **Data needed:** 300+ labels with MFE

### V3: MFE Regression (500+ labels)
- **Question:** "Exactly how many R will price move favorably?"
- **Target:** Continuous MFE value (e.g., 2.37R)
- **TP Strategy:** Dynamic — set TP at 80% of predicted MFE (configurable percentile)
- **When:** Phase 6B (or whenever 500+ labels accumulated)
- **Data needed:** 500+ labels with MFE
- **Key insight:** MFE (Max Favorable Excursion) tracks the peak favorable price movement in R units before the trade resolves. This lets the model learn not just IF a trade will work, but HOW MUCH opportunity exists — enabling intelligent TP placement instead of fixed targets.

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

## REALISTIC TIMELINE

**Aggressive:** 6 months to live trading
**Realistic:** 9-12 months to live trading
**Conservative:** 12-18 months to consistent profitability

### Your timeline depends on:
- Hours per week available (10hrs = fast, 5hrs = slow)
- JavaScript/coding comfort level
- Discipline in labeling quality
- Patience in paper trading phase

*Remember: This is a marathon, not a sprint. The traders who succeed are the ones who stay disciplined, track everything meticulously, and refuse to skip the validation phases. Trust the process.*
