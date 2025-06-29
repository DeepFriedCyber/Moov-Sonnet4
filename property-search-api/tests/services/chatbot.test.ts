// Chatbot Intelligence Tests
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ChatbotConversation } from '../../src/services/chatbot/chatbotConversation';
import { ResponseRouter } from '../../src/services/chatbot/responseRouter';
import { PropertyKnowledgeBase } from '../../src/services/chatbot/knowledgeBase';
import { ApiCallTracker } from '../../src/services/chatbot/apiCallTracker';

describe('Chatbot Intelligence', () => {
  let conversation: ChatbotConversation;
  let responseRouter: ResponseRouter;
  let knowledgeBase: PropertyKnowledgeBase;
  let apiCallTracker: ApiCallTracker;

  beforeEach(() => {
    apiCallTracker = new ApiCallTracker();
    knowledgeBase = new PropertyKnowledgeBase();
    responseRouter = new ResponseRouter(knowledgeBase, apiCallTracker);
    conversation = new ChatbotConversation(responseRouter);
  });

  describe('Property-Focused Conversations', () => {
    it('should maintain property search context', async () => {
      // Initial property interest
      const response1 = await conversation.respond(
        "I'm looking for a 2-bedroom flat in London"
      );
      
      expect(response1.intent).toBe('property_search');
      expect(response1.extractedCriteria.bedrooms).toBe(2);
      expect(response1.extractedCriteria.location).toBe('London');
      expect(response1.extractedCriteria.propertyType).toBe('flat');
      
      // Follow-up question should maintain context
      const response2 = await conversation.respond(
        "What about the transport links?"
      );
      
      expect(response2.context.propertyType).toBe('flat');
      expect(response2.context.location).toBe('London');
      expect(response2.context.bedrooms).toBe(2);
      expect(response2.suggestedActions).toContain('show_transport_info');
      expect(response2.responseType).toBe('contextual_info');
    });

    it('should handle property refinement queries', async () => {
      // Initial search
      await conversation.respond("Looking for a house in Manchester");
      
      // Refinement
      const response = await conversation.respond(
        "Actually, make that under £300k with a garden"
      );
      
      expect(response.context.location).toBe('Manchester');
      expect(response.context.propertyType).toBe('house');
      expect(response.extractedCriteria.maxPrice).toBe(300000);
      expect(response.extractedCriteria.features).toContain('garden');
      expect(response.intent).toBe('refine_search');
    });

    it('should escalate complex queries efficiently', async () => {
      const response = await conversation.respond(
        "I need help with mortgage applications and legal advice for buying"
      );
      
      expect(response.shouldEscalate).toBe(true);
      expect(response.escalationReason).toBe('requires_human_expertise');
      expect(response.suggestedActions).toContain('connect_to_agent');
      expect(response.escalationCategory).toBe('financial_legal');
    });

    it('should handle multi-intent queries', async () => {
      const response = await conversation.respond(
        "Show me 2-bed flats in London and book a viewing for the one on Baker Street"
      );
      
      expect(response.intents).toContain('property_search');
      expect(response.intents).toContain('book_viewing');
      expect(response.extractedCriteria.bedrooms).toBe(2);
      expect(response.extractedCriteria.location).toBe('London');
      expect(response.viewingAddress).toContain('Baker Street');
    });
  });

  describe('Cost Optimization', () => {
    it('should use template responses for common queries', async () => {
      const commonQueries = [
        "What are your opening hours?",
        "How does the property search work?",
        "Do you charge fees?",
        "What documents do I need to rent?",
        "How long does the buying process take?"
      ];
      
      for (const query of commonQueries) {
        const response = await conversation.respond(query);
        expect(response.usedTemplate).toBe(true);
        expect(response.apiCost).toBe(0);  // No external API calls
        expect(response.responseTime).toBeLessThan(50); // Fast response
        expect(response.confidence).toBeGreaterThan(0.8);
      }
    });

    it('should limit API calls per session', async () => {
      const complexQueries = [
        "What's the market value of a 3-bed house in Kensington?",
        "Tell me about mortgage rates for first-time buyers",
        "What are the legal requirements for property purchase?",
        "How much stamp duty would I pay on a £500k property?",
        "What's the average rental yield in Zone 2?",
        "Should I buy or rent in the current market?", // This should be blocked
      ];
      
      let apiCallCount = 0;
      
      for (const query of complexQueries) {
        const response = await conversation.respond(query);
        if (response.usedExternalAPI) {
          apiCallCount++;
        }
      }
      
      expect(apiCallCount).toBeLessThanOrEqual(5); // Max 5 API calls per session
    });

    it('should batch similar queries for efficiency', async () => {
      const similarQueries = [
        "What's the average price in Shoreditch?",
        "How much do properties cost in Shoreditch?",
        "Property prices in Shoreditch area?"
      ];
      
      const startTime = Date.now();
      const responses = await Promise.all(
        similarQueries.map(q => conversation.respond(q))
      );
      const endTime = Date.now();
      
      // Should use cached results for similar queries
      expect(responses[1].usedCache).toBe(true);
      expect(responses[2].usedCache).toBe(true);
      expect(endTime - startTime).toBeLessThan(1000); // Fast due to caching
    });
  });

  describe('Context Management', () => {
    it('should maintain conversation history', async () => {
      await conversation.respond("I'm looking for a flat");
      await conversation.respond("In London");
      const response = await conversation.respond("With 2 bedrooms");
      
      expect(response.context.propertyType).toBe('flat');
      expect(response.context.location).toBe('London');
      expect(response.context.bedrooms).toBe(2);
      expect(conversation.getHistory().length).toBe(3);
    });

    it('should handle context switching', async () => {
      // Start with rental search
      await conversation.respond("Looking to rent a flat in London");
      
      // Switch to buying
      const response = await conversation.respond(
        "Actually, I want to buy a house in Manchester instead"
      );
      
      expect(response.context.intent).toBe('purchase');
      expect(response.context.propertyType).toBe('house');
      expect(response.context.location).toBe('Manchester');
      expect(response.contextSwitch).toBe(true);
    });

    it('should expire old context appropriately', async () => {
      await conversation.respond("Looking for a flat in London");
      
      // Simulate time passing
      jest.advanceTimersByTime(30 * 60 * 1000); // 30 minutes
      
      const response = await conversation.respond("What about Manchester?");
      
      // Context should still be active
      expect(response.context.propertyType).toBe('flat');
      
      // Simulate longer time
      jest.advanceTimersByTime(60 * 60 * 1000); // 1 hour total
      
      const response2 = await conversation.respond("Show me houses");
      
      // Context should be expired, treating as new conversation
      expect(response2.contextExpired).toBe(true);
    });
  });

  describe('Response Quality', () => {
    it('should provide relevant property suggestions', async () => {
      const response = await conversation.respond(
        "I'm a first-time buyer with a £250k budget looking in Birmingham"
      );
      
      expect(response.propertySuggestions).toBeDefined();
      expect(response.propertySuggestions.length).toBeGreaterThan(0);
      expect(response.firstTimeBuyerInfo).toBeDefined();
      expect(response.localAreaInfo.location).toBe('Birmingham');
    });

    it('should provide helpful follow-up questions', async () => {
      const response = await conversation.respond(
        "I want to move to London"
      );
      
      expect(response.followUpQuestions).toBeDefined();
      expect(response.followUpQuestions).toContain(
        "What type of property are you looking for?"
      );
      expect(response.followUpQuestions).toContain(
        "What's your budget range?"
      );
      expect(response.followUpQuestions).toContain(
        "Which area of London interests you?"
      );
    });

    it('should handle ambiguous queries gracefully', async () => {
      const response = await conversation.respond("Something nice");
      
      expect(response.clarificationNeeded).toBe(true);
      expect(response.clarificationQuestions).toBeDefined();
      expect(response.suggestedActions).toContain('ask_for_details');
    });
  });
});

