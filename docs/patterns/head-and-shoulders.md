# Head & Shoulders Pattern Definition

## Overview

A multi-swing reversal pattern consisting of three peaks (H&S top) or three troughs (Inverse H&S bottom), where the middle extreme (head) is the most prominent and the two outer extremes (shoulders) are roughly symmetric. Confirmation occurs when price breaks the neckline connecting the reaction points between the extremes.

---

## 1. Mathematical Definition

### Anatomy

**H&S Top (Bearish Reversal):**
- Left Shoulder (LS): Swing high followed by pullback
- Head (H): Higher swing high (highest point)
- Right Shoulder (RS): Lower swing high, roughly symmetric with LS
- Neckline: Line connecting the two troughs between LS-H and H-RS

**Inverse H&S (Bullish Reversal):**
- Mirror image: swing lows. Head is the lowest point.

### Height Ratios

| Parameter | Minimum | Ideal | Maximum |
|-----------|---------|-------|---------|
| Head height / Avg shoulder height (from neckline) | 1.15x | 1.5x - 2.0x | 3.0x |
| Right Shoulder / Left Shoulder height | 0.60x | 0.85x - 1.15x | 1.40x |
| Shoulder symmetry (RS/LS height %) | 60% | 85-115% | 140% |

Heights measured as perpendicular distance from extreme to neckline at that bar's position.

### Neckline Slope Constraints

```
slope_normalized = abs(SL2_price - SL1_price) / (SL2_index - SL1_index) / ATR(14)

Ideal:      < 0.02 ATR/bar (nearly flat)
Acceptable: < 0.05 ATR/bar
REJECT:     > 0.05 ATR/bar
```

Slope interpretation (H&S top):
- Flat neckline: most reliable
- Downward-sloping: very bearish (confirms weakness)
- Upward-sloping: moderately bearish (pattern fights the slope)

### Minimum Candles

| Constraint | Value |
|-----------|-------|
| Total pattern (LS start to RS end) | >= 20 candles |
| Each component (LS, H, RS) | >= 5 candles |
| Ideal total range | 25-60 candles |
| Maximum before time decay | 150 candles |

### Time Proportions

| Parameter | Minimum | Ideal | Maximum |
|-----------|---------|-------|---------|
| RS duration / LS duration | 0.50 | 0.75 - 1.25 | 2.00 |
| Head duration / Avg shoulder | 0.50 | 0.80 - 1.50 | 2.50 |
| Left side / Right side | 0.40 | 0.70 - 1.30 | 2.50 |

### Current Code Gaps

The existing detector (`lib/pipeline/patterns/head-and-shoulders.ts`) has:
- `swingWindow: 3`, `shoulderTolerance: 0.02`, `minPatternBars: 10`, `maxPatternBars: 80`

**Missing filters to add**:
- Head prominence check (head height > 1.15x avg shoulder)
- Neckline slope constraint
- Time symmetry check
- Prior trend requirement
- Volume pattern analysis
- ATR-based minimum pattern size

---

## 2. Component Identification

### Swing Point Detection

```
Swing High: bar[i].high > bar[i-N].high AND bar[i].high > bar[i+N].high
Swing Low:  bar[i].low  < bar[i-N].low  AND bar[i].low  < bar[i+N].low

Recommended N: 3-5 for daily, 5-7 for intraday
Minimum swing magnitude: 0.5 * ATR(14)
```

### Identification Sequence (H&S Top)

```
1. Find all significant swing highs and lows
2. Find triplets of swing highs where: SH[1] < SH[2] > SH[3] (head is highest)
3. Verify two swing lows exist between the three highs
4. Draw neckline through the two swing lows
5. Validate height ratios, time proportions, neckline slope
6. Apply validity filters
7. Calculate quality score
```

### Neckline Drawing

