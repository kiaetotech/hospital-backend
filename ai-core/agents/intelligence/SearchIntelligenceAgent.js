// D:\hospital backend\ai-core\agents\intelligence\SearchIntelligenceAgent.js

const { AgentRole, AgentStatus } = require('../../../shared/types/AgentTypes');
const { BaseAgent } = require('../base/BaseAgent');

class SearchIntelligenceAgent extends BaseAgent {
  constructor(providerManager) {
    super(
      {
        name: 'Search Intelligence Agent',
        role: AgentRole.SEARCH_INTELLIGENCE,
        capabilities: [
          {
            name: 'semantic_search',
            description: 'Perform semantic search across all healthcare services',
            priority: 1,
            estimatedLatency: 300,
            requiresAuth: false
          },
          {
            name: 'understand_query',
            description: 'Understand and parse user search queries',
            priority: 1,
            estimatedLatency: 200,
            requiresAuth: false
          },
          {
            name: 'rank_results',
            description: 'Rank search results by relevance',
            priority: 2,
            estimatedLatency: 150,
            requiresAuth: false
          },
          {
            name: 'autocomplete',
            description: 'Provide autocomplete suggestions',
            priority: 2,
            estimatedLatency: 100,
            requiresAuth: false
          }
        ]
      },
      providerManager
    );

    this.searchHistory = [];
    this.popularSearches = new Map();
    this.initializePopularSearches();
  }

