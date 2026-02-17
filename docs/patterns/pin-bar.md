# Pin Bar Pattern Definition

## Overview

A pin bar is a single-candle reversal pattern characterized by a long wick (tail) rejecting a price level, a small body, and a minimal opposite wick (nose). It signals that price tested a level and was rejected.

---

## 1. Mathematical Definition

### Terminology

```
Total Range (TR) = High - Low
Body Size (BS)   = |Close - Open|
Upper Wick (UW)  = High - max(Open, Close)
Lower Wick (LW)  = min(Open, Close) - Low
Tail             = The long wick (dominant rejection side)
Nose             = The short wick (opposite side)
```

### Primary Ratios

| Metric | Minimum | Ideal | Strict |
|--------|---------|-------|--------|
| Tail / Total Range | >= 60% | >= 66% (2/3) | >= 75% |
| Body / Total Range | <= 33% | <= 25% | <= 20% |
| Nose / Total Range | <= 25% | <= 10% | <= 5% |
| Tail / Body | >= 2.0x | >= 3.0x | >= 4.0x |
| Tail / Nose | >= 3.0x | >= 5.0x | >= 8.0x |

### Detection Formula

```
isPinBar(candle) =
    TR > 0
    AND tail / TR >= 0.60
    AND BS / TR <= 0.33
    AND nose / TR <= 0.25
    AND tail / BS >= 2.0   (if BS == 0, treat as doji — reject)
    AND tail / nose >= 3.0 (if nose == 0, auto-pass)
```

### Current Code Gaps

The existing detector (`lib/pipeline/patterns/pin-bar.ts`) only checks:
- `minWickRatio: 0.60` (tail/range)
- `maxBodyRatio: 0.35` (body/range)

**Missing filters to add**:
- Nose ratio check (`<= 0.25`)
- Tail-to-body ratio (`>= 2.0x`)
- Tail-to-nose ratio (`>= 3.0x`)
- ATR size filter
- Protrusion check

---

## 2. Bullish vs Bearish Variants

### Bullish Pin Bar

```
Tail:          Lower wick >= 60% of TR (pointing down)
Nose:          Upper wick <= 25% of TR
Body position: In the upper 33% of the range
               (min(Open, Close) - Low) / TR >= 0.60
Color:         Bullish close preferred (+0.5 quality) but not required
Context:       At bottom of downtrend pullback OR at support level
```

Related names: Hammer (after downtrend), Hanging Man (same shape, after uptrend = bearish warning)

### Bearish Pin Bar

```
Tail:          Upper wick >= 60% of TR (pointing up)
Nose:          Lower wick <= 25% of TR
Body position: In the lower 33% of the range
               (High - max(Open, Close)) / TR >= 0.60
Color:         Bearish close preferred (+0.5 quality) but not required
Context:       At top of uptrend rally OR at resistance level
```

Related names: Shooting Star (after uptrend), Inverted Hammer (same shape, after downtrend = bullish)

### Key Insight

For algorithmic detection: only two shape detectors needed (bullish/bearish pin). The four traditional names are the same two shapes in different trend contexts.

---

## 3. Validity Filters

### 3a. Candle Size vs ATR

```
ATR period = 14

REJECT if TR < 0.5 * ATR(14)       — too small, likely noise
REJECT if TR > 3.0 * ATR(14)       — abnormally large, likely news spike

Ideal range: 0.75 * ATR(14) <= TR <= 2.0 * ATR(14)
```

### 3b. Wick Protrusion Beyond Prior Candles

The tail should protrude beyond recent price action, showing rejection of a new level.

```
Lookback = 5 candles (configurable)

Bullish: pin bar Low < min(Low[1..5])
Bearish: pin bar High > max(High[1..5])

Scoring:
  No protrusion:          -2 quality
  Protrudes past 3 bars:  +1
  Protrudes past 5 bars:  +2
  Protrudes past 10 bars: +3 (strong rejection)
```

### 3c. Body Position Within Range

```
Bullish: (min(Open, Close) - Low) / TR >= 0.60, ideal >= 0.70
Bearish: (High - max(Open, Close)) / TR >= 0.60, ideal >= 0.70
```

### 3d. Volume Characteristics

```
volume_ratio = Volume(pin_bar) / SMA(Volume, 20)

>= 1.5:  Strong confirmation (+2 quality)
>= 1.2:  Moderate confirmation (+1 quality)
<  0.8:  Weak, low-conviction (-1 quality)
<  0.5:  Likely noise (-2 quality)
```

### 3e. Close Strength

```
Bullish: close_strength = (Close - Low) / TR, ideal >= 0.70
Bearish: close_strength = (High - Close) / TR, ideal >= 0.70
```

---

## 4. Context Requirements

### 4a. Trend Alignment

```
EMA_fast = EMA(Close, 20)
EMA_slow = EMA(Close, 50)

Best setups:
  - Bullish pin bar during uptrend pullback (continuation)
  - Bearish pin bar during downtrend rally (continuation)
  - Pin bar at key level counter-trend (reversal — requires stronger confluence)

ADX filter:
  ADX >= 20: Trending market — pin bars more reliable
  ADX <  20: Ranging/choppy — pin bars less reliable (trade only at range extremes)
```

### 4b. Support/Resistance Proximity

```
proximity_threshold = 0.5 * ATR(14)

Tail touches/pierces key level:  +2 quality
Within proximity, no touch:      +1 quality
Not near any level:              -2 quality

Key levels include: horizontal S/R, round numbers, moving averages,
  Fibonacci levels, prior day high/low, weekly open
```

