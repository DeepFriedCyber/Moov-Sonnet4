import { QueryParser } from '../search/QueryParser';
import { SearchIntent } from '@/types/search';

interface PropertyService {
    searchBySemantic(embedding: number[], filters: any): Promise<any[]>;
    findById(id: string): Promise<any>;
}

interface SessionStore {
    get(sessionId: string): Promise<SessionContext | null>;
    set(sessionId: string, context: SessionContext): Promise<void>;
    delete(sessionId: string): Promise<void>;
}

interface SessionContext {
    lastQuery?: string;
    lastSearchResults?: any[];
    preferences?: {
        budget?: { min?: number; max?: number };
        location?: string;
        propertyType?: string;
        features?: string[];
    };
    conversationHistory: ConversationEntry[];
    viewedProperties?: string[];
    searchHistory?: { query: string; timestamp: Date }[];
}

interface ConversationEntry {
    message: string;
    response: string;
    timestamp: Date;
    intent: string;
}

interface ChatIntent {
    type: string;
    confidence: number;
    extractedQuery?: any;
}

interface ChatResponse {
    response: string;
    sessionId: string;
    intent: string;
    propertyResults?: any[];
    suggestions?: string[];
    marketData?: any;
    comparison?: any;
    recommendations?: any[];
    error?: string;
}

export class ChatService {
    private readonly MAX_HISTORY_LENGTH = 50;
    private readonly CONFIDENCE_THRESHOLD = 0.7;

    constructor(
        private propertyService: PropertyService,
        private queryParser: QueryParser,
        private sessionStore: SessionStore
    ) { }

    async processMessage(message: string, sessionId: string): Promise<ChatResponse> {
        try {
            // Sanitize input
            const sanitizedMessage = this.sanitizeInput(message);
            const validSessionId = this.validateSessionId(sessionId);

            // Get session context
            const context = await this.getSessionContext(validSessionId);

            // Recognize intent
            const intent = await this.recognizeIntent(sanitizedMessage, context);

            // Process based on intent
            let response: ChatResponse;

            switch (intent.type) {
                case 'greeting':
                    response = this.handleGreeting(validSessionId);
                    break;
                case 'property_search':
                    response = await this.handlePropertySearch(sanitizedMessage, validSessionId, intent);
                    break;
                case 'property_comparison':
                    response = await this.handlePropertyComparison(validSessionId, context);
                    break;
                case 'market_inquiry':
                    response = await this.handleMarketInquiry(sanitizedMessage, validSessionId);
                    break;
                case 'recommendation_request':
                    response = await this.handleRecommendationRequest(validSessionId, context);
                    break;
                case 'refinement':
                    response = await this.handleSearchRefinement(sanitizedMessage, validSessionId, context);
                    break;
                default:
                    response = this.handleGeneral(sanitizedMessage, validSessionId);
            }

            // Update session context
            await this.updateSessionContext(validSessionId, sanitizedMessage, response, intent.type);

            return response;
        } catch (error) {
            return this.handleError(error, sessionId);
        }
    }

    async recognizeIntent(message: string, context?: SessionContext): Promise<ChatIntent> {
        const lowerMessage = message.toLowerCase();

        // Greeting patterns
        if (/^(hi|hello|hey|good morning|good afternoon|good evening)/.test(lowerMessage)) {
            return { type: 'greeting', confidence: 0.95 };
        }

        // Property search patterns
        if (this.isPropertySearchQuery(lowerMessage)) {
            const parsedQuery = this.queryParser.parse(message);
            return {
                type: 'property_search',
                confidence: parsedQuery.confidence,
                extractedQuery: parsedQuery,
            };
        }

        // Comparison patterns
        if (/compare|comparison|versus|vs|difference/.test(lowerMessage) && context?.viewedProperties?.length) {
            return { type: 'property_comparison', confidence: 0.9 };
        }

        // Market inquiry patterns
        if (/average price|market|trends|price range|cost/.test(lowerMessage)) {
            return { type: 'market_inquiry', confidence: 0.85 };
        }

        // Recommendation patterns
        if (/recommend|suggest|what would you|best for me|advice/.test(lowerMessage)) {
            return { type: 'recommendation_request', confidence: 0.8 };
        }

        // Refinement patterns
        if (context?.lastSearchResults && /cheaper|expensive|bigger|smaller|more|less|different/.test(lowerMessage)) {
            return { type: 'refinement', confidence: 0.85 };
        }

        return { type: 'general', confidence: 0.5 };
    }

