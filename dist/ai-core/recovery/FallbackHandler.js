"use strict";
// D:\hospital backend\ai-core\recovery\FallbackHandler.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.FallbackResponses = exports.GracefulDegradation = exports.FallbackFactory = exports.FallbackHandler = exports.FallbackLevel = void 0;
exports.executeWithFallback = executeWithFallback;
var FallbackLevel;
(function (FallbackLevel) {
    FallbackLevel["NONE"] = "none";
    FallbackLevel["PRIMARY"] = "primary";
    FallbackLevel["SECONDARY"] = "secondary";
    FallbackLevel["TERTIARY"] = "tertiary";
})(FallbackLevel || (exports.FallbackLevel = FallbackLevel = {}));
class FallbackHandler {
    constructor(chain) {
        this.chain = chain;
        this.timeout = chain.timeout || 30000;
    }
    /**
     * Execute with fallback chain
     */
    async execute() {
        const startTime = Date.now();
        // Try primary
        try {
            const result = await this.executeWithTimeout(this.chain.primary);
            return {
                success: true,
                data: result,
                source: 'primary',
                fallbackUsed: false,
                fallbackLevel: FallbackLevel.NONE,
                timestamp: new Date(),
                latency: Date.now() - startTime
            };
        }
        catch (error) {
            const primaryError = error;
            console.warn(`⚠️ Primary fallback failed: ${primaryError.message}`);
        }
        // Try secondary
        if (this.chain.secondary) {
            try {
                const result = await this.executeWithTimeout(this.chain.secondary);
                return {
                    success: true,
                    data: result,
                    source: 'secondary',
                    fallbackUsed: true,
                    fallbackLevel: FallbackLevel.PRIMARY,
                    timestamp: new Date(),
                    latency: Date.now() - startTime
                };
            }
            catch (error) {
                const secondaryError = error;
                console.warn(`⚠️ Secondary fallback failed: ${secondaryError.message}`);
            }
        }
        // Try tertiary
        if (this.chain.tertiary) {
            try {
                const result = await this.executeWithTimeout(this.chain.tertiary);
                return {
                    success: true,
                    data: result,
                    source: 'tertiary',
                    fallbackUsed: true,
                    fallbackLevel: FallbackLevel.SECONDARY,
                    timestamp: new Date(),
                    latency: Date.now() - startTime
                };
            }
            catch (error) {
                const tertiaryError = error;
                console.warn(`⚠️ Tertiary fallback failed: ${tertiaryError.message}`);
            }
        }
        // All fallbacks failed
        if (this.chain.fallbackValue !== undefined) {
            return {
                success: true,
                data: this.chain.fallbackValue,
                source: 'fallback_value',
                fallbackUsed: true,
                fallbackLevel: FallbackLevel.TERTIARY,
                timestamp: new Date(),
                latency: Date.now() - startTime
            };
        }
        // Return error response
        return {
            success: false,
            error: this.chain.fallbackError || 'All fallbacks failed',
            source: 'fallback_error',
            fallbackUsed: true,
            fallbackLevel: FallbackLevel.TERTIARY,
            timestamp: new Date(),
            latency: Date.now() - startTime
        };
    }
    /**
     * Execute with timeout
     */
    async executeWithTimeout(fn) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(`Operation timed out after ${this.timeout}ms`));
            }, this.timeout);
            fn()
                .then((result) => {
                clearTimeout(timer);
                resolve(result);
            })
                .catch((error) => {
                clearTimeout(timer);
                reject(error);
            });
        });
    }
    /**
     * Execute with additional context
     */
    async executeWithContext(context) {
        const result = await this.execute();
        return {
            ...result,
            context
        };
    }
    /**
     * Get fallback chain status
     */
    getStatus() {
        return {
            hasPrimary: !!this.chain.primary,
            hasSecondary: !!this.chain.secondary,
            hasTertiary: !!this.chain.tertiary,
            hasFallbackValue: this.chain.fallbackValue !== undefined,
            timeout: this.timeout
        };
    }
}
exports.FallbackHandler = FallbackHandler;
/**
 * Fallback handler factory
 */
