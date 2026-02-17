# Double Top & Double Bottom Pattern Definition

## Overview

A reversal pattern where two successive peaks (double top) or troughs (double bottom) form at approximately the same price level, separated by an intermediate retracement. Confirmation occurs when price breaks the neckline (the intermediate extreme between the two tests).

---

## 1. Mathematical Definition

### Structure

```
Double Top:    P1 (peak) -> V (valley/neckline) -> P2 (peak) -> Breakdown
Double Bottom: T1 (trough) -> P (peak/neckline) -> T2 (trough) -> Breakout
```

### Price Tolerance Between Peaks/Troughs

| Quality | Tolerance |
|---------|-----------|
| Exact | 0-0.5% |
| Tight | 0.5-1.5% |
| Standard | 1.5-3.0% |
| Loose | 3.0-5.0% |
| REJECT | > 5% |

```
tolerance = abs(P1 - P2) / P1
VALID if tolerance <= 0.03 (3% — recommended default)
```

### Pullback Depth Between Tests

```
pattern_height = max(P1, P2) - neckline  (double top)
pullback_ratio = pattern_height / max(P1, P2)

VALID if pullback_ratio >= 0.03 AND pattern_height >= 1.0 * ATR(14)
STRONG if pattern_height >= 2.0 * ATR(14)
```

### Time Between Peaks/Troughs

| Constraint | Candles |
|-----------|---------|
| Minimum separation | 10 |
| Optimal range | 15-65 |
| Maximum | 150 |
| Bulkowski average | ~2-6 weeks (daily) |

### Minimum Pattern Candles

```
Total pattern: >= 20 candles
Recommended: >= 25 candles (< 22 days has higher failure)
```

### Minimum Pattern Height

```
VALID:  height >= 2.0 * ATR(14)
STRONG: height >= 3.0 * ATR(14)
REJECT: height < 1.5 * ATR(14)
```

### Current Code Gaps

The existing detectors (`double-top.ts`, `double-bottom.ts`) have:
- `priceTolerance: 0.003` (0.3% — very tight)
- `minPullbackBars: 5`, `maxPullbackBars: 50`, `swingWindow: 3`

**Missing filters to add**:
- ATR-based minimum pattern height (>= 2.0 ATR)
- Prior trend requirement
- Pullback depth validation
- Volume analysis
- Second peak/trough behavior (lower high is strongest)
- RSI divergence check

---

## 2. Component Identification

### Swing Point Detection

```
N-bar pivot high (for peaks):
  high[i] >= max(high[i-N..i-1]) AND high[i] >= max(high[i+1..i+N])

N-bar pivot low (for troughs):
  low[i] <= min(low[i-N..i-1]) AND low[i] <= min(low[i+1..i+N])

Recommended N: 5 (general-purpose default)
```

### Neckline Definition

```
Double Top:    neckline = lowest low between P1 and P2
Double Bottom: neckline = highest high between T1 and T2

More robust (wide valley/peak):
  neckline = lowest low in range [P1_index + 2, P2_index - 2]
```

### Second Peak/Trough Behavior

| Behavior | Signal Strength | Description |
|----------|----------------|-------------|
| Lower high (P2 < P1 by 0.5-3%) | **Strongest** | Sellers gaining control |
| Exact equal (within 0.5%) | Strong | Classic pattern |
| Marginal new high (P2 > P1 by 0.5-2%) | Strong | Bull trap (if fails in 1-3 bars) |
| Decisively higher (P2 > P1 by > 3%) | **REJECT** | Not a double top |

For double bottoms: mirror logic (higher low = strongest).

---

## 3. Validity Filters

### Prior Trend Requirement

```
Double Top: preceded by uptrend
  - ADX >= 20 at P1
  - Price above SMA(50) at P1
  - Gained >= 1.5 * pattern_height before P1
  - Prior trend >= 20 bars

Double Bottom: preceded by downtrend (mirror)
REJECT if ADX < 20 (ranging)
```

### Volume Characteristics

```
Double Top (ideal):
  vol_P2 < vol_P1 * 0.85   — 15%+ decline on second peak
  vol_breakdown > SMA(Volume, 20) * 1.5  — spike on break

Double Bottom (ideal):
  vol_T2 <= vol_T1
  vol_breakout > SMA(Volume, 20) * 1.5

CAUTION: vol_P2 > vol_P1 * 1.2 = more buyers at P2, possible continuation
```

### Time Quality Score

```
15-65 bars:    1.0 (optimal)
10-15 or 65-100: 0.7
100-150:       0.4
< 10 or > 150: REJECT
```

---

## 4. Variations (Adam & Eve Classification)

### Detection

```
Adam: Sharp V-shape, 1-3 bars, one dominant spike candle
  adam_score = max_single_bar_range / total_swing_range >= 0.5
  OR swing completes in <= 3 bars

Eve: Rounded U-shape, 5+ bars, multiple tests of extreme zone
  Price stays within 1% of extreme for >= 3 bars
```

### Statistical Reliability (Bulkowski, stocks)

| Variation | Avg Decline (DT) | Avg Rise (DB) | Failure Rate | Rank |
|-----------|------------------|---------------|-------------|------|
| Eve & Eve | 19% | 40% | Lowest | **1st (Best)** |
| Adam & Eve | 18% | 37% | Moderate | 2nd |
| Eve & Adam | 17% | 34% | Moderate | 3rd |
| Adam & Adam | 17.5% | 35% | Highest | 4th |

