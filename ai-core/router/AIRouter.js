// D:\hospital backend\ai-core\router\AIRouter.js

const { AgentStatus } = require('../../shared/types/AgentTypes.js');
const { CapabilityRegistry } = require('./CapabilityRegistry.js');
const { Orchestrator } = require('./Orchestrator.js');
const { ProviderManager } = require('../providers/ProviderManager.js');
const { HealthManager } = require('../monitoring/HealthManager.js');

class AIRouter {
  constructor(registry, orchestrator, providerManager, healthManager) {
    this.registry = registry;
    this.orchestrator = orchestrator;
    this.providerManager = providerManager;
    this.healthManager = healthManager;
  }

  async route(request) {
    const health = this.healthManager.getOverallHealth();
    if (health === 'unhealthy') {
      return this.gracefulDegradation(request);
    }

    const decision = this.decideRoute(request);
    
    if (!decision.useAI) {
      return this.handleNoAI(request);
    }

    if (decision.directAgentId) {
      return await this.routeToAgent(decision.directAgentId, request);
    }

    if (decision.requiresOrchestration) {
      return await this.orchestrator.orchestrate(request, decision.tasks || []);
    }

    return this.gracefulDegradation(request);
  }

  decideRoute(request) {
    const task = request.task.toLowerCase();
    
    if (this.isSimpleQuery(request.task)) {
      return { useAI: false };
    }

    const doctorKeywords = ['doctor', 'cardiologist', 'neurologist', 'orthopedic', 'dermatologist',
                           'gynecologist', 'pediatrician', 'psychiatrist', 'physician', 'surgeon'];
    if (doctorKeywords.some(keyword => task.includes(keyword))) {
      const agent = this.registry.findAgentForTask('find_doctor');
      if (agent && (agent.status === 'online' || agent.status === 'idle')) {
        return { useAI: true, directAgentId: agent.id };
      }
    }

    const hospitalKeywords = ['hospital', 'clinic', 'medical center'];
    if (hospitalKeywords.some(keyword => task.includes(keyword))) {
      const agent = this.registry.findAgentForTask('search_hospitals');
      if (agent && (agent.status === 'online' || agent.status === 'idle')) {
        return { useAI: true, directAgentId: agent.id };
      }
    }

    const ambulanceKeywords = ['ambulance', 'emergency', 'medical transport'];
    if (ambulanceKeywords.some(keyword => task.includes(keyword))) {
      const agent = this.registry.findAgentForTask('dispatch_ambulance');
      if (agent && (agent.status === 'online' || agent.status === 'idle')) {
        return { useAI: true, directAgentId: agent.id };
      }
    }

    const insuranceKeywords = ['insurance', 'claim', 'policy', 'cashless'];
    if (insuranceKeywords.some(keyword => task.includes(keyword))) {
      const agent = this.registry.findAgentForTask('compare_policies');
      if (agent && (agent.status === 'online' || agent.status === 'idle')) {
        return { useAI: true, directAgentId: agent.id };
      }
    }

    const wellnessKeywords = ['ayurveda', 'homeopathy', 'mental', 'wellness', 'therapy', 'yoga', 'meditation'];
    if (wellnessKeywords.some(keyword => task.includes(keyword))) {
      const agent = this.registry.findAgentForTask('find_practitioner');
      if (agent && (agent.status === 'online' || agent.status === 'idle')) {
        return { useAI: true, directAgentId: agent.id };
      }
    }

    const caregiverKeywords = ['caregiver', 'home care', 'nurse', 'attendant', 'elder care'];
    if (caregiverKeywords.some(keyword => task.includes(keyword))) {
      const agent = this.registry.findAgentForTask('find_caregiver');
      if (agent && (agent.status === 'online' || agent.status === 'idle')) {
        return { useAI: true, directAgentId: agent.id };
      }
    }

    const diagnosticsKeywords = ['lab', 'test', 'diagnostic', 'checkup', 'blood test'];
    if (diagnosticsKeywords.some(keyword => task.includes(keyword))) {
      const agent = this.registry.findAgentForTask('find_lab');
      if (agent && (agent.status === 'online' || agent.status === 'idle')) {
        return { useAI: true, directAgentId: agent.id };
      }
    }

    const financeKeywords = ['emi', 'loan', 'finance', 'payment', 'installment'];
    if (financeKeywords.some(keyword => task.includes(keyword))) {
      const agent = this.registry.findAgentForTask('calculate_emi');
      if (agent && (agent.status === 'online' || agent.status === 'idle')) {
        return { useAI: true, directAgentId: agent.id };
      }
    }

    const corporateKeywords = ['corporate', 'company', 'employee', 'workplace'];
    if (corporateKeywords.some(keyword => task.includes(keyword))) {
      const agent = this.registry.findAgentForTask('get_corporate_plans');
      if (agent && (agent.status === 'online' || agent.status === 'idle')) {
        return { useAI: true, directAgentId: agent.id };
      }
    }

    const crmKeywords = ['customer', 'crm', 'lead', 'churn', 'segment', 'engagement'];
    if (crmKeywords.some(keyword => task.includes(keyword))) {
      const agent = this.registry.findAgentForTask('track_customer');
      if (agent && (agent.status === 'online' || agent.status === 'idle')) {
        return { useAI: true, directAgentId: agent.id };
      }
    }

    const marketingKeywords = ['content', 'marketing', 'campaign', 'seo', 'social media', 'ad copy'];
    if (marketingKeywords.some(keyword => task.includes(keyword))) {
      const agent = this.registry.findAgentForTask('generate_content');
      if (agent && (agent.status === 'online' || agent.status === 'idle')) {
        return { useAI: true, directAgentId: agent.id };
      }
    }

    const analyticsKeywords = ['kpi', 'analytics', 'report', 'trend', 'forecast', 'metric'];
    if (analyticsKeywords.some(keyword => task.includes(keyword))) {
      const agent = this.registry.findAgentForTask('generate_kpi');
      if (agent && (agent.status === 'online' || agent.status === 'idle')) {
        return { useAI: true, directAgentId: agent.id };
      }
    }

    const supportKeywords = ['faq', 'help', 'support', 'cancel booking', 'refund', 'complaint', 'issue'];
    if (supportKeywords.some(keyword => task.includes(keyword))) {
      const agent = this.registry.findAgentForTask('answer_faq');
      if (agent && (agent.status === 'online' || agent.status === 'idle')) {
        return { useAI: true, directAgentId: agent.id };
      }
    }

    if (task.includes('book hospital') && task.includes('doctor')) {
      return { useAI: true, requiresOrchestration: true, tasks: ['search_hospitals', 'find_doctor'] };
    }

    if (task.includes('ambulance') && task.includes('hospital')) {
      return { useAI: true, requiresOrchestration: true, tasks: ['dispatch_ambulance', 'search_hospitals'] };
    }

    if (task.includes('insurance') && task.includes('hospital')) {
      return { useAI: true, requiresOrchestration: true, tasks: ['search_hospitals', 'compare_policies'] };
    }

    const capabilities = this.identifyRequiredCapabilities(request.task);
    if (capabilities.length === 0) {
      return { useAI: false };
    }

    return { 
      useAI: true, 
      requiresOrchestration: true,
      tasks: capabilities 
    };
  }

