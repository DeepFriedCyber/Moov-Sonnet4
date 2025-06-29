"""
Manual test - import and test components directly
"""
import sys
import os

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

def test_imports():
    print("🧪 Testing Imports")
    print("=" * 30)
    
    # Test 1: Basic imports
    try:
        import numpy as np
        print("✅ numpy imported")
    except ImportError as e:
        print(f"❌ numpy failed: {e}")
        return False
    
    try:
        from sentence_transformers import SentenceTransformer
        print("✅ sentence_transformers imported")
    except ImportError as e:
        print(f"❌ sentence_transformers failed: {e}")
        return False
    
    try:
        import redis
        print("✅ redis imported")
    except ImportError as e:
        print(f"❌ redis failed: {e}")
        return False
    
    # Test 2: Our custom modules
    try:
        from models.embedding_model import EmbeddingModel
        print("✅ EmbeddingModel imported")
    except ImportError as e:
        print(f"❌ EmbeddingModel failed: {e}")
        return False
    
    try:
        from services.embedding_cache import EmbeddingCache
        print("✅ EmbeddingCache imported")
    except ImportError as e:
        print(f"❌ EmbeddingCache failed: {e}")
        return False
    
    return True

def test_model():
    print("\n🤖 Testing Model")
    print("=" * 30)
    
    try:
        from models.embedding_model import EmbeddingModel
        
        print("Creating model...")
        model = EmbeddingModel()
        print("✅ Model created")
        
        print("Testing encoding...")
        text = "luxury apartment London"
        embedding = model.encode(text)
        print(f"✅ Embedding generated: shape {embedding.shape}")
        
        print("Testing model info...")
        info = model.get_model_info()
        print(f"✅ Model info: {info}")
        
        return model
        
    except Exception as e:
        print(f"❌ Model test failed: {e}")
        return None

def test_redis():
    print("\n📊 Testing Redis")
    print("=" * 30)
    
    try:
        import redis
        client = redis.from_url("redis://localhost:6379")
        client.ping()
        print("✅ Redis connection successful")
        
        # Test basic operations
        client.set("test_key", "test_value")
        value = client.get("test_key")
        print(f"✅ Redis read/write: {value.decode()}")
        
        return client
        
    except Exception as e:
        print(f"❌ Redis test failed: {e}")
        return None

def test_cache(model, redis_client):
    print("\n💾 Testing Cache")
    print("=" * 30)
    
    if not model or not redis_client:
        print("❌ Skipping cache test - dependencies not available")
        return False
    
    try:
        from services.embedding_cache import EmbeddingCache
        
        print("Creating cache...")
        cache = EmbeddingCache(redis_client, model.model)
        print("✅ Cache created")
        
        print("Testing cache operations...")
        query = "luxury apartment London"
        
        # First call (should generate)
        embedding1 = cache.get_or_generate(query)
        print(f"✅ First call: {embedding1.shape}")
        
        # Second call (should be cached)
        embedding2 = cache.get_or_generate(query)
        print(f"✅ Second call: {embedding2.shape}")
        
        # Check stats
        stats = cache.get_cache_stats()
        print(f"✅ Cache stats: {stats}")
        
        return True
        
    except Exception as e:
        print(f"❌ Cache test failed: {e}")
        return False

def main():
    print("🎯 Manual Component Testing")
    print("=" * 50)
    
    # Test imports
    if not test_imports():
        print("\n❌ Import tests failed")
        return
    
    # Test model
    model = test_model()
    
    # Test Redis
    redis_client = test_redis()
    
    # Test cache
    cache_ok = test_cache(model, redis_client)
    
    print("\n" + "=" * 50)
    print("🎯 Test Summary:")
    print(f"   Imports: ✅")
    print(f"   Model: {'✅' if model else '❌'}")
    print(f"   Redis: {'✅' if redis_client else '❌'}")
    print(f"   Cache: {'✅' if cache_ok else '❌'}")
    
    if model and redis_client and cache_ok:
        print("\n🎉 All components working! Ready for service deployment.")
    else:
        print("\n⚠️  Some components need attention before service deployment.")

if __name__ == "__main__":
    main()