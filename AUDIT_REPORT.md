# FULL AUDIT REPORT - TA Engine Research Module

## Executive Summary

**ГЛАВНАЯ ПРОБЛЕМА**: График не отрисовывается потому что **frontend ожидает данные в другой структуре, чем их отдает backend**.

---

## 1. BACKEND ANALYSIS

### 1.1 Data Flow
```
Coinbase API → ta_routes.py → per_tf_builder.py → pattern_history_scanner.py → anchor_pattern_builder.py
                                    ↓
                           pattern_render_contract
                                    ↓
                              Frontend
```

### 1.2 Pattern Detection Pipeline
1. `ta_routes.py` получает candles от Coinbase
2. `per_tf_builder.build()` строит полный TA payload
3. `pattern_history_scanner.scan()` сканирует историю и находит паттерны
4. `anchor_pattern_builder.build()` строит render contract с boundaries
5. `display_gate.evaluate()` проверяет качество

### 1.3 CRITICAL ISSUE #1: Структура данных

**Backend отдает:**
```json
{
  "pattern_render_contract": {
    "type": "falling_wedge",
    "render": {
      "boundaries": [{...}, {...}],  // ← ДАННЫЕ ЗДЕСЬ
      "levels": [...],
      "touch_points": [...]
    }
  }
}
```

**Frontend ожидает:**
```json
{
  "pattern_render_contract": {
    "type": "falling_wedge",
    "boundaries": [{...}, {...}],  // ← ДАННЫЕ ДОЛЖНЫ БЫТЬ ЗДЕСЬ
  }
}
```

**File**: `/app/backend/modules/ta_engine/pattern/anchor_pattern_builder.py` (lines 599-602)
**Fix needed**: Добавить `boundaries` на top-level ИЛИ изменить frontend.

---

## 2. FRONTEND ANALYSIS

### 2.1 File Structure
```
/frontend/src/
├── pages/TechAnalysis/index.jsx          # Entry point for /tech-analysis
├── modules/cockpit/
│   ├── TechAnalysisModule.jsx            # Main module wrapper
│   ├── views/ResearchViewNew.jsx         # Research tab view (2303 lines!)
│   ├── components/
│   │   ├── ResearchChart.jsx             # Chart component (1505 lines)
│   │   ├── PatternOverlay.jsx            # Pattern overlay
│   │   └── PatternGeometryRenderer.jsx   # Pattern geometry renderer
│   └── renderers/                        # Render plan renderers
├── chart/renderers/
│   └── patternRenderer.js                # Pattern rendering logic
└── services/
    ├── researchService.js                # Research API calls
    └── setupService.js                   # Setup API calls
```

### 2.2 Data Fetch Flow
```javascript
// ResearchViewNew.jsx (line 662)
const url = `/api/ta-engine/mtf/${baseSymbol}?timeframes=${allTFs}`;
const response = await fetch(url);
const data = await response.json();

// Data stored:
setTfMap(data.tf_map);          // All timeframe data
setSetupData(activeTFData);      // Active TF data
```

### 2.3 CRITICAL ISSUE #2: Chart Rendering

**File**: `/app/frontend/src/modules/cockpit/components/ResearchChart.jsx`

Chart ожидает данные в `render_plan` структуре, но pattern overlay использует:
```javascript
// patternRenderer.js (line 33)
export function drawBoundaries(chart, boundaries, options = {}) {
  // ← ожидает boundaries напрямую
}
```

**ResearchChart вызывает:**
```javascript
// ResearchChart.jsx
const prc = setupData.pattern_render_contract;
// Пытается получить prc.boundaries (undefined!)
```

### 2.4 CRITICAL ISSUE #3: API Endpoints Mismatch

**Frontend calls:**
- `/api/ta-engine/mtf/{symbol}?timeframes=...` ✅ РАБОТАЕТ
- `/api/v1/chart/full-analysis/...` ← НЕ СУЩЕСТВУЕТ в server.py!

**researchService.js (line 241-242):**
```javascript
const chartAnalysis = await fetchWithTimeout(
  `${API_BASE}/api/v1/chart/full-analysis/${symbol}/${timeframe}`
);
```

