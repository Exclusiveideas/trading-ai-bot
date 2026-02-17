# False Breakout Pattern Definition

## Overview

A false breakout (fakeout, bull/bear trap, spring/upthrust) occurs when price penetrates a significant support/resistance level but fails to sustain the move, reversing back inside the prior range. This pattern exploits trapped traders who entered on the breakout.

---

## 1. Mathematical Definition

### What Constitutes a "Breakout"

```
Minimum penetration beyond level: > 0.1 * ATR(14)
Maximum penetration (still "false"): < 1.5 * ATR(14)
  Beyond 1.5 ATR = likely real breakout, don't fade
```

### What Makes It "False"

```
Price must reverse and close back inside the level within 1-3 candles.

Wick-only penetration (body stays inside): ~70% resolve as false breakouts
Body-close penetration: ~45% resolve as false breakouts
```

### Reversal Candle Requirements

```
Close back inside the level on:
  Same candle (wick-only rejection): strongest signal
  Next candle: strong
  Within 2 candles: acceptable
  Within 3 candles: marginal
  > 5 candles: NOT a false breakout
```

### Current Code Gaps

The existing detector (`lib/pipeline/patterns/false-breakout.ts`) has:
- `breakThresholdPips: 5` (fixed pips — should be ATR-based)
- `reversalBars: 3`

**Missing filters to add**:
- ATR-based penetration threshold instead of fixed pips
- Level significance scoring (touches, age, HTF visibility)
- Wick vs body analysis on breakout candle
- Volume analysis (low volume breakout = more likely false)
- Rejection candle quality scoring
- Session timing filter

---

## 2. Types of False Breakouts

### By Level Type

| Type | Description | Reliability |
|------|-------------|------------|
| Horizontal S/R | Break of tested support/resistance | High |
| Swing high/low | Break of previous swing point | High |
| Round numbers | Break of psychological levels (1.3000) | Medium-High |
| Consolidation boundary | Break of range top/bottom | High |
| Trendline | Break of drawn trendline | Medium |
| Equal highs/lows | Break of identical levels (liquidity targets) | Very High |

### Wyckoff Terminology

- **Spring**: False break below support in accumulation (bullish)
- **Upthrust**: False break above resistance in distribution (bearish)
- **Stop hunt / Liquidity grab**: Intentional move to trigger stops before reversing

### Equal Highs/Lows (Prime False Breakout Targets)

```
Equal levels = 2+ swing points within 0.15 * ATR of each other
These are prime liquidity pools where stop losses cluster
False breakouts of equal levels have the highest reliability
```

---

## 3. Component Identification

### Level Identification

```
Significant level requires:
  Minimum: 2 prior touches
  Ideal: 3-5 touches
  Level age: >= 20 candles from first touch
  Touch separation: >= 5 candles apart
  Discard if: < 2 touches, age < 10 candles, or all touches < 3 candles apart
```

### Breakout Candle Detection

```
Upside false breakout (testing resistance):
  brokeAbove = prev.close <= level AND curr.high > level + 0.1 * ATR

Downside false breakout (testing support):
  brokeBelow = prev.close >= level AND curr.low < level - 0.1 * ATR
```

### Wick vs Body Analysis

```
wick_only_breakout = penetration > 0.1 * ATR AND body does not cross level
  -> 70% probability of false breakout

body_breakout = body crosses the level
  -> 45% probability of false breakout

rejection_wick_ratio = rejection_wick / total_range
  > 0.6 = strong rejection
  < 0.3 = weak, likely real breakout
```

### Rejection Candle Quality

| Pattern | Score | Requirements |
|---------|-------|-------------|
| Pin bar at level | 9/10 | Wick > 66%, body < 33%, closes back inside |
| Engulfing at level | 8/10 | 2nd candle engulfs 1st, closes back inside |
| Outside bar reversal | 7/10 | Range engulfs prior candle |
| Doji at level | 5/10 | Body < 10%, wicks both sides |
| Regular close back inside | 4/10 | No special pattern |
| Slow drift back | 2/10 | Multiple candles to reverse |

---

