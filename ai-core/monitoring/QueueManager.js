// D:\hospital backend\ai-core\monitoring\QueueManager.ts

const { Queue, Worker, Job } = require('bullmq');
const Redis = require('ioredis');
const { AgentRequest, AgentResponse } = require('../../shared/types/AgentTypes');

export 

export 

export 

export class QueueManager {
  private queues<string, Queue> = new Map();
  private workers<string, Worker> = new Map();
  private redisConnection;
  private isInitialized= false;
  private jobHandlers<string, (job<JobData>) => Promise<AgentResponse>> = new Map();

  // Queue names
  public static readonly QUEUES = {
    HOSPITAL: 'hospital-queue',
    AMBULANCE: 'ambulance-queue',
    DOCTOR: 'doctor-queue',
    DIAGNOSTICS: 'diagnostics-queue',
    WELLNESS: 'wellness-queue',
    CAREGIVER: 'caregiver-queue',
    INSURANCE: 'insurance-queue',
    FINANCE: 'finance-queue',
    CORPORATE: 'corporate-queue',
    NOTIFICATION: 'notification-queue',
    DEAD_LETTER: 'dead-letter-queue'
  } as const;

  constructor(config) {
    this.redisConnection = new Redis({
      host.host || 'localhost',
      port.port || 6379,
      password.password || undefined,
      db.db || 0,
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 50, 2000)
    });

    this.redisConnection.on('connect', () => {
      console.log('✅ Redis connected for QueueManager');
      this.isInitialized = true;
    });

