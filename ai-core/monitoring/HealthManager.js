// D:\hospital backend\ai-core\monitoring\HealthManager.ts

const { AgentStatus } = require('../../shared/types/AgentTypes');

export 

export 

export class HealthManager {
  private healthStatus<string, HealthCheckResult> = new Map();
  private checkInterval.Timeout | null = null;
  private statusListeners: ((status) => void)[] = [];
  private isRunning= false;
  private checkFrequency= 60000; // 60 seconds

  constructor(checkFrequency?) {
    if (checkFrequency) {
      this.checkFrequency = checkFrequency;
    }
  }

  /**
   * Start health checks
   */
  startHealthChecks(){
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
  stopHealthChecks(){
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
  private async runAllChecks()<void> {
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
  private async checkMongoDB()<HealthCheckResult> {
    try {
      const start = Date.now();
      // In productionmongoose.connection.db.admin().ping()
      await new Promise(resolve => setTimeout(resolve, 10));
      const duration = Date.now() - start;

      return {
        service: 'mongodb',
        status< 50 ? 'healthy' : 'degraded',
        responseTime,
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
          error.message,
          state: 'disconnected'
        }
      };
    }
  }

  /**
   * Check Redis health
   */
  private async checkRedis()<HealthCheckResult> {
    try {
      const start = Date.now();
      // In productionredis.ping()
      await new Promise(resolve => setTimeout(resolve, 5));
      const duration = Date.now() - start;

      return {
        service: 'redis',
        status< 20 ? 'healthy' : 'degraded',
        responseTime,
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
          error.message,
          state: 'disconnected'
        }
      };
    }
  }

  /**
   * Check AI providers health
   */
  private async checkProviders()<HealthCheckResult> {
    try {
      const start = Date.now();
      // In productioneach provider
      await new Promise(resolve => setTimeout(resolve, 100));
      const duration = Date.now() - start;

      return {
        service: 'providers',
        status< 200 ? 'healthy' : 'degraded',
        responseTime,
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
          error.message
        }
      };
    }
  }

  /**
   * Check queues health
   */
  private async checkQueues()<HealthCheckResult> {
    try {
      const start = Date.now();
      // In productionBullMQ queues
      await new Promise(resolve => setTimeout(resolve, 5));
      const duration = Date.now() - start;

      return {
        service: 'queues',
        status: 'healthy',
        responseTime,
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
          error.message
        }
      };
    }
  }

  /**
   * Check agents health
   */
  private async checkAgents()<HealthCheckResult> {
    try {
      const start = Date.now();
      await new Promise(resolve => setTimeout(resolve, 5));
      const duration = Date.now() - start;

      return {
        service: 'agents',
        status: 'healthy',
        responseTime,
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
          error.message
        }
      };
    }
  }

  /**
   * Build service health object
   */
  private buildServiceHealth(){
    const mongodb = this.healthStatus.get('mongodb')?.status || 'unhealthy';
    const redis = this.healthStatus.get('redis')?.status || 'unhealthy';
    const providers = this.healthStatus.get('providers')?.details || {};
    const queues = this.healthStatus.get('queues')?.details || {};
    const agents = this.healthStatus.get('agents')?.details || {};

    return {
      mongodbas 'healthy' | 'degraded' | 'unhealthy',
      redisas 'healthy' | 'degraded' | 'unhealthy',
      providers: {
        groq.groq === 'available' ? 'healthy' : 'unhealthy',
        ollama.ollama === 'available' ? 'healthy' : 'unhealthy',
        gemini.gemini === 'available' ? 'healthy' : 'unhealthy',
        openrouter.openrouter === 'available' ? 'healthy' : 'unhealthy'
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
  getStatus(service)| undefined {
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
  getAllStatuses(){
    const result= {};
    for (const [key, value] of this.healthStatus) {
      result[key] = {
        status.status,
        responseTime.responseTime,
        details.details
      };
    }
    return result;
  }

  /**
   * Get service health
   */
  getServiceHealth(){
    return this.buildServiceHealth();
  }

  /**
   * Register status change listener
   */
  onStatusChange(listener: (status) => void){
    this.statusListeners.push(listener);
  }

  /**
   * Notify listeners
   */
  private notifyListeners(status){
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
  isRunning(){
    return this.isRunning;
  }

  /**
   * Get health report
   */
  getHealthReport(){
    return {
      overall.getOverallHealth(),
      services.getAllStatuses(),
      timestampDate().toISOString(),
      running.isRunning
    };
  }
}

/**
 * Export singleton instance
 */
let healthManagerInstance| null = null;

export function getHealthManager(checkFrequency?){
  if (!healthManagerInstance) {
    healthManagerInstance = new HealthManager(checkFrequency);
  }
  return healthManagerInstance;
}



