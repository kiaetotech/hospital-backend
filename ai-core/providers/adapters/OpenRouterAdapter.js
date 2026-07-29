// D:\hospital backend\ai-core\providers\adapters\OpenRouterAdapter.ts

import { ProviderType, LLMResponse } from '../ProviderManager';

export class OpenRouterAdapter {
  private apiKey;
  private baseUrl= 'https://openrouter.ai/api/v1';
  private quotaRemaining= 20; // OpenRouter free tier: 20 requests/day
  private lastCheck= new Date();
  private dailyRequestCount= 0;
  private dayStart= new Date();

  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY || '';
    this.resetQuotaIfNeeded();
  }

  private resetQuotaIfNeeded(){
    const now = new Date();
    // Reset daily counter
    if (now.getDate() !== this.dayStart.getDate()) {
      this.dailyRequestCount = 0;
      this.dayStart = now;
    }
  }

  async generate(prompt, options?)<LLMResponse> {
    this.resetQuotaIfNeeded();

    if (!this.apiKey) {
      throw new Error('OPENROUTER_API_KEY not configured');
    }

    if (this.dailyRequestCount >= this.quotaRemaining) {
      throw new Error('OpenRouter daily quota exhausted (20/day)');
    }

    try {
      const startTime = Date.now();

      // In production, replace with actual OpenRouter API call:
      // const response = await fetch(`${this.baseUrl}/chat/completions`, {
      //   method: 'POST',
      //   headers: {
      //     'Authorization': `Bearer ${this.apiKey}`,
      //     'Content-Type': 'application/json'
      //   },
      //   body.stringify({
      //     model: 'mistralai/mistral-7b-instruct',
      //     messages: [{ role: 'user', content}]
      //   })
      // });

      // Simulated response for now
      const simulatedResponse = {
        content: `OpenRouter response: ${prompt.substring(0, 50)}...`,
        provider.OPENROUTER,
        tokensUsed.floor(prompt.length / 4),
        costInr: 0, // Free tier
        latency: 350
      };

      this.dailyRequestCount++;
      return simulatedResponse;

    } catch (error) {
      throw new Error(`OpenRouter API error: ${error.message}`);
    }
  }

  async isAvailable()<boolean> {
    this.resetQuotaIfNeeded();
    return this.dailyRequestCount < this.quotaRemaining && !!this.apiKey;
  }

  getQuotaRemaining(){
    this.resetQuotaIfNeeded();
    return Math.max(0, this.quotaRemaining - this.dailyRequestCount);
  }

  getLatency(){
    return 350; // Average latency in ms
  }
}


