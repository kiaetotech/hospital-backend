"use strict";
// D:\hospital backend\ai-core\recovery\RetryPolicy.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.RetryPolicies = exports.RetryPolicy = void 0;
exports.withRetry = withRetry;
exports.Retryable = Retryable;
class RetryPolicy {
    constructor(config) {
        this.attemptCount = 0;
        this.errors = [];
        this.config = config;
    }
    /**
     * Execute a function with retry logic
     */
    async execute(fn) {
        this.attemptCount = 0;
        this.errors = [];
        while (this.attemptCount < this.config.maxAttempts) {
            try {
                const result = await fn();
                this.onSuccess();
                return result;
            }
            catch (error) {
                const err = error;
                this.errors.push(err);
                // Check if we should retry
                if (!this.shouldRetry(err)) {
                    this.onFailure(err);
                    throw err;
                }
                // Check if max attempts reached
                if (this.attemptCount >= this.config.maxAttempts - 1) {
                    const finalError = new Error(`Max retry attempts (${this.config.maxAttempts}) exceeded. Last error: ${err.message}`);
                    finalError.stack = err.stack;
                    this.onFailure(finalError);
                    throw finalError;
                }
                // Calculate delay
                const delay = this.calculateDelay();
                this.onRetry(delay, err);
                // Wait before next attempt
                await this.sleep(delay);
            }
        }
        throw new Error('Retry policy execution completed without result');
    }
    /**
     * Calculate delay based on backoff strategy
     */
    calculateDelay() {
        const attempt = this.attemptCount + 1;
        let delay;
        switch (this.config.backoffStrategy) {
            case 'fixed':
                delay = this.config.initialDelay;
                break;
            case 'exponential':
                delay = this.config.initialDelay * Math.pow(2, attempt - 1);
                break;
            case 'linear':
                delay = this.config.initialDelay * attempt;
                break;
            case 'jitter':
                const baseDelay = this.config.initialDelay * Math.pow(2, attempt - 1);
                const jitter = baseDelay * 0.2 * (Math.random() - 0.5);
                delay = baseDelay + jitter;
                break;
            default:
                delay = this.config.initialDelay;
        }
        // Cap at maxDelay
        return Math.min(delay, this.config.maxDelay);
    }
    /**
     * Check if we should retry based on error
     */
    shouldRetry(error) {
        return this.config.retryOn(error);
    }
    /**
     * Sleep for the specified duration
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * Called on retry attempt
     */
    onRetry(delay, error) {
        this.attemptCount++;
        if (this.config.onRetry) {
            this.config.onRetry(this.attemptCount, delay, error);
        }
        console.log(`🔄 Retry attempt ${this.attemptCount}/${this.config.maxAttempts} after ${delay}ms`);
    }
    /**
     * Called on success
     */
    onSuccess() {
        if (this.config.onSuccess) {
            this.config.onSuccess(this.attemptCount);
        }
        console.log(`✅ Operation succeeded after ${this.attemptCount} attempts`);
    }
    /**
     * Called on final failure
     */
    onFailure(error) {
        if (this.config.onFailure) {
            this.config.onFailure(error, this.attemptCount);
        }
        console.error(`❌ Operation failed after ${this.attemptCount} attempts: ${error.message}`);
    }
    /**
     * Get retry statistics
     */
    getStats() {
        return {
            attempts: this.attemptCount,
            errors: this.errors,
            successRate: this.errors.length === 0 ? 100 : (this.attemptCount - this.errors.length) / this.attemptCount * 100
        };
    }
    /**
     * Reset retry state
     */
    reset() {
        this.attemptCount = 0;
        this.errors = [];
    }
}
exports.RetryPolicy = RetryPolicy;
/**
 * Predefined retry policies
 */
class RetryPolicies {
    /**
     * Default retry policy - exponential backoff
     */
    static default() {
        return new RetryPolicy({
            maxAttempts: 3,
            initialDelay: 1000,
            backoffStrategy: 'exponential',
            maxDelay: 30000,
            retryOn: (error) => {
                // Retry on network errors and 5xx status codes
                const isNetworkError = error.message.includes('network') ||
                    error.message.includes('timeout') ||
                    error.message.includes('ECONNREFUSED') ||
                    error.message.includes('ECONNRESET');
                const isServerError = error.message.includes('500') ||
                    error.message.includes('502') ||
                    error.message.includes('503') ||
                    error.message.includes('504');
                return isNetworkError || isServerError;
            }
        });
    }
    /**
     * Aggressive retry policy - for critical operations
     */
    static aggressive() {
        return new RetryPolicy({
            maxAttempts: 5,
            initialDelay: 500,
            backoffStrategy: 'exponential',
            maxDelay: 60000,
            retryOn: (error) => {
                // Retry on almost any error
                return true;
            }
        });
    }
    /**
     * Conservative retry policy - for non-critical operations
     */
    static conservative() {
        return new RetryPolicy({
            maxAttempts: 2,
            initialDelay: 2000,
            backoffStrategy: 'fixed',
            maxDelay: 10000,
            retryOn: (error) => {
                // Retry only on timeout errors
                return error.message.includes('timeout') || error.message.includes('ECONNREFUSED');
            }
        });
    }
    /**
     * No retry policy
     */
    static none() {
        return new RetryPolicy({
            maxAttempts: 1,
            initialDelay: 0,
            backoffStrategy: 'fixed',
            maxDelay: 0,
            retryOn: () => false
        });
    }
    /**
     * Custom retry policy with options
     */
    static custom(options) {
        return new RetryPolicy({
            maxAttempts: options.attempts || 3,
            initialDelay: options.initialDelay || 1000,
            backoffStrategy: options.backoff || 'exponential',
            maxDelay: options.maxDelay || 30000,
            retryOn: options.retryOn || ((error) => {
                return error.message.includes('timeout') || error.message.includes('network');
            })
        });
    }
}
exports.RetryPolicies = RetryPolicies;
/**
 * Retryable function wrapper
 */
async function withRetry(fn, policy) {
    const retryPolicy = policy || RetryPolicies.default();
    return await retryPolicy.execute(fn);
}
/**
 * Retry decorator for class methods
 */
function Retryable(policy) {
    return function (target, propertyKey, descriptor) {
        const originalMethod = descriptor.value;
        descriptor.value = async function (...args) {
            const retryPolicy = policy || RetryPolicies.default();
            return await retryPolicy.execute(() => originalMethod.apply(this, args));
        };
        return descriptor;
    };
}
