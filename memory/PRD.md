# TA Engine Module - Technical Analysis

## Original Problem Statement
Поднять проект, изучить архитектуру модуля теханализа (ta_engine) и доработать логику определения паттернов.

## What's Been Implemented (March 2026)

### 1. Pattern State Engine (`pattern_state_engine.py`)
Новый компонент для перехода от Level 1 ("рисуем линии") к Level 2 ("описываем поведение рынка"):
- **State Machine**: forming → maturing → breakout/breakdown → invalidated
- **Respect Score**: измерение качества реакций цены на границы паттерна
- **Compression Score**: насколько сужается диапазон (критично для wedge)
- **Reaction Score**: сила движения после касания линии
- **Trading Levels**: trigger, invalidation, target

### 2. Strong Pivot Filter (`strong_pivot_filter.py`)
Фильтрация "шумовых" pivot точек:
- Фильтр по силе реакции (move > ATR * 0.5)
- Минимальное расстояние между pivot'ами
- Убирает случайные колебания

### 3. Wedge Detector V5 (улучшенный в `pattern_detectors_unified.py`)
Ключевые улучшения по фидбеку:
- **Compression Check**: отклоняет паттерны без сжатия (compression < 0.2)
- **Respect Score Check**: отклоняет если цена не реагирует на линии (respect < 0.4)
- **State Engine Integration**: формирует полное описание состояния паттерна
- **Strong Pivot Filter**: убирает шумовые точки
- **Trading Levels**: breakout trigger, invalidation, target price

### 4. PatternCandidate Model (обновлён)
Добавлены новые поля:
- `state`: forming/maturing/breakout/breakdown/invalidated
- `state_reason`: объяснение состояния
- `respect_score`: качество реакций
- `compression_score`: сжатие диапазона
- `target_level`: целевая цена

## Architecture
```
/app/backend/modules/ta_engine/
├── setup/
│   ├── pattern_state_engine.py    # NEW: State machine
│   ├── strong_pivot_filter.py     # NEW: Pivot filtering
│   ├── pattern_detectors_unified.py # UPDATED: Wedge V5
│   ├── pattern_candidate.py       # UPDATED: New fields
│   └── ...
├── ta_routes.py
├── ta_setup_api.py
└── ...
```

## API Endpoints
- `GET /api/ta-engine/mtf/{symbol}?timeframes=1D,4H` - Multi-timeframe analysis
- `GET /api/health` - Health check

## Current Status
- ✅ Backend running on port 8001
- ✅ Frontend running on port 3000
- ✅ MongoDB connected
- ✅ Coinbase provider initialized
- ✅ Bootstrap complete with BTC/ETH/SOL data

## What's Working
- Pattern detection with quality filtering
- Structure analysis (HH/HL/LH/LL)
- POI (Points of Interest) zones
- Liquidity analysis
- Fibonacci levels

## Backlog / P1 Features
1. Улучшение детекции Head & Shoulders с State Engine
2. Добавление визуализации state на фронтенде
3. Реализация alerting при смене state
4. Интеграция State Engine в другие паттерны (triangles, channels)
