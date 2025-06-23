#!/usr/bin/env python3
"""
Test script to verify all imports work correctly in the virtual environment
"""

def test_imports():
    try:
        # Test all the imports from main_enhanced.py
        from fastapi import FastAPI, HTTPException, Request
        from fastapi.middleware.cors import CORSMiddleware
        from pydantic import BaseModel
        from typing import List, Dict, Optional
        import numpy as np
        from sentence_transformers import SentenceTransformer
        import torch
        import redis
        import json
        import hashlib
        import logging
        from datetime import datetime, timedelta
        import asyncio
        from contextlib import asynccontextmanager
        import os
        from prometheus_client import Counter, Histogram, generate_latest
        import time
        
        print("✅ All imports successful!")
        print(f"🐍 Python version: {__import__('sys').version}")
        print(f"🔥 PyTorch version: {torch.__version__}")
        print(f"🤗 Sentence Transformers version: {__import__('sentence_transformers').__version__}")
        print(f"⚡ FastAPI available")
        print(f"📊 Prometheus client available")
        print(f"💾 Redis client available")
        
        # Test device detection
        device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"🖥️  Computing device: {device}")
        
        return True
        
    except ImportError as e:
        print(f"❌ Import error: {e}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False

if __name__ == "__main__":
    print("🧪 Testing imports for property-embedding-service...")
    print("=" * 50)
    success = test_imports()
    print("=" * 50)
    if success:
        print("🎉 All tests passed! Your environment is ready to go!")
    else:
        print("💥 Some tests failed. Please check the error messages above.")