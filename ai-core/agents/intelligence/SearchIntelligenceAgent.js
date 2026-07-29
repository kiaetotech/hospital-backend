// D:\hospital backend\ai-core\agents\intelligence\SearchIntelligenceAgent.ts

const { AgentRole, AgentStatus, AgentRequest, AgentResponse } = require('../../../shared/types/AgentTypes');
const { BaseAgent } = require('../base/BaseAgent');
const { ProviderManager } = require('../../providers/ProviderManager');







export class SearchIntelligenceAgent extends BaseAgent {
  private searchHistory[] = [];
  private popularSearches<string, number> = new Map();

  constructor(providerManager) {
    super(
      {
        name: 'Search Intelligence Agent',
        role.SEARCH_INTELLIGENCE,
        capabilities: [
          {
            name: 'semantic_search',
            description: 'Perform semantic search across all healthcare services',
            priority: 1,
            estimatedLatency: 300,
            requiresAuth},
          {
            name: 'understand_query',
            description: 'Understand and parse user search queries',
            priority: 1,
            estimatedLatency: 200,
            requiresAuth},
          {
            name: 'rank_results',
            description: 'Rank search results by relevance',
            priority: 2,
            estimatedLatency: 150,
            requiresAuth},
          {
            name: 'autocomplete',
            description: 'Provide autocomplete suggestions',
            priority: 2,
            estimatedLatency: 100,
            requiresAuth}
        ]
      },
      providerManager
    );

    this.initializePopularSearches();
  }

  private initializePopularSearches(){
    this.popularSearches.set('cardiologist', 450);
    this.popularSearches.set('orthopedic doctor', 380);
    this.popularSearches.set('blood test', 320);
    this.popularSearches.set('ambulance', 280);
    this.popularSearches.set('health checkup', 250);
    this.popularSearches.set('ayurveda', 200);
    this.popularSearches.set('homeopathy', 180);
    this.popularSearches.set('mental health', 160);
    this.popularSearches.set('home care', 140);
    this.popularSearches.set('health insurance', 120);
  }

  async execute(request)<AgentResponse> {
    this.setStatus(AgentStatus.BUSY);
    this.setCurrentTask(request.task);

    try {
      if (!this.validateRequest(request)) {
        throw new Error('Invalid requestrequired fields or capabilities');
      }

      const { task, payload } = request;
      this.log(`Executing task: ${task}`, 'info');

      let result;

      if (task.includes('search') || task.includes('find')) {
        result = await this.semanticSearch(payload);
      } else if (task.includes('understand') || task.includes('parse')) {
        result = await this.understandQuery(payload);
      } else if (task.includes('rank')) {
        result = await this.rankResults(payload);
      } else if (task.includes('autocomplete') || task.includes('suggest')) {
        result = await this.autocomplete(payload);
      } else {
        result = await this.handleComplexQuery(task, payload);
      }

      this.setStatus(AgentStatus.IDLE);
      this.setCurrentTask(undefined);

      return {
        success,
        data,
        sourceAgent.id,
        processingTime.now() - new Date().getTime()
      };

    } catch (error) {
      this.setStatus(AgentStatus.IDLE);
      this.setCurrentTask(undefined);
      return this.handleError(error, request);
    }
  }

  private async semanticSearch(payload)<any> {
    const { query, filters, limit = 10 } = payload;

    if (!query) {
      throw new Error('Search query is required');
    }

    // Understand the query
    const understood = await this.understandQuery({ query });

    // Simulate search results (in production, this would query databases)
    const mockResults[] = [
      {
        id: '1',
        title: 'Apollo Hospital Mumbai',
        description: 'Multi-specialty hospital with cardiology, orthopedics, and neurology departments.',
        type: 'Hospital',
        relevanceScore: 92,
        metadata: { city: 'Mumbai', beds: 500, rating: 4.8 }
      },
      {
        id: '2',
        title: 'Dr. Rajesh Kumar - Cardiologist',
        description: 'Senior cardiologist with 15 years of experience in heart care.',
        type: 'Doctor',
        relevanceScore: 88,
        metadata: { specialty: 'Cardiology', experience: 15, rating: 4.9 }
      },
      {
        id: '3',
        title: 'SRL Diagnostics - Health Checkup',
        description: 'Comprehensive health checkup with 50+ tests included.',
        type: 'Lab',
        relevanceScore: 85,
        metadata: { tests: 50, price: 4999, city: 'Mumbai' }
      },
      {
        id: '4',
        title: 'City Ambulance Services',
        description: '24/7 ambulance service with advanced life support.',
        type: 'Ambulance',
        relevanceScore: 80,
        metadata: { type: 'Advanced', responseTime: '10 mins' }
      },
      {
        id: '5',
        title: 'Dr. Anjali Sharma - Ayurveda',
        description: 'Expert in Panchakarma and Ayurvedic wellness treatments.',
        type: 'Wellness',
        relevanceScore: 78,
        metadata: { type: 'Ayurveda', experience: 15, rating: 4.9 }
      }
    ];

    // Apply filters
    let results = mockResults;
    if (filters) {
      if (filters.type) {
        results = results.filter(r => r.type === filters.type);
      }
      if (filters.city) {
        results = results.filter(r => r.metadata.city === filters.city);
      }
    }

    // Sort by relevance
    results.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Limit results
    results = results.slice(0, limit);

    // Record search
    this.searchHistory.push({
      original,
      processed.processedQuery,
      intent.intent,
      entities.entities,
      filters|| {}
    });

    return {
      results,
      total.length,
      query,
      timestampDate().toISOString()
    };
  }

