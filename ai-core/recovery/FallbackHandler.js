// D:\hospital backend\ai-core\recovery\FallbackHandler.js

class FallbackHandler {
  constructor(chain) {
    this.chain = chain;
    this.timeout = chain.timeout || 30000;
  }

  async execute() {
    const startTime = Date.now();

    try {
      const result = await this.executeWithTimeout(this.chain.primary);
      return {
        success: true,
        data: result,
        source: 'primary',
        fallbackUsed: false,
        fallbackLevel: 'none',
        timestamp: new Date(),
        latency: Date.now() - startTime
      };
    } catch (error) {
      console.warn(`⚠️ Primary fallback failed: ${error.message}`);
    }

    if (this.chain.secondary) {
      try {
        const result = await this.executeWithTimeout(this.chain.secondary);
        return {
          success: true,
          data: result,
          source: 'secondary',
          fallbackUsed: true,
          fallbackLevel: 'primary',
          timestamp: new Date(),
          latency: Date.now() - startTime
        };
      } catch (error) {
        console.warn(`⚠️ Secondary fallback failed: ${error.message}`);
      }
    }

    if (this.chain.tertiary) {
      try {
        const result = await this.executeWithTimeout(this.chain.tertiary);
        return {
          success: true,
          data: result,
          source: 'tertiary',
          fallbackUsed: true,
          fallbackLevel: 'secondary',
          timestamp: new Date(),
          latency: Date.now() - startTime
        };
      } catch (error) {
        console.warn(`⚠️ Tertiary fallback failed: ${error.message}`);
      }
    }

    if (this.chain.fallbackValue !== undefined) {
      return {
        success: true,
        data: this.chain.fallbackValue,
        source: 'fallback_value',
        fallbackUsed: true,
        fallbackLevel: 'tertiary',
        timestamp: new Date(),
        latency: Date.now() - startTime
      };
    }

    return {
      success: false,
      error: this.chain.fallbackError || 'All fallbacks failed',
      source: 'fallback_error',
      fallbackUsed: true,
      fallbackLevel: 'tertiary',
      timestamp: new Date(),
      latency: Date.now() - startTime
    };
  }

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

  async executeWithContext(context) {
    const result = await this.execute();
    return {
      ...result,
      context
    };
  }

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

class FallbackFactory {
  static create(primary, secondary, fallbackValue, timeout) {
    return new FallbackHandler({
      primary,
      secondary,
      fallbackValue,
      timeout
    });
  }

  static createWithLevels(config) {
    return new FallbackHandler(config);
  }

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

class GracefulDegradation {
  constructor() {
    this.handlers = [];
  }

  addHandler(handler) {
    this.handlers.push(handler);
    return this;
  }

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

  async executeWithCache(cacheKey, cacheTTL) {
    return await this.executeAll();
  }
}

class FallbackResponses {
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

  static paymentFallback() {
    return {
      success: false,
      error: 'Payment service is temporarily unavailable',
      fallback: 'Please try again in a few minutes. Your booking is saved.',
      bookingStatus: 'pending',
      timestamp: new Date().toISOString()
    };
  }

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

async function executeWithFallback(chain) {
  const handler = new FallbackHandler(chain);
  return await handler.execute();
}

module.exports = {
  FallbackHandler,
  FallbackFactory,
  GracefulDegradation,
  FallbackResponses,
  executeWithFallback
};