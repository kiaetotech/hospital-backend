// D:\hospital backend\ai-core\router\Orchestrator.js

const crypto = require('crypto');

class Orchestrator {
  constructor(registry, providerManager) {
    this.registry = registry;
    this.providerManager = providerManager;
    this.activeWorkflows = new Map();
  }

  async orchestrate(request, tasks) {
    if (!tasks || tasks.length === 0) {
      return {
        success: false,
        error: 'No tasks provided for orchestration',
        sourceAgent: 'Orchestrator',
        processingTime: 0
      };
    }

    if (tasks.length === 1) {
      return await this.executeSingleTask(request, tasks[0]);
    }

    return await this.executeWorkflow(request, tasks);
  }

  async executeSingleTask(request, task) {
    const agent = this.registry.findAgentForTask(task);
    if (!agent) {
      return {
        success: false,
        error: `No agent found for task: ${task}`,
        sourceAgent: 'Orchestrator',
        processingTime: 0
      };
    }

    try {
      if (typeof agent.execute === 'function') {
        return await agent.execute(request);
      }

      const response = await this.providerManager.generate(
        `Task: ${request.task}\nPayload: ${JSON.stringify(request.payload)}`,
        request.critical
      );

      return {
        success: true,
        data: { response: response.content },
        sourceAgent: agent.id,
        processingTime: response.latency || 0,
        providerUsed: response.provider
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        sourceAgent: agent.id,
        processingTime: 0
      };
    }
  }

  async executeWorkflow(request, tasks) {
    const workflowId = crypto.randomUUID();
    const steps = [];

    for (const task of tasks) {
      const agent = this.registry.findAgentForTask(task);
      steps.push({
        id: crypto.randomUUID(),
        task,
        agentId: agent?.id || 'unknown',
        status: 'pending'
      });
    }

    this.activeWorkflows.set(workflowId, steps);

    const results = [];
    let previousResult = null;

    try {
      for (const step of steps) {
        step.status = 'running';

        try {
          const agent = this.registry.getAgent(step.agentId);
          if (!agent) {
            throw new Error(`Agent ${step.agentId} not found`);
          }

          let result;
          if (typeof agent.execute === 'function') {
            result = await agent.execute(request);
          } else {
            const response = await this.providerManager.generate(
              `Task: ${step.task}\nPayload: ${JSON.stringify(request.payload)}\nPrevious Result: ${JSON.stringify(previousResult)}`,
              request.critical
            );
            result = { data: { response: response.content }, success: true };
          }

          step.status = 'completed';
          step.result = result;
          results.push(result);
          previousResult = result;

        } catch (error) {
          step.status = 'failed';
          step.error = error.message;
          break;
        }
      }

      this.activeWorkflows.delete(workflowId);

      const allCompleted = steps.every(s => s.status === 'completed');

      return {
        success: allCompleted,
        data: allCompleted ? { steps: results, workflowId } : { error: 'Workflow incomplete', failedStep: steps.find(s => s.status === 'failed') },
        sourceAgent: 'CEO_Agent',
        processingTime: 0
      };

    } catch (error) {
      this.activeWorkflows.delete(workflowId);
      return {
        success: false,
        error: error.message || 'Workflow execution failed',
        sourceAgent: 'CEO_Agent',
        processingTime: 0
      };
    }
  }

  getWorkflowStatus(workflowId) {
    return this.activeWorkflows.get(workflowId) || null;
  }
}

module.exports = { Orchestrator };