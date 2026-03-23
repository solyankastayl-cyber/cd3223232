#!/usr/bin/env python3
"""
Backend API Testing for TA Engine
=================================

Tests the technical analysis engine APIs with focus on:
1. Health endpoint
2. TA Engine MTF endpoints for pattern detection
3. History Scanner functionality
4. Display Gate with lowered thresholds
"""

import requests
import sys
import json
from datetime import datetime
from typing import Dict, Any, Optional

class TAEngineAPITester:
    def __init__(self, base_url: str = "http://localhost:8001"):
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
            # Check for pattern_render_contract in tf_map
            tf_map = response.get("tf_map", {})
            tf_1d = tf_map.get("1D", {})
            pattern_contract = tf_1d.get("pattern_render_contract")
            
            if pattern_contract is not None:
                # Check for required fields in pattern contract
                has_type = "type" in pattern_contract if isinstance(pattern_contract, dict) else False
                has_combined_score = "combined_score" in pattern_contract if isinstance(pattern_contract, dict) else False
                
                if has_type and has_combined_score:
                    print(f"   ✅ Pattern contract valid: type={pattern_contract.get('type')}, score={pattern_contract.get('combined_score')}")
                    return True
                else:
                    print(f"   ❌ Pattern contract missing required fields")
                    self.log_test("Pattern Contract Validation 1D", False, {
                        "pattern_contract": pattern_contract,
                        "missing_fields": [f for f in ["type", "combined_score"] if f not in (pattern_contract or {})]
                    })
                    return False
            else:
                print(f"   ❌ No pattern_render_contract in tf_map.1D")
                self.log_test("Pattern Contract Presence 1D", False, {
                    "tf_map_keys": list(tf_map.keys()),
                    "tf_1d_keys": list(tf_1d.keys()),
                    "pattern_contract": pattern_contract
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
            # Check for pattern_render_contract in tf_map (should not be None)
            tf_map = response.get("tf_map", {})
            tf_4h = tf_map.get("4H", {})
            pattern_contract = tf_4h.get("pattern_render_contract")
            
            if pattern_contract is not None:
                print(f"   ✅ Pattern contract exists (not None)")
                if isinstance(pattern_contract, dict):
                    print(f"   📊 Pattern type: {pattern_contract.get('type', 'unknown')}")
                    print(f"   📊 Combined score: {pattern_contract.get('combined_score', 'unknown')}")
                return True
            else:
                print(f"   ❌ Pattern contract is None")
                self.log_test("Pattern Contract Non-None 4H", False, {
                    "tf_map_keys": list(tf_map.keys()),
                    "tf_4h_keys": list(tf_4h.keys()),
                    "pattern_contract": pattern_contract
                })
                return False
        
        return success

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
            "ta_engine_1d": self.test_ta_engine_mtf_1d(),
            "ta_engine_4h": self.test_ta_engine_mtf_4h(),
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
        if not test_results["ta_engine_1d"]:
            critical_issues.append("TA Engine 1D endpoint not returning valid pattern contract")
        if not test_results["ta_engine_4h"]:
            critical_issues.append("TA Engine 4H endpoint not returning pattern contract")
        
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