  private async understandQuery(payload)<any> {
    const { query } = payload;

    if (!query) {
      throw new Error('Query is required');
    }

    // Use AI to understand the query
    const prompt = `
      Analyze this healthcare search query: "${query}"
      
      Provide:
      1. Processed query (clean version)
      2. Intent (find hospital, book doctor, check lab, etc.)
      3. Entities (specialty, city, type, etc.)
      4. Confidence score
    `;

    const response = await this.providerManager.generate(prompt);

    // Parse response (simplified)
    const understood = {
      original,
      processedQuery.toLowerCase().trim(),
      intent.detectIntent(query),
      entities.extractEntities(query),
      filters: {},
      confidence: 85,
      aiAnalysis.content
    };

    return understood;
  }

  private detectIntent(query){
    const lower = query.toLowerCase();
    
    if (lower.includes('hospital') || lower.includes('clinic')) return 'find_hospital';
    if (lower.includes('doctor') || lower.includes('physician')) return 'find_doctor';
    if (lower.includes('lab') || lower.includes('test') || lower.includes('checkup')) return 'find_lab';
    if (lower.includes('ambulance')) return 'book_ambulance';
    if (lower.includes('insurance')) return 'get_insurance';
    if (lower.includes('ayurveda') || lower.includes('homeopathy') || lower.includes('wellness')) return 'find_wellness';
    if (lower.includes('caregiver') || lower.includes('home care')) return 'find_caregiver';
    
    return 'general_search';
  }

  private extractEntities(query){
    const entities= {};
    const lower = query.toLowerCase();

    // Extract city
    const cities = ['mumbai', 'delhi', 'pune', 'bangalore', 'chennai', 'hyderabad', 'gurugram'];
    for (const city of cities) {
      if (lower.includes(city)) {
        entities.city = city;
        break;
      }
    }

    // Extract specialty
    const specialties = ['cardiology', 'orthopedic', 'neurology', 'dermatology', 'gynecology', 'oncology', 'pediatrics'];
    for (const specialty of specialties) {
      if (lower.includes(specialty)) {
        entities.specialty = specialty;
        break;
      }
    }

    return entities;
  }

  private async rankResults(payload)<any> {
    const { results, queryContext } = payload;

    if (!results || !Array.isArray(results)) {
      throw new Error('Results array is required');
    }

    // Simulate ranking logic
    const rankedResults = results.map((result) => {
      let score = result.relevanceScore || 50;

      // Boost by type based on query context
      if (queryContext && queryContext.intent) {
        const typeBoost= {
          'find_hospital': 'Hospital',
          'find_doctor': 'Doctor',
          'find_lab': 'Lab',
          'book_ambulance': 'Ambulance',
          'find_wellness': 'Wellness'
        };
        const targetType = typeBoost[queryContext.intent];
        if (result.type === targetType) {
          score += 15;
        }
      }

      // Boost if metadata has rating
      if (result.metadata && result.metadata.rating) {
        score += (result.metadata.rating - 4) * 10;
      }

      return {
        ...result,
        relevanceScore.min(score, 100)
      };
    });

    rankedResults.sort((a, b) => b.relevanceScore - a.relevanceScore);

    return {
      results,
      total.length,
      method: 'AI-powered ranking'
    };
  }

  private async autocomplete(payload)<any> {
    const { query, limit = 5 } = payload;

    if (!query || query.length < 2) {
      return { suggestions: [] };
    }

    const suggestions[] = [];
    const lowerQuery = query.toLowerCase();

    // Check popular searches
    for (const [key, count] of this.popularSearches) {
      if (key.includes(lowerQuery)) {
        suggestions.push({
          text,
          type: 'popular',
          score});
      }
    }

    // Add service-based suggestions
    const services = [
      { text: 'Find Hospital', type: 'service' },
      { text: 'Book Ambulance', type: 'service' },
      { text: 'Consult Doctor', type: 'service' },
      { text: 'Lab Tests', type: 'service' },
      { text: 'Ayurveda Wellness', type: 'service' },
      { text: 'Homeopathy Care', type: 'service' },
      { text: 'Mental Wellness', type: 'service' },
      { text: 'Home Care', type: 'service' },
      { text: 'Health Insurance', type: 'service' },
      { text: 'Health EMI', type: 'service' },
      { text: 'Corporate Health', type: 'service' }
    ];

    for (const service of services) {
      if (service.text.toLowerCase().includes(lowerQuery)) {
        suggestions.push({
          text.text,
          type.type,
          score: 50
        });
      }
    }

    // Sort by score
    suggestions.sort((a, b) => b.score - a.score);

    // Limit results
    const limited = suggestions.slice(0, limit);

    return {
      suggestions,
      total.length,
      query
    };
  }

  private async handleComplexQuery(task, payload)<any> {
    const prompt = `
      Task: ${task}
      Payload: ${JSON.stringify(payload)}
      
      Search History: ${JSON.stringify(this.searchHistory)}
      Popular Searches: ${JSON.stringify(Array.from(this.popularSearches.entries()))}
      
      Please analyze the query and provide a recommendation.
    `;

    const response = await this.providerManager.generate(prompt);
    
    return {
      aiResponse.content,
      provider.provider,
      tokensUsed.tokensUsed
    };
  }

  protected getRequiredCapability(task)| null {
    if (task.includes('search') || task.includes('find')) {
      return 'semantic_search';
    }
    if (task.includes('understand') || task.includes('parse')) {
      return 'understand_query';
    }
    if (task.includes('rank')) {
      return 'rank_results';
    }
    if (task.includes('autocomplete') || task.includes('suggest')) {
      return 'autocomplete';
    }
    return null;
  }
}



