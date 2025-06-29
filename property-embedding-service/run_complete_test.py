"""
Complete test - start service and run comprehensive tests
"""
import subprocess
import sys
import os
import time
import threading
import signal

def start_service_in_background():
    """Start the service in background"""
    try:
        print("🚀 Starting service in background...")
        # Start the service process
        process = subprocess.Popen(
            [sys.executable, "src/main_simple_working.py"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        # Give it time to start
        time.sleep(5)
        
        # Check if it's still running
        if process.poll() is None:
            print("✅ Service started successfully")
            return process
        else:
            stdout, stderr = process.communicate()
            print(f"❌ Service failed to start")
            print(f"STDOUT: {stdout}")
            print(f"STDERR: {stderr}")
            return None
            
    except Exception as e:
        print(f"❌ Error starting service: {e}")
        return None

def run_tests():
    """Run the comprehensive tests"""
    try:
        print("\n🧪 Running comprehensive tests...")
        result = subprocess.run(
            [sys.executable, "test_simple_no_unicode.py"],
            capture_output=True,
            text=True,
            timeout=120
        )
        
        print("📋 Test Output:")
        print(result.stdout)
        
        if result.stderr:
            print("⚠️ Test Errors:")
            print(result.stderr)
        
        return result.returncode == 0
        
    except subprocess.TimeoutExpired:
        print("❌ Tests timed out")
        return False
    except Exception as e:
        print(f"❌ Error running tests: {e}")
        return False

def main():
    print("🎯 Complete Service Test - Enhanced TDD Implementation")
    print("=" * 60)
    
    # Check if we're in the right directory
    if not os.path.exists("src/main_simple_working.py"):
        print("❌ Please run this from the property-embedding-service directory")
        return
    
    service_process = None
    
    try:
        # Start service
        service_process = start_service_in_background()
        
        if not service_process:
            print("❌ Could not start service")
            return
        
        # Run tests
        success = run_tests()
        
        if success:
            print("\n🎉 ALL TESTS PASSED!")
            print("✅ Your Enhanced TDD Implementation is working perfectly!")
            print("\n🚀 Ready for production deployment!")
        else:
            print("\n❌ Some tests failed")
            
    except KeyboardInterrupt:
        print("\n🛑 Test interrupted by user")
    finally:
        # Clean up service process
        if service_process and service_process.poll() is None:
            print("\n🛑 Stopping service...")
            service_process.terminate()
            try:
                service_process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                service_process.kill()
            print("✅ Service stopped")

if __name__ == "__main__":
    main()