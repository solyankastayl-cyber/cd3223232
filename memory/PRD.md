# TA Engine PRD - Technical Analysis Module

## Current Status (Mar 24, 2026)

### CRITICAL: Debug system added for coordinate diagnosis

**Problem:** SVG overlay mounts (green border visible), but pattern shapes don't render.
**Root cause hypothesis:** Coordinates not mapping to chart (time format or series ref issue).

## Debug Features in PatternSVGOverlay.jsx

### 1. Mount Debug Log
```
[PatternSVGOverlay] === MOUNT DEBUG ===
- hasChart, hasSeries, hasRenderContract
- sampleCandleTime vs patternTime (format comparison!)
- timeMismatch: "PATTERN IN MS, CANDLE IN S" / "OK"
- anchorsSample: {p1, p2}
```

### 2. Coordinate Debug
```
[PatternSVGOverlay] First toX: {originalTime, normalizedTime, x}
[PatternSVGOverlay] First toY: {price, y}
[PatternSVGOverlay] NULL coords for point: {...}
```

### 3. Visual Debug Elements
- **Green border** (2px solid lime) — SVG container visible
- **Red static line** (50,50 → 200,150) — SVG renders
- **Yellow circle** at first anchor coords — Coordinate conversion works

### 4. Time Normalization
```javascript
const normalizeTime = (t) => {
  if (t > 9999999999) return Math.floor(t / 1000); // ms → s
  return t;
};
```

## How to Diagnose

1. **Open browser console**, look for `[PatternSVGOverlay]` logs

2. **Check timeMismatch:**
   - If "PATTERN IN MS, CANDLE IN S" → time format bug
   - If "OK" → series ref issue

3. **Check debugTestCoord in RENDER log:**
   - If "NONE" → coords returning null
   - If "(x, y)" → coords work, check pattern building

4. **Visual check:**
   - Green border only → SVG mounted, coords fail
   - Yellow circle visible → coords work!

## Files

### Backend (STABLE)
```
/app/backend/modules/ta_engine/geometry/
├── geometry_normalizer.py      # 12 tests ✅
├── pattern_projection_engine.py # 16 tests ✅
├── render_profile.py           # 14 tests ✅
```

### Frontend
```
/app/frontend/src/modules/cockpit/components/
└── PatternSVGOverlay.jsx       # V4 + DEBUG
```

## Testing
```bash
# All backend tests
cd /app/backend && python -m pytest tests/test_geometry_normalizer.py tests/test_pattern_projection.py tests/test_render_profile.py -v

# Services
sudo supervisorctl status
curl http://localhost:8001/api/health
```

## Next Steps

After getting console logs:

1. **If timeMismatch detected:**
   - Check backend anchor time format
   - Ensure ms → s conversion

2. **If coords null but time OK:**
   - Check priceSeriesInstance ref
   - Verify series has data

3. **If yellow circle appears:**
   - Coordinate system works!
   - Focus on pattern building logic