## 4. Validity Filters

### Level Significance

| Criteria | Minimum | Ideal | Weight |
|----------|---------|-------|--------|
| Prior touches | 2 | 3-5 | 2.0x |
| Level age (candles) | 20 | 50-200 | 1.5x |
| Touch separation | 5 candles | 15+ candles | 1.0x |
| HTF visibility | Same TF only | Visible on 2+ higher TFs | 3.0x |
| Confluence factors | 0 | 2+ (round #, fib, MA) | 1.5x each |

### Breakout Conviction (Inverted — Low Conviction = More Likely False)

```
LOW conviction breakout (likely false — trade it):
  volume < 0.8x average
  body < 0.3 of candle range (weak body)
  candle range < 0.5 * ATR (small candle)

HIGH conviction breakout (likely real — do NOT fade):
  volume > 1.5x average WITH strong close
  body > 0.7 of range
  range > 1.2 * ATR
  RSI 40-70 (not exhausted)
```

### Reversal Speed

```
Same candle:     10/10
Next candle:      8/10
Within 2 candles: 6/10
Within 3 candles: 4/10
Within 5 candles: 2/10
No reversal:      0/10 (not a false breakout)
```

### Prior Consolidation

```
Tight consolidation (range < 1.5 * ATR):    +3 quality
Duration 15-50 candles:                      +2
Declining volume in consolidation:           +2
Multiple level tests within consolidation:   +1 per test
```

---

## 5. Context Requirements

### Counter-Trend vs With-Trend

```
WITH HTF trend (best):
  Uptrend + false break below support (spring) = 65-75% win rate
  Downtrend + false break above resistance = 65-75% win rate

COUNTER HTF trend:
  False break against HTF trend direction = 55-65% win rate

AGAINST HTF trend (worst):
  Fading a breakout that aligns with HTF trend = 40-50% (avoid)
```

### Volume Analysis

```
Ideal false breakout volume fingerprint:
  Breakout candle: volume < 1.0x average (no institutional participation)
  Reversal candle: volume >= 1.0x average (buyers/sellers step in)

volume_divergence = volume_reversal / volume_breakout
  > 1.5 = strong confirmation of false breakout
```

### Session Timing (Forex)

```
Asian (00:00-08:00 GMT):     65-75% false breakout probability (best for detection)
London open (07:00-09:00):   60-70% (sweeps Asian range)
NY open (13:00-15:00):       50-60% (sweeps London range)
London close (15:00-17:00):  55-65%
London/NY overlap:           Lower false breakout rate (real breakouts more likely)

Scoring:
  Asian session:           +1.3x weight
  London open 30min:       +1.2x weight
  London/NY overlap:       0.8x weight (breakouts more real here)
```

### Institutional / Liquidity Concepts

```
Order blocks: last bullish candle before a down move = bearish OB (resistance)
  False breakout of order block + close back inside = high reliability

Fair Value Gaps (FVG): candle[i-1].low > candle[i+1].high (bearish FVG)
  False breakout that fills FVG and reverses: +2 quality

Liquidity pools above swing highs / below swing lows:
  Equal highs/lows are prime targets: +3 quality
```

### Multi-Timeframe

```
Level on 2+ timeframes:              +3 quality per additional TF
HTF trend supports reversal:         +4 quality
HTF shows exhaustion at same price:  +2 quality
LTF confirms reversal pattern:       +1 quality
```

---

## 6. When NOT to Fade (Real Breakout Signals)

### Do NOT trade as false breakout when:

1. **Momentum breakout**: body > 1.5 * ATR, closes in top/bottom 20% of range, volume > 2x avg
2. **Third test**: Level tested 3+ times with weakening pullbacks — 3rd test often breaks through
3. **Gap breakout**: Price gaps beyond level by > 0.5 * ATR, not filled within 4 candles
4. **News-driven**: High-impact news, sustained move 15+ min after, volume > 3x avg
5. **Long consolidation breakout**: Range > 100 candles, ATR expanding, BB width at historical lows

### Momentum vs Exhaustion Classification

```
Momentum (likely real):
  Body > 0.7 of range
  Range > 1.2 * ATR
  Volume > 1.5x average
  RSI 40-70 (not exhausted)

Exhaustion (likely false):
  Body < 0.4 of range
  RSI > 70 or < 30
  3+ large candles in same direction preceding (climactic)
```

### Invalidation of False Breakout Trade

```
EXIT when:
  1. Price closes beyond the false breakout wick extreme
  2. Two consecutive candles close beyond the level
  3. Volume on continuation > volume on reversal
  4. Retest of level fails to hold
```

---

## 7. Entry, Stop Loss, Target

### Entry Methods

| Method | Entry | Win Rate | R:R |
|--------|-------|----------|-----|
| Aggressive | Close of rejection candle back inside | 50-55% | 3:1 - 5:1 |
| Conservative | Break of breakout candle body in reversal dir | 60-65% | 2:1 - 3:1 |
| Confirmation | 2 candles close back inside level | 65-70% | 1.5:1 - 2.5:1 |

### Stop Loss

```
Primary: beyond false breakout wick extreme + 0.2 * ATR buffer

For false upside breakout (selling):
  SL = highest high of breakout candles + 0.2 * ATR

For false downside breakout (buying):
  SL = lowest low of breakout candles - 0.2 * ATR

Maximum: never more than 2.0 * ATR from entry
```

### Targets

```
T1: Opposite side of range           (minimum 1.5 * risk)
T2: Opposite side - range_width      (measured move)
T3: Next significant S/R level

ATR-based:
  T1 = entry + 1.5 * ATR
  T2 = entry + 2.5 * ATR
  T3 = entry + 4.0 * ATR

Minimum R:R = 1.5 (skip if lower)
Ideal R:R = 2:1 - 3:1
```

### Scale Out

```
50% at T1 (move stop to breakeven)
30% at T2 (trail stop to T1)
20% at T3 (trail by 1.0 * ATR)
```

---

## 8. Quality Rating (1-10)

### Scoring Components

| # | Factor | Max Points |
|---|--------|-----------|
| 1 | Level significance (touches, HTF visibility) | 1.5 |
| 2 | Breakout conviction — inverted (weak = better) | 1.0 |
| 3 | Rejection quality (pin bar/engulfing at level) | 1.5 |
| 4 | Reversal speed (same candle = best) | 1.0 |
| 5 | Volume confirmation (low break vol, high reversal vol) | 1.0 |
| 6 | HTF trend alignment (supports reversal) | 1.0 |
| 7 | Confluence count (round #, fib, MA, OB, FVG) | 1.0 |
| 8 | Session timing (Asian/London open sweep) | 0.5 |
| 9 | Prior consolidation (15-50 bars, declining volume) | 0.5 |
| 10 | R:R available (>= 2.5:1 = full points) | 1.0 |

**Total: 10.0**

### Examples

**9/10 False Breakout:**
- 3+ touches on level, visible on 2+ timeframes
- Wick-only penetration, low volume (0.7x avg)
- Pin bar rejection, closes back inside on same candle
- Volume 1.8x on reversal candle
- HTF uptrend supports bullish reversal
- Level = round number + order block + fib 61.8%
- London open sweep of Asian high
- 30-candle consolidation with declining volume
- 3:1 R:R to opposite side of range

**3/10 False Breakout:**
- 2 touches, current TF only
- Body closes beyond level, moderate-high volume
- Slow 4-bar drift back inside
- Low volume on reversal
- HTF trend supports the breakout direction
- No confluence factors
- London/NY overlap (breakouts tend to be real here)
- No consolidation, trending price action
- < 1.5 R:R available

---

## Key Statistics

| Metric | Value |
|--------|-------|
| General breakout failure rate | 50-70% |
| Wick-only penetrations that fail | ~70% |
| Body-close penetrations that fail | ~45% |
| Low-volume breakouts that fail | 65-75% |
| High-volume + strong close failures | 25-35% |
| 3rd test of level breaks through | ~60% |
| False breakouts with HTF trend alignment win rate | 65-75% |
| False breakouts against HTF trend win rate | 40-50% |
