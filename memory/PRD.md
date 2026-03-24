# TA Engine PRD - Technical Analysis Module

## Original Problem Statement
Поднять проект с GitHub репозитория, изучить архитектуру модуля теханализа и реализовать Geometry Normalization Layer для улучшения визуализации паттернов.

## Architecture
- **Backend**: FastAPI (Python) - модуль `ta_engine`
- **Frontend**: React - модуль `cockpit` с `PatternSVGOverlay.jsx`
- **Database**: MongoDB

## Module Focus: ta_engine
Работа только с модулем теханализа (`/app/backend/modules/ta_engine/`)

### Geometry Layer Structure
```
/app/backend/modules/ta_engine/geometry/
├── geometry_normalizer.py  ⬅ NEW (Geometry Normalization Layer)
├── pattern_geometry_builder.py
├── wedge_shape_validator.py
├── main_render_gate.py
└── __init__.py
```

## What's Been Implemented (Mar 24, 2026)

### 1. Geometry Normalization Layer (`geometry_normalizer.py`)
- **Double Top/Bottom**: 
  - Выравнивание пиков по среднему уровню
  - Симметрия по времени относительно valley
  - Усиление valley (min * 0.995)
- **Range**:
  - Padding 1% для отступов от свечей
  - Confidence через количество касаний
- **Wedge/Triangle**:
  - Принудительная сходимость линий
  - Фильтр почти параллельных линий

### 2. Frontend Improvements (`PatternSVGOverlay.jsx`)
- **Double Top**: Gradient fill, M-shape, маркеры P1/P2/V
- **Range**: Dynamic opacity по confidence, touch count labels, R/S маркеры

### 3. Integration
- Нормализатор интегрирован в `per_tf_builder.py`
- Логирование применённых нормализаций

## Testing Status
- ✅ 12/12 unit tests passed for geometry_normalizer
- ✅ Backend API health check OK
- ✅ Frontend compiled successfully

## Backlog (P0-P2)
### P0 (Critical)
- [ ] End-to-end test с реальными данными Coinbase

### P1 (Important)
- [ ] Pattern Beautifier (gradient, glow)
- [ ] Projection lines (target/invalidation zones)
- [ ] Snap to Structure (strong pivots only)

### P2 (Nice to have)
- [ ] Hover highlight
- [ ] Breakout projection
- [ ] Custom cursors

## Next Tasks
1. Тест E2E с Coinbase адаптером
2. Visual upgrade (gradient fill, glow)
3. Projection линии
