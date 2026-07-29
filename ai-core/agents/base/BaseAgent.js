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

export 

export abstract class BaseAgent {
  public id;
  public name;
  public role;
  public status;
  public capabilities[];
  public metadata;
  public lastActive;
  public currentTask?;

  protected providerManager;

  constructor(config, providerManager) {
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
  abstract execute(request)<AgentResponse>;

  /**
   * Get agent registration for capability registry
   */
  getRegistration(){
    return {
      id.id,
      name.name,
      role.role,
      status.status,
      capabilities.capabilities,
      currentTask.currentTask,
      lastActive.lastActive,
      metadata.metadata
    };
  }

  /**
   * Update agent status
   */
  setStatus(status){
    this.status = status;
    this.lastActive = new Date();
  }

  /**
   * Set current task
   */
  setCurrentTask(task?){
    this.currentTask = task;
    this.lastActive = new Date();
  }

  /**
   * Check if agent has a specific capability
   */
  hasCapability(capabilityName){
    return this.capabilities.some(c => c.name === capabilityName);
  }

  /**
   * Get capability by name
   */
  getCapability(capabilityName)| undefined {
    return this.capabilities.find(c => c.name === capabilityName);
  }

  /**
   * Validate request before execution
   */
  protected validateRequest(request){
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
  protected getRequiredCapability(task)| null {
    // Default implementation - can be overridden
    return null;
  }

  /**
   * Handle errors gracefully
   */
  protected handleError(error, request){
    console.error(`[${this.name}] Error:`, error.message);
    
    return {
      success,
      error.message,
      sourceAgent.id,
      processingTime: 0
    };
  }

  /**
   * Log agent activity
   */
  protected log(message, level: 'info' | 'warn' | 'error' = 'info'){
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${this.name}] [${level.toUpperCase()}] ${message}`);
  }

  /**
   * Update metadata
   */
  updateMetadata(key, value){
    this.metadata[key] = value;
  }

  /**
   * Get metadata
   */
  getMetadata<T>(key)| undefined {
    return this.metadata[key] as T;
  }

  /**
   * Get agent health status
   */
  getHealthStatus(): {
    status;
    lastActive;
    capabilities[];
    currentTask?;
    metadata;
  } {
    return {
      status.status,
      lastActive.lastActive,
      capabilities.capabilities.map(c => c.name),
      currentTask.currentTask,
      metadata.metadata
    };
  }

  /**
   * Check if agent is healthy
   */
  isHealthy(){
    // Check if agent is online or busy
    return this.status === AgentStatus.ONLINE || this.status === AgentStatus.BUSY;
  }

  /**
   * Reset agent state
   */
  reset(){
    this.status = AgentStatus.IDLE;
    this.currentTask = undefined;
    this.lastActive = new Date();
  }
}