  initializePopularSearches() {
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

  async execute(request) {
    this.setStatus(AgentStatus.BUSY);
    this.setCurrentTask(request.task);

    try {
      if (!this.validateRequest(request)) {
        throw new Error('Invalid request: missing required fields or capabilities');
      }

      var task = request.task;
      var payload = request.payload;
      this.log('Executing task: ' + task, 'info');

      var result;

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
      this.setCurrentTask(null);

      return {
        success: true,
        data: result,
        sourceAgent: this.id,
        processingTime: Date.now() - new Date().getTime()
      };

    } catch (error) {
      this.setStatus(AgentStatus.IDLE);
      this.setCurrentTask(null);
      return this.handleError(error, request);
    }
  }

  async semanticSearch(payload) {
    var query = payload.query;
    var filters = payload.filters;
    var limit = payload.limit || 10;

    if (!query) {
      throw new Error('Search query is required');
    }

    var understood = await this.understandQuery({ query: query });

    var mockResults = [
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

    var results = mockResults;
    if (filters) {
      if (filters.type) {
        results = results.filter(function(r) { return r.type === filters.type; });
      }
      if (filters.city) {
        results = results.filter(function(r) { return r.metadata.city === filters.city; });
      }
    }

    results.sort(function(a, b) { return b.relevanceScore - a.relevanceScore; });
    results = results.slice(0, limit);

    this.searchHistory.push({
      original: query,
      processed: understood.processedQuery,
      intent: understood.intent,
      entities: understood.entities,
      filters: filters || {}
    });

    return {
      results: results,
      total: results.length,
      query: query,
      timestamp: new Date().toISOString()
    };
  }

  async understandQuery(payload) {
    var query = payload.query;

    if (!query) {
      throw new Error('Query is required');
    }

    var prompt = 'Analyze this healthcare search query: "' + query + '"\n\n' +
      'Provide:\n' +
      '1. Processed query (clean version)\n' +
      '2. Intent (find hospital, book doctor, check lab, etc.)\n' +
      '3. Entities (specialty, city, type, etc.)\n' +
      '4. Confidence score';

    var response = await this.providerManager.generate(prompt);

    var understood = {
      original: query,
      processedQuery: query.toLowerCase().trim(),
      intent: this.detectIntent(query),
      entities: this.extractEntities(query),
      filters: {},
      confidence: 85,
      aiAnalysis: response.content
    };

    return understood;
  }

  detectIntent(query) {
    var lower = query.toLowerCase();

    if (lower.includes('hospital') || lower.includes('clinic')) return 'find_hospital';
    if (lower.includes('doctor') || lower.includes('physician')) return 'find_doctor';
    if (lower.includes('lab') || lower.includes('test') || lower.includes('checkup')) return 'find_lab';
    if (lower.includes('ambulance')) return 'book_ambulance';
    if (lower.includes('insurance')) return 'get_insurance';
    if (lower.includes('ayurveda') || lower.includes('homeopathy') || lower.includes('wellness')) return 'find_wellness';
    if (lower.includes('caregiver') || lower.includes('home care')) return 'find_caregiver';

    return 'general_search';
  }

  extractEntities(query) {
    var entities = {};
    var lower = query.toLowerCase();

    var cities = ['mumbai', 'delhi', 'pune', 'bangalore', 'chennai', 'hyderabad', 'gurugram'];
    for (var i = 0; i < cities.length; i++) {
      if (lower.includes(cities[i])) {
        entities.city = cities[i];
        break;
      }
    }

    var specialties = ['cardiology', 'orthopedic', 'neurology', 'dermatology', 'gynecology', 'oncology', 'pediatrics'];
    for (var j = 0; j < specialties.length; j++) {
      if (lower.includes(specialties[j])) {
        entities.specialty = specialties[j];
        break;
      }
    }

    return entities;
  }

  async rankResults(payload) {
    var results = payload.results;
    var queryContext = payload.queryContext;

    if (!results || !Array.isArray(results)) {
      throw new Error('Results array is required');
    }

    var rankedResults = results.map(function(result) {
      var score = result.relevanceScore || 50;

      if (queryContext && queryContext.intent) {
        var typeBoost = {
          'find_hospital': 'Hospital',
          'find_doctor': 'Doctor',
          'find_lab': 'Lab',
          'book_ambulance': 'Ambulance',
          'find_wellness': 'Wellness'
        };
        var targetType = typeBoost[queryContext.intent];
        if (result.type === targetType) {
          score += 15;
        }
      }

      if (result.metadata && result.metadata.rating) {
        score += (result.metadata.rating - 4) * 10;
      }

      var newResult = {};
      var keys = Object.keys(result);
      for (var i = 0; i < keys.length; i++) {
        newResult[keys[i]] = result[keys[i]];
      }
      newResult.relevanceScore = Math.min(score, 100);
      return newResult;
    });

    rankedResults.sort(function(a, b) { return b.relevanceScore - a.relevanceScore; });

    return {
      results: rankedResults,
      total: rankedResults.length,
      method: 'AI-powered ranking'
    };
  }

  async autocomplete(payload) {
    var query = payload.query;
    var limit = payload.limit || 5;

    if (!query || query.length < 2) {
      return { suggestions: [] };
    }

    var suggestions = [];
    var lowerQuery = query.toLowerCase();

    // Check popular searches
    var popularEntries = Array.from(this.popularSearches.entries());
    for (var i = 0; i < popularEntries.length; i++) {
      var key = popularEntries[i][0];
      var count = popularEntries[i][1];
      if (key.includes(lowerQuery)) {
        suggestions.push({
          text: key,
          type: 'popular',
          score: count
        });
      }
    }

    // Add service-based suggestions
    var services = [
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

    for (var j = 0; j < services.length; j++) {
      if (services[j].text.toLowerCase().includes(lowerQuery)) {
        suggestions.push({
          text: services[j].text,
          type: services[j].type,
          score: 50
        });
      }
    }

    suggestions.sort(function(a, b) { return b.score - a.score; });
    var limited = suggestions.slice(0, limit);

    return {
      suggestions: limited,
      total: suggestions.length,
      query: query
    };
  }

  async handleComplexQuery(task, payload) {
    var prompt = 'Task: ' + task + '\n' +
      'Payload: ' + JSON.stringify(payload) + '\n\n' +
      'Search History: ' + JSON.stringify(this.searchHistory) + '\n' +
      'Popular Searches: ' + JSON.stringify(Array.from(this.popularSearches.entries())) + '\n\n' +
      'Please analyze the query and provide a recommendation.';

    var response = await this.providerManager.generate(prompt);

    return {
      aiResponse: response.content,
      provider: response.provider,
      tokensUsed: response.tokensUsed
    };
  }

  getRequiredCapability(task) {
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

module.exports = { SearchIntelligenceAgent };