// Local Property Knowledge Base for Cost-Efficient Responses
export interface KnowledgeAnswer {
  answer: string;
  confidence: number;
  source: string;
  suggestedActions?: string[];
  relatedQuestions?: string[];
  responseTime?: number;
}

export interface LocationInfo {
  location: string;
  categories: string[];
  description: string;
  highlights: string[];
}

export interface ProcessInfo {
  steps: string[];
  timeline: string;
  requirements: string[];
  tips: string[];
}

export class PropertyKnowledgeBase {
  private faqDatabase: Map<string, KnowledgeAnswer>;
  private locationDatabase: Map<string, LocationInfo>;
  private processDatabase: Map<string, ProcessInfo>;
  private synonyms: Map<string, string[]>;

  constructor() {
    this.faqDatabase = new Map();
    this.locationDatabase = new Map();
    this.processDatabase = new Map();
    this.synonyms = new Map();
    
    this.initializeFAQs();
    this.initializeLocationInfo();
    this.initializeProcessInfo();
    this.initializeSynonyms();
  }

  getAnswer(question: string): KnowledgeAnswer | null {
    const startTime = Date.now();
    
    // Normalize question for better matching
    const normalizedQuestion = this.normalizeQuestion(question);
    
    // Try exact match first
    let answer = this.faqDatabase.get(normalizedQuestion);
    
    if (!answer) {
      // Try fuzzy matching
      answer = this.findBestMatch(normalizedQuestion);
    }
    
    if (answer) {
      answer.responseTime = Date.now() - startTime;
    }
    
    return answer;
  }

  getLocationInfo(query: string): LocationInfo | null {
    const location = this.extractLocation(query);
    if (location) {
      return this.locationDatabase.get(location.toLowerCase());
    }
    return null;
  }

  getProcessInfo(query: string): ProcessInfo | null {
    const processType = this.identifyProcess(query);
    if (processType) {
      return this.processDatabase.get(processType);
    }
    return null;
  }

  private initializeFAQs(): void {
    const faqs = [
      {
        question: "what documents do i need to rent",
        answer: "To rent a property, you typically need: 1) Proof of identity (passport/driving licence), 2) Proof of income (3 months payslips or employment contract), 3) Bank statements (3 months), 4) Previous landlord reference (if applicable), 5) Right to rent documentation, and 6) Deposit (usually 1-6 weeks rent).",
        confidence: 0.95,
        suggestedActions: ["check_documents", "contact_agent"],
        relatedQuestions: ["How much deposit do I need?", "What is right to rent?"]
      },
      {
        question: "how long does the buying process take",
        answer: "The property buying process typically takes 8-12 weeks from offer acceptance to completion. This includes: mortgage application (2-4 weeks), property survey (1-2 weeks), legal searches (4-6 weeks), and exchange/completion (1-2 weeks). First-time buyers may take longer.",
        confidence: 0.95,
        suggestedActions: ["view_timeline", "get_mortgage_advice"],
        relatedQuestions: ["What happens after my offer is accepted?", "How long does a mortgage application take?"]
      },
      {
        question: "what is stamp duty",
        answer: "Stamp Duty Land Tax (SDLT) is a tax paid when buying property in England and Northern Ireland. Rates vary: 0% on first £250k (£425k for first-time buyers), 5% on £250k-£925k, 10% on £925k-£1.5m, and 12% above £1.5m. Additional 3% surcharge applies to second homes.",
        confidence: 0.95,
        suggestedActions: ["calculate_stamp_duty", "get_tax_advice"],
        relatedQuestions: ["Am I a first-time buyer?", "What other costs are involved in buying?"]
      },
      {
        question: "do i need a deposit to rent",
        answer: "Yes, most landlords require a deposit when renting. This is typically 1-6 weeks' rent, held in a government-approved tenancy deposit scheme. The deposit protects against damage or unpaid rent and should be returned at the end of your tenancy if there are no issues.",
        confidence: 0.95,
        suggestedActions: ["check_deposit_schemes", "understand_rights"],
        relatedQuestions: ["What is a tenancy deposit scheme?", "When do I get my deposit back?"]
      },
      {
        question: "what are your opening hours",
        answer: "Our property search service is available 24/7 online. Our customer support team is available Monday to Friday 9am-6pm, and Saturday 10am-4pm. You can search properties, save favorites, and book viewings anytime through our platform.",
        confidence: 0.95,
        suggestedActions: ["search_properties", "book_viewing"],
        relatedQuestions: ["How do I book a viewing?", "Can I search properties now?"]
      },
      {
        question: "how does the property search work",
        answer: "Our property search uses advanced filters and AI-powered matching. Simply enter your criteria (location, price, bedrooms, etc.) and we'll show relevant properties. You can save favorites, set up alerts for new matches, and book viewings directly. Our semantic search understands natural language queries too!",
        confidence: 0.95,
        suggestedActions: ["start_search", "set_alerts"],
        relatedQuestions: ["How do I set up property alerts?", "What search filters are available?"]
      },
      {
        question: "do you charge fees",
        answer: "Our property search service is completely free for buyers and renters. We're paid by estate agents and landlords when successful matches are made. There are no hidden fees, subscription costs, or charges for using our platform or booking viewings.",
        confidence: 0.95,
        suggestedActions: ["start_searching", "learn_more"],
        relatedQuestions: ["How do you make money?", "Are there any costs involved?"]
      },
      {
        question: "what is the difference between freehold and leasehold",
        answer: "Freehold means you own the property and the land it sits on outright. Leasehold means you own the property for a fixed period (the lease term) but not the land - you pay ground rent to the freeholder. Most houses are freehold, most flats are leasehold. Check lease length when buying leasehold properties.",
        confidence: 0.95,
        suggestedActions: ["check_lease_details", "get_legal_advice"],
        relatedQuestions: ["How long should a lease be?", "What is ground rent?"]
      }
    ];

    faqs.forEach(faq => {
      this.faqDatabase.set(faq.question, {
        answer: faq.answer,
        confidence: faq.confidence,
        source: 'local_knowledge',
        suggestedActions: faq.suggestedActions,
        relatedQuestions: faq.relatedQuestions
      });
    });
  }

