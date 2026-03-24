#!/usr/bin/env python3
"""
TA Engine Geometry Module Testing
=================================

Tests the geometry normalization and pattern projection components:
1. /api/health endpoint
2. geometry_normalizer unit tests (12 tests expected)
3. pattern_projection_engine unit tests (16 tests expected)
"""

import requests
import sys
import json
import subprocess
import os
from datetime import datetime
from typing import Dict, Any

class GeometryModuleTester:
    def __init__(self, base_url: str = "https://r4r4r44r4-nrxc.preview.emergentagent.com"):
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

    def test_health_endpoint(self) -> bool:
        """Test /api/health endpoint"""
        print(f"\n🔍 Testing Health Endpoint...")
        print(f"   URL: {self.base_url}/api/health")
        
        try:
            response = requests.get(f"{self.base_url}/api/health", timeout=30)
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    has_ok = data.get("ok") is True
                    has_mode = "mode" in data or "version" in data
                    has_timestamp = "timestamp" in data
                    
                    if has_ok and has_mode:
                        print(f"   ✅ Health endpoint working: {data}")
                        self.log_test("Health Endpoint", True, {"response": data})
                        return True
                    else:
                        print(f"   ❌ Health response missing required fields: {data}")
                        self.log_test("Health Endpoint", False, {"response": data})
                        return False
                except json.JSONDecodeError:
                    print(f"   ❌ Health endpoint returned non-JSON: {response.text[:200]}")
                    self.log_test("Health Endpoint", False, {"error": "Non-JSON response"})
                    return False
            else:
                print(f"   ❌ Health endpoint returned status {response.status_code}")
                self.log_test("Health Endpoint", False, {"status_code": response.status_code})
                return False
                
        except requests.exceptions.Timeout:
            print(f"   ❌ Health endpoint timeout")
            self.log_test("Health Endpoint", False, {"error": "Timeout"})
            return False
        except requests.exceptions.ConnectionError:
            print(f"   ❌ Health endpoint connection error")
            self.log_test("Health Endpoint", False, {"error": "Connection error"})
            return False
        except Exception as e:
            print(f"   ❌ Health endpoint error: {str(e)}")
            self.log_test("Health Endpoint", False, {"error": str(e)})
            return False

    def test_geometry_normalizer_unit_tests(self) -> bool:
        """Run unit tests for geometry_normalizer module"""
        print(f"\n🔍 Testing Geometry Normalizer Unit Tests...")
        
        try:
            # Change to backend directory
            os.chdir("/app/backend")
            
            # Run pytest on the specific test file
            result = subprocess.run([
                "python", "-m", "pytest", 
                "tests/test_geometry_normalizer.py", 
                "-v", "--tb=short"
            ], capture_output=True, text=True, timeout=60)
            
            print(f"   Exit code: {result.returncode}")
            print(f"   STDOUT:\n{result.stdout}")
            if result.stderr:
                print(f"   STDERR:\n{result.stderr}")
            
            # Parse output to count tests
            stdout_lines = result.stdout.split('\n')
            test_count = 0
            passed_count = 0
            
            for line in stdout_lines:
                if "PASSED" in line:
                    passed_count += 1
                    test_count += 1
                elif "FAILED" in line:
                    test_count += 1
            
            # Look for summary line
            for line in stdout_lines:
                if "passed" in line and "failed" in line:
                    # Extract numbers from summary
                    import re
                    numbers = re.findall(r'\d+', line)
                    if len(numbers) >= 2:
                        passed_count = int(numbers[0])
                        test_count = passed_count + int(numbers[1])
                        break
                elif "passed" in line and "failed" not in line:
                    import re
                    numbers = re.findall(r'\d+', line)
                    if numbers:
                        passed_count = int(numbers[0])
                        test_count = passed_count
                        break
            
            success = result.returncode == 0 and test_count >= 12
            
            details = {
                "exit_code": result.returncode,
                "tests_found": test_count,
                "tests_passed": passed_count,
                "expected_tests": 12,
                "stdout": result.stdout,
                "stderr": result.stderr
            }
            
            if success:
                print(f"   ✅ Geometry normalizer tests passed: {passed_count}/{test_count}")
            else:
                print(f"   ❌ Geometry normalizer tests failed: {passed_count}/{test_count} (expected ≥12)")
            
            self.log_test("Geometry Normalizer Unit Tests", success, details)
            return success
            
        except subprocess.TimeoutExpired:
            print(f"   ❌ Geometry normalizer tests timed out")
            self.log_test("Geometry Normalizer Unit Tests", False, {"error": "Timeout"})
            return False
        except Exception as e:
            print(f"   ❌ Error running geometry normalizer tests: {str(e)}")
            self.log_test("Geometry Normalizer Unit Tests", False, {"error": str(e)})
            return False

    def test_pattern_projection_unit_tests(self) -> bool:
        """Run unit tests for pattern_projection_engine module"""
        print(f"\n🔍 Testing Pattern Projection Engine Unit Tests...")
        
        try:
            # Change to backend directory
            os.chdir("/app/backend")
            
            # Run pytest on the specific test file
            result = subprocess.run([
                "python", "-m", "pytest", 
                "tests/test_pattern_projection.py", 
                "-v", "--tb=short"
            ], capture_output=True, text=True, timeout=60)
            
            print(f"   Exit code: {result.returncode}")
            print(f"   STDOUT:\n{result.stdout}")
            if result.stderr:
                print(f"   STDERR:\n{result.stderr}")
            
            # Parse output to count tests
            stdout_lines = result.stdout.split('\n')
            test_count = 0
            passed_count = 0
            
            for line in stdout_lines:
                if "PASSED" in line:
                    passed_count += 1
                    test_count += 1
                elif "FAILED" in line:
                    test_count += 1
            
            # Look for summary line
            for line in stdout_lines:
                if "passed" in line and "failed" in line:
                    # Extract numbers from summary
                    import re
                    numbers = re.findall(r'\d+', line)
                    if len(numbers) >= 2:
                        passed_count = int(numbers[0])
                        test_count = passed_count + int(numbers[1])
                        break
                elif "passed" in line and "failed" not in line:
                    import re
                    numbers = re.findall(r'\d+', line)
                    if numbers:
                        passed_count = int(numbers[0])
                        test_count = passed_count
                        break
            
            success = result.returncode == 0 and test_count >= 16
            
            details = {
                "exit_code": result.returncode,
                "tests_found": test_count,
                "tests_passed": passed_count,
                "expected_tests": 16,
                "stdout": result.stdout,
                "stderr": result.stderr
            }
            
            if success:
                print(f"   ✅ Pattern projection tests passed: {passed_count}/{test_count}")
            else:
                print(f"   ❌ Pattern projection tests failed: {passed_count}/{test_count} (expected ≥16)")
            
            self.log_test("Pattern Projection Engine Unit Tests", success, details)
            return success
            
        except subprocess.TimeoutExpired:
            print(f"   ❌ Pattern projection tests timed out")
            self.log_test("Pattern Projection Engine Unit Tests", False, {"error": "Timeout"})
            return False
        except Exception as e:
            print(f"   ❌ Error running pattern projection tests: {str(e)}")
            self.log_test("Pattern Projection Engine Unit Tests", False, {"error": str(e)})
            return False

    def test_frontend_compilation(self) -> bool:
        """Test if PatternSVGOverlay.jsx compiles without errors"""
        print(f"\n🔍 Testing Frontend Compilation...")
        
        try:
            # Change to frontend directory
            os.chdir("/app/frontend")
            
            # Run yarn build to check compilation
            result = subprocess.run([
                "yarn", "build"
            ], capture_output=True, text=True, timeout=120)
            
            print(f"   Exit code: {result.returncode}")
            if result.stdout:
                print(f"   STDOUT:\n{result.stdout}")
            if result.stderr:
                print(f"   STDERR:\n{result.stderr}")
            
            success = result.returncode == 0
            
            details = {
                "exit_code": result.returncode,
                "stdout": result.stdout,
                "stderr": result.stderr
            }
            
            if success:
                print(f"   ✅ Frontend compilation successful")
            else:
                print(f"   ❌ Frontend compilation failed")
            
            self.log_test("Frontend Compilation", success, details)
            return success
            
        except subprocess.TimeoutExpired:
            print(f"   ❌ Frontend compilation timed out")
            self.log_test("Frontend Compilation", False, {"error": "Timeout"})
            return False
        except Exception as e:
            print(f"   ❌ Error during frontend compilation: {str(e)}")
            self.log_test("Frontend Compilation", False, {"error": str(e)})
            return False

    def test_frontend_loading(self) -> bool:
        """Test if frontend loads on port 3000"""
        print(f"\n🔍 Testing Frontend Loading...")
        
        # Check if frontend is already running by testing the public URL
        frontend_url = "https://r4r4r44r4-nrxc.preview.emergentagent.com"
        
        try:
            response = requests.get(frontend_url, timeout=30)
            
            if response.status_code == 200:
                # Check if it's actually a React app
                content = response.text
                is_react = "react" in content.lower() or "root" in content or "app" in content.lower()
                
                if is_react:
                    print(f"   ✅ Frontend loading successfully at {frontend_url}")
                    self.log_test("Frontend Loading", True, {"url": frontend_url, "status_code": response.status_code})
                    return True
                else:
                    print(f"   ❌ Frontend URL returns content but doesn't appear to be React app")
                    self.log_test("Frontend Loading", False, {"url": frontend_url, "content_preview": content[:200]})
                    return False
            else:
                print(f"   ❌ Frontend not accessible at {frontend_url} (status: {response.status_code})")
                self.log_test("Frontend Loading", False, {"url": frontend_url, "status_code": response.status_code})
                return False
                
        except requests.exceptions.Timeout:
            print(f"   ❌ Frontend loading timeout")
            self.log_test("Frontend Loading", False, {"error": "Timeout"})
            return False
        except requests.exceptions.ConnectionError:
            print(f"   ❌ Frontend connection error")
            self.log_test("Frontend Loading", False, {"error": "Connection error"})
            return False
        except Exception as e:
            print(f"   ❌ Frontend loading error: {str(e)}")
            self.log_test("Frontend Loading", False, {"error": str(e)})
            return False

    def run_all_tests(self) -> Dict[str, Any]:
        """Run all tests and return summary"""
        print("=" * 60)
        print("TA ENGINE GEOMETRY MODULE TESTING")
        print("=" * 60)
        print(f"Base URL: {self.base_url}")
        print(f"Test Time: {datetime.now().isoformat()}")
        print()
        
        # Run all tests
        test_results = {
            "health_endpoint": self.test_health_endpoint(),
            "geometry_normalizer_tests": self.test_geometry_normalizer_unit_tests(),
            "pattern_projection_tests": self.test_pattern_projection_unit_tests(),
            "frontend_compilation": self.test_frontend_compilation(),
            "frontend_loading": self.test_frontend_loading()
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
        if not test_results["health_endpoint"]:
            critical_issues.append("Health endpoint not working")
        if not test_results["geometry_normalizer_tests"]:
            critical_issues.append("Geometry normalizer unit tests failing")
        if not test_results["pattern_projection_tests"]:
            critical_issues.append("Pattern projection unit tests failing")
        if not test_results["frontend_compilation"]:
            critical_issues.append("Frontend compilation errors")
        
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
    tester = GeometryModuleTester()
    results = tester.run_all_tests()
    
    # Save results to file
    with open("/app/geometry_test_results.json", "w") as f:
        json.dump(results, f, indent=2)
    
    print(f"\n📄 Detailed results saved to: /app/geometry_test_results.json")
    
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