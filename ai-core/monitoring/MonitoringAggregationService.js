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



export class MonitoringAggregationService {
  private clients[] = [];
  private registry;
  private providerManager;
  private healthManager;
  private budgetManager;
  private queueManager;
  private lastSnapshot| null = null;
  private updateInterval.Timeout | null = null;

  constructor(
    registry,
    providerManager,
    healthManager,
    budgetManager,
    queueManager) {
    this.registry = registry;
    this.providerManager = providerManager;
    this.healthManager = healthManager;
    this.budgetManager = budgetManager;
    this.queueManager = queueManager;
    
    this.startUpdates();
  }

  private startUpdates(){
    this.updateInterval = setInterval(() => {
      this.collectSnapshot();
    }, 10000); // Every 10 seconds
  }

  private async collectSnapshot()<void> {
    const snapshot = this.buildSnapshot();
    this.lastSnapshot = snapshot;
    this.broadcastToClients(snapshot);
  }

  private buildSnapshot(){
    const agents = this.registry.getAllAgents();
    const agentData['agents'] = {};

    for (const agent of agents) {
      const health = this.healthManager.getStatus(agent.id) as any;
      const queue = this.queueManager.getQueueStatus(agent.id);

      agentData[agent.id] = {
        status.status,
        health: {
          agentId.id,
          status?.status || 'unknown',
          uptime: 0, // This would need to be tracked
          responseTime?.responseTime || 0,
          errorRate: 0,
          lastCheckDate(),
          details?.details || {}
        },
        cost: {
          agentId.id,
          provider: 'unknown', // Would need to track per agent
          tokensUsed: 0,
          costInr: 0,
          dailyCostInr: 0,
          weeklyCostInr: 0,
          monthlyCostInr: 0,
          budgetRemaining.budgetManager.getCurrentSpend().daily,
          budgetPercentage.budgetManager.getUsagePercentage()
        },
        queues|| [],
        memory: []
      };
    }

    const providerHealth = await this.providerManager.getHealthStatus();
    const systemHealth['systemHealth'] = {
      mongodb: (this.healthManager.getStatus('mongodb')?.status as any) || 'healthy',
      redis: (this.healthManager.getStatus('redis')?.status as any) || 'healthy',
      providers: {}
    };

    for (const [provider, status] of Object.entries(providerHealth)) {
      systemHealth.providers[provider] = status.available ? 'healthy' : 'unhealthy';
    }

    const spend = this.budgetManager.getCurrentSpend();

    return {
      timestampDate(),
      agents,
      systemHealth,
      totalCostToday.daily,
      totalRequestsToday: 0, // Would need to track requests
      activeAgentsCount.filter(a => a.status === 'online').length
    };
  }

  getLatestSnapshot()| null {
    return this.lastSnapshot;
  }

  addClient(client){
    this.clients.push(client);
    client.isAlive = true;
    
    // Send initial snapshot
    if (this.lastSnapshot) {
      client.send(JSON.stringify(this.lastSnapshot));
    }
  }

  removeClient(client){
    this.clients = this.clients.filter(c => c !== client);
  }

  private broadcastToClients(data){
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

  stopUpdates(){
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }
}


