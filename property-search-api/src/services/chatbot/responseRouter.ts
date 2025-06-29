// Intelligent Response Router for Cost-Optimized Chatbot
import { PropertyKnowledgeBase } from './knowledgeBase';
import { ApiCallTracker } from './apiCallTracker';
import { ContextAnalyzer } from './contextAnalyzer';
import { TemplateManager } from './templateManager';

export interface ChatResponse {
  message: string;
  intent?: string;
  intents?: string[];
  extractedCriteria?: any;
  context?: ConversationContext;
  suggestedActions?: string[];
  followUpQuestions?: string[];
  shouldEscalate?: boolean;
  escalationReason?: string;
  escalationCategory?: string;
  usedTemplate?: boolean;
  usedExternalAPI?: boolean;
  usedCache?: boolean;
  apiCost?: number;
  responseTime?: number;
  confidence?: number;
  routingDecision?: string;
  templateId?: string;
  apiProvider?: string;
  guidanceType?: string;
  clarificationNeeded?: boolean;
  clarificationQuestions?: string[];
  responseType?: string;
  contextSwitch?: boolean;
  contextExpired?: boolean;
  propertySuggestions?: any[];
  firstTimeBuyerInfo?: any;
  localAreaInfo?: any;
  viewingAddress?: string;
}

export interface ConversationContext {
  sessionId: string;
  userId?: string;
  propertyType?: string;
  location?: string;
  bedrooms?: number;
  maxPrice?: number;
  minPrice?: number;
  features?: string[];
  intent?: string;
  urgency?: string;
  lastActivity?: Date;
  conversationHistory?: any[];
  apiCallCount?: number;
}

export class ResponseRouter {
  private templateManager: TemplateManager;
  private contextAnalyzer: ContextAnalyzer;
  private knowledgeBase: PropertyKnowledgeBase;
  private apiCallTracker: ApiCallTracker;
  
  // Cost optimization settings
  private readonly MAX_API_CALLS_PER_SESSION = 5;
  private readonly TEMPLATE_CONFIDENCE_THRESHOLD = 0.8;
  private readonly PROPERTY_INTENT_THRESHOLD = 0.7;
  private readonly CONTEXT_EXPIRY_MINUTES = 60;

  constructor(
    knowledgeBase: PropertyKnowledgeBase,
    apiCallTracker: ApiCallTracker
  ) {
    this.knowledgeBase = knowledgeBase;
    this.apiCallTracker = apiCallTracker;
    this.templateManager = new TemplateManager();
    this.contextAnalyzer = new ContextAnalyzer();
  }

  async route(message: string, context: ConversationContext): Promise<ChatResponse> {
    const startTime = Date.now();
    
    try {
      // Step 1: Check for template matches (zero cost)
      const templateMatch = await this.findTemplateMatch(message);
      if (templateMatch && templateMatch.confidence > this.TEMPLATE_CONFIDENCE_THRESHOLD) {
        const response = await this.enhanceTemplateResponse(templateMatch, context);
        response.responseTime = Date.now() - startTime;
        return response;
      }

      // Step 2: Property-specific intent detection (local processing)
      const propertyIntent = await this.detectPropertyIntent(message, context);
      if (propertyIntent.confidence > this.PROPERTY_INTENT_THRESHOLD) {
        const response = await this.handlePropertyIntent(propertyIntent, context);
        response.responseTime = Date.now() - startTime;
        return response;
      }

      // Step 3: Check knowledge base (local processing)
      const knowledgeResponse = await this.checkKnowledgeBase(message, context);
      if (knowledgeResponse) {
        knowledgeResponse.responseTime = Date.now() - startTime;
        return knowledgeResponse;
      }

      // Step 4: Only use external API for complex queries
      if (this.shouldUseExternalAPI(message, context)) {
        const response = await this.callExternalAPI(message, context);
        response.responseTime = Date.now() - startTime;
        return response;
      }

      // Step 5: Fallback to guided response
      const response = await this.createGuidedResponse(message, context);
      response.responseTime = Date.now() - startTime;
      return response;

    } catch (error) {
      console.error('Error in response routing:', error);
      return this.createErrorResponse(error, context);
    }
  }

  private async findTemplateMatch(message: string): Promise<any> {
    return this.templateManager.findBestMatch(message);
  }

