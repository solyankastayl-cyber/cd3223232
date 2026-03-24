# TA Engine PRD - Technical Analysis Module

## Original Problem Statement
Реализовать систему отрисовки паттернов. Добавить debug для диагностики проблемы с overlay.

## Current Status (Mar 24, 2026)

### Backend — WORKING
- ✅ 42/42 unit tests passed
- ✅ health endpoint OK
- ✅ Modules: geometry_normalizer, pattern_projection_engine, render_profile

### Frontend — NEEDS TESTING ON LIVE ENV
- ✅ PatternSVGOverlay.jsx updated with DEBUG
- ✅ Time normalization added (ms → s)
- ✅ Test line (red) + green border added
- ⚠️ External preview unavailable (ingress/CDN issue)

## Debug Features Added

### PatternSVGOverlay.jsx
1. **Console logs on mount:**
   - hasChart, hasSeries, hasRenderContract
   - patternType, patternMode, renderProfile
   - structurePoints, anchors, bounds

2. **Coordinate conversion logs:**
   - [toX] originalTime, normalizedTime, x
   - [toY] price, y
   - [toXY] NULL coords warning

3. **Visual debug:**
   - Green border (2px solid lime) on SVG
   - Red test line from (50,50) to (200,150)
   - "SVG OVERLAY TEST" text label

### Time Normalization
```javascript
const normalizeTime = (t) => {
  if (t > 9999999999) return Math.floor(t / 1000); // ms → s
  return t;
};
```

## Files Modified

### Backend
```
/app/backend/modules/ta_engine/geometry/
├── geometry_normalizer.py      # 12 tests
├── pattern_projection_engine.py # 16 tests
├── render_profile.py           # 14 tests
└── __init__.py
```

### Frontend
```
/app/frontend/src/modules/cockpit/components/
└── PatternSVGOverlay.jsx       # V4 + DEBUG
```

## Next Steps to Debug Overlay

1. **Open browser console** and look for:
   - `[PatternSVGOverlay] MOUNTED` — component is mounting
   - `[toX]` / `[toY]` — coordinate conversion
   - `[PatternSVGOverlay] RENDER` — render happening

2. **Check visual indicators:**
   - Green border around SVG area
   - Red test line at top-left

3. **If no green border:**
   - Component not mounted
   - Check `showPatternOverlay` prop
   - Check `data?.pattern_render_contract`

4. **If green border but no pattern:**
   - Coords returning null
   - Check time format (ms vs s)
   - Check series reference

## Testing Commands
```bash
# Backend unit tests
cd /app/backend && python -m pytest tests/test_geometry_normalizer.py tests/test_pattern_projection.py tests/test_render_profile.py -v

# Check services
sudo supervisorctl status
curl http://localhost:8001/api/health
curl http://localhost:3000 | head -5
```
