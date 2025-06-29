from sentence_transformers import SentenceTransformer
import numpy as np
from typing import Union, List
import logging

class EmbeddingModel:
    """Wrapper for sentence transformer model"""
    
    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        self.model_name = model_name
        self.model = SentenceTransformer(model_name)
        self.logger = logging.getLogger(__name__)
        
    def encode(self, texts: Union[str, List[str]]) -> np.ndarray:
        """Generate embeddings for text(s)"""
        return self.model.encode(texts)
    
    def get_model_info(self) -> dict:
        """Get model information"""
        return {
            "model_name": self.model_name,
            "max_seq_length": self.model.max_seq_length,
            "embedding_dimension": self.model.get_sentence_embedding_dimension()
        }

# Keep the original class for backward compatibility
class PropertyEmbeddingModel:
    """Enhanced embedding model for property search with semantic understanding"""
    
    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        self.model_name = model_name
        self.model = None
        self.logger = logging.getLogger(__name__)
        self.load_model()
    
    def load_model(self):
        """Load the sentence transformer model"""
        try:
            self.logger.info(f"Loading embedding model: {self.model_name}")
            self.model = SentenceTransformer(self.model_name)
            self.logger.info(f"✅ Model loaded successfully: {self.model_name}")
        except Exception as e:
            self.logger.error(f"Failed to load model {self.model_name}: {e}")
            raise
    
    def encode(self, texts: List[str]) -> np.ndarray:
        """Generate embeddings for a list of texts"""
        if self.model is None:
            raise RuntimeError("Model not loaded")
        
        try:
            embeddings = self.model.encode(texts)
            return embeddings
        except Exception as e:
            self.logger.error(f"Error generating embeddings: {e}")
            raise
    
    def encode_single(self, text: str) -> np.ndarray:
        """Generate embedding for a single text"""
        return self.encode([text])[0]
    
    def get_similarity(self, embedding1: np.ndarray, embedding2: np.ndarray) -> float:
        """Calculate cosine similarity between two embeddings"""
        return np.dot(embedding1, embedding2) / (
            np.linalg.norm(embedding1) * np.linalg.norm(embedding2)
        )
    
    def get_model_info(self) -> dict:
        """Get information about the loaded model"""
        if self.model is None:
            return {"error": "Model not loaded"}
        
        return {
            "model_name": self.model_name,
            "max_seq_length": getattr(self.model, 'max_seq_length', 'unknown'),
            "embedding_dimension": self.model.get_sentence_embedding_dimension()
        }