  private async enhanceTemplateResponse(
    templateMatch: any, 
    context: ConversationContext
  ): Promise<ChatResponse> {
    const baseResponse = this.templateManager.getTemplate(templateMatch.templateId);
    
    return {
      message: this.personalizeTemplate(baseResponse.message, context),
      usedTemplate: true,
      templateId: templateMatch.templateId,
      apiCost: 0,
      confidence: templateMatch.confidence,
      routingDecision: 'template',
      suggestedActions: baseResponse.suggestedActions || [],
      followUpQuestions: baseResponse.followUpQuestions || []
    };
  }

  private async detectPropertyIntent(
    message: string, 
    context: ConversationContext
  ): Promise<any> {
    return this.contextAnalyzer.analyzePropertyIntent(message, context);
  }

  private async handlePropertyIntent(
    propertyIntent: any, 
    context: ConversationContext
  ): Promise<ChatResponse> {
    const extractedCriteria = this.contextAnalyzer.extractSearchCriteria(
      propertyIntent.message, 
      context
    );

    // Update context with new information
    const updatedContext = this.mergeContext(context, extractedCriteria);

    // Generate property-focused response
    const response: ChatResponse = {
      message: this.generatePropertyResponse(propertyIntent, extractedCriteria),
      intent: propertyIntent.intent,
      extractedCriteria,
      context: updatedContext,
      confidence: propertyIntent.confidence,
      routingDecision: 'property_intent',
      apiCost: 0,
      usedTemplate: false,
      usedExternalAPI: false,
      responseType: 'property_search'
    };

    // Add property suggestions if criteria is complete enough
    if (this.hasMinimumSearchCriteria(extractedCriteria)) {
      response.propertySuggestions = await this.getPropertySuggestions(extractedCriteria);
      response.suggestedActions = ['show_properties', 'refine_search', 'save_search'];
    } else {
      response.followUpQuestions = this.generateFollowUpQuestions(extractedCriteria);
      response.suggestedActions = ['provide_more_details'];
    }

    return response;
  }

  private async checkKnowledgeBase(
    message: string, 
    context: ConversationContext
  ): Promise<ChatResponse | null> {
    const kbResponse = this.knowledgeBase.getAnswer(message);
    
    if (kbResponse && kbResponse.confidence > 0.7) {
      return {
        message: kbResponse.answer,
        confidence: kbResponse.confidence,
        routingDecision: 'knowledge_base',
        apiCost: 0,
        usedTemplate: false,
        usedExternalAPI: false,
        suggestedActions: kbResponse.suggestedActions || []
      };
    }

    return null;
  }

  private shouldUseExternalAPI(message: string, context: ConversationContext): boolean {
    // Use API only for:
    // - Complex property valuation questions
    // - Legal/financial advice (before escalation)
    // - Highly specific local area questions
    
    const apiTriggers = [
      'valuation', 'worth', 'market price', 'current value',
      'legal', 'solicitor', 'conveyancing',
      'mortgage', 'lending', 'finance', 'rates',
      'investment', 'yield', 'roi',
      'market trends', 'price prediction'
    ];

    const hasApiTrigger = apiTriggers.some(trigger => 
      message.toLowerCase().includes(trigger)
    );

    const recentApiCalls = this.apiCallTracker.getRecentCalls(context.sessionId);
    const withinBudget = recentApiCalls < this.MAX_API_CALLS_PER_SESSION;

    // Don't use API if we're over budget
    if (!withinBudget) {
      console.log(`API call limit reached for session ${context.sessionId}`);
      return false;
    }

    return hasApiTrigger;
  }

  private async callExternalAPI(
    message: string, 
    context: ConversationContext
  ): Promise<ChatResponse> {
    // Track API call
    this.apiCallTracker.recordCall(context.sessionId);

    // Determine which API to use based on query type
    const apiProvider = this.selectAPIProvider(message);
    
    try {
      const apiResponse = await this.makeAPICall(apiProvider, message, context);
      
      return {
        message: apiResponse.answer,
        confidence: apiResponse.confidence,
        routingDecision: 'external_api',
        apiProvider,
        apiCost: apiResponse.cost || 0.01, // Estimated cost
        usedExternalAPI: true,
        usedTemplate: false,
        suggestedActions: apiResponse.suggestedActions || []
      };
    } catch (error) {
      console.error('External API call failed:', error);
      
      // Fallback to guided response
      return this.createGuidedResponse(message, context);
    }
  }

  private async createGuidedResponse(
    message: string, 
    context: ConversationContext
  ): Promise<ChatResponse> {
    // Analyze what information we're missing
    const missingInfo = this.analyzeMissingInformation(message, context);
    
    return {
      message: this.generateGuidanceMessage(missingInfo, context),
      routingDecision: 'guided_response',
      guidanceType: 'clarification',
      clarificationNeeded: true,
      clarificationQuestions: this.generateClarificationQuestions(missingInfo),
      apiCost: 0,
      confidence: 0.6,
      suggestedActions: ['ask_for_details', 'show_examples']
    };
  }