### 4c. Session Timing (Forex)

```
London/NY overlap (12:00-16:00 UTC):  +1 quality (best)
London or NY session:                  0 (neutral)
Asian session:                        -1 quality
First/last 30 min of session:         -1 (erratic)
Daily timeframe:                      N/A
```

### 4d. Volatility Regime

```
ATR percentile (100-bar lookback):
  < 25th percentile:  Less reliable (tight ranges)
    EXCEPTION: pin bar breaking out of compression = very strong
  25th-75th:          Ideal for pin bar trading
  > 75th percentile:  Apply stricter ratios (tail >= 70%)
```

### 4e. Multi-Timeframe Confluence

```
Pin bar at HTF S/R level:         +2
Aligned with HTF trend:           +1
HTF also shows pin bar:           +3 (strongest)
Against HTF trend, no level:      -2
```

---

## 5. Rejection Rules

REJECT the pin bar if ANY of the following are true:

1. `TR < 0.5 * ATR(14)` — candle too small
2. `TR > 3.0 * ATR(14)` — abnormal spike, likely news
3. Body is a doji (`BS < 0.03 * TR`) AND tail < 75% — indecision, not pin bar
4. Both wicks long: `min(UW, LW) / TR > 0.25` — spinning top/doji
5. Pin bar is inside the prior candle's range AND no protrusion
6. Next candle immediately invalidates (bullish pin: next close below pin low)
7. Forms in the middle of a range with no nearby S/R
8. 3+ consecutive alternating pin bars — choppy market

### Ranging Market Filter

```
In ranging markets (ADX < 20):
  Only trade at range extremes (top/bottom 20%)
  Reject all in the middle 60%

range_position = (Close - range_low) / (range_high - range_low)
Bullish: range_position <= 0.20
Bearish: range_position >= 0.80
```

---

## 6. Entry, Stop Loss, Target Rules

### Entry Methods

| Method | Entry | Pros | Cons |
|--------|-------|------|------|
| Break of nose | `High + buffer` (bullish) | Confirms momentum, +5-8% win rate | Worse R:R |
| 50% retrace | `Low + 0.5 * TR` (bullish) | Best R:R (nearly 2x improvement) | ~40-50% fill rate |
| Immediate | `Close` of pin bar | Never misses signal | Worst R:R |

Buffer = `max(spread * 2, 0.1 * ATR(14))`

### Stop Loss

```
Bullish: SL = Low - buffer, where buffer = max(spread * 2, 0.1 * ATR(14))
Bearish: SL = High + buffer

Alternative (ATR-based): SL = entry +/- 1.5 * ATR(14)

Never tighter than 0.5 * ATR(14) from entry
Never wider than 2.0 * ATR(14) from entry
```

### Targets

```
risk = |entry - stop_loss|

TP1 = entry + 1.5R  (take 50% off)
TP2 = entry + 2.0R  (take 30% off)
TP3 = entry + 3.0R  (let 20% run with trailing stop)

Minimum acceptable R:R = 1.5
If structure target < 1.5R: skip the trade

Trailing stop after TP1: move to breakeven, trail by 1.0 * ATR(14)
```

---

## 7. Quality Rating (1-10)

### Scoring Components

```
Base score = 5

SHAPE (max +/- 3):
  tail >= 0.75:      +1
  body <= 0.15:      +1 (very small body)
  nose <= 0.05:      +1 (almost no nose)

PROTRUSION (max +/- 2):
  Past 10+ candles:  +2
  Past 5 candles:    +1
  No protrusion:     -2

LOCATION (max +/- 2):
  HTF S/R level:     +2
  Minor S/R:         +1
  No level:          -2

TREND (max +/- 1):
  With trend:        +1
  Counter at level:  +0
  Counter, no level: -1

VOLUME (max +/- 1):
  >= 1.5x avg:       +1
  < 0.8x avg:        -1

CANDLE SIZE (max +/- 1):
  0.75-2.0x ATR:     +0
  0.5-0.75x ATR:     -0.5
  > 2.0x ATR:        -0.5

MTF (max +/- 1):
  HTF pin + level:   +1
  HTF contradiction: -1

CLOSE DIRECTION (max +/- 0.5):
  In signal dir:     +0.5
  Against signal:    -0.5

Final = clamp(base + modifiers, 1, 10)
```

### Examples

**9/10 Pin Bar (EUR/USD Daily)**:
- Tail 78%, body 12%, nose 10%
- Protrudes below last 8 daily lows
- Exactly at weekly support (1.0800)
- Uptrend pullback to support
- Volume 1.6x average
- H4 also shows rejection at same level
- Bullish close

**3/10 Pin Bar (GBP/USD H1)**:
- Tail 62% (barely qualifies), body 30%
- No protrusion
- No S/R nearby
- ADX 15 (choppy)
- Volume 0.7x average
- Asian session
- Middle of a range

---

## Implementation Notes

1. **Two-pass approach**: Shape detection first (fast, pure math), then context evaluation (requires lookback, S/R, MTF)
2. **Sensitivity**: Tail ratio threshold has largest impact on signal frequency. At 60% expect 3-5x more signals than at 75%.
3. **Timeframe**: Most reliable on H4 and Daily. M1-M15 has high noise. Weekly is rare but powerful.
4. **Recommended starting parameters**:
   - Tail >= 66% of range
   - Body <= 25% of range
   - Nose <= 15% of range
   - ATR: 0.5x to 2.5x ATR(14)
   - Require protrusion past 2+ prior candles
   - Minimum quality: 6/10 for live trading
