# TA Engine - Technical Analysis Module PRD

## Original Problem Statement
Поднять проект теханализа с GitHub репозитория, изучить архитектуру и работать только с модулем теханализа. Исправить баг с логическим противоречием. Добавить Market Narrative Engine и MTF Alignment Engine.

## Architecture Overview
- **Backend**: FastAPI + MongoDB
- **Frontend**: React + styled-components + ECharts
- **Core Module**: `/app/backend/modules/ta_engine/`

### Key Components:
- `per_tf_builder.py` - Per-timeframe analysis builder
- `pro_pattern_engine.py` - Pattern detection (STRICT + LOOSE)
- `loose_pattern_engine.py` - Loose pattern interpretation + anchor ordering
- `interpretation/interpretation_engine.py` - Human-readable analysis text
- `narrative_engine.py` - Market narrative builder (NEW!)
- `mtf_alignment_engine.py` - Multi-timeframe alignment (NEW!)
- `ta_routes.py` - API endpoints

## User Personas
1. **Trader** - Uses TA module for market analysis
2. **Developer** - Extends TA functionality

## Core Requirements (Static)
1. TA Engine must always provide meaningful interpretation (never empty)
2. STRICT patterns = textbook accuracy, solid lines
3. LOOSE patterns = developing formations, dashed lines
4. Summary must not contradict detected pattern
5. Market narrative must explain structure + pattern + context

## What's Been Implemented

### 2026-03-24: Session 1 - Bug Fixes & UI Improvements

**Bug Fixed:**
- Fixed logical contradiction where "PATTERN DETECTED: Loose Range" showed "No dominant pattern" in summary
- Modified `per_tf_builder.py` to accept 2+ anchors for loose patterns
- Fixed `interpretation_engine.py` to use pro_pattern_payload for loose patterns

**UI Improvements:**
- Added visual confidence progress bar in `PatternHintCard.jsx`
- Added `ModeBadge` component (STRICT=solid, LOOSE=dashed)
- Added SVG shapes for loose_range, loose_wedge, loose_triangle patterns

### 2026-03-24: Session 2 - Narrative & Alignment Engines

**New Files Created:**
- `/app/backend/modules/ta_engine/narrative_engine.py`
  - `build_market_narrative()` - builds narrative from structure + pattern + context
  - `build_mtf_narrative()` - builds multi-timeframe narrative
  
- `/app/backend/modules/ta_engine/mtf_alignment_engine.py`
  - `build_mtf_alignment()` - calculates direction + confidence across TFs
  - `get_alignment_summary()` - human-readable alignment status

**Backend Integration:**
- `per_tf_builder.py` now calls `build_market_narrative()` for each TF
- `ta_routes.py` now calls `build_mtf_alignment()` and `build_mtf_narrative()`
- Response includes: `narrative`, `mtf_context.alignment`, `mtf_context.mtf_narrative`

**Frontend Updates:**
- Added MTF ALIGNMENT box with direction badge and confidence bar
- Added MARKET NARRATIVE box with italic styling
- Color-coded by direction (green=bullish, red=bearish, gray=neutral)

**Polygon Anchor Ordering:**
- Added `order_polygon_anchors()` function in `loose_pattern_engine.py`
- Correctly orders anchors: top-left → top-right → bottom-right → bottom-left
- Added `build_pattern_window()` for zoom/focus

## Test Coverage
- Backend: 95.2%
- Frontend: 100%
- Overall: 97.6%

## Prioritized Backlog

### P0 (Critical) - DONE
- [x] Fix "No dominant pattern" contradiction
- [x] Market Narrative Engine
- [x] MTF Alignment Engine

### P1 (High Priority)
- [ ] Signal Layer (entry / invalidation / target)
- [ ] Bias Engine (bullish/bearish probability)
- [ ] Pattern confidence breakdown (touches, symmetry, cleanliness)

### P2 (Medium Priority)
- [ ] Strategy hints
- [ ] Historical pattern performance tracking
- [ ] Pattern animation on detection

## Next Tasks
1. Signal Layer: "Trigger: breakout above 68k / Invalidation: below 64k"
2. Bias Engine: "Bullish probability: 64% / Bearish: 36%"
3. Pattern confidence breakdown with individual scores

## API Examples

```bash
# Get MTF analysis with alignment
curl "/api/ta-engine/mtf/BTC?timeframes=1D,4H"

# Response includes:
# - tf_map[TF].narrative.short/full
# - mtf_context.alignment.direction/confidence
# - mtf_context.mtf_narrative.short/full
```
