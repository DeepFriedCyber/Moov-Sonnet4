import pytest
import sys
import os

# Add src to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from models.embedding_model import EmbeddingModel
import numpy as np

def test_embedding_model_creation():
    """Test that we can create an embedding model"""
    model = EmbeddingModel()
    assert model.model_name == "all-MiniLM-L6-v2"

def test_embedding_generation():
    """Test that we can generate embeddings"""
    model = EmbeddingModel()
    
    text = "luxury apartment in London"
    embedding = model.encode(text)
    
    assert isinstance(embedding, np.ndarray)
    assert len(embedding) > 0
    assert embedding.shape[0] == 384  # all-MiniLM-L6-v2 dimension

def test_model_info():
    """Test that model info is available"""
    model = EmbeddingModel()
    info = model.get_model_info()
    
    assert "model_name" in info
    assert "embedding_dimension" in info
    assert info["embedding_dimension"] == 384