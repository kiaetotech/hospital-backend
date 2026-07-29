// D:\hospital backend\ai-core\router\AIRouter.ts

import { 
  AgentRequest, 
  AgentResponse, 
  AgentRole,
  AgentStatus 
} from '../../shared/types/AgentTypes';
import { CapabilityRegistry } from './CapabilityRegistry';
import { Orchestrator } from './Orchestrator';
import { ProviderManager } from '../providers/ProviderManager';
import { HealthManager } from '../monitoring/HealthManager';

  useAI: boolean;
  directAgentId?: string;
  requiresOrchestration?: boolean;
  tasks?: string[];
}

export class AIRouter {
  private registry: CapabilityRegistry;
  private orchestrator: Orchestrator;
  private providerManager: ProviderManager;
  private healthManager: HealthManager;

  constructor(
    registry: CapabilityRegistry,
    orchestrator: Orchestrator,
    providerManager: ProviderManager,
    healthManager: HealthManager
  ) {
    this.registry = registry;
    this.orchestrator = orchestrator;
    this.providerManager = providerManager;
    this.healthManager = healthManager;
  }

  async route(request: AgentRequest): Promise<AgentResponse> {
    // 1. Check if AI is healthy
    const health = this.healthManager.getOverallHealth();
    if (health === 'unhealthy') {
      return this.gracefulDegradation(request);
    }

    // 2. Check if AI is needed
    const decision = this.decideRoute(request);
    
    if (!decision.useAI) {
      return this.handleNoAI(request);
    }

    // 3. Route to single agent or orchestrate
    if (decision.directAgentId) {
      return await this.routeToAgent(decision.directAgentId, request);
    }

    if (decision.requiresOrchestration) {
      return await this.orchestrator.orchestrate(
        request,
        decision.tasks || []
      );
    }

    // 4. Fallback
    return this.gracefulDegradation(request);
  }

