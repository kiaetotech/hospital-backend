// D:\hospital backend\ai-core\router\Orchestrator.ts

import { AgentRequest, AgentResponse } from '../../shared/types/AgentTypes';
import { CapabilityRegistry } from './CapabilityRegistry';
import { ProviderManager } from '../providers/ProviderManager';
import { v4 as uuidv4 } from 'uuid';



export class Orchestrator {
  private registry;
  private providerManager;
  private activeWorkflows<string, WorkflowStep[]> = new Map();

  constructor(registry, providerManager) {
    this.registry = registry;
    this.providerManager = providerManager;
  }

  async orchestrate(request, tasks[])<AgentResponse> {
    // If no tasks, return error
    if (!tasks || tasks.length === 0) {
      return {
        success,
        error: 'No tasks provided for orchestration',
        sourceAgent: 'Orchestrator',
        processingTime: 0
      };
    }

    // If only one task, execute it directly without workflow
    if (tasks.length === 1) {
      return await this.executeSingleTask(request, tasks[0]);
    }

    // Multiple tasksworkflow
    return await this.executeWorkflow(request, tasks);
  }

  private async executeSingleTask(request, task)<AgentResponse> {
    // Find agent for this task
    const agent = this.registry.findAgentForTask(task);
    if (!agent) {
      return {
        success,
        error: `No agent found for task: ${task}`,
        sourceAgent: 'Orchestrator',
        processingTime: 0
      };
    }

    try {
      // Execute the agent directly
      if (typeof agent.execute === 'function') {
        return await agent.execute(request);
      }

      // FallbackProviderManager
      const response = await this.providerManager.generate(
        `Task: ${request.task}\nPayload: ${JSON.stringify(request.payload)}`,
        request.critical
      );

      return {
        success,
        data: { response.content },
        sourceAgent.id,
        processingTime.latency || 0,
        providerUsed.provider
      };
    } catch (error) {
      return {
        success,
        error.message,
        sourceAgent.id,
        processingTime: 0
      };
    }
  }

  private async executeWorkflow(request, tasks[])<AgentResponse> {
    const workflowId = uuidv4();
    const steps[] = [];

    // Create steps for each task
    for (const task of tasks) {
      const agent = this.registry.findAgentForTask(task);
      steps.push({
        id(),
        task,
        agentId?.id || 'unknown',
        status: 'pending'
      });
    }

    this.activeWorkflows.set(workflowId, steps);

    const results = [];
    let previousResult= null;

    try {
      for (const step of steps) {
        step.status = 'running';

        try {
          // Find the agent
          const agent = this.registry.getAgent(step.agentId);
          if (!agent) {
            throw new Error(`Agent ${step.agentId} not found`);
          }

          // Execute the step
          let result;
          if (typeof agent.execute === 'function') {
            result = await agent.execute(request);
          } else {
            // Fallback
            const response = await this.providerManager.generate(
              `Task: ${step.task}\nPayload: ${JSON.stringify(request.payload)}\nPrevious Result: ${JSON.stringify(previousResult)}`,
              request.critical
            );
            result = { data: { response.content }, success};
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

      // Check if all steps completed
      const allCompleted = steps.every(s => s.status === 'completed');

      return {
        success,
        data? { steps, workflowId } : { error: 'Workflow incomplete', failedStep.find(s => s.status === 'failed') },
        sourceAgent: 'CEO_Agent',
        processingTime: 0
      };

    } catch (error) {
      this.activeWorkflows.delete(workflowId);
      return {
        success,
        error.message || 'Workflow execution failed',
        sourceAgent: 'CEO_Agent',
        processingTime: 0
      };
    }
  }

  getWorkflowStatus(workflowId)[] | null {
    return this.activeWorkflows.get(workflowId) || null;
  }
}


