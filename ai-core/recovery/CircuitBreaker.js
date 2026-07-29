// D:\hospital backend\ai-core\recovery\CircuitBreaker.ts

export 

export enum CircuitBreakerState {
  CLOSED = 'CLOSED',        // Normal operation - requests flow through
  OPEN = 'OPEN',            // Circuit is open - requests fail fast
  HALF_OPEN = 'HALF_OPEN'   // Testing if service is recovered
}

export 

export class CircuitBreaker {
  private state= CircuitBreakerState.CLOSED;
  private failureCount= 0;
  private successCount= 0;
  private lastFailure| null = null;
  private lastSuccess| null = null;
  private openSince| null = null;
  private totalFailures= 0;
  private totalSuccesses= 0;

  private config;
  private resetTimer.Timeout | null = null;

  constructor(config) {
    this.config = {
      failureThreshold.failureThreshold || 5,
      timeout.timeout || 60000,
      resetTimeout.resetTimeout || 30000,
      successThreshold.successThreshold || 3
    };
  }

  /**
   * Check if circuit allows request to pass through
   */
  isOpen(){
    if (this.state === CircuitBreakerState.OPEN) {
      // Check if timeout has elapsed
      if (this.openSince && (Date.now() - this.openSince.getTime() > this.config.timeout)) {
        // Transition to half-open
        this.transitionToHalfOpen();
        return false;
      }
      return true;
    }
    return false;
  }

  /**
   * Record a successful request
   */
  recordSuccess(){
    this.totalSuccesses++;
    this.lastSuccess = new Date();

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= (this.config.successThreshold || 3)) {
        this.transitionToClosed();
      }
    } else if (this.state === CircuitBreakerState.CLOSED) {
      // Reset failure count on success
      this.failureCount = 0;
    }
  }

  /**
   * Record a failed request
   */
  recordFailure(){
    this.totalFailures++;
    this.lastFailure = new Date();

    if (this.state === CircuitBreakerState.CLOSED) {
      this.failureCount++;
      if (this.failureCount >= this.config.failureThreshold) {
        this.transitionToOpen();
      }
    } else if (this.state === CircuitBreakerState.HALF_OPEN) {
      // Failure in half-open state → go back to open
      this.transitionToOpen();
    }
  }

  /**
   * Transition to OPEN state
   */
  private transitionToOpen(){
    this.state = CircuitBreakerState.OPEN;
    this.openSince = new Date();
    this.failureCount = 0;
    this.successCount = 0;

    // Clear any existing timer
    this.clearResetTimer();

    // Schedule reset attempt
    this.resetTimer = setTimeout(() => {
      this.transitionToHalfOpen();
    }, this.config.resetTimeout);

    console.log(`🔌 Circuit BREAKER OPEN at ${this.openSince.toISOString()}`);
  }

  /**
   * Transition to HALF_OPEN state
   */
  private transitionToHalfOpen(){
    this.state = CircuitBreakerState.HALF_OPEN;
    this.successCount = 0;
    this.failureCount = 0;
    this.openSince = null;

    this.clearResetTimer();

    console.log(`🔌 Circuit HALF_OPEN at ${new Date().toISOString()}`);
  }

  /**
   * Transition to CLOSED state
   */
  private transitionToClosed(){
    this.state = CircuitBreakerState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.openSince = null;

    this.clearResetTimer();

    console.log(`🔌 Circuit CLOSED at ${new Date().toISOString()}`);
  }

  /**
   * Clear reset timer
   */
  private clearResetTimer(){
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
  }

  /**
   * Get current circuit status
   */
  getStatus(){
    return {
      state.state,
      failureCount.failureCount,
      successCount.successCount,
      lastFailure.lastFailure,
      lastSuccess.lastSuccess,
      openSince.openSince,
      totalFailures.totalFailures,
      totalSuccesses.totalSuccesses
    };
  }

  /**
   * Force circuit to closed state
   */
  forceClosed(){
    this.transitionToClosed();
    console.log('🔌 Circuit FORCED CLOSED');
  }

  /**
   * Force circuit to open state
   */
  forceOpen(){
    this.transitionToOpen();
    console.log('🔌 Circuit FORCED OPEN');
  }

  /**
   * Reset circuit completely
   */
  reset(){
    this.state = CircuitBreakerState.CLOSED;
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

  /**
   * Get failure rate
   */
  getFailureRate(){
    const total = this.totalFailures + this.totalSuccesses;
    if (total === 0) return 0;
    return (this.totalFailures / total) * 100;
  }

  /**
   * Get circuit health
   */
  getHealth(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    failureRate;
    state;
  } {
    const failureRate = this.getFailureRate();
    let status: 'healthy' | 'degraded' | 'unhealthy';

    if (this.state === CircuitBreakerState.OPEN) {
      status = 'unhealthy';
    } else if (failureRate > 20) {
      status = 'degraded';
    } else {
      status = 'healthy';
    }

    return {
      status,
      failureRate,
      state.state
    };
  }
}

/**
 * Circuit Breaker Factory
 */
export class CircuitBreakerFactory {
  private static instances<string, CircuitBreaker> = new Map();

  static getInstance(
    name,
    config?){
    if (!this.instances.has(name)) {
      const defaultConfig= {
        failureThreshold: 5,
        timeout: 60000,
        resetTimeout: 30000,
        successThreshold: 3
      };
      this.instances.set(name, new CircuitBreaker(config || defaultConfig));
    }
    return this.instances.get(name)!;
  }

  static getAllInstances()<string, CircuitBreaker> {
    return this.instances;
  }

  static resetAll(){
    for (const [name, breaker] of this.instances) {
      breaker.reset();
      console.log(`🔄 Circuit ${name} reset`);
    }
  }
}



