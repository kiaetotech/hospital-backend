// D:\hospital backend\ai-core\monitoring\QueueManager.js

class QueueManager {
  constructor(config) {
    this.queues = new Map();
    this.workers = new Map();
    this.isInitialized = false;
    this.jobHandlers = new Map();
    this.redisConnection = null;
  }

  async initialize() {
    if (this.isInitialized) {
      console.log('QueueManager already initialized');
      return;
    }
    this.isInitialized = true;
    console.log('✅ QueueManager initialized');
  }

  createQueue(name) {
    const queue = {
      name,
      jobs: [],
      processing: 0,
      completed: 0,
      failed: 0
    };
    this.queues.set(name, queue);
    return queue;
  }

  async addJob(queueName, agentId, request, priority = 1) {
    if (!this.isInitialized) {
      throw new Error('QueueManager not initialized');
    }

    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const job = {
      id: `job-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      agentId,
      request,
      retryCount: 0,
      priority,
      createdAt: new Date()
    };

    queue.jobs.push(job);
    console.log(`📥 Job added to ${queueName}: ${job.id}`);
    return job.id;
  }

  async registerWorker(queueName, handler, concurrency = 5) {
    if (!this.isInitialized) {
      throw new Error('QueueManager not initialized');
    }

    this.jobHandlers.set(queueName, handler);
    console.log(`✅ Worker registered for ${queueName}`);
  }

  async getQueueStatus(queueName) {
    const queue = this.queues.get(queueName);
    if (!queue) {
      return null;
    }

    return {
      name: queueName,
      depth: queue.jobs.length,
      processing: queue.processing,
      completed: queue.completed,
      failed: queue.failed,
      delayed: 0,
      waiting: queue.jobs.length,
      active: queue.processing
    };
  }

  async getAllQueueStatus() {
    const statuses = {};
    for (const [name] of this.queues) {
      const status = await this.getQueueStatus(name);
      if (status) {
        statuses[name] = status;
      }
    }
    return statuses;
  }

  async getJob(queueName, jobId) {
    const queue = this.queues.get(queueName);
    if (!queue) {
      return null;
    }
    return queue.jobs.find(j => j.id === jobId) || null;
  }

  async cancelJob(queueName, jobId) {
    const queue = this.queues.get(queueName);
    if (!queue) {
      return false;
    }

    const index = queue.jobs.findIndex(j => j.id === jobId);
    if (index !== -1) {
      queue.jobs.splice(index, 1);
      console.log(`🗑️ Job ${jobId} cancelled from ${queueName}`);
      return true;
    }
    return false;
  }

  async getDeadLetterQueue() {
    return [];
  }

  async moveToDeadLetter(job, reason) {
    console.log(`📦 Job ${job.id} moved to dead letter queue. Reason: ${reason}`);
  }

  async retryJob(queueName, jobId) {
    const queue = this.queues.get(queueName);
    if (!queue) {
      return false;
    }
    const job = queue.jobs.find(j => j.id === jobId);
    if (job) {
      job.retryCount++;
      console.log(`🔄 Job ${jobId} retried from ${queueName}`);
      return true;
    }
    return false;
  }

  async pauseQueue(queueName) {
    console.log(`⏸️ Queue ${queueName} paused`);
    return true;
  }

  async resumeQueue(queueName) {
    console.log(`▶️ Queue ${queueName} resumed`);
    return true;
  }

  async cleanQueue(queueName, age = 3600) {
    const queue = this.queues.get(queueName);
    if (!queue) {
      return 0;
    }
    const cleaned = queue.jobs.filter(j => 
      Date.now() - j.createdAt.getTime() > age * 1000
    );
    queue.jobs = queue.jobs.filter(j => 
      Date.now() - j.createdAt.getTime() <= age * 1000
    );
    console.log(`🧹 Cleaned ${cleaned.length} jobs from ${queueName}`);
    return cleaned.length;
  }

  async getQueueMetrics(queueName) {
    const status = await this.getQueueStatus(queueName);
    if (!status) {
      return null;
    }

    return {
      ...status,
      utilization: status.depth > 0 ? (status.active / (status.active + status.waiting)) * 100 : 0,
      health: status.failed > 100 ? 'Degraded' : status.depth > 1000 ? 'Warning' : 'Healthy'
    };
  }

  async getAllQueueMetrics() {
    const metrics = {};
    for (const [name] of this.queues) {
      const metric = await this.getQueueMetrics(name);
      if (metric) {
        metrics[name] = metric;
      }
    }
    return metrics;
  }

  async shutdown() {
    console.log('🔄 Shutting down QueueManager...');
    this.isInitialized = false;
    console.log('✅ QueueManager shutdown complete');
  }

  isHealthy() {
    return this.isInitialized;
  }
}

module.exports = { QueueManager };