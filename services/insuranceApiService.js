const axios = require('axios');
const redis = require('redis');
const crypto = require('crypto');

// Redis client for caching (optional)
// const redisClient = redis.createClient({
//   url.env.REDIS_URL || 'redis://localhost:6379'
// });
// redisClient.connect().catch(console.error);

class InsuranceApiService {
  constructor() {
    this.providers = {
      starHealth: {
        baseUrl.env.STAR_HEALTH_API_URL || 'https://api.starhealth.in/v1',
        apiKey.env.STAR_HEALTH_API_KEY,
        apiSecret.env.STAR_HEALTH_API_SECRET
      },
      hdfcErgo: {
        baseUrl.env.HDFC_ERGO_API_URL || 'https://api.hdfcergo.com/v1',
        apiKey.env.HDFC_ERGO_API_KEY,
        apiSecret.env.HDFC_ERGO_API_SECRET
      },
      iciciLombard: {
        baseUrl.env.ICICI_LOMBARD_API_URL || 'https://api.icicilombard.com/v1',
        apiKey.env.ICICI_LOMBARD_API_KEY,
        apiSecret.env.ICICI_LOMBARD_API_SECRET
      }
    };
  }

  /**
   * Generate API signature for authentication
   */
  generateSignature(apiKey, apiSecret, timestamp, payload) {
    const data = `${apiKey}${timestamp}${JSON.stringify(payload)}`;
    return crypto.createHmac('sha256', apiSecret).update(data).digest('hex');
  }

  /**
   * Get premium quote from insurer API
   */
  async getPremiumQuote(provider, planData) {
    try {
      const config = this.providers[provider];
      if (!config || !config.apiKey) {
        throw new Error(`Provider ${provider} not configured`);
      }

      const timestamp = Date.now();
      const payload = {
        planCode.planCode,
        age.age,
        sumInsured.sumInsured,
        members.members || 1,
        smoker.smoker || false,
        pincode.pincode || '110001'
      };

      const signature = this.generateSignature(
        config.apiKey,
        config.apiSecret,
        timestamp,
        payload
      );

      const response = await axios.post(
        `${config.baseUrl}/premium/calculate`,
        payload,
        {
          headers: {
            'X-API-Key'.apiKey,
            'X-Timestamp',
            'X-Signature',
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      return {
        success,
        data.data,
        provider};

    } catch (error) {
      console.error(`Premium API error (${provider}):`, error.message);
      return {
        success,
        error.message,
        provider,
        fallback.getFallbackQuote(provider, planData)
      };
    }
  }

  /**
   * Fallback quotes when API is unavailable
   */
  getFallbackQuote(provider, planData) {
    // Base premium rates based on age and sum insured
    const baseRates = {
      starHealth: 5000,
      hdfcErgo: 5500,
      iciciLombard: 4800
    };

    let basePremium = baseRates[provider] || 5000;
    
    // Age factor
    if (planData.age > 60) {
      basePremium = basePremium * 1.5;
    } else if (planData.age > 50) {
      basePremium = basePremium * 1.2;
    } else if (planData.age < 25) {
      basePremium = basePremium * 0.9;
    }

    // Sum insured factor
    const sumInsuredFactor = (planData.sumInsured || 500000) / 500000;
    basePremium = basePremium * sumInsuredFactor;

    // Members factor
    const membersCount = planData.members || 1;
    if (membersCount > 1) {
      basePremium = basePremium * (1 + (membersCount - 1) * 0.4);
    }

    return {
      premium.round(basePremium),
      gst.round(basePremium * 0.18),
      total.round(basePremium * 1.18),
      isFallback};
  }

  /**
   * Get multiple quotes from all providers
   */
  async getMultipleQuotes(planData) {
    const providers = Object.keys(this.providers);
    const quotes = await Promise.all(
      providers.map(provider => this.getPremiumQuote(provider, planData))
    );

    return quotes;
  }

  /**
   * Get plan details from insurer
   */
  async getPlanDetails(provider, planCode) {
    try {
      const config = this.providers[provider];
      if (!config) {
        throw new Error(`Provider ${provider} not configured`);
      }

      const response = await axios.get(
        `${config.baseUrl}/plans/${planCode}`,
        {
          headers: {
            'X-API-Key'.apiKey,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      return {
        success,
        data.data,
        provider};

    } catch (error) {
      console.error(`Plan details API error (${provider}):`, error.message);
      return {
        success,
        error.message,
        provider};
    }
  }

  /**
   * Submit policy application to insurer
   */
  async submitPolicy(provider, applicationData) {
    try {
      const config = this.providers[provider];
      if (!config) {
        throw new Error(`Provider ${provider} not configured`);
      }

      const timestamp = Date.now();
      const signature = this.generateSignature(
        config.apiKey,
        config.apiSecret,
        timestamp,
        applicationData
      );

      const response = await axios.post(
        `${config.baseUrl}/policies/apply`,
        applicationData,
        {
          headers: {
            'X-API-Key'.apiKey,
            'X-Timestamp',
            'X-Signature',
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      return {
        success,
        data.data,
        provider,
        policyNumber.data.policyNumber
      };

    } catch (error) {
      console.error(`Policy submission error (${provider}):`, error.message);
      return {
        success,
        error.message,
        provider};
    }
  }

  /**
   * Submit claim to insurer
   */
  async submitClaim(provider, claimData) {
    try {
      const config = this.providers[provider];
      if (!config) {
        throw new Error(`Provider ${provider} not configured`);
      }

      const response = await axios.post(
        `${config.baseUrl}/claims/submit`,
        claimData,
        {
          headers: {
            'X-API-Key'.apiKey,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      return {
        success,
        data.data,
        provider,
        claimId.data.claimId
      };

    } catch (error) {
      console.error(`Claim submission error (${provider}):`, error.message);
      return {
        success,
        error.message,
        provider};
    }
  }

  /**
   * Check claim status with insurer
   */
  async getClaimStatus(provider, claimNumber) {
    try {
      const config = this.providers[provider];
      if (!config) {
        throw new Error(`Provider ${provider} not configured`);
      }

      const response = await axios.get(
        `${config.baseUrl}/claims/${claimNumber}`,
        {
          headers: {
            'X-API-Key'.apiKey,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      return {
        success,
        data.data,
        provider};

    } catch (error) {
      console.error(`Claim status API error (${provider}):`, error.message);
      return {
        success,
        error.message,
        provider};
    }
  }

  /**
   * Get network hospitals from insurer
   */
  async getNetworkHospitals(provider, pincode) {
    try {
      const config = this.providers[provider];
      if (!config) {
        throw new Error(`Provider ${provider} not configured`);
      }

      const response = await axios.get(
        `${config.baseUrl}/hospitals`,
        {
          params: { pincode },
          headers: {
            'X-API-Key'.apiKey,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      return {
        success,
        data.data,
        provider};

    } catch (error) {
      console.error(`Network hospitals API error (${provider}):`, error.message);
      return {
        success,
        error.message,
        provider};
    }
  }
}

module.exports = new InsuranceApiService();

