"""
TA Engine Routes
=================
Phase 14.2 — API endpoints for TA Hypothesis Layer.
Includes MTF (Multi-Timeframe) endpoints.
"""

from fastapi import APIRouter, Query
from datetime import datetime, timezone
from typing import List, Dict, Any
import time

from modules.ta_engine.hypothesis import get_hypothesis_builder
from modules.ta_engine.per_tf_builder import get_per_timeframe_builder
from modules.ta_engine.mtf import get_mtf_orchestrator
from modules.ta_engine.render_plan import get_render_plan_engine, get_render_plan_engine_v2
from modules.ta_engine.market_state import get_market_state_engine
from modules.ta_engine.patterns.pattern_figure_registry import get_pattern_figure_registry
from modules.ta_engine.structure import StructureVisualizationBuilder
from modules.ta_engine.setup.pattern_validator_v2 import get_pattern_validator_v2
from modules.data.coinbase_auto_init import CoinbaseAutoInit

router = APIRouter(prefix="/api/ta-engine", tags=["ta-engine"])

_builder = get_hypothesis_builder()
_per_tf_builder = get_per_timeframe_builder()
_mtf_orchestrator = get_mtf_orchestrator()
_render_plan_engine = get_render_plan_engine()
_render_plan_engine_v2 = get_render_plan_engine_v2()
_market_state_engine = get_market_state_engine()
_pattern_figure_registry = get_pattern_figure_registry()
_structure_viz_builder = StructureVisualizationBuilder()

# Simple cache for MTF responses (60 seconds TTL)
_mtf_cache: Dict[str, Dict[str, Any]] = {}
_mtf_cache_ttl = 60  # seconds

def _get_cached_mtf(cache_key: str):
    """Get cached MTF response if still valid."""
    if cache_key in _mtf_cache:
        cached = _mtf_cache[cache_key]
        if time.time() - cached["timestamp"] < _mtf_cache_ttl:
            return cached["data"]
    return None

def _set_cached_mtf(cache_key: str, data: dict):
    """Cache MTF response."""
    _mtf_cache[cache_key] = {
        "data": data,
        "timestamp": time.time()
    }

def get_coinbase_provider():
    """Get Coinbase provider instance."""
    return CoinbaseAutoInit.get_instance()


def _aggregate_candles(candles: List[Dict[str, Any]], period_days: int) -> List[Dict[str, Any]]:
    """
    Aggregate daily candles into higher timeframe candles.
    
    For example:
    - period_days=7 -> weekly candles
    - period_days=30 -> monthly candles
    - period_days=180 -> 6-month candles
    - period_days=365 -> yearly candles
    
    Each aggregated candle:
    - open: first candle's open
    - high: max high in period
    - low: min low in period
    - close: last candle's close
    - volume: sum of volumes
    - time: first candle's timestamp
    """
    if not candles or period_days <= 1:
        return candles
    
    # Sort by time
    sorted_candles = sorted(candles, key=lambda x: x['time'])
    
    aggregated = []
    period_seconds = period_days * 24 * 60 * 60
    
    i = 0
    while i < len(sorted_candles):
        period_start = sorted_candles[i]['time']
        period_end = period_start + period_seconds
        
        # Collect candles in this period
        period_candles = []
        while i < len(sorted_candles) and sorted_candles[i]['time'] < period_end:
            period_candles.append(sorted_candles[i])
            i += 1
        
        if period_candles:
            agg_candle = {
                'time': period_candles[0]['time'],
                'open': period_candles[0]['open'],
                'high': max(c['high'] for c in period_candles),
                'low': min(c['low'] for c in period_candles),
                'close': period_candles[-1]['close'],
                'volume': sum(c.get('volume', 0) for c in period_candles),
            }
            aggregated.append(agg_candle)
    
    return aggregated


# NOTE: Static routes MUST come before dynamic {symbol} routes

