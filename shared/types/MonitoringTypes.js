// D:\hospital backend\shared\types\MonitoringTypes.ts

export interface AgentHealth {
  agentId: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number; // seconds
  responseTime: number; // ms
  errorRate: number; // percentage
  lastCheck: Date;
  details: Record<string, any>;
}

export interface AgentCost {
  agentId: string;
  provider: string;
  tokensUsed: number;
  costInr: number;
  dailyCostInr: number;
  weeklyCostInr: number;
  monthlyCostInr: number;
  budgetRemaining: number;
  budgetPercentage: number;
}

export interface AgentQueue {
  queueName: string;
  depth: number;
  processingPerMinute: number;
  delayed: number;
  failed: number;
  deadLetter: number;
}

export interface AgentMemory {
  totalEntries: number;
  sizeMB: number;
  indexedTerms: number;
  type: 'patient' | 'session' | 'conversation' | 'preference';
}

export interface MonitoringSnapshot {
  timestamp: Date;
  agents: {
    [key: string]: {
      status: string;
      health: AgentHealth;
      cost: AgentCost;
      queues: AgentQueue[];
      memory: AgentMemory[];
    };
  };
  systemHealth: {
    mongodb: 'healthy' | 'degraded' | 'unhealthy';
    redis: 'healthy' | 'degraded' | 'unhealthy';
    providers: Record<string, 'healthy' | 'degraded' | 'unhealthy'>;
  };
  totalCostToday: number;
  totalRequestsToday: number;
  activeAgentsCount: number;
}

export interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  details: Record<string, any>;
}