    private isPropertySearchQuery(message: string): boolean {
        const searchKeywords = [
            'find', 'search', 'looking for', 'need', 'want', 'show me',
            'apartment', 'house', 'flat', 'property', 'home',
            'bedroom', 'bathroom', 'garden', 'parking',
            'london', 'manchester', 'birmingham', // cities
            '£', 'price', 'budget', 'under', 'over'
        ];

        return searchKeywords.some(keyword => message.includes(keyword));
    }

    private handleGreeting(sessionId: string): ChatResponse {
        return {
            response: 'Hello! I\'m your Property Assistant. I can help you find properties using natural language. Try asking me something like "Find me a 2 bedroom apartment in London under £500k".',
            sessionId,
            intent: 'greeting',
            suggestions: [
                'Find properties',
                'Search by location',
                'Browse by price range',
                'Get market insights',
            ],
        };
    }

    private async handlePropertySearch(
        message: string,
        sessionId: string,
        intent: ChatIntent
    ): Promise<ChatResponse> {
        const parsedQuery = intent.extractedQuery;

        // Generate embedding for semantic search (mock for now)
        const embedding = await this.generateEmbedding(message);

        // Build search filters
        const filters = this.buildSearchFilters(parsedQuery);

        // Search properties
        const properties = await this.propertyService.searchBySemantic(embedding, filters);

        if (properties.length === 0) {
            return {
                response: 'I couldn\'t find any properties matching your criteria. Would you like me to broaden the search or try different parameters?',
                sessionId,
                intent: 'property_search',
                suggestions: [
                    'Broaden search criteria',
                    'Try different location',
                    'Adjust price range',
                    'Change property type',
                ],
            };
        }

        const responseText = this.generateSearchResponseText(properties, parsedQuery);

        return {
            response: responseText,
            sessionId,
            intent: 'property_search',
            propertyResults: properties.slice(0, 5), // Limit to top 5
            suggestions: [
                'View property details',
                'Search similar properties',
                'Refine search criteria',
                'Save search',
            ],
        };
    }

    private async handlePropertyComparison(
        sessionId: string,
        context: SessionContext
    ): Promise<ChatResponse> {
        if (!context.viewedProperties || context.viewedProperties.length < 2) {
            return {
                response: 'You need to view at least 2 properties before I can compare them. Would you like me to help you find some properties first?',
                sessionId,
                intent: 'property_comparison',
                suggestions: [
                    'Find properties to compare',
                    'Search by criteria',
                    'Browse featured properties',
                ],
            };
        }

        const properties = await Promise.all(
            context.viewedProperties.map(id => this.propertyService.findById(id))
        );

        const comparison = this.generateComparison(properties);

        return {
            response: `Here's a comparison of the properties you've viewed: ${comparison.summary}`,
            sessionId,
            intent: 'property_comparison',
            comparison,
            suggestions: [
                'Schedule viewings',
                'Get mortgage advice',
                'View similar properties',
                'Save favorites',
            ],
        };
    }