```
neckline = Line(SL1, SL2) for H&S top
neckline = Line(SH1, SH2) for IH&S bottom

Extended forward: neckline_price(X) = SL1_price + slope * (X - SL1_index)
```

### Volume Pattern (Ideal)

| Component | Volume Expectation |
|-----------|-------------------|
| Left Shoulder rally | Highest (strong buying) |
| Head rally | Lower than LS (weakening) |
| Right Shoulder rally | Lowest of three (exhausted) |
| Neckline break | Spike >= 1.5x average |

```
Quantitative:
  Vol_Head < Vol_LS
  Vol_RS < Vol_Head
  Vol_RS < 0.80 * Vol_LS (stronger confirmation)
  Vol_Breakout >= 1.5 * SMA(Volume, 20)
```

---

## 3. Validity Filters

### Minimum Pattern Size

```
head_to_neckline >= 1.5 * ATR(14)  — minimum
head_to_neckline >= 2.5 * ATR(14)  — ideal
head_to_neckline > 8.0 * ATR(14)   — likely parabolic, not clean H&S
```

### Prior Trend Requirement

```
H&S top: preceded by uptrend
  - Price gained >= 2 * ATR(14) over 30 bars before LS
  - SMA(20) slope positive over 20 bars before LS
  - Ideal: prior trend >= 2x pattern width in bars

IH&S bottom: preceded by downtrend (mirror conditions)
```

### Head Must Be the Extreme

```
H&S:  Head_High > max(LS_High, RS_High)  — strictly
IH&S: Head_Low  < min(LS_Low, RS_Low)    — strictly

If RS exceeds the head: INVALIDATED (trend continuation)
```

### Shoulder Height Tolerance

```
abs(LS_height - RS_height) / avg(LS_height, RS_height) <= 0.40 (40% max)
Ideal: <= 20%
```

---

## 4. Context Requirements

### Trend Maturity

```
Minimum prior trend: 2x the pattern width
Ideal: 3-5x the pattern width
Trend < 30 bars: too young for reliable reversal
Mature trends (100+ bars): highest probability H&S
```

### Key Level Alignment

Head within 0.5 * ATR(14) of:
- Major horizontal S/R (2+ prior touches)
- Round number
- Fibonacci level (61.8%, 100%, 161.8%)
- Weekly/Monthly high/low

### RSI/MACD Divergence

```
H&S top: RSI at Head < RSI at LS (bearish divergence)
IH&S:    RSI at Head > RSI at LS (bullish divergence)

divergence_present = RSI difference >= 3 points
strong_divergence = RSI difference >= 8 points
```

Divergence at the head is one of the strongest confirming signals.

### Multi-Timeframe

```
Pattern on lower TF + higher TF confirms:   +2 quality
Higher TF contradicts:                       -1 quality
Pattern visible on 2+ timeframes:            strongest
```

---

## 5. Breakout & Confirmation

### Neckline Break Requirements

| Method | Definition | Reliability |
|--------|-----------|-------------|
| Close break | Candle closes beyond neckline | High (recommended) |
| ATR filter | Close beyond by >= 0.25 * ATR(14) | Very high |
| Two-bar confirmation | 2 consecutive closes beyond | Highest but late |

Recommended: `close beyond neckline by max(0.25 * ATR(14), 0.5% of price)`

### Volume on Breakout

```
>= 2.0x average: ideal
>= 1.5x average: acceptable
<  1.0x average: high failure rate (~50%+)
```

### Neckline Retest

```
~40-50% of valid H&S breakouts retest the neckline
Retest typically within 5-15 bars

Retest zone: neckline +/- 0.3 * ATR(14)
Valid retest: price enters zone, shows rejection candle, doesn't close back inside
Failed retest: price closes back beyond neckline = pattern failure
```

### Invalidation

- Price closes above RS extreme after neckline break
- Price makes new high above head (H&S) / new low below head (IH&S)
- Breakout on very low volume reverses within 3 bars
- 2x pattern duration elapses without neckline break after RS