    this.redisConnection.on('error', (error) => {
      console.error('❌ Redis connection error:', error);
      this.isInitialized = false;
    });
  }

  /**
   * Initialize all queues
   */
  async initialize()<void> {
    if (this.isInitialized) {
      console.log('QueueManager already initialized');
      return;
    }

    try {
      // Create all queues
      for (const [name, queueName] of Object.entries(QueueManager.QUEUES)) {
        this.createQueue(queueName);
        console.log(`✅ Queue created: ${queueName}`);
      }

      this.isInitialized = true;
      console.log('✅ All queues initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize queues:', error);
      throw error;
    }
  }

  /**
   * Create a queue
   */
  private createQueue(name){
    const queue = new Queue(name, {
      connection.redisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000
        },
        removeOnComplete: {
          age: 3600, // 1 hour
          count: 1000
        },
        removeOnFail: {
          age: 86400, // 24 hours
          count: 10000
        }
      }
    });

    this.queues.set(name, queue);
    return queue;
  }

  /**
   * Add a job to a queue
   */
  async addJob(
    queueName,
    agentId,
    request,
    priority= 1
  )<string> {
    if (!this.isInitialized) {
      throw new Error('QueueManager not initialized');
    }

    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const jobData= {
      id: `job-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      agentId,
      request,
      retryCount: 0,
      priority,
      createdAtDate()
    };

    const job = await queue.add('process-job', jobData, {
      priority,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000
      }
    });

    console.log(`📥 Job added to ${queueName}: ${job.id}`);
    return job.id;
  }

  /**
   * Register a worker for a queue
   */
  async registerWorker(
    queueName,
    handler: (job<JobData>) => Promise<AgentResponse>,
    concurrency= 5
  )<void> {
    if (!this.isInitialized) {
      throw new Error('QueueManager not initialized');
    }

    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    // Store handler for reference
    this.jobHandlers.set(queueName, handler);

    // Create worker
    const worker = new Worker(
      queueName,
      async (job<JobData>) => {
        try {
          console.log(`🔄 Processing job ${job.id} from ${queueName}`);
          
          const result = await handler(job);
          
          console.log(`✅ Job ${job.id} completed from ${queueName}`);
          return result;
        } catch (error) {
          console.error(`❌ Job ${job.id} failed from ${queueName}:`, error);
          throw error;
        }
      },
      {
        connection.redisConnection,
        concurrency,
        lockDuration: 30000, // 30 seconds
        stalledInterval: 30000,
        maxStalledCount: 3
      }
    );

    // Worker event handlers
    worker.on('completed', (job) => {
      console.log(`✅ Job ${job.id} completed from ${queueName}`);
    });

    worker.on('failed', (job| undefined, error) => {
      if (job) {
        console.error(`❌ Job ${job.id} failed from ${queueName}:`, error.message);
      }
    });

    worker.on('stalled', (jobId) => {
      console.warn(`⚠️ Job ${jobId} stalled from ${queueName}`);
    });

    this.workers.set(queueName, worker);
    console.log(`✅ Worker registered for ${queueName}`);
  }

  /**
   * Get queue status
   */
  async getQueueStatus(queueName)<QueueStatus | null> {
    if (!this.isInitialized) {
      return null;
    }

    const queue = this.queues.get(queueName);
    if (!queue) {
      return null;
    }

    try {
      const counts = await queue.getJobCounts();
      
      return {
        name,
        depth.waiting || 0,
        processing.active || 0,
        completed.completed || 0,
        failed.failed || 0,
        delayed.delayed || 0,
        waiting.waiting || 0,
        active.active || 0
      };
    } catch (error) {
      console.error(`Failed to get status for ${queueName}:`, error);
      return null;
    }
  }

  /**
   * Get status for all queues
   */
  async getAllQueueStatus()<Record<string, QueueStatus>> {
    const statuses= {};

    for (const [name] of this.queues) {
      const status = await this.getQueueStatus(name);
      if (status) {
        statuses[name] = status;
      }
    }

    return statuses;
  }

  /**
   * Get job by ID
   */
  async getJob(queueName, jobId)<Job | null> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      return null;
    }

    try {
      return await queue.getJob(jobId);
    } catch (error) {
      console.error(`Failed to get job ${jobId}:`, error);
      return null;
    }
  }

  /**
   * Cancel a job
   */
  async cancelJob(queueName, jobId)<boolean> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      return false;
    }

    try {
      const job = await queue.getJob(jobId);
      if (job) {
        await job.remove();
        console.log(`🗑️ Job ${jobId} cancelled from ${queueName}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`Failed to cancel job ${jobId}:`, error);
      return false;
    }
  }

  /**
   * Get dead letter queue (failed jobs)
   */
  async getDeadLetterQueue()<Job[]> {
    const queue = this.queues.get(QueueManager.QUEUES.DEAD_LETTER);
    if (!queue) {
      return [];
    }

    try {
      const jobs = await queue.getJobs(['failed', 'completed']);
      return jobs;
    } catch (error) {
      console.error('Failed to get dead letter queue:', error);
      return [];
    }
  }

  /**
   * Move failed job to dead letter queue
   */
  async moveToDeadLetter(job<JobData>, reason)<void> {
    const deadLetterQueue = this.queues.get(QueueManager.QUEUES.DEAD_LETTER);
    if (!deadLetterQueue) {
      console.error('Dead letter queue not found');
      return;
    }

    try {
      await deadLetterQueue.add('dead-letter-job', job.data, {
        attempts: 1,
        removeOnComplete,
        removeOnFail});
      
      console.log(`📦 Job ${job.id} moved to dead letter queue. Reason: ${reason}`);
    } catch (error) {
      console.error('Failed to move job to dead letter queue:', error);
    }
  }

  /**
   * Retry a failed job
   */
  async retryJob(queueName, jobId)<boolean> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      return false;
    }

    try {
      const job = await queue.getJob(jobId);
      if (job && await job.isFailed()) {
        await job.retry();
        console.log(`🔄 Job ${jobId} retried from ${queueName}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`Failed to retry job ${jobId}:`, error);
      return false;
    }
  }

  /**
   * Pause a queue
   */
  async pauseQueue(queueName)<boolean> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      return false;
    }

    try {
      await queue.pause();
      console.log(`⏸️ Queue ${queueName} paused`);
      return true;
    } catch (error) {
      console.error(`Failed to pause queue ${queueName}:`, error);
      return false;
    }
  }

  /**
   * Resume a queue
   */
  async resumeQueue(queueName)<boolean> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      return false;
    }

    try {
      await queue.resume();
      console.log(`▶️ Queue ${queueName} resumed`);
      return true;
    } catch (error) {
      console.error(`Failed to resume queue ${queueName}:`, error);
      return false;
    }
  }

  /**
   * Clean old jobs from a queue
   */
  async cleanQueue(queueName, age= 3600)<number> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      return 0;
    }

    try {
      const cleaned = await queue.clean(age * 1000, 1000, 'completed');
      console.log(`🧹 Cleaned ${cleaned.length} jobs from ${queueName}`);
      return cleaned.length;
    } catch (error) {
      console.error(`Failed to clean queue ${queueName}:`, error);
      return 0;
    }
  }

  /**
   * Get queue metrics for monitoring
   */
  async getQueueMetrics(queueName)<any> {
    const status = await this.getQueueStatus(queueName);
    if (!status) {
      return null;
    }

    return {
      ...status,
      utilization.depth > 0 ? (status.active / (status.active + status.waiting)) * 100 : 0,
      health.failed > 100 ? 'Degraded' .depth > 1000 ? 'Warning' : 'Healthy'
    };
  }

  /**
   * Get all queue metrics
   */
  async getAllQueueMetrics()<Record<string, any>> {
    const metrics= {};

    for (const [name] of this.queues) {
      const metric = await this.getQueueMetrics(name);
      if (metric) {
        metrics[name] = metric;
      }
    }

    return metrics;
  }

  /**
   * Shutdown all queues and workers
   */
  async shutdown()<void> {
    console.log('🔄 Shutting down QueueManager...');

    // Close all workers
    for (const [name, worker] of this.workers) {
      await worker.close();
      console.log(`Worker closed for ${name}`);
    }

    // Close all queues
    for (const [name, queue] of this.queues) {
      await queue.close();
      console.log(`Queue closed for ${name}`);
    }

    // Close Redis connection
    await this.redisConnection.quit();
    console.log('✅ Redis connection closed');

    this.isInitialized = false;
    console.log('✅ QueueManager shutdown complete');
  }

  /**
   * Check if QueueManager is healthy
   */
  isHealthy(){
    return this.isInitialized && this.redisConnection.status === 'ready';
  }
}

/**
 * Export singleton instance
 */
let queueManagerInstance| null = null;

export function getQueueManager(config?){
  if (!queueManagerInstance) {
    if (!config) {
      throw new Error('QueueConfig required for initializing QueueManager');
    }
    queueManagerInstance = new QueueManager(config);
  }
  return queueManagerInstance;
}