Этот endpoint **не существует** в backend!

---

## 3. СВЯЗКА BACKEND-FRONTEND

### 3.1 What Backend Returns (ACTUAL)
```json
{
  "ok": true,
  "symbol": "BTCUSDT",
  "tf_map": {
    "1D": {
      "timeframe": "1D",
      "candles": [...],
      "pattern_render_contract": {
        "type": "falling_wedge",
        "combined_score": 0.99,
        "render": {
          "boundaries": [{x1, y1, x2, y2}],
          "levels": [...],
          "touch_points": [...]
        }
      },
      "render_plan": {
        "structure": {"swings": [...]},
        "levels": [...],
        "patterns": [...]
      }
    }
  }
}
```

### 3.2 What Frontend Expects
```json
{
  "pattern_render_contract": {
    "boundaries": [...],  // TOP-LEVEL, not inside "render"
    "type": "...",
    "markers": [...],
    "levels": [...]
  }
}
```

---

## 4. ROOT CAUSES

| #  | Problem | Location | Impact |
|----|---------|----------|--------|
| 1  | boundaries nested in render, not top-level | anchor_pattern_builder.py:599 | Pattern lines not drawn |
| 2  | /api/v1/chart/full-analysis endpoint missing | researchService.js:241 | Research service fails |
| 3  | Frontend expects different data structure | patternRenderer.js | Chart empty |
| 4  | Multiple data sources (setupData vs renderPlan) | ResearchChart.jsx | Confusion |

---

## 5. FIXES REQUIRED

### FIX #1: Add top-level boundaries to pattern_render_contract
**File**: `/app/backend/modules/ta_engine/pattern/anchor_pattern_builder.py`

```python
# Line 569-600 in _build_render_contract()
return {
    "type": pattern_type,
    # ... other fields ...
    "boundaries": [upper_boundary, lower_boundary],  # ← ADD THIS
    "render": {
        "boundaries": [upper_boundary, lower_boundary],
        # ...
    }
}
```

### FIX #2: Update ResearchChart to use correct path
**File**: `/app/frontend/src/modules/cockpit/components/ResearchChart.jsx`

```javascript
// Get boundaries from render.boundaries
const prc = setupData?.pattern_render_contract;
const boundaries = prc?.render?.boundaries || prc?.boundaries || [];
```

### FIX #3: Add missing /api/v1/chart/full-analysis endpoint
**File**: `/app/backend/server.py`

Add endpoint that proxies to ta-engine/mtf.

---

## 6. WHAT IS ANALYZED vs NOT ANALYZED

### Currently Analyzed:
- Price candles (OHLCV)
- Structure (swing highs/lows, BOS, CHOCH)
- Patterns (wedges, triangles, channels)
- Liquidity (BSL, SSL, sweeps)
- Fibonacci levels
- Indicators (RSI, MACD, EMA)
- Decision engine

### NOT Analyzed (missing or broken):
- Pattern boundaries not rendered on chart
- Execution zones not displayed
- Historical fractal matches
- Capital flow visualization

---

## 7. RECOMMENDATIONS

1. **Immediate**: Fix boundaries structure (FIX #1) - 5 minutes
2. **Short-term**: Add /api/v1/chart/full-analysis endpoint (FIX #3) - 15 minutes  
3. **Medium-term**: Refactor frontend to use single data source (render_plan)
4. **Long-term**: Create unified TA visualization contract between backend/frontend

---

## 8. FILES TO MODIFY

| Priority | File | Change |
|----------|------|--------|
| P0 | /app/backend/modules/ta_engine/pattern/anchor_pattern_builder.py | Add top-level boundaries |
| P0 | /app/frontend/src/chart/renderers/patternRenderer.js | Handle render.boundaries path |
| P1 | /app/backend/server.py | Add /api/v1/chart/full-analysis |
| P2 | /app/frontend/src/modules/cockpit/components/ResearchChart.jsx | Clean up data sources |

---

*Generated: 2026-03-23*
