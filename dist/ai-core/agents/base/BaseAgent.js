"use strict";
// D:\hospital backend\ai-core\agents\base\BaseAgent.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseAgent = void 0;
const AgentTypes_1 = require("../../../shared/types/AgentTypes");
const uuid_1 = require("uuid");
class BaseAgent {
    constructor(config, providerManager) {
        this.id = config.id || (0, uuid_1.v4)();
        this.name = config.name;
        this.role = config.role;
        this.status = AgentTypes_1.AgentStatus.IDLE;
        this.capabilities = config.capabilities;
        this.metadata = config.metadata || {};
        this.lastActive = new Date();
        this.providerManager = providerManager;
    }
    /**
     * Get agent registration for capability registry
     */
    getRegistration() {
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
    setStatus(status) {
        this.status = status;
        this.lastActive = new Date();
    }
    /**
     * Set current task
     */
    setCurrentTask(task) {
        this.currentTask = task;
        this.lastActive = new Date();
    }
    /**
     * Check if agent has a specific capability
     */
    hasCapability(capabilityName) {
        return this.capabilities.some(c => c.name === capabilityName);
    }
    /**
     * Get capability by name
     */
    getCapability(capabilityName) {
        return this.capabilities.find(c => c.name === capabilityName);
    }
    /**
     * Validate request before execution
     */
    validateRequest(request) {
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
    getRequiredCapability(task) {
        // Default implementation - can be overridden
        return null;
    }
    /**
     * Handle errors gracefully
     */
    handleError(error, request) {
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
    log(message, level = 'info') {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [${this.name}] [${level.toUpperCase()}] ${message}`);
    }
    /**
     * Update metadata
     */
    updateMetadata(key, value) {
        this.metadata[key] = value;
    }
    /**
     * Get metadata
     */
    getMetadata(key) {
        return this.metadata[key];
    }
    /**
     * Get agent health status
     */
    getHealthStatus() {
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
    isHealthy() {
        // Check if agent is online or busy
        return this.status === AgentTypes_1.AgentStatus.ONLINE || this.status === AgentTypes_1.AgentStatus.BUSY;
    }
    /**
     * Reset agent state
     */
    reset() {
        this.status = AgentTypes_1.AgentStatus.IDLE;
        this.currentTask = undefined;
        this.lastActive = new Date();
    }
}
exports.BaseAgent = BaseAgent;