  private initializeLocationInfo(): void {
    const locations = [
      {
        name: "zone 2",
        description: "Zone 2 offers excellent transport links with shorter commutes to Central London than outer zones, while being more affordable than Zone 1.",
        categories: ["transport", "lifestyle", "pricing"],
        highlights: [
          "15-25 minute commute to Central London",
          "Good mix of residential areas",
          "Better value than Zone 1",
          "Excellent tube and bus connections"
        ]
      },
      {
        name: "richmond",
        description: "Richmond is known for its excellent schools, green spaces, and family-friendly atmosphere, with good transport links to Central London.",
        categories: ["schools", "parks", "family", "transport"],
        highlights: [
          "Outstanding primary and secondary schools",
          "Richmond Park and Kew Gardens nearby",
          "Strong sense of community",
          "District line and National Rail connections"
        ]
      },
      {
        name: "shoreditch",
        description: "Shoreditch is a vibrant area popular with young professionals, known for its nightlife, restaurants, and creative scene.",
        categories: ["nightlife", "restaurants", "culture", "young_professionals"],
        highlights: [
          "Buzzing nightlife and restaurant scene",
          "Creative and tech hub",
          "Excellent transport links",
          "Popular with young professionals"
        ]
      }
    ];

    locations.forEach(location => {
      this.locationDatabase.set(location.name, {
        location: location.name,
        categories: location.categories,
        description: location.description,
        highlights: location.highlights
      });
    });
  }

  private initializeProcessInfo(): void {
    const processes = [
      {
        type: "making_offer",
        steps: [
          "Research comparable property prices",
          "Decide on your offer amount",
          "Submit offer through estate agent",
          "Negotiate if needed",
          "Agree terms and conditions",
          "Instruct solicitor",
          "Arrange mortgage application"
        ],
        timeline: "1-2 weeks for offer negotiation",
        requirements: ["Mortgage agreement in principle", "Solicitor details", "Proof of funds"],
        tips: [
          "Don't offer asking price immediately",
          "Consider property condition in your offer",
          "Be prepared to negotiate",
          "Have your finances ready"
        ]
      },
      {
        type: "conveyancing",
        steps: [
          "Instruct solicitor/conveyancer",
          "Property searches conducted",
          "Survey arranged and completed",
          "Contract review and queries",
          "Exchange of contracts",
          "Final checks and completion",
          "Keys handed over"
        ],
        timeline: "6-8 weeks on average",
        requirements: ["Solicitor", "Mortgage offer", "Buildings insurance", "Deposit funds"],
        tips: [
          "Choose an experienced conveyancer",
          "Respond to queries quickly",
          "Arrange insurance before exchange",
          "Keep in regular contact with your solicitor"
        ]
      }
    ];

    processes.forEach(process => {
      this.processDatabase.set(process.type, {
        steps: process.steps,
        timeline: process.timeline,
        requirements: process.requirements,
        tips: process.tips
      });
    });
  }