describe('Response Router', () => {
  let router: ResponseRouter;
  let knowledgeBase: PropertyKnowledgeBase;
  let apiCallTracker: ApiCallTracker;

  beforeEach(() => {
    apiCallTracker = new ApiCallTracker();
    knowledgeBase = new PropertyKnowledgeBase();
    router = new ResponseRouter(knowledgeBase, apiCallTracker);
  });

  describe('Routing Logic', () => {
    it('should route to templates for exact matches', async () => {
      const response = await router.route(
        "What are your opening hours?",
        { sessionId: 'test-session' }
      );
      
      expect(response.routingDecision).toBe('template');
      expect(response.usedTemplate).toBe(true);
      expect(response.templateId).toBe('opening_hours');
    });

    it('should route to property intent handler', async () => {
      const response = await router.route(
        "Show me 2-bedroom flats under £400k",
        { sessionId: 'test-session' }
      );
      
      expect(response.routingDecision).toBe('property_intent');
      expect(response.intentConfidence).toBeGreaterThan(0.7);
    });

    it('should route to external API for complex queries', async () => {
      const response = await router.route(
        "What's the current market valuation for a Victorian terrace in Clapham?",
        { sessionId: 'test-session' }
      );
      
      expect(response.routingDecision).toBe('external_api');
      expect(response.apiProvider).toBeDefined();
    });

    it('should route to guided response for unclear queries', async () => {
      const response = await router.route(
        "I need help with stuff",
        { sessionId: 'test-session' }
      );
      
      expect(response.routingDecision).toBe('guided_response');
      expect(response.guidanceType).toBe('clarification');
    });
  });
});

describe('Knowledge Base', () => {
  let kb: PropertyKnowledgeBase;

  beforeEach(() => {
    kb = new PropertyKnowledgeBase();
  });

  it('should answer property FAQs without API calls', () => {
    const faqs = [
      "What documents do I need to rent?",
      "How long does the buying process take?",
      "What is stamp duty?",
      "Do I need a deposit to rent?",
      "What's the difference between freehold and leasehold?"
    ];
    
    faqs.forEach(question => {
      const answer = kb.getAnswer(question);
      expect(answer).toBeDefined();
      expect(answer.confidence).toBeGreaterThan(0.8);
      expect(answer.source).toBe('local_knowledge');
      expect(answer.responseTime).toBeLessThan(10); // Very fast
    });
  });

  it('should provide location-specific information', () => {
    const locationQueries = [
      "Tell me about transport in Zone 2",
      "What are the schools like in Richmond?",
      "Is Shoreditch a good area for young professionals?"
    ];
    
    locationQueries.forEach(query => {
      const answer = kb.getLocationInfo(query);
      expect(answer).toBeDefined();
      expect(answer.location).toBeDefined();
      expect(answer.categories).toContain('transport');
    });
  });

  it('should handle property process questions', () => {
    const processQueries = [
      "What happens after I make an offer?",
      "How long does conveyancing take?",
      "When do I need to arrange a survey?"
    ];
    
    processQueries.forEach(query => {
      const answer = kb.getProcessInfo(query);
      expect(answer).toBeDefined();
      expect(answer.steps).toBeDefined();
      expect(answer.timeline).toBeDefined();
    });
  });
});