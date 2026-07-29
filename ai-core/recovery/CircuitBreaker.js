// D:\hospital backend\ai-core\recovery\CircuitBreaker.ts

export interface CircuitBreakerConfig {
  failureThreshold: number;      // Number of failures before opening circuit
  timeout: number;               // Time in ms to wait before attempting again
  resetTimeout: number;          // Time in ms to wait before trying half-open
  successThreshold?: number;     // Number of successes needed to close circuit
}

export enum CircuitBreakerState {
  CLOSED = 'CLOSED',        // Normal operation - requests flow through
  OPEN = 'OPEN',            // Circuit is open - requests fail fast
  HALF_OPEN = 'HALF_OPEN'   // Testing if service is recovered
}

export interface CircuitBreakerStatus {
  state: CircuitBreakerState;
  failureCount: number;
  successCount: number;
  lastFailure: Date | null;
  lastSuccess: Date | null;
  openSince: Date | null;
  totalFailures: number;
  totalSuccesses: number;
}

export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailure: Date | null = null;
  private lastSuccess: Date | null = null;
  private openSince: Date | null = null;
  private totalFailures: number = 0;
  private totalSuccesses: number = 0;

  private config: CircuitBreakerConfig;
  private resetTimer: NodeJS.Timeout | null = null;

  constructor(config: CircuitBreakerConfig) {
    this.config = {
      failureThreshold: config.failureThreshold || 5,
      timeout: config.timeout || 60000,
      resetTimeout: config.resetTimeout || 30000,
      successThreshold: config.successThreshold || 3
    };
  }

  /**
   * Check if circuit allows request to pass through
   */
  isOpen(): boolean {
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
  recordSuccess(): void {
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
  recordFailure(): void {
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
  private transitionToOpen(): void {
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
  private transitionToHalfOpen(): void {
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
  private transitionToClosed(): void {
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
  private clearResetTimer(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
  }

  /**
   * Get current circuit status
   */
  getStatus(): CircuitBreakerStatus {
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

  /**
   * Force circuit to closed state
   */
  forceClosed(): void {
    this.transitionToClosed();
    console.log('🔌 Circuit FORCED CLOSED');
  }

  /**
   * Force circuit to open state
   */
  forceOpen(): void {
    this.transitionToOpen();
    console.log('🔌 Circuit FORCED OPEN');
  }

  /**
   * Reset circuit completely
   */
  reset(): void {
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
  getFailureRate(): number {
    const total = this.totalFailures + this.totalSuccesses;
    if (total === 0) return 0;
    return (this.totalFailures / total) * 100;
  }

  /**
   * Get circuit health
   */
  getHealth(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    failureRate: number;
    state: CircuitBreakerState;
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
      state: this.state
    };
  }
}

/**
 * Circuit Breaker Factory
 */
export class CircuitBreakerFactory {
  private static instances: Map<string, CircuitBreaker> = new Map();

  static getInstance(
    name: string,
    config?: CircuitBreakerConfig
  ): CircuitBreaker {
    if (!this.instances.has(name)) {
      const defaultConfig: CircuitBreakerConfig = {
        failureThreshold: 5,
        timeout: 60000,
        resetTimeout: 30000,
        successThreshold: 3
      };
      this.instances.set(name, new CircuitBreaker(config || defaultConfig));
    }
    return this.instances.get(name)!;
  }

  static getAllInstances(): Map<string, CircuitBreaker> {
    return this.instances;
  }

  static resetAll(): void {
    for (const [name, breaker] of this.instances) {
      breaker.reset();
      console.log(`🔄 Circuit ${name} reset`);
    }
  }
}