    private async handleMarketInquiry(
        message: string,
        sessionId: string
    ): Promise<ChatResponse> {
        // Extract location and property type from message
        const parsedQuery = this.queryParser.parse(message);

        // Mock market data (in real implementation, this would query market data service)
        const marketData = {
            averagePrice: 450000,
            priceRange: { min: 300000, max: 800000 },
            trends: 'Prices have increased by 3.2% in the last year',
            sampleSize: 150,
        };

        const location = parsedQuery.location.city || 'the area';
        const propertyType = parsedQuery.propertyType || 'properties';

        return {
            response: `Based on recent data, the average price for ${propertyType} in ${location} is £${marketData.averagePrice.toLocaleString()}. Prices typically range from £${marketData.priceRange.min.toLocaleString()} to £${marketData.priceRange.max.toLocaleString()}. ${marketData.trends}`,
            sessionId,
            intent: 'market_inquiry',
            marketData,
            suggestions: [
                'View properties in this price range',
                'Compare with other areas',
                'Set up price alerts',
                'Get mortgage advice',
            ],
        };
    }

    private async handleRecommendationRequest(
        sessionId: string,
        context: SessionContext
    ): Promise<ChatResponse> {
        if (!context.preferences && !context.searchHistory?.length) {
            return {
                response: 'I\'d love to help you with recommendations! To provide personalized suggestions, could you tell me about your preferences? For example, your budget, preferred location, and property type.',
                sessionId,
                intent: 'recommendation_request',
                suggestions: [
                    'Set budget preferences',
                    'Choose preferred locations',
                    'Select property type',
                    'Specify must-have features',
                ],
            };
        }

        const recommendations = await this.generateRecommendations(context);

        return {
            response: 'Based on your preferences and search history, here are my recommendations for you:',
            sessionId,
            intent: 'recommendation_request',
            recommendations,
            suggestions: [
                'Refine preferences',
                'Set up alerts',
                'Schedule viewings',
                'Get mortgage pre-approval',
            ],
        };
    }

    private async handleSearchRefinement(
        message: string,
        sessionId: string,
        context: SessionContext
    ): Promise<ChatResponse> {
        if (!context.lastSearchResults || !context.lastQuery) {
            return {
                response: 'I don\'t have a previous search to refine. Would you like to start a new property search?',
                sessionId,
                intent: 'refinement',
                suggestions: [
                    'Start new search',
                    'Browse featured properties',
                    'Get recommendations',
                ],
            };
        }

        // Analyze refinement request
        const refinement = this.analyzeRefinement(message, context.lastSearchResults);

        // Apply refinement to previous query
        const refinedFilters = this.applyRefinement(context.lastQuery, refinement);

        // Generate embedding and search
        const embedding = await this.generateEmbedding(context.lastQuery);
        const properties = await this.propertyService.searchBySemantic(embedding, refinedFilters);

        return {
            response: `I found ${properties.length} more affordable options based on your previous search.`,
            sessionId,
            intent: 'refinement',
            propertyResults: properties.slice(0, 5),
            suggestions: [
                'Further refine search',
                'Compare with previous results',
                'Save refined search',
                'Set up alerts',
            ],
        };
    }

    private handleGeneral(message: string, sessionId: string): ChatResponse {
        return {
            response: 'I\'m here to help you find properties! You can ask me to search for specific types of properties, get market information, or compare properties. What would you like to know?',
            sessionId,
            intent: 'general',
            suggestions: [
                'Search for properties',
                'Get market insights',
                'Compare properties',
                'Get recommendations',
            ],
        };
    }

    private handleError(error: any, sessionId: string): ChatResponse {
        console.error('Chat service error:', error);

        return {
            response: 'I\'m temporarily unable to process your request. Please try again in a moment.',
            sessionId: this.validateSessionId(sessionId),
            intent: 'error',
            error: 'service_unavailable',
            suggestions: [
                'Try again in a moment',
                'Contact support',
                'Browse featured properties',
            ],
        };
    }

