# Advanced Query Processing for Semantic Search
import re
from typing import List, Optional, Dict, Any
from dataclasses import dataclass
from enum import Enum
import logging

logger = logging.getLogger(__name__)

class QueryIntent(Enum):
    SEARCH = "search"
    PURCHASE = "purchase"
    RENTAL = "rental"
    VALUATION = "valuation"
    VIEWING = "viewing"
    INFORMATION = "information"

class UrgencyLevel(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"

@dataclass
class PriceRange:
    min_price: Optional[int] = None
    max_price: Optional[int] = None

@dataclass
class ProcessedQuery:
    """Structured representation of processed query"""
    original_query: str
    normalized_query: str
    keywords: List[str]
    location: Optional[str] = None
    property_type: Optional[str] = None
    bedrooms: Optional[int] = None
    price_range: Optional[PriceRange] = None
    features: List[str] = None
    intent: QueryIntent = QueryIntent.SEARCH
    urgency: UrgencyLevel = UrgencyLevel.MEDIUM
    confidence: float = 0.0

class QueryProcessor:
    """
    Advanced query processor that extracts structured information
    from natural language property search queries
    """
    
    def __init__(self):
        # Property type patterns
        self.property_types = {
            r'\b(flat|apartment|apt)\b': 'flat',
            r'\b(house|home)\b': 'house',
            r'\b(studio)\b': 'studio',
            r'\b(penthouse)\b': 'penthouse',
            r'\b(maisonette)\b': 'maisonette',
            r'\b(bungalow)\b': 'bungalow',
            r'\b(cottage)\b': 'cottage',
            r'\b(townhouse)\b': 'townhouse'
        }
        
        # Bedroom patterns
        self.bedroom_patterns = [
            (r'\b(\d+)\s*(?:bed|bedroom|br)\b', lambda m: int(m.group(1))),
            (r'\b(one|1)\s*(?:bed|bedroom)\b', lambda m: 1),
            (r'\b(two|2)\s*(?:bed|bedroom)\b', lambda m: 2),
            (r'\b(three|3)\s*(?:bed|bedroom)\b', lambda m: 3),
            (r'\b(four|4)\s*(?:bed|bedroom)\b', lambda m: 4),
            (r'\b(five|5)\s*(?:bed|bedroom)\b', lambda m: 5),
            (r'\bstudio\b', lambda m: 0)
        ]
        
        # Price patterns
        self.price_patterns = [
            (r'under\s*£?(\d+(?:,\d{3})*(?:k|000)?)', 'max'),
            (r'up\s*to\s*£?(\d+(?:,\d{3})*(?:k|000)?)', 'max'),
            (r'below\s*£?(\d+(?:,\d{3})*(?:k|000)?)', 'max'),
            (r'maximum\s*£?(\d+(?:,\d{3})*(?:k|000)?)', 'max'),
            (r'over\s*£?(\d+(?:,\d{3})*(?:k|000)?)', 'min'),
            (r'above\s*£?(\d+(?:,\d{3})*(?:k|000)?)', 'min'),
            (r'minimum\s*£?(\d+(?:,\d{3})*(?:k|000)?)', 'min'),
            (r'from\s*£?(\d+(?:,\d{3})*(?:k|000)?)', 'min'),
            (r'between\s*£?(\d+(?:,\d{3})*(?:k|000)?)\s*(?:and|to|-)\s*£?(\d+(?:,\d{3})*(?:k|000)?)', 'range'),
            (r'around\s*£?(\d+(?:,\d{3})*(?:k|000)?)', 'around'),
            (r'budget\s*£?(\d+(?:,\d{3})*(?:k|000)?)', 'max'),
            (r'£(\d+(?:,\d{3})*(?:k|000)?)', 'exact')
        ]
        
        # Location patterns (UK-specific)
        self.location_patterns = [
            r'\bin\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)',  # "in London"
            r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+area',  # "London area"
            r'\bnear\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)',  # "near Canary Wharf"
            r'\b([A-Z]{1,2}\d{1,2}[A-Z]?)\b',  # Postcodes like "SW1", "M1 1AA"
            r'\b(Zone\s+\d+)\b',  # "Zone 2"
        ]
        
        # Feature patterns
        self.feature_patterns = {
            r'\b(parking|garage)\b': 'parking',
            r'\b(garden|outdoor\s+space)\b': 'garden',
            r'\b(balcony|terrace)\b': 'balcony',
            r'\b(gym|fitness)\b': 'gym',
            r'\b(pool|swimming)\b': 'pool',
            r'\b(lift|elevator)\b': 'lift',
            r'\b(concierge|porter)\b': 'concierge',
            r'\b(furnished)\b': 'furnished',
            r'\b(unfurnished)\b': 'unfurnished',
            r'\b(pet.friendly|pets?\s+allowed)\b': 'pet_friendly',
            r'\b(transport|tube|train|bus)\b': 'transport_links',
            r'\b(schools?|education)\b': 'near_schools',
            r'\b(shops?|shopping)\b': 'near_shops',
            r'\b(quiet|peaceful)\b': 'quiet_area',
            r'\b(modern|contemporary)\b': 'modern',
            r'\b(period|victorian|georgian)\b': 'period_property'
        }
        
        # Intent patterns
        self.intent_patterns = {
            QueryIntent.PURCHASE: [
                r'\b(buy|purchase|buying|sale|for sale)\b',
                r'\b(mortgage|deposit)\b'
            ],
            QueryIntent.RENTAL: [
                r'\b(rent|rental|renting|let|letting|to let)\b',
                r'\b(tenant|landlord)\b'
            ],
            QueryIntent.VALUATION: [
                r'\b(value|valuation|worth|price|estimate)\b',
                r'\b(how much|what.s.*worth)\b'
            ],
            QueryIntent.VIEWING: [
                r'\b(view|viewing|visit|see|show)\b',
                r'\b(appointment|book)\b'
            ]
        }
        
        # Urgency patterns
        self.urgency_patterns = {
            UrgencyLevel.HIGH: [
                r'\b(urgent|asap|immediately|now|quick)\b',
                r'\b(need.*(?:soon|quickly|fast))\b',
                r'\b(by.*(?:week|month))\b'
            ],
            UrgencyLevel.LOW: [
                r'\b(browsing|looking around|just looking)\b',
                r'\b(next year|future|eventually)\b',
                r'\b(no rush|no hurry)\b'
            ]
        }
    
    def preprocess(self, query: str) -> ProcessedQuery:
        """
        Main preprocessing function that extracts all structured information
        """
        normalized = self.normalize_query(query)
        
        processed = ProcessedQuery(
            original_query=query,
            normalized_query=normalized,
            keywords=self._extract_keywords(normalized),
            features=[]
        )
        
        # Extract structured information
        processed.location = self._extract_location(query)
        processed.property_type = self._extract_property_type(query)
        processed.bedrooms = self._extract_bedrooms(query)
        processed.price_range = self._extract_price_range(query)
        processed.features = self._extract_features(query)
        processed.intent = self._extract_intent(query)
        processed.urgency = self._extract_urgency(query)
        processed.confidence = self._calculate_confidence(processed)
        
        return processed
    
    def normalize_query(self, query: str) -> str:
        """Normalize query for consistent processing"""
        # Convert to lowercase
        normalized = query.lower().strip()
        
        # Remove extra whitespace
        normalized = re.sub(r'\s+', ' ', normalized)
        
        # Standardize common abbreviations
        abbreviations = {
            r'\bbr\b': 'bedroom',
            r'\bbed\b': 'bedroom',
            r'\bapt\b': 'apartment',
            r'\bflat\b': 'flat',
            r'\bk\b': '000',  # 300k -> 300000
        }
        
        for pattern, replacement in abbreviations.items():
            normalized = re.sub(pattern, replacement, normalized)
        
        return normalized
    
    def _extract_keywords(self, query: str) -> List[str]:
        """Extract meaningful keywords from query"""
        # Remove stop words and extract meaningful terms
        stop_words = {
            'i', 'want', 'need', 'looking', 'for', 'a', 'an', 'the', 'in', 'on',
            'at', 'to', 'with', 'and', 'or', 'but', 'is', 'are', 'was', 'were'
        }
        
        words = re.findall(r'\b\w+\b', query.lower())
        keywords = [w for w in words if w not in stop_words and len(w) > 2]
        
        return list(set(keywords))  # Remove duplicates
    
    def _extract_location(self, query: str) -> Optional[str]:
        """Extract location information from query"""
        for pattern in self.location_patterns:
            match = re.search(pattern, query, re.IGNORECASE)
            if match:
                return match.group(1).strip()
        return None
    
    def _extract_property_type(self, query: str) -> Optional[str]:
        """Extract property type from query"""
        for pattern, prop_type in self.property_types.items():
            if re.search(pattern, query, re.IGNORECASE):
                return prop_type
        return None
    
    def _extract_bedrooms(self, query: str) -> Optional[int]:
        """Extract number of bedrooms from query"""
        for pattern, extractor in self.bedroom_patterns:
            match = re.search(pattern, query, re.IGNORECASE)
            if match:
                return extractor(match)
        return None
    
    def _extract_price_range(self, query: str) -> Optional[PriceRange]:
        """Extract price range from query"""
        price_range = PriceRange()
        
        for pattern, price_type in self.price_patterns:
            match = re.search(pattern, query, re.IGNORECASE)
            if match:
                if price_type == 'range':
                    # Handle "between X and Y"
                    min_val = self._parse_price(match.group(1))
                    max_val = self._parse_price(match.group(2))
                    price_range.min_price = min_val
                    price_range.max_price = max_val
                elif price_type == 'around':
                    # Handle "around X" (±10%)
                    price = self._parse_price(match.group(1))
                    price_range.min_price = int(price * 0.9)
                    price_range.max_price = int(price * 1.1)
                elif price_type == 'min':
                    price_range.min_price = self._parse_price(match.group(1))
                elif price_type in ['max', 'exact']:
                    price_range.max_price = self._parse_price(match.group(1))
                
                break  # Use first match
        
        return price_range if price_range.min_price or price_range.max_price else None
    
    def _parse_price(self, price_str: str) -> int:
        """Parse price string to integer"""
        # Remove commas and convert k to thousands
        price_str = price_str.replace(',', '')
        
        if price_str.endswith('k'):
            return int(price_str[:-1]) * 1000
        elif price_str.endswith('000'):
            return int(price_str)
        else:
            return int(price_str)
    
    def _extract_features(self, query: str) -> List[str]:
        """Extract property features and amenities"""
        features = []
        for pattern, feature in self.feature_patterns.items():
            if re.search(pattern, query, re.IGNORECASE):
                features.append(feature)
        return features
    
    def _extract_intent(self, query: str) -> QueryIntent:
        """Determine the intent of the query"""
        for intent, patterns in self.intent_patterns.items():
            for pattern in patterns:
                if re.search(pattern, query, re.IGNORECASE):
                    return intent
        return QueryIntent.SEARCH  # Default intent
    
    def _extract_urgency(self, query: str) -> UrgencyLevel:
        """Determine urgency level of the query"""
        for urgency, patterns in self.urgency_patterns.items():
            for pattern in patterns:
                if re.search(pattern, query, re.IGNORECASE):
                    return urgency
        return UrgencyLevel.MEDIUM  # Default urgency
    
    def _calculate_confidence(self, processed: ProcessedQuery) -> float:
        """Calculate confidence score for the processed query"""
        confidence = 0.0
        
        # Base confidence from extracted information
        if processed.location:
            confidence += 0.2
        if processed.property_type:
            confidence += 0.2
        if processed.bedrooms is not None:
            confidence += 0.15
        if processed.price_range:
            confidence += 0.15
        if processed.features:
            confidence += 0.1 * min(len(processed.features), 3) / 3
        if len(processed.keywords) >= 3:
            confidence += 0.2
        
        return min(confidence, 1.0)  # Cap at 1.0