@router.get("/status")
async def get_ta_status():
    """Health check for TA Engine."""
    return {
        "ok": True,
        "module": "ta_engine",
        "version": "14.2",
        "phase": "Hypothesis Layer",
        "components": {
            "hypothesis_builder": "active",
            "trend_analyzer": "active",
            "momentum_analyzer": "active",
            "structure_analyzer": "active",
            "breakout_detector": "active",
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/hypothesis/batch")
async def get_hypothesis_batch(
    symbols: str = Query("BTC,ETH,SOL", description="Comma-separated symbols"),
    timeframe: str = Query("1d", description="Candle timeframe")
):
    """Get hypothesis for multiple symbols."""
    sym_list = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    results = {}
    for sym in sym_list:
        hypo = _builder.build(sym, timeframe)
        results[sym] = hypo.to_dict()
    return {
        "ok": True,
        "count": len(results),
        "hypotheses": results,
    }


@router.get("/hypothesis/full/{symbol}")
async def get_hypothesis_full(
    symbol: str = "BTC",
    timeframe: str = Query("1d", description="Candle timeframe")
):
    """
    Get full TA hypothesis with detailed component signals.
    """
    hypo = _builder.build(symbol, timeframe)
    return {
        "ok": True,
        "hypothesis": hypo.to_full_dict(),
    }


@router.get("/hypothesis/{symbol}")
async def get_hypothesis(
    symbol: str = "BTC",
    timeframe: str = Query("1d", description="Candle timeframe")
):
    """
    Get unified TA hypothesis for a symbol.
    This is the primary endpoint for Trading Layer.
    
    Returns single direction/conviction after analyzing:
    - Trend (MA alignment)
    - Momentum (RSI, MACD)
    - Structure (HH/HL, BOS)
    - Breakout detection
    """
    hypo = _builder.build(symbol, timeframe)
    return {
        "ok": True,
        "hypothesis": hypo.to_dict(),
    }


# =============================================================================
# MTF (MULTI-TIMEFRAME) ENDPOINTS
# =============================================================================

@router.get("/mtf/{symbol}")
async def get_mtf_analysis(
    symbol: str = "BTC",
    timeframes: str = Query("1D,4H,1H", description="Comma-separated timeframes"),
    bias_tf: str = Query("1D", description="Higher timeframe for bias"),
    setup_tf: str = Query("4H", description="Setup timeframe"),
    entry_tf: str = Query("1H", description="Entry timeframe"),
):
    """
    Get Multi-Timeframe analysis.
    
    Each timeframe is analyzed independently, then orchestrated.
    
    Returns:
    - tf_map: Full TA payload for each timeframe
    - mtf_context: Orchestrated context (alignment, tradeability)
    - default_tf: Recommended timeframe to display
    """
    try:
        # Check cache first
        cache_key = f"{symbol}:{timeframes}"
        cached_data = _get_cached_mtf(cache_key)
        if cached_data:
            print(f"[MTF] Cache hit for {cache_key}")
            return cached_data
        
        print(f"[MTF] Cache miss, building for {cache_key}")
        
        provider = get_coinbase_provider()
        tf_list = [t.strip().upper() for t in timeframes.split(",") if t.strip()]
        
        # Normalize symbol
        clean_symbol = symbol.upper().replace("USDT", "").replace("USD", "")
        normalized_symbol = f"{clean_symbol}USDT"
        product_id = f"{clean_symbol}-USD"
        
        # Build per-timeframe data
        tf_map = {}
        
        # TF normalization (1M/6M are proper TA names, 30D/180D are legacy)
        tf_normalize = {
            "1M": "1M", "30D": "1M",   # Monthly
            "6M": "6M", "180D": "6M",  # Semi-annual
        }
        
        # TF to candle type mapping
        # Note: Coinbase doesn't support 4h, using 6h instead
        # For higher TFs (7D, 1M, 6M, 1Y) we aggregate from daily candles
        tf_candle_map = {
            "1H": "1h",
            "4H": "6h",
            "1D": "1d",
            "7D": "1d",      # Aggregate to weekly
            "1M": "1d",      # Aggregate to monthly (was 30D)
            "30D": "1d",     # Legacy alias for 1M
            "6M": "1d",      # Aggregate to 6-month (was 180D)
            "180D": "1d",    # Legacy alias for 6M
            "1Y": "1d",      # Aggregate to yearly
        }
        
        # Lookback config (raw candles to fetch before aggregation)
        tf_lookback = {
            "1H": 168,
            "4H": 200,
            "1D": 150,
            "7D": 400,       # 400 days -> ~57 weekly candles
            "1M": 1200,      # 1200 days -> ~40 monthly candles
            "30D": 1200,     # Legacy alias
            "6M": 2000,      # 2000 days -> ~11 six-month candles
            "180D": 2000,    # Legacy alias
            "1Y": 3650,      # ~10 years of data -> ~10 yearly candles
        }
        
        # Aggregation periods (in days) for higher timeframes
        tf_aggregation = {
            "7D": 7,
            "1M": 30,        # Monthly (was 30D)
            "30D": 30,       # Legacy alias
            "6M": 180,       # Semi-annual (was 180D)
            "180D": 180,     # Legacy alias
            "1Y": 365,
        }
        
        for tf in tf_list:
            cb_tf = tf_candle_map.get(tf, "1d")
            lookback = tf_lookback.get(tf, 150)
            aggregation_days = tf_aggregation.get(tf)
            
            try:
                # Get candles for this timeframe
                print(f"[MTF] Getting candles for {tf} ({cb_tf})...")
                raw_candles = await provider.data_provider.get_candles(
                    product_id=product_id,
                    timeframe=cb_tf,
                    limit=lookback + 50
                )
                print(f"[MTF] Got {len(raw_candles)} candles for {tf}")
                
                # Format candles
                candles = []
                for c in raw_candles:
                    candles.append({
                        "time": c['timestamp'] // 1000 if c['timestamp'] > 1e12 else c['timestamp'],
                        "open": c['open'],
                        "high": c['high'],
                        "low": c['low'],
                        "close": c['close'],
                        "volume": c.get('volume', 0)
                    })
                
                candles.sort(key=lambda x: x['time'])
                
                # Aggregate candles for higher timeframes (7D, 30D, 180D, 1Y)
                if aggregation_days and len(candles) > 0:
                    candles = _aggregate_candles(candles, aggregation_days)
                    print(f"[MTF] Aggregated {tf} to {len(candles)} candles (period={aggregation_days}d)")
                else:
                    candles = candles[-lookback:]
                
                if candles:
                    # Build full TA for this TF
                    print(f"[MTF] Building TA for {tf} with {len(candles)} candles...")
                    tf_data = _per_tf_builder.build(
                        candles=candles,
                        symbol=normalized_symbol,
                        timeframe=tf,
                    )
                    print(f"[MTF] TA built for {tf}")
                    
                    # Keep candles in response for chart rendering
                    tf_map[tf] = tf_data
                else:
                    tf_map[tf] = _per_tf_builder._empty_result(tf, normalized_symbol)
                    
            except Exception as e:
                print(f"[MTF] Error building TF {tf}: {e}")
                import traceback
                traceback.print_exc()
                tf_map[tf] = _per_tf_builder._empty_result(tf, normalized_symbol)
        
        # Build MTF orchestration
        mtf_context = _mtf_orchestrator.build(
            tf_map=tf_map,
            bias_tf=bias_tf,
            setup_tf=setup_tf,
            entry_tf=entry_tf,
        )
        
        # Add interpretation summary_text for frontend
        try:
            from modules.ta_engine.interpretation.interpretation_engine import get_interpretation_engine
            ie = get_interpretation_engine()
            
            # Get data from each TF role
            htf_data = None
            mtf_data = None
            ltf_data = None
            
            for tf in ["1Y", "6M", "180D", "30D", "1M"]:
                if tf in tf_map and tf_map[tf].get("candles"):
                    htf_data = tf_map[tf]
                    break
            for tf in ["7D", "1D"]:
                if tf in tf_map and tf_map[tf].get("candles"):
                    mtf_data = tf_map[tf]
                    break
            if "4H" in tf_map and tf_map["4H"].get("candles"):
                ltf_data = tf_map["4H"]
            
            # Build one-line summary
            summary_text = ie.build_one_line_summary(htf_data, mtf_data, ltf_data)
            
            # Ensure mtf_context has summary dict with summary_text
            if isinstance(mtf_context, dict):
                mtf_context["summary"] = {
                    "text": mtf_context.get("summary", ""),
                    "summary_text": summary_text,
                }
            print(f"[MTF] Summary text: {summary_text}")
        except Exception as e:
            print(f"[MTF] Failed to build summary_text: {e}")
        
        result = {
            "ok": True,
            "symbol": normalized_symbol,
            "tf_map": tf_map,
            "mtf_context": mtf_context,
            "default_tf": setup_tf,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        
        # Cache result
        _set_cached_mtf(cache_key, result)
        print(f"[MTF] Cached result for {cache_key}")
        
        return result
    
    except Exception as e:
        import traceback
        print(f"[MTF] Error: {e}")
        traceback.print_exc()
        return {
            "ok": False,
            "error": str(e),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }


@router.get("/mtf/{symbol}/{timeframe}")
async def get_single_tf_analysis(
    symbol: str = "BTC",
    timeframe: str = "4H",
):
    """
    Get analysis for a single timeframe.
    
    Returns full TA payload including candles.
    """
    try:
        provider = get_coinbase_provider()
        
        # Normalize symbol
        clean_symbol = symbol.upper().replace("USDT", "").replace("USD", "")
        normalized_symbol = f"{clean_symbol}USDT"
        product_id = f"{clean_symbol}-USD"
        
        # TF to candle type mapping
        # Note: Coinbase doesn't support 4h, using 6h instead
        tf_candle_map = {
            "1H": "1h",
            "4H": "6h", 
            "1D": "1d",
            "7D": "1d",
            "30D": "1d",
        }
        
        # Lookback config
        tf_lookback = {
            "1H": 168,
            "4H": 200,
            "1D": 150,
            "7D": 400,
            "30D": 800,
        }
        
        cb_tf = tf_candle_map.get(timeframe.upper(), "1d")
        lookback = tf_lookback.get(timeframe.upper(), 150)
        
        raw_candles = await provider.data_provider.get_candles(
            product_id=product_id,
            timeframe=cb_tf,
            limit=lookback + 50
        )
        
        if not raw_candles:
            return {
                "ok": False,
                "error": "No candles available",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        
        # Format candles
        candles = []
        for c in raw_candles:
            candles.append({
                "time": c['timestamp'] // 1000 if c['timestamp'] > 1e12 else c['timestamp'],
                "open": c['open'],
                "high": c['high'],
                "low": c['low'],
                "close": c['close'],
                "volume": c.get('volume', 0)
            })
        
        candles.sort(key=lambda x: x['time'])
        candles = candles[-lookback:]
        
        # Build full TA
        tf_data = _per_tf_builder.build(
            candles=candles,
            symbol=normalized_symbol,
            timeframe=timeframe.upper(),
        )
        
        return {
            "ok": True,
            "symbol": normalized_symbol,
            "timeframe": timeframe.upper(),
            "data": tf_data,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    
    except Exception as e:
        import traceback
        print(f"[MTF Single TF] Error: {e}")
        traceback.print_exc()
        return {
            "ok": False,
            "error": str(e),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }



# =============================================================================
# RENDER PLAN ENDPOINT
# =============================================================================

@router.get("/render-plan/{symbol}")
async def get_render_plan(
    symbol: str = "BTC",
    timeframe: str = Query("1D", description="Timeframe for analysis"),
):
    """
    Get RENDER PLAN for visualization.
    
    This is the BRAIN of visualization:
    - Filters data to show only what matters
    - Prioritizes based on regime (trend/range/reversal)
    - Returns focused visualization: 1 graph = 1 setup = 1 story
    
    Returns:
    - execution: entry/stop/targets
    - pattern: active pattern (if relevant)
    - poi: closest zone only (not 5)
    - structure: simplified swings/choch/bos
    - liquidity: limited eq/sweeps
    - displacement: latest only
    - indicators: regime-appropriate
    - meta: regime + focus
    - chain_highlight: sweep -> choch -> entry storytelling
    """
    try:
        provider = get_coinbase_provider()
        
        # Normalize symbol
        clean_symbol = symbol.upper().replace("USDT", "").replace("USD", "")
        normalized_symbol = f"{clean_symbol}USDT"
        product_id = f"{clean_symbol}-USD"
        
        # TF mapping
        tf_candle_map = {
            "1H": "1h",
            "4H": "6h",
            "1D": "1d",
        }
        tf_lookback = {
            "1H": 168,
            "4H": 200,
            "1D": 150,
        }
        
        cb_tf = tf_candle_map.get(timeframe.upper(), "1d")
        lookback = tf_lookback.get(timeframe.upper(), 150)
        
        # Get candles
        raw_candles = await provider.data_provider.get_candles(
            product_id=product_id,
            timeframe=cb_tf,
            limit=lookback + 50
        )
        
        if not raw_candles:
            return {
                "ok": False,
                "error": "No candles available",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        
        # Format candles
        candles = []
        for c in raw_candles:
            candles.append({
                "time": c['timestamp'] // 1000 if c['timestamp'] > 1e12 else c['timestamp'],
                "open": c['open'],
                "high": c['high'],
                "low": c['low'],
                "close": c['close'],
                "volume": c.get('volume', 0)
            })
        
        candles.sort(key=lambda x: x['time'])
        candles = candles[-lookback:]
        
        current_price = candles[-1]['close'] if candles else 0
        
        # Build full TA first
        tf_data = _per_tf_builder.build(
            candles=candles,
            symbol=normalized_symbol,
            timeframe=timeframe.upper(),
        )
        
        # Extract components for render_plan
        execution = tf_data.get("execution", {})
        primary_pattern = tf_data.get("primary_pattern")
        structure_context = tf_data.get("structure_context", {})
        liquidity = tf_data.get("liquidity", {})
        displacement = tf_data.get("displacement", {})
        poi = tf_data.get("poi", {})
        indicators = tf_data.get("indicators", {})
        
        # Build render_plan
        render_plan = _render_plan_engine.build(
            execution=execution,
            primary_pattern=primary_pattern,
            structure_context=structure_context,
            liquidity=liquidity,
            displacement=displacement,
            poi=poi,
            indicators=indicators,
            current_price=current_price,
        )
        
        return {
            "ok": True,
            "symbol": normalized_symbol,
            "timeframe": timeframe.upper(),
            "current_price": current_price,
            "render_plan": render_plan,
            "candles": candles,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    
    except Exception as e:
        import traceback
        print(f"[Render Plan] Error: {e}")
        traceback.print_exc()
        return {
            "ok": False,
            "error": str(e),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }



# =============================================================================
# PATTERN REGISTRY ENDPOINT
# =============================================================================

@router.get("/registry/patterns")
async def get_pattern_registry():
    """
    Get full pattern figure registry.
    
    Returns 50+ registered pattern figures organized by category:
    - reversal (13+)
    - continuation (14+)
    - harmonic (12+)
    - candlestick (15+)
    - complex (8+)
    """
    return {
        "ok": True,
        "registry": _pattern_figure_registry.to_dict(),
        "total": _pattern_figure_registry.count(),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# =============================================================================
# RENDER PLAN V2 ENDPOINT (6 LAYERS)
# =============================================================================

@router.get("/render-plan-v2/{symbol}")
async def get_render_plan_v2(
    symbol: str = "BTC",
    timeframe: str = Query("1D", description="Timeframe: 4H, 1D, 7D, 30D, 180D, 1Y"),
):
    """
    Get RENDER PLAN V2 with 6 isolated layers.
    
    Product Timeframes: 4H, 1D, 7D, 30D, 180D, 1Y
    
    Layers:
    A. Market State (trend, channel, volatility, momentum, wyckoff)
    B. Structure (swings, HH/HL/LH/LL, BOS, CHOCH)
    C. Indicators (overlays, panes)
    D. Pattern Figures (ONLY from registry - NOT channel/trend)
    E. Liquidity (EQH/EQL, sweeps, OB, FVG)
    F. Execution (ALWAYS visible: valid/waiting/no_trade)
    
    Key rules:
    - 1 timeframe = 1 isolated world
    - Each TF renders its own complete TA analysis
    """
    try:
        provider = get_coinbase_provider()
        
        # Normalize symbol
        clean_symbol = symbol.upper().replace("USDT", "").replace("USD", "")
        normalized_symbol = f"{clean_symbol}USDT"
        product_id = f"{clean_symbol}-USD"
        
        # Product TF mapping (ALL 6 supported TFs)
        supported_tfs = ["4H", "1D", "7D", "30D", "180D", "1Y"]
        tf_upper = timeframe.upper()
        if tf_upper not in supported_tfs:
            tf_upper = "1D"
        
        # Coinbase timeframe mapping
        # For longer TFs, we use daily candles and aggregate
        tf_candle_map = {
            "4H": "6h",      # 6h candles for 4H analysis
            "1D": "1d",      # Daily candles
            "7D": "1d",      # Daily candles, more lookback
            "30D": "1d",     # Daily candles, more lookback
            "180D": "1d",    # Daily candles, more lookback
            "1Y": "1d",      # Daily candles, max lookback
        }
        
        # Lookback periods for each TF
        tf_lookback = {
            "4H": 200,       # ~33 days of 4H
            "1D": 150,       # 150 days
            "7D": 365,       # ~1 year for 7D view
            "30D": 730,      # ~2 years for 30D view
            "180D": 1095,    # ~3 years for 180D view
            "1Y": 1460,      # ~4 years for 1Y view
        }
        
        cb_tf = tf_candle_map.get(tf_upper, "1d")
        lookback = tf_lookback.get(tf_upper, 150)
        
        # Get candles
        raw_candles = await provider.data_provider.get_candles(
            product_id=product_id,
            timeframe=cb_tf,
            limit=lookback + 50
        )
        
        if not raw_candles:
            return {
                "ok": False,
                "error": "No candles available",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        
        # Format candles
        candles = []
        for c in raw_candles:
            candles.append({
                "time": c['timestamp'] // 1000 if c['timestamp'] > 1e12 else c['timestamp'],
                "open": c['open'],
                "high": c['high'],
                "low": c['low'],
                "close": c['close'],
                "volume": c.get('volume', 0)
            })
        
        candles.sort(key=lambda x: x['time'])
        candles = candles[-lookback:]
        
        current_price = candles[-1]['close'] if candles else 0
        
        # Build full TA
        tf_data = _per_tf_builder.build(
            candles=candles,
            symbol=normalized_symbol,
            timeframe=tf_upper,
        )
        
        # Compute market state (Layer A)
        market_state = _market_state_engine.analyze(candles)
        
        # Build structure visualization (swings, BOS, CHOCH for chart)
        # First get pivots
        tf_config = {
            "4H": {"lookback": 200, "pivot_window": 5, "min_pivot_distance": 10, "pattern_window": 150, "candle_type": "4h"},
            "1D": {"lookback": 300, "pivot_window": 7, "min_pivot_distance": 15, "pattern_window": 200, "candle_type": "1d"},
        }.get(tf_upper, {"lookback": 300, "pivot_window": 7, "min_pivot_distance": 15, "pattern_window": 200, "candle_type": "1d"})
        
        validator = get_pattern_validator_v2(tf_upper, tf_config)
        pivot_highs_raw, pivot_lows_raw = validator.find_pivots(candles)
        
        # Build structure visualization with swings, events, trendlines
        structure_context = tf_data.get("structure_context", {})
        structure_viz = _structure_viz_builder.build(
            pivots_high=pivot_highs_raw,
            pivots_low=pivot_lows_raw,
            structure_context=structure_context,
            candles=candles,
        )
        
        # Merge structure context metrics with visualization data
        # Extract BOS/CHOCH from events list
        events = structure_viz.get("events", [])
        bos_event = next((e for e in events if "bos" in e.get("type", "")), None)
        choch_event = next((e for e in events if "choch" in e.get("type", "")), None)
        
        structure = {
            **structure_context,
            "swings": structure_viz.get("pivot_points", []),
            "bos": bos_event,
            "choch": choch_event,
            "active_trendlines": structure_viz.get("active_trendlines", []),
        }
        
        indicators = tf_data.get("indicators", {})
        liquidity = tf_data.get("liquidity", {})
        execution = tf_data.get("execution", {})
        poi = tf_data.get("poi", {})
        
        # Get patterns (convert primary_pattern to list)
        patterns = []
        primary = tf_data.get("primary_pattern")
        if primary:
            patterns.append(primary)
        
        # Build render plan v2
        render_plan = _render_plan_engine_v2.build(
            timeframe=tf_upper,
            current_price=current_price,
            market_state=market_state.to_dict(),
            structure=structure,
            indicators=indicators,
            patterns=patterns,
            liquidity=liquidity,
            execution=execution,
            poi=poi,
        )
        
        return {
            "ok": True,
            "symbol": normalized_symbol,
            "timeframe": tf_upper,
            "current_price": current_price,
            "render_plan": render_plan,
            "candles": candles,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    
    except Exception as e:
        import traceback
        print(f"[Render Plan V2] Error: {e}")
        traceback.print_exc()
        return {
            "ok": False,
            "error": str(e),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }


# =============================================================================
# INDICATOR REGISTRY ENDPOINT
# =============================================================================

@router.get("/registry/indicators")
async def get_indicator_registry():
    """
    Get full indicator registry.
    
    Returns 30+ indicators organized by type:
    - overlays (on main chart)
    - oscillators (separate pane, bounded)
    - momentum (separate pane, unbounded)
    - volume
    - volatility
    - trend
    """
    from modules.ta_engine.indicators import get_indicator_registry
    registry = get_indicator_registry()
    
    return {
        "ok": True,
        "registry": registry.to_dict(),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
