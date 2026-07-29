const { ProviderType } = require('../../shared/types/AgentTypes.js');
const { BudgetManager } = require('../monitoring/BudgetManager.js');
const { CircuitBreaker } = require('../recovery/CircuitBreaker.js');

class ProviderManager {
  constructor(budgetManager) {
    this.budgetManager = budgetManager;
    this.circuitBreakers = new Map();
    this.fallbackOrder = ['groq', 'ollama', 'gemini', 'openrouter'];
    this.mockMode = true;
    this.initializeCircuitBreakers();
    console.log('🔧 ProviderManager initialized with MOCK MODE:', this.mockMode);
  }

  initializeCircuitBreakers() {
    for (const type of this.fallbackOrder) {
      this.circuitBreakers.set(type, new CircuitBreaker({
        failureThreshold: 3,
        timeout: 120000,
        resetTimeout: 60000
      }));
    }
  }

  async generate(prompt, critical = false) {
    if (this.mockMode) {
      console.log('🔄 [MOCK] Generating response for:', prompt.substring(0, 50) + '...');
      
      let mockData = {};
      const lowerPrompt = prompt.toLowerCase();
      
      if (lowerPrompt.includes('doctor') || lowerPrompt.includes('cardiologist')) {
        mockData = {
          doctors: [
            { id: 'd1', name: 'Dr. Rajesh Kumar', specialty: 'Cardiology', city: 'Mumbai', rating: 4.9 },
            { id: 'd2', name: 'Dr. Priya Sharma', specialty: 'Cardiology', city: 'Delhi', rating: 4.8 }
          ],
          total: 2
        };
      } else if (lowerPrompt.includes('hospital') || lowerPrompt.includes('search_hospitals')) {
        mockData = {
          hospitals: [
            { id: 'h1', name: 'Apollo Hospital', city: 'Mumbai', rating: 4.8 },
            { id: 'h2', name: 'Fortis Hospital', city: 'Mumbai', rating: 4.6 }
          ],
          total: 2
        };
      } else if (lowerPrompt.includes('ambulance') || lowerPrompt.includes('dispatch_ambulance')) {
        mockData = {
          ambulance: {
            id: 'amb1',
            vehicleNumber: 'MH-01-AB-1234',
            type: 'Advanced',
            driverName: 'Rajesh Singh',
            eta: '5 minutes'
          }
        };
      } else if (lowerPrompt.includes('insurance') || lowerPrompt.includes('compare_policies')) {
        mockData = {
          policies: [
            { id: 'pol1', name: 'ICICI Health Shield', coverage: 500000, premium: 12000 },
            { id: 'pol2', name: 'HDFC Health Advantage', coverage: 1000000, premium: 18000 }
          ],
          total: 2
        };
      } else if (lowerPrompt.includes('ayurveda') || lowerPrompt.includes('wellness') || lowerPrompt.includes('find_practitioner')) {
        mockData = {
          practitioners: [
            { id: 'w1', name: 'Dr. Anjali Sharma', type: 'Ayurveda', city: 'Mumbai', rating: 4.9 },
            { id: 'w2', name: 'Dr. Rajesh Kumar', type: 'Ayurveda', city: 'Mumbai', rating: 4.7 }
          ],
          total: 2
        };
      } else {
        mockData = {
          message: 'Mock response for your request',
          task: prompt.substring(0, 100)
        };
      }

      this.budgetManager.recordSpend(0, critical);

      return {
        content: JSON.stringify(mockData),
        provider: 'groq',
        tokensUsed: 10,
        costInr: 0,
        latency: 50
      };
    }

    return this.generate(prompt, critical);
  }

  async getHealthStatus() {
    const status = {};
    for (const type of this.fallbackOrder) {
      status[type] = {
        available: this.mockMode ? true : false,
        quota: this.mockMode ? 999 : 0,
        latency: this.mockMode ? 50 : 0,
        circuitBreaker: this.circuitBreakers.get(type)?.getStatus() || { state: 'CLOSED' }
      };
    }
    return status;
  }

  setMockMode(enabled) {
    this.mockMode = enabled;
    console.log(`🔧 Mock mode ${enabled ? 'ENABLED' : 'DISABLED'}`);
  }
}

module.exports = { ProviderManager };
