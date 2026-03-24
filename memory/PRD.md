# TA Engine Module - Technical Analysis

## Original Problem Statement
Поднять проект, изучить архитектуру модуля теханализа (ta_engine) и доработать логику определения паттернов.

## What's Been Implemented (March 2026)

### 1. Pattern Priority System (`pattern_priority_system.py`) - КРИТИЧЕСКИЙ
**Главное правило: 1 TF = 1 идея**

DOMINANCE фильтр:
- Coverage >= 15% (паттерн должен занимать минимум 15% ценового диапазона)
- Time >= 12% (паттерн должен занимать минимум 12% баров)
- Window >= 15 bars (минимум 15 свечей)
- Final Score >= 0.55 (иначе → structure fallback)

Type Priority:
- head_and_shoulders: 1.0
- double_top/bottom: 0.95
- triangle: 0.9
- wedge: 0.85
- flag: 0.8
- channel: 0.6

### 2. Final Analysis Resolver (`final_analysis_resolver.py`)
**Принцип: ПУСТОГО АНАЛИЗА НИКОГДА НЕ БЫВАЕТ**

Три режима:
- `figure` - паттерн прошёл dominance check
- `structure` - HH/HL/LH/LL (когда figure отклонена)
- `context` - macro view для HTF

### 3. Pattern State Engine
- States: forming → maturing → breakout → breakdown → invalidated
- Scores: respect, compression, reaction

### 4. Strong Pivot Filter
- Фильтрует шумовые pivot точки

### 5. Wedge Detector V5
- Исправленная логика convergence

## How It Works Now

```
Pattern detected
    ↓
DOMINANCE CHECK
    ├─ coverage < 15%? → REJECT
    ├─ time < 12%? → REJECT
    └─ bars < 15? → REJECT
    ↓
Display Gate
    ↓
If passed → analysis_mode = "figure"
If rejected → analysis_mode = "structure"
```

## Current Status
```
BTC 1D:
- Render Contract: rising_wedge
- Display Approved: True
- Coverage: 23.1%
- Time: 14.7%
- Final Analysis Mode: figure
- Summary: "Bearish Rising Wedge forming"
```

## API Response Structure
```json
{
  "final_analysis": {
    "analysis_mode": "figure | structure | context",
    "figure": {...} | null,
    "structure": {
      "trend": "up",
      "phase": "correction",
      "bias": "bullish",
      "swing_state": "HH-HL sequence intact"
    },
    "summary": {
      "title": "...",
      "text": "..."
    }
  },
  "pattern_dominance": {
    "coverage": 0.231,
    "time_coverage": 0.147,
    "final_score": 0.72,
    "is_dominant": true
  }
}
```

## Key Files
- `/app/backend/modules/ta_engine/setup/pattern_priority_system.py` (NEW)
- `/app/backend/modules/ta_engine/setup/final_analysis_resolver.py` (NEW)
- `/app/backend/modules/ta_engine/per_tf_builder.py` (UPDATED - dominance check)

## Next Steps
1. Frontend: отобразить `final_analysis.summary` prominently
2. Add more pattern types to priority system
3. Tune dominance thresholds per timeframe
