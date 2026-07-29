// packages/ai-core/src/monitoring/MonitoringAggregationService.ts

import { 
  AgentHealth, 
  AgentCost, 
  AgentQueue, 
  MonitoringSnapshot 
} from '../../shared/types/MonitoringTypes';
import { CapabilityRegistry } from '../router/CapabilityRegistry';
import { ProviderManager } from '../providers/ProviderManager';
import { HealthManager } from './HealthManager';
import { BudgetManager } from './BudgetManager';
import { QueueManager } from './QueueManager';

interface WebSocketClient {
  send: (data: string) => void;
  isAlive: boolean;
}

export class MonitoringAggregationService {
  private clients: WebSocketClient[] = [];
  private registry: CapabilityRegistry;
  private providerManager: ProviderManager;
  private healthManager: HealthManager;
  private budgetManager: BudgetManager;
  private queueManager: QueueManager;
  private lastSnapshot: MonitoringSnapshot | null = null;
  private updateInterval: NodeJS.Timeout | null = null;

  constructor(
    registry: CapabilityRegistry,
    providerManager: ProviderManager,
    healthManager: HealthManager,
    budgetManager: BudgetManager,
    queueManager: QueueManager
  ) {
    this.registry = registry;
    this.providerManager = providerManager;
    this.healthManager = healthManager;
    this.budgetManager = budgetManager;
    this.queueManager = queueManager;
    
    this.startUpdates();
  }

  private startUpdates(): void {
    this.updateInterval = setInterval(() => {
      this.collectSnapshot();
    }, 10000); // Every 10 seconds
  }

  private async collectSnapshot(): Promise<void> {
    const snapshot = this.buildSnapshot();
    this.lastSnapshot = snapshot;
    this.broadcastToClients(snapshot);
  }

  private buildSnapshot(): MonitoringSnapshot {
    const agents = this.registry.getAllAgents();
    const agentData: MonitoringSnapshot['agents'] = {};

    for (const agent of agents) {
      const health = this.healthManager.getStatus(agent.id) as any;
      const queue = this.queueManager.getQueueStatus(agent.id);

      agentData[agent.id] = {
        status: agent.status,
        health: {
          agentId: agent.id,
          status: health?.status || 'unknown',
          uptime: 0, // This would need to be tracked
          responseTime: health?.responseTime || 0,
          errorRate: 0,
          lastCheck: new Date(),
          details: health?.details || {}
        },
        cost: {
          agentId: agent.id,
          provider: 'unknown', // Would need to track per agent
          tokensUsed: 0,
          costInr: 0,
          dailyCostInr: 0,
          weeklyCostInr: 0,
          monthlyCostInr: 0,
          budgetRemaining: this.budgetManager.getCurrentSpend().daily,
          budgetPercentage: this.budgetManager.getUsagePercentage()
        },
        queues: queue || [],
        memory: []
      };
    }

    const providerHealth = await this.providerManager.getHealthStatus();
    const systemHealth: MonitoringSnapshot['systemHealth'] = {
      mongodb: (this.healthManager.getStatus('mongodb')?.status as any) || 'healthy',
      redis: (this.healthManager.getStatus('redis')?.status as any) || 'healthy',
      providers: {}
    };

    for (const [provider, status] of Object.entries(providerHealth)) {
      systemHealth.providers[provider] = status.available ? 'healthy' : 'unhealthy';
    }

    const spend = this.budgetManager.getCurrentSpend();

    return {
      timestamp: new Date(),
      agents: agentData,
      systemHealth,
      totalCostToday: spend.daily,
      totalRequestsToday: 0, // Would need to track requests
      activeAgentsCount: agents.filter(a => a.status === 'online').length
    };
  }

  getLatestSnapshot(): MonitoringSnapshot | null {
    return this.lastSnapshot;
  }

  addClient(client: WebSocketClient): void {
    this.clients.push(client);
    client.isAlive = true;
    
    // Send initial snapshot
    if (this.lastSnapshot) {
      client.send(JSON.stringify(this.lastSnapshot));
    }
  }

  removeClient(client: WebSocketClient): void {
    this.clients = this.clients.filter(c => c !== client);
  }

  private broadcastToClients(data: any): void {
    const message = JSON.stringify(data);
    for (const client of this.clients) {
      try {
        if (client.isAlive) {
          client.send(message);
        }
      } catch (error) {
        console.error('Failed to send to client:', error);
      }
    }
  }

  stopUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }
}