**Eve & Eve** is most reliable because rounded formations represent sustained supply/demand exhaustion vs temporary spikes.

---

## 5. Context Requirements

### RSI/MACD Divergence

```
Double Top: RSI(14) at P2 < RSI(14) at P1 (bearish divergence)
Double Bottom: RSI(14) at T2 > RSI(14) at T1 (bullish divergence)

Present if RSI difference >= 3 points
Strong if RSI difference >= 8 points

Patterns with divergence have ~40-60% lower failure rates
```

### Key Level Alignment

```
Confluence scoring:
  +2: Major horizontal S/R (2+ touches)
  +2: Round psychological number
  +1: Fibonacci level
  +1: Prior swing from higher TF
  +1: Key moving average (200 SMA, 50 SMA)
  +1: Pivot point level
```

### Multi-Timeframe

```
Same pattern on higher TF:            +3
HTF at key S/R level:                 +2
HTF overbought/oversold RSI:          +1
Lower TF confirms structure break:    +1
```

---

## 6. Breakout & Confirmation

### Neckline Break Requirements

```
Conservative (recommended):
  close < neckline - (0.001 * neckline)  — 0.1% buffer

Aggressive:
  price trades through neckline intrabar (wick counts)

Ultra-conservative:
  2 consecutive closes beyond neckline
```

### Volume on Breakout

```
>= 2.0x average: strong
>= 1.5x average: valid
<  1.0x average: weak (higher failure risk)
```

### Retest Behavior

```
~59% of double tops pull back to neckline
~58% of double bottoms pull back to neckline

Valid retest: within 0.5% of neckline, doesn't close back inside, within 10 bars
Retest entry: often highest R:R entry point
```

### Invalidation

```
Double Top INVALIDATED if:
  close > max(P1, P2) + ATR(14) * 0.5
  OR tolerance > 3% after second peak
  OR > 150 bars without neckline break

Triple test: if P3 forms, reclassify as triple top (more reliable but rarer)
Fourth test: horizontal range, not a pattern
```

---

## 7. Entry, Stop Loss, Target

### Entry Methods

| Method | Trigger | Win Rate | R:R |
|--------|---------|----------|-----|
| Neckline break | Close below/above neckline | ~63-67% | Moderate |
| Neckline retest | Limit at neckline after break | ~60% | Best |
| Aggressive at P2/T2 | At second peak with LTF confirmation | ~45-50% | Highest |

### Stop Loss

```
Double Top:   SL = max(P1, P2) + buffer
Double Bottom: SL = min(T1, T2) - buffer

buffer = max(ATR(14) * 0.5, spread * 3, 0.1% of price)

Retest entry (tighter): SL = P2 + ATR(14) * 0.3
```

### Target (Measured Move)

```
pattern_height = max(P1, P2) - neckline

target_1 = neckline - pattern_height    — 100% measured move
target_2 = neckline - 1.272 * height    — 127.2% Fibonacci
target_3 = neckline - 1.618 * height    — 161.8% Fibonacci

Success rates:
  100% target: ~70%
  127% target: ~55%
  162% target: ~40%

Scale out:
  50% at target_1, 30% at target_2, 20% trailing
```

### Minimum R:R

```
MINIMUM: 1.5
IDEAL:   2.0+
If R:R < 1.0: DO NOT TAKE
```

---

## 8. Quality Rating (1-10)

| # | Factor | Max Points |
|---|--------|-----------|
| 1 | Price tolerance (< 1% = 1.5, 1-2% = 1.0, 2-3% = 0.5) | 1.5 |
| 2 | Prior trend (ADX > 30 + 30+ bars = 1.5) | 1.5 |
| 3 | RSI divergence (> 8pt = 1.5, 3-8pt = 1.0) | 1.5 |
| 4 | Volume confirmation (declining + spike) | 1.0 |
| 5 | Pattern height vs ATR (>= 3x = 1.0) | 1.0 |
| 6 | Time between peaks (15-65 bars = 1.0) | 1.0 |
| 7 | Key level confluence | 1.0 |
| 8 | Adam/Eve classification (Eve-Eve = 0.5) | 0.5 |
| 9 | Breakout volume (> 2x avg = 0.5) | 0.5 |
| 10 | Multi-TF confluence | 0.5 |

**Total: 10.0**

### Examples

**9/10 Double Top:**
- Peaks within 0.3% (1.5)
- 40-bar uptrend, ADX 35 (1.5)
- RSI divergence 12 points (1.5)
- Volume 30% lower at P2, breakdown 2.5x avg (1.0)
- Height 3.5x ATR (1.0)
- 35 bars between peaks (1.0)
- Major weekly resistance + round number (1.0)
- Eve-Eve formation (0.5)

**3/10 Double Top:**
- Peaks differ 4% (0)
- ADX 18, choppy market (0)
- No divergence (0)
- Volume increases at P2 (0)
- Height 1.8x ATR (0)
- 12 bars between peaks (0.5)
- No S/R level (0)
- Adam-Adam (0.1)

---

## Key Statistics (Bulkowski)

| Metric | Double Top | Double Bottom |
|--------|-----------|---------------|
| Avg decline/rise after breakout | -17.3% | +40% |
| Failure rate (< 5% move) | 11% | 5% |
| % meeting measured move target | 72% | 66% |
| Pullback/throwback rate | 59% | 58% |
| Best variation | Eve & Eve | Eve & Eve |