---

## 6. False Signals

### When to REJECT

1. No prior trend (forms in sideways range)
2. Head is not the extreme (RS exceeds head)
3. Shoulders grossly asymmetric (ratio outside 0.60-1.40)
4. Neckline too steep (> 0.05 ATR/bar)
5. Pattern too small (head-to-neckline < 1.5 ATR)
6. Volume increasing on RS (suggests continuation)
7. Higher TF strongly contradicts

### Continuation Traps

Red flags:
- Pattern after brief trend (< 20 bars)
- Height < 2.0 ATR
- Volume doesn't decline across formation
- Pattern width < 30% of prior trend duration
- Failed H&S breakdowns often lead to explosive moves in original direction

### Time Decay

- Patterns > 150 candles lose structural significance
- RS taking > 2.5x LS duration: pattern degrading
- Target not reached within 2x pattern duration: thesis weakens

---

## 7. Entry, Stop Loss, Target

### Entry Methods

| Method | Trigger | R:R |
|--------|---------|-----|
| Aggressive (at RS) | RS + reversal candle confirmation | 2:1 - 5:1 |
| Standard (neckline break) | Close beyond neckline | 1.5:1 - 3:1 |
| Conservative (retest) | Neckline retest rejection | 2:1 - 4:1 |

### Stop Loss

| Method | Placement |
|--------|-----------|
| Above/below head | Head extreme + 0.5 * ATR (widest) |
| Above/below RS | RS extreme + 0.5 * ATR (standard, recommended) |
| Neckline-based | Neckline + 0.5 * ATR (tightest, retest entry only) |

### Target Calculation (Measured Move)

```
pattern_height = abs(Head_extreme - neckline_price_at_head)

target_1 = breakout_price +/- (0.75 * pattern_height)   — conservative (75%)
target_2 = breakout_price +/- (1.00 * pattern_height)   — standard (100%)
target_3 = breakout_price +/- (1.618 * pattern_height)  — extended (Fibonacci)

Statistics: ~55-60% reach the full 100% measured move
            ~76% is the average achievement
```

### Scale-Out Plan

```
50% at Target 1 (0.75x height) -> move stop to breakeven
30% at Target 2 (1.00x height) -> trail by 1.5 ATR
20% at Target 3 (1.618x height) or trail
```

---

## 8. Quality Rating (1-10)

| # | Criterion | Max Points |
|---|-----------|-----------|
| 1 | Prior trend (>= 2x pattern width) | 1.5 |
| 2 | Shoulder symmetry (height 85-115%, time 75-125%) | 1.5 |
| 3 | Head prominence (1.5-2.5x avg shoulder) | 1.0 |
| 4 | Neckline flatness (slope < 0.02 ATR/bar) | 1.0 |
| 5 | Volume signature (declining + breakout spike) | 1.5 |
| 6 | RSI/MACD divergence at head | 1.0 |
| 7 | Key level alignment (head at major S/R) | 1.0 |
| 8 | Pattern size (2.5+ ATR, 25-60 candles) | 0.5 |
| 9 | Multi-TF confluence | 0.5 |
| 10 | Clean structure (clear swings, no noise) | 0.5 |

**Total: 10.0**

### Examples

**9/10 H&S Top:**
- 80+ bar uptrend preceding
- Shoulders within 10% height, 20% time
- Head 1.8x shoulder height
- Flat neckline (< 0.01 ATR/bar)
- Declining volume LS > H > RS, breakout at 2x avg
- RSI bearish divergence at head
- Forms at major weekly resistance
- Daily confirms reversal

**3/10 H&S Top:**
- 15-bar shallow prior trend
- Shoulders differ 35% in height
- Head barely exceeds shoulders (1.18x)
- Steep neckline (> 0.04 ATR/bar)
- Erratic volume, no decline pattern
- No divergence
- No significant level
- HTF in strong opposing trend