  private decideRoute(request: AgentRequest): RouteDecision {
  const task = request.task.toLowerCase();
  
  // Check if it's a simple query first
  if (this.isSimpleQuery(request.task)) {
    return { useAI: false };
  }

  // ============================================
  // DIRECT AGENT ROUTING
  // ============================================

  // 1. DOCTOR AGENT
  const doctorKeywords = ['doctor', 'cardiologist', 'neurologist', 'orthopedic', 'dermatologist',
                         'gynecologist', 'pediatrician', 'psychiatrist', 'physician', 'surgeon'];
  if (doctorKeywords.some(keyword => task.includes(keyword))) {
    const agent = this.registry.findAgentForTask('find_doctor');
    if (agent && (agent.status === AgentStatus.ONLINE || agent.status === AgentStatus.IDLE)) {
      return { useAI: true, directAgentId: agent.id };
    }
  }

  // 2. HOSPITAL AGENT
  const hospitalKeywords = ['hospital', 'clinic', 'medical center'];
  if (hospitalKeywords.some(keyword => task.includes(keyword))) {
    const agent = this.registry.findAgentForTask('search_hospitals');
    if (agent && (agent.status === AgentStatus.ONLINE || agent.status === AgentStatus.IDLE)) {
      return { useAI: true, directAgentId: agent.id };
    }
  }

  // 3. AMBULANCE AGENT
  const ambulanceKeywords = ['ambulance', 'emergency', 'medical transport'];
  if (ambulanceKeywords.some(keyword => task.includes(keyword))) {
    const agent = this.registry.findAgentForTask('dispatch_ambulance');
    if (agent && (agent.status === AgentStatus.ONLINE || agent.status === AgentStatus.IDLE)) {
      return { useAI: true, directAgentId: agent.id };
    }
  }

  // 4. INSURANCE AGENT
  const insuranceKeywords = ['insurance', 'claim', 'policy', 'cashless'];
  if (insuranceKeywords.some(keyword => task.includes(keyword))) {
    const agent = this.registry.findAgentForTask('compare_policies');
    if (agent && (agent.status === AgentStatus.ONLINE || agent.status === AgentStatus.IDLE)) {
      return { useAI: true, directAgentId: agent.id };
    }
  }

  // 5. WELLNESS AGENT
  const wellnessKeywords = ['ayurveda', 'homeopathy', 'mental', 'wellness', 'therapy', 'yoga', 'meditation'];
  if (wellnessKeywords.some(keyword => task.includes(keyword))) {
    const agent = this.registry.findAgentForTask('find_practitioner');
    if (agent && (agent.status === AgentStatus.ONLINE || agent.status === AgentStatus.IDLE)) {
      return { useAI: true, directAgentId: agent.id };
    }
  }

  // 6. CAREGIVER AGENT
  const caregiverKeywords = ['caregiver', 'home care', 'nurse', 'attendant', 'elder care'];
  if (caregiverKeywords.some(keyword => task.includes(keyword))) {
    const agent = this.registry.findAgentForTask('find_caregiver');
    if (agent && (agent.status === AgentStatus.ONLINE || agent.status === AgentStatus.IDLE)) {
      return { useAI: true, directAgentId: agent.id };
    }
  }

  // 7. DIAGNOSTICS AGENT
  const diagnosticsKeywords = ['lab', 'test', 'diagnostic', 'checkup', 'blood test'];
  if (diagnosticsKeywords.some(keyword => task.includes(keyword))) {
    const agent = this.registry.findAgentForTask('find_lab');
    if (agent && (agent.status === AgentStatus.ONLINE || agent.status === AgentStatus.IDLE)) {
      return { useAI: true, directAgentId: agent.id };
    }
  }

  // 8. FINANCE AGENT
  const financeKeywords = ['emi', 'loan', 'finance', 'payment', 'installment'];
  if (financeKeywords.some(keyword => task.includes(keyword))) {
    const agent = this.registry.findAgentForTask('calculate_emi');
    if (agent && (agent.status === AgentStatus.ONLINE || agent.status === AgentStatus.IDLE)) {
      return { useAI: true, directAgentId: agent.id };
    }
  }

  // 9. CORPORATE AGENT
  const corporateKeywords = ['corporate', 'company', 'employee', 'workplace'];
  if (corporateKeywords.some(keyword => task.includes(keyword))) {
    const agent = this.registry.findAgentForTask('get_corporate_plans');
    if (agent && (agent.status === AgentStatus.ONLINE || agent.status === AgentStatus.IDLE)) {
      return { useAI: true, directAgentId: agent.id };
    }
  }

  // 10. SUPPORT AGENT
  const supportKeywords = ['faq', 'help', 'support', 'cancel booking', 'refund', 'complaint', 'issue'];
  if (supportKeywords.some(keyword => task.includes(keyword))) {
    const agent = this.registry.findAgentForTask('answer_faq');
    if (agent && (agent.status === AgentStatus.ONLINE || agent.status === AgentStatus.IDLE)) {
      return { useAI: true, directAgentId: agent.id };
    }
  }

  // ============================================
  // NEWLY ADDED AGENTS
  // ============================================

  // 11. CRM AGENT
  const crmKeywords = ['customer', 'crm', 'lead', 'churn', 'segment', 'engagement', 'track customer'];
  if (crmKeywords.some(keyword => task.includes(keyword))) {
    const agent = this.registry.findAgentForTask('track_customer');
    if (agent && (agent.status === AgentStatus.ONLINE || agent.status === AgentStatus.IDLE)) {
      return { useAI: true, directAgentId: agent.id };
    }
  }

  // 12. MARKETING AGENT
  const marketingKeywords = ['content', 'marketing', 'campaign', 'seo', 'social media', 'ad copy', 'generate content'];
  if (marketingKeywords.some(keyword => task.includes(keyword))) {
    const agent = this.registry.findAgentForTask('generate_content');
    if (agent && (agent.status === AgentStatus.ONLINE || agent.status === AgentStatus.IDLE)) {
      return { useAI: true, directAgentId: agent.id };
    }
  }

  // 13. ANALYTICS AGENT
  const analyticsKeywords = ['kpi', 'analytics', 'report', 'trend', 'forecast', 'metric', 'generate kpi'];
  if (analyticsKeywords.some(keyword => task.includes(keyword))) {
    const agent = this.registry.findAgentForTask('generate_kpi');
    if (agent && (agent.status === AgentStatus.ONLINE || agent.status === AgentStatus.IDLE)) {
      return { useAI: true, directAgentId: agent.id };
    }
  }

  // ============================================
  // COMPLEX WORKFLOWS (Use CEO Agent)
  // ============================================
  
  if (task.includes('book hospital') && task.includes('doctor')) {
    return { useAI: true, requiresOrchestration: true, tasks: ['search_hospitals', 'find_doctor'] };
  }
  
  if (task.includes('ambulance') && task.includes('hospital')) {
    return { useAI: true, requiresOrchestration: true, tasks: ['dispatch_ambulance', 'search_hospitals'] };
  }
  
  if (task.includes('insurance') && task.includes('hospital')) {
    return { useAI: true, requiresOrchestration: true, tasks: ['search_hospitals', 'compare_policies'] };
  }

  // ============================================
  // DEFAULT
  // ============================================
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

  private isSimpleQuery(task: string): boolean {
    const simplePatterns = [
      'list hospitals',
      'show booking',
      'view profile',
      'check status',
      'my bookings',
      'dashboard',
      'help',
      'menu'
    ];
    
    const lowerTask = task.toLowerCase();
    
    // If task contains action words, it's NOT simple
    const actionWords = ['find', 'search', 'book', 'compare', 'calculate', 'get', 'show me', 'need'];
    for (const word of actionWords) {
      if (lowerTask.includes(word)) {
        return false;
      }
    }
    
    return simplePatterns.some(pattern => 
      lowerTask === pattern || lowerTask.includes(pattern)
    );
  }

  private identifyRequiredCapabilities(task: string): string[] {
    const capabilityMap: Record<string, string[]> = {
      'hospital': ['search_hospitals', 'compare_hospitals', 'check_beds'],
      'doctor': ['find_doctor', 'book_consultation', 'check_availability'],
      'ambulance': ['dispatch_ambulance', 'track_ambulance'],
      'insurance': ['check_claim', 'compare_policies'],
      'payment': ['process_payment', 'calculate_emi'],
      'diagnostics': ['find_lab', 'compare_tests'],
      'wellness': ['find_practitioner', 'book_consultation']
    };

    const matchedCapabilities: string[] = [];
    const lowerTask = task.toLowerCase();

    for (const [keyword, caps] of Object.entries(capabilityMap)) {
      if (lowerTask.includes(keyword)) {
        matchedCapabilities.push(...caps);
      }
    }

    return [...new Set(matchedCapabilities)];
  }

  private async routeToAgent(agentId: string, request: AgentRequest): Promise<AgentResponse> {
    try {
      // Find the agent and execute it directly
      const agent = this.registry.getAgent(agentId);
      if (agent && typeof agent.execute === 'function') {
        return await agent.execute(request);
      }
      
      // Fallback: Use ProviderManager
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

  private gracefulDegradation(request: AgentRequest): AgentResponse {
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

  private handleNoAI(request: AgentRequest): AgentResponse {
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