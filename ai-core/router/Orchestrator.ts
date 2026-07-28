// D:\hospital backend\ai-core\router\Orchestrator.ts

import { AgentRequest, AgentResponse } from '../../shared/types/AgentTypes';
import { CapabilityRegistry } from './CapabilityRegistry';
import { ProviderManager } from '../providers/ProviderManager';
import { v4 as uuidv4 } from 'uuid';

interface WorkflowStep {
  id: string;
  task: string;
  agentId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
  error?: string;
}

export class Orchestrator {
  private registry: CapabilityRegistry;
  private providerManager: ProviderManager;
  private activeWorkflows: Map<string, WorkflowStep[]> = new Map();

  constructor(registry: CapabilityRegistry, providerManager: ProviderManager) {
    this.registry = registry;
    this.providerManager = providerManager;
  }

  async orchestrate(request: AgentRequest, tasks: string[]): Promise<AgentResponse> {
    // If no tasks, return error
    if (!tasks || tasks.length === 0) {
      return {
        success: false,
        error: 'No tasks provided for orchestration',
        sourceAgent: 'Orchestrator',
        processingTime: 0
      };
    }

    // If only one task, execute it directly without workflow
    if (tasks.length === 1) {
      return await this.executeSingleTask(request, tasks[0]);
    }

    // Multiple tasks: Execute workflow
    return await this.executeWorkflow(request, tasks);
  }

  private async executeSingleTask(request: AgentRequest, task: string): Promise<AgentResponse> {
    // Find agent for this task
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
      // Execute the agent directly
      if (typeof agent.execute === 'function') {
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

  private async executeWorkflow(request: AgentRequest, tasks: string[]): Promise<AgentResponse> {
    const workflowId = uuidv4();
    const steps: WorkflowStep[] = [];

    // Create steps for each task
    for (const task of tasks) {
      const agent = this.registry.findAgentForTask(task);
      steps.push({
        id: uuidv4(),
        task,
        agentId: agent?.id || 'unknown',
        status: 'pending'
      });
    }

    this.activeWorkflows.set(workflowId, steps);

    const results = [];
    let previousResult: any = null;

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

      // Check if all steps completed
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

  getWorkflowStatus(workflowId: string): WorkflowStep[] | null {
    return this.activeWorkflows.get(workflowId) || null;
  }
}