# TA Engine PRD - Technical Analysis Module

## Original Problem Statement
Реализовать систему отрисовки паттернов с разделением по mode/stage. Упростить рендер для loose patterns, убрать лишние слои.

## Architecture
- **Backend**: FastAPI (Python) - модуль `ta_engine`
- **Frontend**: React - модуль `cockpit` с `PatternSVGOverlay.jsx`

## What's Been Implemented (Mar 24, 2026)

### 1. Render Profile System (`render_profile.py`) — NEW
**Главное правило:**
- **loose patterns** → minimal render (только body, без projection)
- **strict forming** → compact render (body + bounds, без projection)  
- **strict confirmed** → full render (всё включено)

**Profiles:**
- `compact`: M-shape + neckline only (Double Top)
- `box`: Rectangle only (Range)
- `clean`: Lines only (Triangle/Wedge)
- `full`: Everything (только strict + confirmed)

### 2. Geometry Normalization Layer
- ✅ 12/12 unit tests passed

### 3. Pattern Projection Engine
- ✅ 16/16 unit tests passed

### 4. Render Profile Tests
- ✅ 14/14 unit tests passed

### 5. Frontend PatternSVGOverlay.jsx V4
- Читает `render_profile` от backend
- Отключает projection для loose/forming patterns
- Упрощённый рендер Range (box only)
- Минимальный рендер для loose patterns

## File Structure
```
/app/backend/modules/ta_engine/geometry/
├── geometry_normalizer.py      # Normalization
├── pattern_projection_engine.py # Projection
├── render_profile.py           # Render profiles (NEW)
├── pattern_geometry_builder.py
├── wedge_shape_validator.py
└── main_render_gate.py
```

## Testing Status
- ✅ 42/42 unit tests passed (normalizer + projection + render_profile)
- ✅ Frontend compilation OK
- ✅ Backend health OK

## Render Matrix

| Pattern Type    | Mode   | Stage     | Structure | Fill | Bounds | Projection |
|-----------------|--------|-----------|-----------|------|--------|------------|
| double_top      | strict | confirmed | ✅        | ✅   | ✅     | ✅         |
| double_top      | strict | forming   | ✅        | ✅   | ✅     | ❌         |
| double_top      | loose  | any       | ✅        | ❌   | ✅     | ❌         |
| range           | strict | confirmed | ✅        | ✅   | ✅     | ✅         |
| range           | strict | forming   | ✅        | ✅   | ✅     | ❌         |
| range           | loose  | any       | ✅        | ❌   | ✅     | ❌         |
| triangle/wedge  | strict | confirmed | ✅        | ✅   | ✅     | ✅         |
| triangle/wedge  | loose  | any       | ✅        | ❌   | ✅     | ❌         |

## Next Tasks
1. E2E тест с реальными данными
2. Visual beautifier (hover, glow) для confirmed patterns
3. Live breakout detection