  isSimpleQuery(task) {
    const simplePatterns = ['list hospitals', 'show booking', 'view profile', 'check status', 'my bookings', 'dashboard', 'help', 'menu'];
    const lowerTask = task.toLowerCase();
    const actionWords = ['find', 'search', 'book', 'compare', 'calculate', 'get', 'show me', 'need'];
    
    for (const word of actionWords) {
      if (lowerTask.includes(word)) {
        return false;
      }
    }
    
    return simplePatterns.some(pattern => lowerTask === pattern || lowerTask.includes(pattern));
  }

  identifyRequiredCapabilities(task) {
    const capabilityMap = {
      'hospital': ['search_hospitals', 'compare_hospitals', 'check_beds'],
      'doctor': ['find_doctor', 'book_consultation', 'check_availability'],
      'ambulance': ['dispatch_ambulance', 'track_ambulance'],
      'insurance': ['check_claim', 'compare_policies'],
      'payment': ['process_payment', 'calculate_emi'],
      'diagnostics': ['find_lab', 'compare_tests'],
      'wellness': ['find_practitioner', 'book_consultation']
    };

    const matchedCapabilities = [];
    const lowerTask = task.toLowerCase();

    for (const [keyword, caps] of Object.entries(capabilityMap)) {
      if (lowerTask.includes(keyword)) {
        matchedCapabilities.push(...caps);
      }
    }

    return [...new Set(matchedCapabilities)];
  }

  async routeToAgent(agentId, request) {
    try {
      const agent = this.registry.getAgent(agentId);
      if (agent && typeof agent.execute === 'function') {
        return await agent.execute(request);
      }

      const response = await this.providerManager.generate(
        `Task: ${request.task}\nPayload: ${JSON.stringify(request.payload)}`,
        request.critical
      );

      return {
        success: true,
        data: { response: response.content },
        sourceAgent: agentId,
        processingTime: response.latency || 0,
        providerUsed: response.provider
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        sourceAgent: agentId,
        processingTime: 0
      };
    }
  }

  gracefulDegradation(request) {
    return {
      success: false,
      error: 'AI temporarily unavailable. Please try again later.',
      sourceAgent: 'AI_Router',
      processingTime: 0,
      data: {
        fallback: true,
        message: 'Core services (Booking, Payments, Hospital search) are still available.'
      }
    };
  }

  handleNoAI(request) {
    return {
      success: true,
      data: {
        message: 'This request does not require AI processing.',
        details: 'You can use the normal business services flow.'
      },
      sourceAgent: 'AI_Router',
      processingTime: 5
    };
  }
}

module.exports = { AIRouter };
