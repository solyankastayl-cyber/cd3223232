# TA Engine - Technical Analysis Module PRD

## Original Problem Statement
Поднять проект теханализа с GitHub репозитория, изучить архитектуру и работать только с модулем теханализа. Исправить баг с логическим противоречием "PATTERN DETECTED: Loose Range" но summary показывает "No dominant pattern".

## Architecture Overview
- **Backend**: FastAPI + MongoDB
- **Frontend**: React + styled-components
- **Core Module**: `/app/backend/modules/ta_engine/`
- **Key Components**:
  - `per_tf_builder.py` - Per-timeframe analysis builder
  - `pro_pattern_engine.py` - Pattern detection (STRICT + LOOSE)
  - `loose_pattern_engine.py` - Loose pattern interpretation
  - `interpretation/interpretation_engine.py` - Human-readable analysis text

## User Personas
1. **Trader** - Uses TA module for market analysis
2. **Developer** - Extends TA functionality

## Core Requirements (Static)
1. TA Engine must always provide meaningful interpretation (never empty)
2. STRICT patterns = textbook accuracy, solid lines
3. LOOSE patterns = developing formations, dashed lines
4. Summary must not contradict detected pattern

## What's Been Implemented

### 2026-03-24: Bug Fixes & UI Improvements

**Bug Fixed:**
- Fixed logical contradiction where "PATTERN DETECTED: Loose Range" showed "No dominant pattern" in summary
- Modified `per_tf_builder.py` (lines 1256-1281) to accept 2+ anchors for loose patterns
- Modified fallback logic (lines 1323-1343) to show pattern name when loose pattern exists
- Fixed `interpretation_engine.py` to use pro_pattern_payload for loose patterns

**UI Improvements:**
- Added visual confidence progress bar in `PatternHintCard.jsx`
- Added `ModeBadge` component to differentiate STRICT vs LOOSE patterns visually
- STRICT: solid border, blue background
- LOOSE: dashed border, gray background
- Added SVG shapes for loose_range, loose_wedge, loose_triangle patterns

**Files Modified:**
- `/app/backend/modules/ta_engine/per_tf_builder.py`
- `/app/backend/modules/ta_engine/interpretation/interpretation_engine.py`
- `/app/frontend/src/modules/cockpit/components/PatternHintCard.jsx`

## Prioritized Backlog

### P0 (Critical) - DONE
- [x] Fix "No dominant pattern" contradiction

### P1 (High Priority)
- [ ] Pattern confidence breakdown (touches, symmetry, cleanliness)
- [ ] Multi-timeframe alignment view
- [ ] Market narrative engine

### P2 (Medium Priority)
- [ ] Pattern animation on detection
- [ ] Historical pattern performance tracking

## Next Tasks
1. Implement Pattern confidence breakdown with individual scores
2. Add multi-timeframe alignment indicator
3. Market narrative engine ("Market compressing inside range after bullish impulse")

## Test Coverage
- Backend: 93.3%
- Frontend: 100%
- Overall: 96.7%
