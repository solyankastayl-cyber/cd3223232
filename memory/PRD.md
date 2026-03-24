# TA Engine PRD - Technical Analysis Module

## Original Problem Statement
Поднять проект с GitHub репозитория, изучить архитектуру модуля теханализа и реализовать полную систему отрисовки паттернов с 4-мя слоями: Structure, Bounds, Completion, Projection.

## Architecture
- **Backend**: FastAPI (Python) - модуль `ta_engine`
- **Frontend**: React - модуль `cockpit` с `PatternSVGOverlay.jsx`
- **Database**: MongoDB

## What's Been Implemented (Mar 24, 2026)

### 1. Geometry Normalization Layer (`geometry_normalizer.py`)
- **Double Top/Bottom**: выравнивание пиков, симметрия по времени, усиление valley
- **Range**: padding 1%, confidence через touches
- **Wedge/Triangle**: принудительная сходимость линий
- ✅ 12/12 unit tests passed

### 2. Pattern Projection Engine (`pattern_projection_engine.py`) — NEW
Полный контракт с 4 слоями:
- **STRUCTURE**: points, lines, fill area
- **BOUNDS**: resistance, support, neckline, upper/lower lines
- **COMPLETION**: end_time, apex, confirm_level, invalidation_level
- **PROJECTION**: primary target, secondary (invalidation), path, confidence
- ✅ 16/16 unit tests passed

### 3. Frontend PatternSVGOverlay.jsx V3
- Full Double Top/Bottom: M-shape, fill, neckline, completion line, projection arrows, target zones
- Full Triangle: fill, upper/lower lines, apex marker, projection
- Full Wedge: fill, converging lines, projection
- Full Range: box fill with confidence-based opacity, R/S lines, touch count, dual projections
- Stage indicators: FORMING, MATURING, CONFIRMED, INVALIDATED

### 4. Integration
- Projection engine интегрирован в `per_tf_builder.py`
- Логирование projection: stage, direction, target

## Testing Status
- ✅ 28/28 unit tests passed (geometry + projection)
- ✅ Frontend compilation successful
- ✅ Backend localhost health check OK
- ⚠️ External URL routing (ingress issue, not code)

## File Structure
```
/app/backend/modules/ta_engine/geometry/
├── geometry_normalizer.py      # Normalization layer
├── pattern_projection_engine.py # Projection engine (NEW)
├── pattern_geometry_builder.py
├── wedge_shape_validator.py
├── main_render_gate.py
└── __init__.py

/app/frontend/src/modules/cockpit/components/
└── PatternSVGOverlay.jsx       # V3 with 4-layer support
```

## Backlog (P0-P2)

### P0 (Critical) — DONE
- [x] Geometry Normalization Layer
- [x] Pattern Projection Engine
- [x] 4-layer SVG rendering

### P1 (Important)
- [ ] Pattern Beautifier (gradient glow, hover effects)
- [ ] Breakout detection live
- [ ] Multi-pattern overlay

### P2 (Nice to have)
- [ ] Auto probability engine (based on backtest)
- [ ] Replay mode (как цена "идёт по фигуре")
- [ ] Custom pattern alerts

## Next Tasks
1. E2E test с реальными данными Coinbase
2. Visual beautifier (glow, hover highlight)
3. Live breakout detection
