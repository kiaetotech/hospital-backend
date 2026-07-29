// D:\hospital backend\ai-core\monitoring\HealthManager.ts

import { AgentStatus } from '../../shared/types/AgentTypes';

export interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  details: Record<string, any>;
}

export interface ServiceHealth {
  mongodb: 'healthy' | 'degraded' | 'unhealthy';
  redis: 'healthy' | 'degraded' | 'unhealthy';
  providers: Record<string, 'healthy' | 'degraded' | 'unhealthy'>;
  queues: Record<string, 'healthy' | 'degraded' | 'unhealthy'>;
  agents: Record<string, 'healthy' | 'degraded' | 'unhealthy'>;
}

export class HealthManager {
  private healthStatus: Map<string, HealthCheckResult> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;
  private statusListeners: ((status: ServiceHealth) => void)[] = [];
  private isRunning: boolean = false;
  private checkFrequency: number = 60000; // 60 seconds

  constructor(checkFrequency?: number) {
    if (checkFrequency) {
      this.checkFrequency = checkFrequency;
    }
  }

  /**
   * Start health checks
   */
  startHealthChecks(): void {
    if (this.isRunning) {
      console.log('Health checks already running');
      return;
    }

    this.isRunning = true;
    console.log(`🩺 Health checks started (every ${this.checkFrequency / 1000}s)`);

    // Run immediately
    this.runAllChecks();

    // Schedule periodic checks
    this.checkInterval = setInterval(() => {
      this.runAllChecks();
    }, this.checkFrequency);
  }

  /**
   * Stop health checks
   */
  stopHealthChecks(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isRunning = false;
    console.log('🩺 Health checks stopped');
  }

  /**
   * Run all health checks
   */
  private async runAllChecks(): Promise<void> {
    try {
      const checks = await Promise.all([
        this.checkMongoDB(),
        this.checkRedis(),
        this.checkProviders(),
        this.checkQueues(),
        this.checkAgents()
      ]);

      for (const result of checks) {
        this.healthStatus.set(result.service, result);
      }

      // Build and broadcast service health
      const serviceHealth = this.buildServiceHealth();
      this.notifyListeners(serviceHealth);

    } catch (error) {
      console.error('Health check failed:', error);
    }
  }

  /**
   * Check MongoDB health
   */
  private async checkMongoDB(): Promise<HealthCheckResult> {
    try {
      const start = Date.now();
      // In production: await mongoose.connection.db.admin().ping()
      await new Promise(resolve => setTimeout(resolve, 10));
      const duration = Date.now() - start;

      return {
        service: 'mongodb',
        status: duration < 50 ? 'healthy' : 'degraded',
        responseTime: duration,
        details: {
          latency: `${duration}ms`,
          state: 'connected'
        }
      };
    } catch (error) {
      return {
        service: 'mongodb',
        status: 'unhealthy',
        responseTime: 0,
        details: {
          error: error.message,
          state: 'disconnected'
        }
      };
    }
  }

  /**
   * Check Redis health
   */
  private async checkRedis(): Promise<HealthCheckResult> {
    try {
      const start = Date.now();
      // In production: await redis.ping()
      await new Promise(resolve => setTimeout(resolve, 5));
      const duration = Date.now() - start;

      return {
        service: 'redis',
        status: duration < 20 ? 'healthy' : 'degraded',
        responseTime: duration,
        details: {
          latency: `${duration}ms`,
          state: 'connected'
        }
      };
    } catch (error) {
      return {
        service: 'redis',
        status: 'unhealthy',
        responseTime: 0,
        details: {
          error: error.message,
          state: 'disconnected'
        }
      };
    }
  }

  /**
   * Check AI providers health
   */
  private async checkProviders(): Promise<HealthCheckResult> {
    try {
      const start = Date.now();
      // In production: check each provider
      await new Promise(resolve => setTimeout(resolve, 100));
      const duration = Date.now() - start;

      return {
        service: 'providers',
        status: duration < 200 ? 'healthy' : 'degraded',
        responseTime: duration,
        details: {
          groq: 'available',
          ollama: 'available',
          gemini: 'available',
          openrouter: 'available',
          latency: `${duration}ms`
        }
      };
    } catch (error) {
      return {
        service: 'providers',
        status: 'unhealthy',
        responseTime: 0,
        details: {
          error: error.message
        }
      };
    }
  }

