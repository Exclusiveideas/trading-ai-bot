# Pattern Definition Documents

Professional-grade quantitative definitions for algorithmic pattern detection.
These documents serve as the ground truth for labeling, detection tuning, and quality scoring.

## Patterns

| Pattern | File | Signal Type | Complexity |
|---------|------|-------------|------------|
| Pin Bar | [pin-bar.md](./pin-bar.md) | Single-candle reversal | Low |
| Head & Shoulders | [head-and-shoulders.md](./head-and-shoulders.md) | Multi-swing reversal | High |
| Double Top / Bottom | [double-top-bottom.md](./double-top-bottom.md) | Two-swing reversal | Medium |
| False Breakout | [false-breakout.md](./false-breakout.md) | Level rejection | Medium |

## How to Use

1. **Labeling (Phase 4)**: Use quality rating criteria when reviewing candidates
2. **Detector Tuning**: Reference mathematical definitions to adjust detection thresholds
3. **Model Features**: Context requirements map directly to feature engineering
4. **Trade Rules**: Entry/SL/TP rules inform the outcome calculator

## Quality Rating Scale (All Patterns)

| Score | Grade | Action |
|-------|-------|--------|
| 9-10 | A+ | Trade with full position size |
| 7-8 | A | Trade with standard position size |
| 5-6 | B | Trade with reduced size (50%) |
| 3-4 | C | Skip or paper-trade only |
| 1-2 | D | Do not trade |
