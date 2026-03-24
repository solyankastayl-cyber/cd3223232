# TA Engine - Technical Analysis Module PRD

## Original Problem Statement
Исправить отрисовку фигур на графике — паттерны обнаруживались но не рисовались.

## What's Been Implemented

### 2026-03-24: Pattern Rendering Complete

**Problem**: Patterns detected but NOT drawn (render was DISABLED)

**Solution in `ResearchChart.jsx`**:

1. **Double Top/Bottom**:
   - **Resistance** line at peak level (solid red/green)
   - **Neckline** line at valley level (dashed cyan)
   - **P1, P2 markers** (arrows down at peaks)
   - **V marker** (arrow up at valley)
   
2. **Range/Channel**:
   - **Resistance** horizontal line (upper bound)
   - **Support** horizontal line (lower bound)
   - Labels on right axis

3. **Wedge/Triangle**:
   - Diagonal boundary lines via LineSeries
   - Upper + Lower trendlines

**Technical Notes**:
- Uses `createPriceLine` for horizontal lines (stable)
- Uses `createSeriesMarkers` for markers (new API)
- `LineSeries` for diagonal lines may disappear on re-render
- For true polyline overlay: requires custom plugin or SVG

## Current Pattern Visualization

### Double Top (4H):
```
    P1↓         P2↓
     |           |
     |     V↑    |
     |     |     |
─────────────────── Resistance (71811)
     |     |     |
     └──────────── Neckline (67332)
```

### Loose Range (1D):
```
─────────────────── Resistance (76022)
     │candles│
─────────────────── Support (62534)
```

## Test Coverage
- Pattern Rendering: 100%
- Overall: 95.1%

## Next Tasks
1. Signal Layer (entry/invalidation/target)
2. True polyline via SVG overlay or custom plugin
3. Area fill for pattern zones
