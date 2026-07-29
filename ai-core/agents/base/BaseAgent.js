// D:\hospital backend\ai-core\agents\base\BaseAgent.js

// UUID generator replacement
function generateId() {
  return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
}

class BaseAgent {
  constructor(config, providerManager) {
    this.id = config.id || generateId();
    this.name = config.name;
    this.role = config.role;
    this.status = 'idle';
    this.capabilities = config.capabilities || [];
    this.metadata = config.metadata || {};
    this.lastActive = new Date();
    this.currentTask = null;
    this.providerManager = providerManager;
  }

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

  setStatus(status) {
    this.status = status;
    this.lastActive = new Date();
  }

  setCurrentTask(task) {
    this.currentTask = task;
    this.lastActive = new Date();
  }

  hasCapability(capabilityName) {
    return this.capabilities.some(c => c.name === capabilityName);
  }

  getCapability(capabilityName) {
    return this.capabilities.find(c => c.name === capabilityName);
  }

  validateRequest(request) {
    if (!request.task || !request.payload) {
      return false;
    }
    const requiredCapability = this.getRequiredCapability(request.task);
    if (requiredCapability && !this.hasCapability(requiredCapability)) {
      return false;
    }
    return true;
  }

  getRequiredCapability(task) {
    return null;
  }

  handleError(error, request) {
    console.error(`[${this.name}] Error:`, error.message);
    return {
      success: false,
      error: error.message,
      sourceAgent: this.id,
      processingTime: 0
    };
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${this.name}] [${level.toUpperCase()}] ${message}`);
  }

  updateMetadata(key, value) {
    this.metadata[key] = value;
  }

  getMetadata(key) {
    return this.metadata[key];
  }

  getHealthStatus() {
    return {
      status: this.status,
      lastActive: this.lastActive,
      capabilities: this.capabilities.map(c => c.name),
      currentTask: this.currentTask,
      metadata: this.metadata
    };
  }

  isHealthy() {
    return this.status === 'online' || this.status === 'busy';
  }

  reset() {
    this.status = 'idle';
    this.currentTask = null;
    this.lastActive = new Date();
  }
}

module.exports = { BaseAgent };