class FallbackFactory {
    /**
     * Create a fallback handler with simple chain
     */
    static create(primary, secondary, fallbackValue, timeout) {
        return new FallbackHandler({
            primary,
            secondary,
            fallbackValue,
            timeout
        });
    }
    /**
     * Create with multiple levels
     */
    static createWithLevels(config) {
        return new FallbackHandler(config);
    }
    /**
     * Create from array of providers
     */
    static createFromProviders(providers, fallbackValue, timeout) {
        const chain = {
            primary: providers[0] || (() => Promise.reject(new Error('No primary provider'))),
            timeout
        };
        if (providers.length > 1) {
            chain.secondary = providers[1];
        }
        if (providers.length > 2) {
            chain.tertiary = providers[2];
        }
        if (fallbackValue !== undefined) {
            chain.fallbackValue = fallbackValue;
        }
        return new FallbackHandler(chain);
    }
}
exports.FallbackFactory = FallbackFactory;
/**
 * Graceful degradation helper
 */
class GracefulDegradation {
    constructor() {
        this.handlers = [];
    }
    /**
     * Add a fallback handler
     */
    addHandler(handler) {
        this.handlers.push(handler);
        return this;
    }
    /**
     * Execute all handlers sequentially until one succeeds
     */
    async executeAll() {
        let lastError = null;
        for (const handler of this.handlers) {
            const result = await handler.execute();
            if (result.success && result.data !== undefined) {
                return result.data;
            }
            if (result.error) {
                lastError = new Error(result.error);
            }
        }
        throw lastError || new Error('All fallback handlers failed');
    }
    /**
     * Execute with cached result
     */
    async executeWithCache(cacheKey, cacheTTL) {
        // Simulate cache check (in production, use Redis or similar)
        // For now, just execute normally
        return await this.executeAll();
    }
}
exports.GracefulDegradation = GracefulDegradation;
/**
 * Fallback response generator for common scenarios
 */
class FallbackResponses {
    /**
     * Generate a graceful degradation response for API errors
     */
    static apiError(message) {
        return {
            success: false,
            error: message || 'Service temporarily unavailable',
            gracefulDegradation: true,
            timestamp: new Date().toISOString(),
            recommendations: [
                'Please try again in a few minutes',
                'You can still use other services on the platform',
                'Contact support if the issue persists'
            ]
        };
    }
    /**
     * Generate a fallback response for AI failures
     */
    static aiFallback() {
        return {
            success: true,
            data: {
                message: 'AI recommendation is temporarily unavailable.',
                fallback: 'You can still search and book services manually.',
                alternatives: [
                    'Browse hospitals by specialty',
                    'Search doctors by name',
                    'View available services'
                ]
            },
            timestamp: new Date().toISOString()
        };
    }
    /**
     * Generate a fallback response for payment failures
     */
    static paymentFallback() {
        return {
            success: false,
            error: 'Payment service is temporarily unavailable',
            fallback: 'Please try again in a few minutes. Your booking is saved.',
            bookingStatus: 'pending',
            timestamp: new Date().toISOString()
        };
    }
    /**
     * Generate a fallback response for search failures
     */
    static searchFallback(query) {
        return {
            success: true,
            data: {
                results: [],
                message: 'Search results are limited right now.',
                query,
                fallback: 'Try refining your search or browse by category.',
                categories: [
                    'Hospitals',
                    'Doctors',
                    'Labs',
                    'Ambulance',
                    'Wellness'
                ]
            },
            timestamp: new Date().toISOString()
        };
    }
}
exports.FallbackResponses = FallbackResponses;
/**
 * Fallback chain executor helper
 */
async function executeWithFallback(chain) {
    const handler = new FallbackHandler(chain);
    return await handler.execute();
}
