# Query Optimization Tests
import pytest
import sys
import os
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np

# Add src to path for imports
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'src'))

from services.query_processor import QueryProcessor
from models.embedding_model import EmbeddingModel

class TestQueryOptimization:
    @pytest.fixture
    def query_processor(self):
        """Create query processor for testing"""
        return QueryProcessor()
    
    @pytest.fixture
    def mock_embedding_model(self):
        """Mock embedding model for similarity testing"""
        from unittest.mock import Mock
        model = Mock()
        
        # Create embeddings that reflect semantic similarity
        embedding_map = {
            "luxury penthouse": np.array([0.9, 0.8, 0.7, 0.6]),
            "luxury apartment": np.array([0.85, 0.75, 0.65, 0.55]),
            "high-end flat": np.array([0.8, 0.7, 0.6, 0.5]),
            "studio flat": np.array([0.2, 0.3, 0.4, 0.5]),
            "shared house": np.array([0.1, 0.2, 0.3, 0.4])
        }
        
        def mock_encode(text):
            return embedding_map.get(text.lower(), np.array([0.5, 0.5, 0.5, 0.5]))
        
        model.encode = mock_encode
        return model
    
    def test_query_preprocessing_accuracy(self, query_processor):
        """Test that query preprocessing improves search accuracy"""
        raw_queries = [
            "I want a flat near good schools in Manchester under 300k",
            "Looking for 2bed house with garden, quiet area, budget £450000",
            "Modern apartment, walking distance to tube, London Zone 2"
        ]
        
        for query in raw_queries:
            processed = query_processor.preprocess(query)
            
            # Should extract key components
            assert len(processed.keywords) >= 3
            assert processed.location is not None
            if "£" in query or "k" in query:
                assert processed.price_range is not None
    
    def test_price_extraction(self, query_processor):
        """Test price range extraction from various formats"""
        test_cases = [
            ("under 300k", {"max": 300000}),
            ("£450000 budget", {"max": 450000}),
            ("between 200k and 400k", {"min": 200000, "max": 400000}),
            ("around £350,000", {"min": 315000, "max": 385000}),  # ±10%
            ("up to 500000", {"max": 500000}),
            ("minimum £250k", {"min": 250000})
        ]
        
        for query, expected in test_cases:
            processed = query_processor.preprocess(query)
            
            if "min" in expected:
                assert processed.price_range.min_price == expected["min"]
            if "max" in expected:
                assert processed.price_range.max_price == expected["max"]
    
    def test_location_extraction(self, query_processor):
        """Test location extraction and normalization"""
        test_cases = [
            ("flat in Manchester", "Manchester"),
            ("London Zone 2 apartment", "London Zone 2"),
            ("Birmingham city centre", "Birmingham"),
            ("near Canary Wharf", "Canary Wharf"),
            ("SW1 postcode area", "SW1")
        ]
        
        for query, expected_location in test_cases:
            processed = query_processor.preprocess(query)
            assert expected_location.lower() in processed.location.lower()
    
    def test_property_type_extraction(self, query_processor):
        """Test property type identification"""
        test_cases = [
            ("2 bedroom flat", "flat"),
            ("house with garden", "house"),
            ("studio apartment", "studio"),
            ("penthouse suite", "penthouse"),
            ("maisonette for rent", "maisonette")
        ]
        
        for query, expected_type in test_cases:
            processed = query_processor.preprocess(query)
            assert expected_type in processed.property_type.lower()
    
    def test_bedroom_extraction(self, query_processor):
        """Test bedroom count extraction"""
        test_cases = [
            ("2 bedroom flat", 2),
            ("three bed house", 3),
            ("1-bed apartment", 1),
            ("four bedroom family home", 4),
            ("studio", 0)  # Studio typically has 0 separate bedrooms
        ]
        
        for query, expected_bedrooms in test_cases:
            processed = query_processor.preprocess(query)
            assert processed.bedrooms == expected_bedrooms
    
    def test_feature_extraction(self, query_processor):
        """Test feature and amenity extraction"""
        query = "modern apartment with parking, balcony, and gym access near transport"
        processed = query_processor.preprocess(query)
        
        expected_features = ["parking", "balcony", "gym", "transport"]
        for feature in expected_features:
            assert any(feature in f.lower() for f in processed.features)
    
    def test_embedding_similarity_threshold(self, mock_embedding_model):
        """Test optimal similarity threshold for search results"""
        test_cases = [
            {
                "query": "luxury penthouse",
                "expected_matches": ["luxury apartment", "high-end flat"],
                "expected_non_matches": ["studio flat", "shared house"]
            }
        ]
        
        for case in test_cases:
            query_embedding = mock_embedding_model.encode(case["query"])
            
            for match in case["expected_matches"]:
                match_embedding = mock_embedding_model.encode(match)
                similarity = cosine_similarity([query_embedding], [match_embedding])[0][0]
                assert similarity > 0.6  # Minimum threshold for relevance
                
            for non_match in case["expected_non_matches"]:
                non_match_embedding = mock_embedding_model.encode(non_match)
                similarity = cosine_similarity([query_embedding], [non_match_embedding])[0][0]
                assert similarity < 0.4  # Should be clearly different
    
    def test_query_normalization(self, query_processor):
        """Test query normalization for consistent processing"""
        variations = [
            "Looking for a 2-bedroom flat in London",
            "2 bed flat london",
            "2BR apartment London",
            "Two bedroom flat in London area"
        ]
        
        normalized_queries = [query_processor.normalize_query(q) for q in variations]
        
        # All should contain similar key terms
        for normalized in normalized_queries:
            assert "2" in normalized or "two" in normalized
            assert "bedroom" in normalized or "bed" in normalized
            assert "london" in normalized.lower()
    
    def test_intent_classification(self, query_processor):
        """Test query intent classification"""
        test_cases = [
            ("I want to buy a house", "purchase"),
            ("Looking to rent an apartment", "rental"),
            ("What's the value of my property", "valuation"),
            ("Properties for sale in London", "search"),
            ("Book a viewing", "viewing")
        ]
        
        for query, expected_intent in test_cases:
            processed = query_processor.preprocess(query)
            assert processed.intent == expected_intent
    
    def test_urgency_detection(self, query_processor):
        """Test urgency level detection in queries"""
        test_cases = [
            ("Need to move ASAP", "high"),
            ("Looking to buy soon", "medium"),
            ("Just browsing properties", "low"),
            ("Urgent: need flat by next week", "high"),
            ("Planning to move next year", "low")
        ]
        
        for query, expected_urgency in test_cases:
            processed = query_processor.preprocess(query)
            assert processed.urgency == expected_urgency