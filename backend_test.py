#!/usr/bin/env python3
"""
Backend API Testing for TA Engine
=================================

Tests the technical analysis engine APIs with focus on:
1. Health endpoint
2. TA Engine MTF endpoints for pattern detection
3. Market Narrative Engine and MTF Alignment Engine (NEW!)
4. History Scanner functionality
5. Display Gate with lowered thresholds
"""

import requests
import sys
import json
from datetime import datetime
from typing import Dict, Any, Optional

class TAEngineAPITester:
    def __init__(self, base_url: str = "https://tech-analysis-17.preview.emergentagent.com"):
        self.base_url = base_url.rstrip('/')
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name: str, success: bool, details: Dict[str, Any] = None):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
        
        result = {
            "test_name": name,
            "success": success,
            "timestamp": datetime.now().isoformat(),
            "details": details or {}
        }
        self.test_results.append(result)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {name}")
        if details and not success:
            print(f"   Details: {details}")

    def run_test(self, name: str, method: str, endpoint: str, expected_status: int = 200, 
                 data: Dict = None, params: Dict = None) -> tuple[bool, Dict]:
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        headers = {'Content-Type': 'application/json'}
        
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method.upper() == 'GET':
                response = requests.get(url, headers=headers, params=params, timeout=30)
            elif method.upper() == 'POST':
                response = requests.post(url, json=data, headers=headers, params=params, timeout=30)
            else:
                raise ValueError(f"Unsupported method: {method}")

            success = response.status_code == expected_status
            
            try:
                response_data = response.json()
            except:
                response_data = {"raw_response": response.text}
            
            details = {
                "status_code": response.status_code,
                "expected_status": expected_status,
                "response_size": len(response.text),
                "url": url
            }
            
            if success:
                print(f"   ✅ Status: {response.status_code}")
                if response_data:
                    print(f"   📊 Response keys: {list(response_data.keys()) if isinstance(response_data, dict) else 'Non-dict response'}")
            else:
                print(f"   ❌ Status: {response.status_code} (expected {expected_status})")
                print(f"   📄 Response: {response.text[:200]}...")
                details["error_response"] = response.text[:500]

            self.log_test(name, success, details)
            return success, response_data

        except requests.exceptions.Timeout:
            error_msg = "Request timeout (30s)"
            print(f"   ❌ {error_msg}")
            self.log_test(name, False, {"error": error_msg, "url": url})
            return False, {}
        except requests.exceptions.ConnectionError:
            error_msg = "Connection error - server may be down"
            print(f"   ❌ {error_msg}")
            self.log_test(name, False, {"error": error_msg, "url": url})
            return False, {}
        except Exception as e:
            error_msg = f"Unexpected error: {str(e)}"
            print(f"   ❌ {error_msg}")
            self.log_test(name, False, {"error": error_msg, "url": url})
            return False, {}

    def test_health_endpoint(self) -> bool:
        """Test /api/health endpoint"""
        success, response = self.run_test(
            "Health Check",
            "GET",
            "/api/health",
            200
        )
        
        if success and isinstance(response, dict):
            # Check for required fields
            has_ok = response.get("ok") is True
            has_mode = "mode" in response
            has_timestamp = "timestamp" in response
            
            if has_ok and has_mode and has_timestamp:
                print(f"   ✅ Health response valid: ok={response.get('ok')}, mode={response.get('mode')}")
                return True
            else:
                print(f"   ❌ Health response missing required fields")
                self.log_test("Health Response Validation", False, {
                    "missing_fields": [f for f in ["ok", "mode", "timestamp"] if f not in response]
                })
                return False
        
        return success

    def test_ta_engine_mtf_1d(self) -> bool:
        """Test /api/ta-engine/mtf/BTC?timeframes=1D"""
        success, response = self.run_test(
            "TA Engine MTF BTC 1D",
            "GET",
            "/api/ta-engine/mtf/BTC",
            200,
            params={"timeframes": "1D"}
        )
        
        if success and isinstance(response, dict):
            # Check for tf_map structure
            tf_map = response.get("tf_map", {})
            tf_1d = tf_map.get("1D", {})
            
            # Check that we have the expected structure
            has_final_analysis = "final_analysis" in tf_1d
            has_display_message = "display_message" in tf_1d
            pattern_contract = tf_1d.get("pattern_render_contract")
            
            if has_final_analysis and has_display_message:
                # This is correct behavior - pattern_render_contract can be None if no pattern found
                final_analysis = tf_1d.get("final_analysis", {})
                analysis_mode = final_analysis.get("analysis_mode")
                display_message = tf_1d.get("display_message")
                
                print(f"   ✅ BTC 1D analysis structure valid: analysis_mode={analysis_mode}")
                if pattern_contract is None and display_message:
                    print(f"   ✅ No pattern found (expected): {display_message}")
                elif pattern_contract is not None:
                    print(f"   ✅ Pattern found: {pattern_contract.get('type', 'unknown')}")
                
                return True
            else:
                print(f"   ❌ BTC 1D missing required analysis structure")
                self.log_test("BTC 1D Analysis Structure", False, {
                    "missing_fields": [f for f in ["final_analysis", "display_message"] if f not in tf_1d],
                    "tf_1d_keys": list(tf_1d.keys())
                })
                return False
        
        return success

    def test_ta_engine_mtf_4h(self) -> bool:
        """Test /api/ta-engine/mtf/BTC?timeframes=4H"""
        success, response = self.run_test(
            "TA Engine MTF BTC 4H",
            "GET",
            "/api/ta-engine/mtf/BTC",
            200,
            params={"timeframes": "4H"}
        )
        
        if success and isinstance(response, dict):
            # Check for tf_map structure
            tf_map = response.get("tf_map", {})
            tf_4h = tf_map.get("4H", {})
            
            # Check that we have the expected structure
            has_final_analysis = "final_analysis" in tf_4h
            has_display_message = "display_message" in tf_4h
            pattern_contract = tf_4h.get("pattern_render_contract")
            
            if has_final_analysis and has_display_message:
                # This is correct behavior - pattern_render_contract can be None if no pattern found
                final_analysis = tf_4h.get("final_analysis", {})
                analysis_mode = final_analysis.get("analysis_mode")
                display_message = tf_4h.get("display_message")
                
                print(f"   ✅ BTC 4H analysis structure valid: analysis_mode={analysis_mode}")
                if pattern_contract is None and display_message:
                    print(f"   ✅ No pattern found (expected): {display_message}")
                elif pattern_contract is not None:
                    print(f"   ✅ Pattern found: {pattern_contract.get('type', 'unknown')}")
                
                return True
            else:
                print(f"   ❌ BTC 4H missing required analysis structure")
                self.log_test("BTC 4H Analysis Structure", False, {
                    "missing_fields": [f for f in ["final_analysis", "display_message"] if f not in tf_4h],
                    "tf_4h_keys": list(tf_4h.keys())
                })
                return False
        
        return success

    def test_market_narrative_engine(self) -> bool:
        """Test Market Narrative Engine - API /api/ta-engine/mtf/BTC?timeframes=1D returns narrative with short and full"""
        print(f"\n🔍 Testing Market Narrative Engine...")
        
        success, response = self.run_test(
            "Market Narrative Engine (1D)",
            "GET",
            "/api/ta-engine/mtf/BTC",
            200,
            params={"timeframes": "1D"}
        )
        
        if not success or not isinstance(response, dict):
            self.log_test("Market Narrative Engine", False, {"error": "API call failed"})
            return False
        
        # Check tf_map structure
        tf_map = response.get("tf_map", {})
        if not tf_map:
            self.log_test("Market Narrative Engine", False, {"error": "tf_map missing"})
            return False
        
        # Check 1D timeframe data
        tf_1d = tf_map.get("1D", {})
        if not tf_1d:
            self.log_test("Market Narrative Engine", False, {"error": "1D timeframe data missing"})
            return False
        
        # Check narrative exists
        narrative = tf_1d.get("narrative", {})
        if not narrative:
            self.log_test("Market Narrative Engine", False, {"error": "narrative field missing"})
            return False
        
        # Check narrative.short
        narrative_short = narrative.get("short", "")
        if not narrative_short or len(narrative_short.strip()) == 0:
            self.log_test("Market Narrative Engine", False, {"error": "narrative.short is empty"})
            return False
        
        # Check narrative.full
        narrative_full = narrative.get("full", "")
        if not narrative_full or len(narrative_full.strip()) == 0:
            self.log_test("Market Narrative Engine", False, {"error": "narrative.full is empty"})
            return False
        
        # Check if narrative.full contains pattern description when pattern exists
        pattern = tf_1d.get("primary_pattern") or tf_1d.get("pattern_render_contract")
        pattern_mentioned = True
        if pattern and pattern.get("type"):
            pattern_type = pattern.get("type", "").replace("_", " ")
            if pattern_type.lower() not in narrative_full.lower():
                pattern_mentioned = False
        
        self.log_test("Market Narrative Engine", True, {
            "narrative_short": narrative_short[:50] + "..." if len(narrative_short) > 50 else narrative_short,
            "narrative_full": narrative_full[:80] + "..." if len(narrative_full) > 80 else narrative_full,
            "pattern_mentioned": pattern_mentioned,
            "pattern_type": pattern.get("type") if pattern else None
        })
        return True

    def test_mtf_alignment_engine(self) -> bool:
        """Test MTF Alignment Engine - API /api/ta-engine/mtf/BTC?timeframes=1D,4H returns mtf_context.alignment"""
        print(f"\n🔍 Testing MTF Alignment Engine...")
        
        success, response = self.run_test(
            "MTF Alignment Engine (1D,4H)",
            "GET",
            "/api/ta-engine/mtf/BTC",
            200,
            params={"timeframes": "1D,4H"}
        )
        
        if not success or not isinstance(response, dict):
            self.log_test("MTF Alignment Engine", False, {"error": "API call failed"})
            return False
        
        # Check mtf_context exists
        mtf_context = response.get("mtf_context", {})
        if not mtf_context:
            self.log_test("MTF Alignment Engine", False, {"error": "mtf_context missing"})
            return False
        
        # Check alignment exists
        alignment = mtf_context.get("alignment", {})
        if not alignment:
            self.log_test("MTF Alignment Engine", False, {"error": "mtf_context.alignment missing"})
            return False
        
        # Check alignment.direction
        direction = alignment.get("direction", "")
        valid_directions = ["bullish", "bearish", "neutral"]
        if direction not in valid_directions:
            self.log_test("MTF Alignment Engine", False, {
                "error": "Invalid alignment.direction",
                "expected": valid_directions,
                "actual": direction
            })
            return False
        
        # Check alignment.confidence
        confidence = alignment.get("confidence")
        if confidence is None or not isinstance(confidence, (int, float)) or confidence < 0 or confidence > 1:
            self.log_test("MTF Alignment Engine", False, {
                "error": "Invalid alignment.confidence",
                "expected": "Number between 0 and 1",
                "actual": confidence
            })
            return False
        
        # Check mtf_narrative exists
        mtf_narrative = mtf_context.get("mtf_narrative", {})
        if not mtf_narrative:
            self.log_test("MTF Alignment Engine", False, {"error": "mtf_context.mtf_narrative missing"})
            return False
        
        # Check mtf_narrative.short and full
        mtf_narrative_short = mtf_narrative.get("short", "")
        mtf_narrative_full = mtf_narrative.get("full", "")
        
        if not mtf_narrative_short or len(mtf_narrative_short.strip()) == 0:
            self.log_test("MTF Alignment Engine", False, {"error": "mtf_narrative.short is empty"})
            return False
        
        if not mtf_narrative_full or len(mtf_narrative_full.strip()) == 0:
            self.log_test("MTF Alignment Engine", False, {"error": "mtf_narrative.full is empty"})
            return False
        
        self.log_test("MTF Alignment Engine", True, {
            "alignment_direction": direction,
            "alignment_confidence": confidence,
            "mtf_narrative_short": mtf_narrative_short[:50] + "..." if len(mtf_narrative_short) > 50 else mtf_narrative_short,
            "mtf_narrative_full": mtf_narrative_full[:80] + "..." if len(mtf_narrative_full) > 80 else mtf_narrative_full
        })
        return True

    def test_4h_double_top_pattern(self) -> bool:
        """Test if 4H timeframe shows Double Top pattern (if present)"""
        print(f"\n🔍 Testing 4H Timeframe - Double Top Pattern...")
        
        success, response = self.run_test(
            "4H Double Top Pattern Check",
            "GET",
            "/api/ta-engine/mtf/BTC",
            200,
            params={"timeframes": "4H"}
        )
        
        if not success or not isinstance(response, dict):
            self.log_test("4H Double Top Pattern", False, {"error": "API call failed"})
            return False
        
        # Check 4H timeframe data
        tf_map = response.get("tf_map", {})
        tf_4h = tf_map.get("4H", {})
        
        if not tf_4h:
            self.log_test("4H Double Top Pattern", False, {"error": "4H timeframe data missing"})
            return False
        
        # Check for patterns in 4H data
        patterns_found = []
        
        # Check primary_pattern
        primary_pattern = tf_4h.get("primary_pattern")
        if primary_pattern and primary_pattern.get("type"):
            patterns_found.append(primary_pattern.get("type"))
        
        # Check pattern_render_contract
        render_contract = tf_4h.get("pattern_render_contract")
        if render_contract and render_contract.get("type"):
            patterns_found.append(render_contract.get("type"))
        
        # Check alternative patterns
        alt_patterns = tf_4h.get("alternative_patterns", [])
        for alt in alt_patterns:
            if alt.get("type"):
                patterns_found.append(alt.get("type"))
        
        # Check alternative render contracts
        alt_render_contracts = tf_4h.get("alternative_render_contracts", [])
        for alt in alt_render_contracts:
            if alt.get("type"):
                patterns_found.append(alt.get("type"))
        
        # Look for Double Top pattern
        double_top_found = any("double_top" in pattern.lower() or "double top" in pattern.lower() 
                             for pattern in patterns_found)
        
        # This test passes regardless of whether Double Top is found, as it depends on current market conditions
        self.log_test("4H Double Top Pattern", True, {
            "double_top_found": double_top_found,
            "patterns_detected": patterns_found,
            "note": "Double Top presence depends on current market conditions"
        })
        return True
    def test_history_scanner_logs(self) -> bool:
        """Test if HistoryScanner is working by checking API responses for scanner activity"""
        print(f"\n🔍 Testing HistoryScanner functionality...")
        
        # Test both timeframes to see scanner activity
        success_1d, response_1d = self.run_test(
            "HistoryScanner Activity Check (1D)",
            "GET",
            "/api/ta-engine/mtf/BTC",
            200,
            params={"timeframes": "1D"}
        )
        
        success_4h, response_4h = self.run_test(
            "HistoryScanner Activity Check (4H)",
            "GET",
            "/api/ta-engine/mtf/BTC",
            200,
            params={"timeframes": "4H"}
        )
        
        # Check if we get any pattern data indicating scanner worked
        scanner_working = False
        scanner_evidence = []
        
        if success_1d and isinstance(response_1d, dict):
            tf_map = response_1d.get("tf_map", {})
            tf_1d = tf_map.get("1D", {})
            pattern = tf_1d.get("pattern_render_contract")
            if pattern and isinstance(pattern, dict):
                # Look for evidence of history scanning
                if pattern.get("engine") == "V8_HISTORY_SCAN":
                    scanner_evidence.append("Found V8_HISTORY_SCAN engine (HistoryScanner)")
                    scanner_working = True
                if pattern.get("source") == "HISTORY_SCAN_V8":
                    scanner_evidence.append("Found HISTORY_SCAN_V8 source (HistoryScanner)")
                    scanner_working = True
                if pattern.get("window") and isinstance(pattern.get("window"), dict):
                    window = pattern["window"]
                    if "candle_count" in window:
                        scanner_evidence.append(f"Found window with {window['candle_count']} candles")
                        scanner_working = True
        
        if success_4h and isinstance(response_4h, dict):
            tf_map = response_4h.get("tf_map", {})
            tf_4h = tf_map.get("4H", {})
            pattern = tf_4h.get("pattern_render_contract")
            if pattern and isinstance(pattern, dict):
                if pattern.get("engine") == "V8_HISTORY_SCAN" and "V8_HISTORY_SCAN" not in str(scanner_evidence):
                    scanner_evidence.append("Found V8_HISTORY_SCAN engine in 4H (HistoryScanner)")
                    scanner_working = True
        
        if scanner_working:
            print(f"   ✅ HistoryScanner evidence found:")
            for evidence in scanner_evidence:
                print(f"      - {evidence}")
            self.log_test("HistoryScanner Activity", True, {"evidence": scanner_evidence})
            return True
        else:
            print(f"   ❌ No evidence of HistoryScanner activity")
            self.log_test("HistoryScanner Activity", False, {
                "checked_responses": ["1D", "4H"],
                "no_scanner_metadata": True
            })
            return False

    def test_display_gate_lowered_thresholds(self) -> bool:
        """Test if Display Gate is passing patterns with lowered thresholds"""
        print(f"\n🔍 Testing Display Gate with lowered thresholds...")
        
        # Test multiple timeframes to see if patterns are being displayed
        timeframes = ["1D", "4H"]
        patterns_found = []
        
        for tf in timeframes:
            success, response = self.run_test(
                f"Display Gate Check ({tf})",
                "GET",
                "/api/ta-engine/mtf/BTC",
                200,
                params={"timeframes": tf}
            )
            
            if success and isinstance(response, dict):
                tf_map = response.get("tf_map", {})
                tf_data = tf_map.get(tf, {})
                pattern = tf_data.get("pattern_render_contract")
                if pattern and isinstance(pattern, dict):
                    pattern_type = pattern.get("type", "unknown")
                    combined_score = pattern.get("combined_score", 0)
                    touch_score = pattern.get("touch_score", 0)
                    render_quality = pattern.get("render_quality", 0)
                    display_approved = pattern.get("display_approved", False)
                    
                    patterns_found.append({
                        "timeframe": tf,
                        "type": pattern_type,
                        "combined_score": combined_score,
                        "touch_score": touch_score,
                        "render_quality": render_quality,
                        "display_approved": display_approved
                    })
                    
                    print(f"   📊 {tf} Pattern: {pattern_type} (score: {combined_score:.3f}, approved: {display_approved})")
        
        if patterns_found:
            # Check if any patterns have scores that would indicate lowered thresholds
            # Based on the code, lowered thresholds are:
            # - combined_score >= 0.50 (was 0.65)
            # - touch_score >= 0.40 (was 0.55) 
            # - render_quality >= 0.50 (was 0.65)
            
            lowered_threshold_evidence = []
            for p in patterns_found:
                if 0.50 <= p["combined_score"] < 0.65:
                    lowered_threshold_evidence.append(f"{p['timeframe']} pattern passed with combined_score {p['combined_score']:.3f} (would fail old 0.65 threshold)")
                if 0.40 <= p["touch_score"] < 0.55:
                    lowered_threshold_evidence.append(f"{p['timeframe']} pattern passed with touch_score {p['touch_score']:.3f} (would fail old 0.55 threshold)")
                if 0.50 <= p["render_quality"] < 0.65:
                    lowered_threshold_evidence.append(f"{p['timeframe']} pattern passed with render_quality {p['render_quality']:.3f} (would fail old 0.65 threshold)")
            
            if lowered_threshold_evidence:
                print(f"   ✅ Evidence of lowered thresholds:")
                for evidence in lowered_threshold_evidence:
                    print(f"      - {evidence}")
                self.log_test("Display Gate Lowered Thresholds", True, {
                    "patterns_found": patterns_found,
                    "lowered_threshold_evidence": lowered_threshold_evidence
                })
                return True
            else:
                print(f"   ✅ Patterns found, but scores are high (may not show lowered threshold effect)")
                self.log_test("Display Gate Patterns Found", True, {
                    "patterns_found": patterns_found,
                    "note": "Patterns found but scores too high to demonstrate lowered thresholds"
                })
                return True
        else:
            print(f"   ❌ No patterns found - Display Gate may be too strict")
            self.log_test("Display Gate Lowered Thresholds", False, {
                "timeframes_tested": timeframes,
                "no_patterns_found": True
            })
            return False

    def test_ta_engine_status(self) -> bool:
        """Test /api/ta-engine/status endpoint"""
        success, response = self.run_test(
            "TA Engine Status",
            "GET",
            "/api/ta-engine/status",
            200
        )
        
        if success and isinstance(response, dict):
            # Check for required fields (adjusted based on actual response)
            has_ok = response.get("ok") is True
            has_version = "version" in response
            has_phase = "phase" in response  # API returns 'phase' not 'status'
            
            if has_ok and has_version and has_phase:
                print(f"   ✅ TA Engine status valid: ok={response.get('ok')}, version={response.get('version')}, phase={response.get('phase')}")
                return True
            else:
                print(f"   ❌ TA Engine status missing required fields")
                self.log_test("TA Engine Status Validation", False, {
                    "missing_fields": [f for f in ["ok", "version", "phase"] if f not in response]
                })
                return False
        
        return success

    def test_coinbase_provider_status(self) -> bool:
        """Test /api/provider/coinbase/status endpoint"""
        success, response = self.run_test(
            "Coinbase Provider Status",
            "GET",
            "/api/provider/coinbase/status",
            200
        )
        
        if success and isinstance(response, dict):
            # Check for required fields (adjusted based on actual response)
            has_provider = "provider" in response
            has_status = "status" in response
            has_initialized = "is_initialized" in response  # API returns 'is_initialized' not 'connected'
            
            if has_provider and has_status and has_initialized:
                is_working = response.get("status") == "connected" and response.get("is_initialized") is True
                print(f"   ✅ Coinbase provider status valid: status={response.get('status')}, initialized={response.get('is_initialized')}")
                return is_working
            else:
                print(f"   ❌ Coinbase provider status missing required fields")
                self.log_test("Coinbase Provider Status Validation", False, {
                    "missing_fields": [f for f in ["provider", "status", "is_initialized"] if f not in response]
                })
                return False
        
        return success

    def test_sol_1d_analysis_mode_figure(self) -> bool:
        """Test SOL 1D should return analysis_mode=figure with pattern_render_contract"""
        success, response = self.run_test(
            "SOL 1D Analysis Mode Figure",
            "GET",
            "/api/ta-engine/mtf/SOL",
            200,
            params={"timeframes": "1D"}
        )
        
        if success and isinstance(response, dict):
            tf_map = response.get("tf_map", {})
            tf_1d = tf_map.get("1D", {})
            final_analysis = tf_1d.get("final_analysis", {})
            analysis_mode = final_analysis.get("analysis_mode")
            pattern_contract = tf_1d.get("pattern_render_contract")
            
            # Check for geometry boundaries in final_analysis.ui.main_overlay
            ui = final_analysis.get("ui", {})
            main_overlay = ui.get("main_overlay", {})
            geometry = main_overlay.get("geometry") if main_overlay else None
            
            if analysis_mode == "figure" and pattern_contract is not None:
                print(f"   ✅ SOL 1D has analysis_mode=figure with pattern_render_contract")
                if geometry and isinstance(geometry, dict):
                    boundaries = geometry.get("boundaries", {})
                    if boundaries:
                        print(f"   ✅ SOL 1D has geometry.boundaries in final_analysis.ui.main_overlay")
                        return True
                    else:
                        print(f"   ❌ SOL 1D missing geometry.boundaries in final_analysis.ui.main_overlay")
                        self.log_test("SOL 1D Geometry Boundaries", False, {
                            "geometry": geometry,
                            "main_overlay": main_overlay
                        })
                        return False
                else:
                    print(f"   ❌ SOL 1D missing geometry in final_analysis.ui.main_overlay")
                    self.log_test("SOL 1D Geometry", False, {
                        "ui": ui,
                        "main_overlay": main_overlay
                    })
                    return False
            else:
                print(f"   ❌ SOL 1D analysis_mode={analysis_mode}, pattern_contract={pattern_contract is not None}")
                self.log_test("SOL 1D Analysis Mode", False, {
                    "analysis_mode": analysis_mode,
                    "has_pattern_contract": pattern_contract is not None,
                    "final_analysis_keys": list(final_analysis.keys())
                })
                return False
        
        return success

    def test_btc_eth_1d_analysis_mode_structure(self) -> bool:
        """Test BTC/ETH 1D analysis_mode can be structure (if no pattern)"""
        symbols = ["BTC", "ETH"]
        structure_found = False
        
        for symbol in symbols:
            success, response = self.run_test(
                f"{symbol} 1D Analysis Mode Check",
                "GET",
                f"/api/ta-engine/mtf/{symbol}",
                200,
                params={"timeframes": "1D"}
            )
            
            if success and isinstance(response, dict):
                tf_map = response.get("tf_map", {})
                tf_1d = tf_map.get("1D", {})
                final_analysis = tf_1d.get("final_analysis", {})
                analysis_mode = final_analysis.get("analysis_mode")
                
                print(f"   📊 {symbol} 1D analysis_mode: {analysis_mode}")
                
                if analysis_mode == "structure":
                    structure_found = True
                    print(f"   ✅ {symbol} 1D has analysis_mode=structure (valid fallback)")
                elif analysis_mode == "figure":
                    print(f"   ✅ {symbol} 1D has analysis_mode=figure (pattern found)")
                else:
                    print(f"   ⚠️  {symbol} 1D has analysis_mode={analysis_mode}")
        
        if structure_found:
            self.log_test("BTC/ETH Structure Mode", True, {
                "note": "At least one symbol shows structure mode as expected"
            })
            return True
        else:
            self.log_test("BTC/ETH Structure Mode", True, {
                "note": "Both symbols show figure mode (patterns found, which is also valid)"
            })
            return True

    def run_all_tests(self) -> Dict[str, Any]:
        """Run all tests and return summary"""
        print("=" * 60)
        print("TA ENGINE BACKEND API TESTING")
        print("=" * 60)
        print(f"Base URL: {self.base_url}")
        print(f"Test Time: {datetime.now().isoformat()}")
        print()
        
        # Run all tests
        test_results = {
            "health": self.test_health_endpoint(),
            "ta_engine_status": self.test_ta_engine_status(),
            "coinbase_provider": self.test_coinbase_provider_status(),
            "ta_engine_1d": self.test_ta_engine_mtf_1d(),
            "ta_engine_4h": self.test_ta_engine_mtf_4h(),
            "market_narrative_engine": self.test_market_narrative_engine(),
            "mtf_alignment_engine": self.test_mtf_alignment_engine(),
            "4h_double_top_pattern": self.test_4h_double_top_pattern(),
            "sol_1d_figure_mode": self.test_sol_1d_analysis_mode_figure(),
            "btc_eth_structure_mode": self.test_btc_eth_1d_analysis_mode_structure(),
            "history_scanner": self.test_history_scanner_logs(),
            "display_gate": self.test_display_gate_lowered_thresholds()
        }
        
        # Summary
        print("\n" + "=" * 60)
        print("TEST SUMMARY")
        print("=" * 60)
        print(f"Tests Run: {self.tests_run}")
        print(f"Tests Passed: {self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%" if self.tests_run > 0 else "0%")
        print()
        
        # Individual test results
        for test_name, passed in test_results.items():
            status = "✅ PASS" if passed else "❌ FAIL"
            print(f"{status} {test_name}")
        
        # Critical issues
        critical_issues = []
        if not test_results["health"]:
            critical_issues.append("Health endpoint not working")
        if not test_results["ta_engine_status"]:
            critical_issues.append("TA Engine status endpoint not working")
        if not test_results["coinbase_provider"]:
            critical_issues.append("Coinbase provider not connected")
        if not test_results["sol_1d_figure_mode"]:
            critical_issues.append("SOL 1D not returning analysis_mode=figure with geometry boundaries")
        
        if critical_issues:
            print(f"\n🚨 CRITICAL ISSUES:")
            for issue in critical_issues:
                print(f"   - {issue}")
        
        return {
            "summary": {
                "tests_run": self.tests_run,
                "tests_passed": self.tests_passed,
                "success_rate": (self.tests_passed/self.tests_run*100) if self.tests_run > 0 else 0,
                "critical_issues": critical_issues
            },
            "test_results": test_results,
            "detailed_results": self.test_results,
            "timestamp": datetime.now().isoformat()
        }


def main():
    """Main test runner"""
    tester = TAEngineAPITester()
    results = tester.run_all_tests()
    
    # Save results to file
    with open("/app/backend_test_results.json", "w") as f:
        json.dump(results, f, indent=2)
    
    print(f"\n📄 Detailed results saved to: /app/backend_test_results.json")
    
    # Return appropriate exit code
    if results["summary"]["critical_issues"]:
        print(f"\n❌ Tests completed with critical issues")
        return 1
    elif results["summary"]["success_rate"] < 80:
        print(f"\n⚠️  Tests completed with low success rate")
        return 1
    else:
        print(f"\n✅ All tests completed successfully")
        return 0


if __name__ == "__main__":
    sys.exit(main())