    private sanitizeInput(input: string): string {
        return input
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/[<>]/g, '')
            .trim()
            .substring(0, 1000); // Limit length
    }

    private validateSessionId(sessionId: string): string {
        const sanitized = sessionId.replace(/[^a-zA-Z0-9-]/g, '');
        return sanitized || `session-${Date.now()}`;
    }

    private async getSessionContext(sessionId: string): Promise<SessionContext> {
        const context = await this.sessionStore.get(sessionId);
        return context || {
            conversationHistory: [],
            viewedProperties: [],
            searchHistory: [],
        };
    }

    private async updateSessionContext(
        sessionId: string,
        message: string,
        response: ChatResponse,
        intent: string
    ): Promise<void> {
        const context = await this.getSessionContext(sessionId);

        // Add to conversation history
        context.conversationHistory.push({
            message,
            response: response.response,
            timestamp: new Date(),
            intent,
        });

        // Limit history length
        if (context.conversationHistory.length > this.MAX_HISTORY_LENGTH) {
            context.conversationHistory = context.conversationHistory.slice(-this.MAX_HISTORY_LENGTH);
        }

        // Update search history for property searches
        if (intent === 'property_search') {
            context.lastQuery = message;
            context.lastSearchResults = response.propertyResults;

            if (!context.searchHistory) context.searchHistory = [];
            context.searchHistory.push({
                query: message,
                timestamp: new Date(),
            });
        }

        await this.sessionStore.set(sessionId, context);
    }

    private async generateEmbedding(text: string): Promise<number[]> {
        // Mock embedding generation - in real implementation, this would call embedding service
        return Array.from({ length: 384 }, () => Math.random());
    }

    private buildSearchFilters(parsedQuery: any): any {
        return {
            city: parsedQuery.location?.city,
            minPrice: parsedQuery.budget?.minPrice,
            maxPrice: parsedQuery.budget?.maxPrice,
            propertyType: parsedQuery.propertyType,
            bedrooms: parsedQuery.rooms?.bedrooms,
            bathrooms: parsedQuery.rooms?.bathrooms,
            features: parsedQuery.features,
            lifestyle: parsedQuery.lifestyle,
        };
    }

    private generateSearchResponseText(properties: any[], parsedQuery: any): string {
        const count = properties.length;
        const location = parsedQuery.location?.city || 'your area';
        const propertyType = parsedQuery.propertyType || 'properties';

        if (count === 1) {
            return `I found 1 ${propertyType} in ${location} that matches your criteria.`;
        } else {
            return `I found ${count} ${propertyType}s in ${location} that match your criteria. Here are the top matches:`;
        }
    }

    private generateComparison(properties: any[]): any {
        // Mock comparison logic
        return {
            properties,
            differences: [
                'Property A is £50,000 more expensive but has an extra bedroom',
                'Property B has better transport links',
                'Property A has a garden while Property B has a balcony',
            ],
            recommendations: 'Based on your search history, Property A seems to better match your preferences for family-friendly features.',
            summary: 'Both properties offer good value, but they have different strengths.',
        };
    }

    private async generateRecommendations(context: SessionContext): Promise<any[]> {
        // Mock recommendation logic
        return [
            {
                reason: 'Based on your budget and location preferences',
                properties: [], // Would be populated with actual properties
                confidence: 0.9,
            },
            {
                reason: 'Similar to properties you\'ve viewed',
                properties: [],
                confidence: 0.8,
            },
        ];
    }

    private analyzeRefinement(message: string, lastResults: any[]): any {
        const lowerMessage = message.toLowerCase();

        if (/cheaper|less expensive|lower price/.test(lowerMessage)) {
            const maxPrice = Math.min(...lastResults.map(p => p.price)) - 1;
            return { type: 'price', direction: 'lower', maxPrice };
        }

        if (/expensive|higher price|luxury/.test(lowerMessage)) {
            const minPrice = Math.max(...lastResults.map(p => p.price)) + 1;
            return { type: 'price', direction: 'higher', minPrice };
        }

        return { type: 'general' };
    }

    private applyRefinement(lastQuery: string, refinement: any): any {
        const parsedQuery = this.queryParser.parse(lastQuery);

        if (refinement.type === 'price') {
            if (refinement.direction === 'lower') {
                parsedQuery.budget.maxPrice = refinement.maxPrice;
            } else if (refinement.direction === 'higher') {
                parsedQuery.budget.minPrice = refinement.minPrice;
            }
        }

        return this.buildSearchFilters(parsedQuery);
    }
}