  private initializeSynonyms(): void {
    const synonymGroups = [
      ["rent", "rental", "renting", "let", "letting", "lease"],
      ["buy", "purchase", "buying", "sale", "for sale"],
      ["flat", "apartment", "apt"],
      ["house", "home", "property"],
      ["deposit", "security deposit", "bond"],
      ["mortgage", "home loan", "property loan"],
      ["viewing", "visit", "see", "show", "tour"],
      ["documents", "paperwork", "documentation", "papers"],
      ["fees", "costs", "charges", "expenses"],
      ["opening hours", "office hours", "contact hours", "availability"]
    ];

    synonymGroups.forEach(group => {
      const primary = group[0];
      group.forEach(synonym => {
        this.synonyms.set(synonym, group);
      });
    });
  }

  private normalizeQuestion(question: string): string {
    let normalized = question.toLowerCase().trim();
    
    // Remove punctuation
    normalized = normalized.replace(/[^\w\s]/g, ' ');
    
    // Replace multiple spaces with single space
    normalized = normalized.replace(/\s+/g, ' ');
    
    // Replace synonyms with primary terms
    const words = normalized.split(' ');
    const normalizedWords = words.map(word => {
      const synonymGroup = this.synonyms.get(word);
      return synonymGroup ? synonymGroup[0] : word;
    });
    
    return normalizedWords.join(' ');
  }

  private findBestMatch(question: string): KnowledgeAnswer | null {
    let bestMatch: KnowledgeAnswer | null = null;
    let bestScore = 0;
    
    for (const [key, answer] of this.faqDatabase) {
      const score = this.calculateSimilarity(question, key);
      if (score > bestScore && score > 0.6) { // Minimum similarity threshold
        bestScore = score;
        bestMatch = { ...answer, confidence: answer.confidence * score };
      }
    }
    
    return bestMatch;
  }

  private calculateSimilarity(str1: string, str2: string): number {
    const words1 = str1.split(' ');
    const words2 = str2.split(' ');
    
    const commonWords = words1.filter(word => words2.includes(word));
    const totalWords = new Set([...words1, ...words2]).size;
    
    return commonWords.length / totalWords;
  }

  private extractLocation(query: string): string | null {
    const locationPatterns = [
      /\bin\s+([a-z\s]+)/i,
      /([a-z\s]+)\s+area/i,
      /zone\s+(\d+)/i
    ];
    
    for (const pattern of locationPatterns) {
      const match = query.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }
    
    return null;
  }

  private identifyProcess(query: string): string | null {
    if (query.includes('offer') || query.includes('bid')) {
      return 'making_offer';
    }
    if (query.includes('conveyancing') || query.includes('legal') || query.includes('solicitor')) {
      return 'conveyancing';
    }
    return null;
  }

  // Utility methods
  addFAQ(question: string, answer: KnowledgeAnswer): void {
    const normalized = this.normalizeQuestion(question);
    this.faqDatabase.set(normalized, answer);
  }

  getStats(): any {
    return {
      totalFAQs: this.faqDatabase.size,
      totalLocations: this.locationDatabase.size,
      totalProcesses: this.processDatabase.size,
      totalSynonymGroups: this.synonyms.size
    };
  }

  searchFAQs(query: string, limit: number = 5): KnowledgeAnswer[] {
    const normalized = this.normalizeQuestion(query);
    const results: Array<{ answer: KnowledgeAnswer; score: number }> = [];
    
    for (const [key, answer] of this.faqDatabase) {
      const score = this.calculateSimilarity(normalized, key);
      if (score > 0.3) { // Lower threshold for search
        results.push({ answer: { ...answer, confidence: answer.confidence * score }, score });
      }
    }
    
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(result => result.answer);
  }
}