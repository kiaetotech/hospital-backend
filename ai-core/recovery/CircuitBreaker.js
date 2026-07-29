// D:\hospital backend\ai-core\recovery\CircuitBreaker.js

class CircuitBreaker {
  constructor(config) {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailure = null;
    this.lastSuccess = null;
    this.openSince = null;
    this.totalFailures = 0;
    this.totalSuccesses = 0;
    this.config = {
      failureThreshold: config?.failureThreshold || 5,
      timeout: config?.timeout || 60000,
      resetTimeout: config?.resetTimeout || 30000,
      successThreshold: config?.successThreshold || 3
    };
    this.resetTimer = null;
  }

  isOpen() {
    if (this.state === 'OPEN') {
      if (this.openSince && (Date.now() - this.openSince.getTime() > this.config.timeout)) {
        this.transitionToHalfOpen();
        return false;
      }
      return true;
    }
    return false;
  }

  recordSuccess() {
    this.totalSuccesses++;
    this.lastSuccess = new Date();

    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.config.successThreshold) {
        this.transitionToClosed();
      }
    } else if (this.state === 'CLOSED') {
      this.failureCount = 0;
    }
  }

  recordFailure() {
    this.totalFailures++;
    this.lastFailure = new Date();

    if (this.state === 'CLOSED') {
      this.failureCount++;
      if (this.failureCount >= this.config.failureThreshold) {
        this.transitionToOpen();
      }
    } else if (this.state === 'HALF_OPEN') {
      this.transitionToOpen();
    }
  }

  transitionToOpen() {
    this.state = 'OPEN';
    this.openSince = new Date();
    this.failureCount = 0;
    this.successCount = 0;
    this.clearResetTimer();
    this.resetTimer = setTimeout(() => {
      this.transitionToHalfOpen();
    }, this.config.resetTimeout);
    console.log(`🔌 Circuit BREAKER OPEN at ${this.openSince.toISOString()}`);
  }

  transitionToHalfOpen() {
    this.state = 'HALF_OPEN';
    this.successCount = 0;
    this.failureCount = 0;
    this.openSince = null;
    this.clearResetTimer();
    console.log(`🔌 Circuit HALF_OPEN at ${new Date().toISOString()}`);
  }

  transitionToClosed() {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.openSince = null;
    this.clearResetTimer();
    console.log(`🔌 Circuit CLOSED at ${new Date().toISOString()}`);
  }

  clearResetTimer() {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
  }

  getStatus() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailure: this.lastFailure,
      lastSuccess: this.lastSuccess,
      openSince: this.openSince,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses
    };
  }

  forceClosed() {
    this.transitionToClosed();
    console.log('🔌 Circuit FORCED CLOSED');
  }

  forceOpen() {
    this.transitionToOpen();
    console.log('🔌 Circuit FORCED OPEN');
  }

  reset() {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailure = null;
    this.lastSuccess = null;
    this.openSince = null;
    this.totalFailures = 0;
    this.totalSuccesses = 0;
    this.clearResetTimer();
    console.log('🔌 Circuit RESET');
  }

  getFailureRate() {
    const total = this.totalFailures + this.totalSuccesses;
    if (total === 0) return 0;
    return (this.totalFailures / total) * 100;
  }

  getHealth() {
    const failureRate = this.getFailureRate();
    let status = 'healthy';
    if (this.state === 'OPEN') {
      status = 'unhealthy';
    } else if (failureRate > 20) {
      status = 'degraded';
    }
    return {
      status,
      failureRate,
      state: this.state
    };
  }
}

class CircuitBreakerFactory {
  static instances = new Map();

  static getInstance(name, config) {
    if (!this.instances.has(name)) {
      const defaultConfig = {
        failureThreshold: 5,
        timeout: 60000,
        resetTimeout: 30000,
        successThreshold: 3
      };
      this.instances.set(name, new CircuitBreaker(config || defaultConfig));
    }
    return this.instances.get(name);
  }

  static getAllInstances() {
    return this.instances;
  }

  static resetAll() {
    for (const [name, breaker] of this.instances) {
      breaker.reset();
      console.log(`🔄 Circuit ${name} reset`);
    }
  }
}

module.exports = { CircuitBreaker, CircuitBreakerFactory };