  /**
   * Check queues health
   */
  private async checkQueues(): Promise<HealthCheckResult> {
    try {
      const start = Date.now();
      // In production: check BullMQ queues
      await new Promise(resolve => setTimeout(resolve, 5));
      const duration = Date.now() - start;

      return {
        service: 'queues',
        status: 'healthy',
        responseTime: duration,
        details: {
          queueCount: 9,
          deadLetterCount: 0,
          totalWaiting: 0,
          totalActive: 0
        }
      };
    } catch (error) {
      return {
        service: 'queues',
        status: 'unhealthy',
        responseTime: 0,
        details: {
          error: error.message
        }
      };
    }
  }

  /**
   * Check agents health
   */
  private async checkAgents(): Promise<HealthCheckResult> {
    try {
      const start = Date.now();
      await new Promise(resolve => setTimeout(resolve, 5));
      const duration = Date.now() - start;

      return {
        service: 'agents',
        status: 'healthy',
        responseTime: duration,
        details: {
          total: 18,
          online: 18,
          busy: 0,
          idle: 18,
          offline: 0
        }
      };
    } catch (error) {
      return {
        service: 'agents',
        status: 'unhealthy',
        responseTime: 0,
        details: {
          error: error.message
        }
      };
    }
  }

  /**
   * Build service health object
   */
  private buildServiceHealth(): ServiceHealth {
    const mongodb = this.healthStatus.get('mongodb')?.status || 'unhealthy';
    const redis = this.healthStatus.get('redis')?.status || 'unhealthy';
    const providers = this.healthStatus.get('providers')?.details || {};
    const queues = this.healthStatus.get('queues')?.details || {};
    const agents = this.healthStatus.get('agents')?.details || {};

    return {
      mongodb: mongodb as 'healthy' | 'degraded' | 'unhealthy',
      redis: redis as 'healthy' | 'degraded' | 'unhealthy',
      providers: {
        groq: providers.groq === 'available' ? 'healthy' : 'unhealthy',
        ollama: providers.ollama === 'available' ? 'healthy' : 'unhealthy',
        gemini: providers.gemini === 'available' ? 'healthy' : 'unhealthy',
        openrouter: providers.openrouter === 'available' ? 'healthy' : 'unhealthy'
      },
      queues: {
        hospital: 'healthy',
        ambulance: 'healthy',
        doctor: 'healthy',
        diagnostics: 'healthy',
        wellness: 'healthy',
        caregiver: 'healthy',
        insurance: 'healthy',
        finance: 'healthy',
        corporate: 'healthy'
      },
      agents: {
        hospital: 'healthy',
        doctor: 'healthy',
        diagnostics: 'healthy',
        ambulance: 'healthy',
        insurance: 'healthy',
        caregiver: 'healthy',
        wellness: 'healthy',
        finance: 'healthy',
        corporate: 'healthy'
      }
    };
  }

  /**
   * Get status of a specific service
   */
  getStatus(service: string): HealthCheckResult | undefined {
    return this.healthStatus.get(service);
  }

  /**
   * Get overall health
   */
  getOverallHealth(): 'healthy' | 'degraded' | 'unhealthy' {
    const statuses = Array.from(this.healthStatus.values());

    if (statuses.some(s => s.status === 'unhealthy')) {
      return 'unhealthy';
    }

    if (statuses.some(s => s.status === 'degraded')) {
      return 'degraded';
    }

    return 'healthy';
  }

  /**
   * Get all statuses
   */
  getAllStatuses(): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [key, value] of this.healthStatus) {
      result[key] = {
        status: value.status,
        responseTime: value.responseTime,
        details: value.details
      };
    }
    return result;
  }

  /**
   * Get service health
   */
  getServiceHealth(): ServiceHealth {
    return this.buildServiceHealth();
  }

  /**
   * Register status change listener
   */
  onStatusChange(listener: (status: ServiceHealth) => void): void {
    this.statusListeners.push(listener);
  }

  /**
   * Notify listeners
   */
  private notifyListeners(status: ServiceHealth): void {
    for (const listener of this.statusListeners) {
      try {
        listener(status);
      } catch (error) {
        console.error('Listener error:', error);
      }
    }
  }

  /**
   * Check if health manager is running
   */
  isRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get health report
   */
  getHealthReport(): Record<string, any> {
    return {
      overall: this.getOverallHealth(),
      services: this.getAllStatuses(),
      timestamp: new Date().toISOString(),
      running: this.isRunning
    };
  }
}

/**
 * Export singleton instance
 */
let healthManagerInstance: HealthManager | null = null;

export function getHealthManager(checkFrequency?: number): HealthManager {
  if (!healthManagerInstance) {
    healthManagerInstance = new HealthManager(checkFrequency);
  }
  return healthManagerInstance;
}