  private createErrorResponse(error: any, context: ConversationContext): ChatResponse {
    return {
      message: "I apologize, but I'm having trouble understanding your request. Could you please rephrase it or ask something more specific about properties?",
      routingDecision: 'error',
      confidence: 0.1,
      apiCost: 0,
      suggestedActions: ['rephrase_query', 'contact_agent']
    };
  }

  // Helper methods
  private personalizeTemplate(template: string, context: ConversationContext): string {
    // Replace placeholders with context information
    return template
      .replace('{location}', context.location || 'your preferred area')
      .replace('{propertyType}', context.propertyType || 'property')
      .replace('{bedrooms}', context.bedrooms?.toString() || 'your preferred number of');
  }

  private mergeContext(
    existing: ConversationContext, 
    newCriteria: any
  ): ConversationContext {
    return {
      ...existing,
      ...newCriteria,
      lastActivity: new Date()
    };
  }

  private generatePropertyResponse(propertyIntent: any, criteria: any): string {
    const responses = [
      `I can help you find ${criteria.propertyType || 'properties'} ${criteria.location ? `in ${criteria.location}` : ''}.`,
      `Looking for ${criteria.bedrooms ? `${criteria.bedrooms}-bedroom ` : ''}${criteria.propertyType || 'properties'}${criteria.location ? ` in ${criteria.location}` : ''} - great choice!`,
      `I'll help you search for ${criteria.propertyType || 'properties'}${criteria.location ? ` in ${criteria.location}` : ''}.`
    ];
    
    return responses[Math.floor(Math.random() * responses.length)];
  }

  private hasMinimumSearchCriteria(criteria: any): boolean {
    return !!(criteria.location || criteria.propertyType || criteria.bedrooms);
  }

  private async getPropertySuggestions(criteria: any): Promise<any[]> {
    // This would integrate with your property search service
    // For now, return mock data
    return [
      { id: '1', title: 'Sample Property 1', price: 350000 },
      { id: '2', title: 'Sample Property 2', price: 420000 }
    ];
  }

  private generateFollowUpQuestions(criteria: any): string[] {
    const questions = [];
    
    if (!criteria.location) {
      questions.push("Which area are you interested in?");
    }
    if (!criteria.propertyType) {
      questions.push("What type of property are you looking for? (flat, house, etc.)");
    }
    if (!criteria.bedrooms) {
      questions.push("How many bedrooms do you need?");
    }
    if (!criteria.maxPrice && !criteria.minPrice) {
      questions.push("What's your budget range?");
    }
    
    return questions.slice(0, 3); // Limit to 3 questions
  }

  private selectAPIProvider(message: string): string {
    if (message.includes('valuation') || message.includes('worth')) {
      return 'property_valuation_api';
    }
    if (message.includes('mortgage') || message.includes('finance')) {
      return 'mortgage_api';
    }
    if (message.includes('legal') || message.includes('conveyancing')) {
      return 'legal_api';
    }
    return 'general_property_api';
  }

  private async makeAPICall(provider: string, message: string, context: ConversationContext): Promise<any> {
    // Mock API call - replace with actual API integration
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API delay
    
    return {
      answer: `Based on current market data, here's what I found regarding your query about ${message.slice(0, 50)}...`,
      confidence: 0.8,
      cost: 0.01,
      suggestedActions: ['get_more_details', 'contact_specialist']
    };
  }

  private analyzeMissingInformation(message: string, context: ConversationContext): string[] {
    const missing = [];
    
    if (!context.intent) missing.push('intent');
    if (!context.location) missing.push('location');
    if (!context.propertyType) missing.push('property_type');
    if (!context.maxPrice && !context.minPrice) missing.push('budget');
    
    return missing;
  }

  private generateGuidanceMessage(missingInfo: string[], context: ConversationContext): string {
    if (missingInfo.includes('intent')) {
      return "I'd be happy to help! Are you looking to buy, rent, or get information about properties?";
    }
    
    return "To help you better, could you provide a bit more detail about what you're looking for?";
  }

  private generateClarificationQuestions(missingInfo: string[]): string[] {
    const questionMap = {
      'intent': 'Are you looking to buy or rent?',
      'location': 'Which area interests you?',
      'property_type': 'What type of property? (flat, house, studio, etc.)',
      'budget': 'What\'s your budget range?'
    };
    
    return missingInfo.map(info => questionMap[info]).filter(Boolean);
  }
}