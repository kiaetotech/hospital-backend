// D:\hospital backend\ai-core\agents\base\BaseAgent.ts

import { 
  AgentRole, 
  AgentStatus, 
  AgentCapability, 
  AgentRegistration,
  AgentRequest,
  AgentResponse 
} from '../../../shared/types/AgentTypes';
import { ProviderManager } from '../../providers/ProviderManager';
import { v4 as uuidv4 } from 'uuid';

export interface AgentConfig {
  id?: string;
  name: string;
  role: AgentRole;
  capabilities: AgentCapability[];
  metadata?: Record<string, any>;
}

export abstract class BaseAgent {
  public id: string;
  public name: string;
  public role: AgentRole;
  public status: AgentStatus;
  public capabilities: AgentCapability[];
  public metadata: Record<string, any>;
  public lastActive: Date;
  public currentTask?: string;

  protected providerManager: ProviderManager;

  constructor(config: AgentConfig, providerManager: ProviderManager) {
    this.id = config.id || uuidv4();
    this.name = config.name;
    this.role = config.role;
    this.status = AgentStatus.IDLE;
    this.capabilities = config.capabilities;
    this.metadata = config.metadata || {};
    this.lastActive = new Date();
    this.providerManager = providerManager;
  }

  /**
   * Main execution method - must be implemented by all agents
   */
  abstract execute(request: AgentRequest): Promise<AgentResponse>;

  /**
   * Get agent registration for capability registry
   */
  getRegistration(): AgentRegistration {
    return {
      id: this.id,
      name: this.name,
      role: this.role,
      status: this.status,
      capabilities: this.capabilities,
      currentTask: this.currentTask,
      lastActive: this.lastActive,
      metadata: this.metadata
    };
  }

  /**
   * Update agent status
   */
  setStatus(status: AgentStatus): void {
    this.status = status;
    this.lastActive = new Date();
  }

  /**
   * Set current task
   */
  setCurrentTask(task?: string): void {
    this.currentTask = task;
    this.lastActive = new Date();
  }

  /**
   * Check if agent has a specific capability
   */
  hasCapability(capabilityName: string): boolean {
    return this.capabilities.some(c => c.name === capabilityName);
  }

  /**
   * Get capability by name
   */
  getCapability(capabilityName: string): AgentCapability | undefined {
    return this.capabilities.find(c => c.name === capabilityName);
  }

  /**
   * Validate request before execution
   */
  protected validateRequest(request: AgentRequest): boolean {
    // Check if request has required fields
    if (!request.task || !request.payload) {
      return false;
    }

    // Check if agent has required capability
    const requiredCapability = this.getRequiredCapability(request.task);
    if (requiredCapability && !this.hasCapability(requiredCapability)) {
      return false;
    }

    return true;
  }

  /**
   * Get required capability for a task
   * Override this in child classes
   */
  protected getRequiredCapability(task: string): string | null {
    // Default implementation - can be overridden
    return null;
  }

  /**
   * Handle errors gracefully
   */
  protected handleError(error: Error, request: AgentRequest): AgentResponse {
    console.error(`[${this.name}] Error:`, error.message);
    
    return {
      success: false,
      error: error.message,
      sourceAgent: this.id,
      processingTime: 0
    };
  }

  /**
   * Log agent activity
   */
  protected log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${this.name}] [${level.toUpperCase()}] ${message}`);
  }

  /**
   * Update metadata
   */
  updateMetadata(key: string, value: any): void {
    this.metadata[key] = value;
  }

  /**
   * Get metadata
   */
  getMetadata<T>(key: string): T | undefined {
    return this.metadata[key] as T;
  }

  /**
   * Get agent health status
   */
  getHealthStatus(): {
    status: AgentStatus;
    lastActive: Date;
    capabilities: string[];
    currentTask?: string;
    metadata: Record<string, any>;
  } {
    return {
      status: this.status,
      lastActive: this.lastActive,
      capabilities: this.capabilities.map(c => c.name),
      currentTask: this.currentTask,
      metadata: this.metadata
    };
  }

  /**
   * Check if agent is healthy
   */
  isHealthy(): boolean {
    // Check if agent is online or busy
    return this.status === AgentStatus.ONLINE || this.status === AgentStatus.BUSY;
  }

  /**
   * Reset agent state
   */
  reset(): void {
    this.status = AgentStatus.IDLE;
    this.currentTask = undefined;
    this.lastActive = new Date();
  }
}