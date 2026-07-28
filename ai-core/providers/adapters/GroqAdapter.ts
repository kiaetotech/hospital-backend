// D:\hospital backend\ai-core\providers\adapters\GroqAdapter.ts

import { ProviderType, LLMResponse } from '../ProviderManager';

export class GroqAdapter {
  private apiKey: string;
  private baseUrl: string = 'https://api.groq.com/openai/v1';
  private quotaRemaining: number = 14500; // Groq free tier: 14,500 requests/day
  private lastCheck: Date = new Date();

  constructor() {
    this.apiKey = process.env.GROQ_API_KEY || '';
    this.resetQuotaIfNeeded();
  }

  private resetQuotaIfNeeded(): void {
    const now = new Date();
    if (now.getDate() !== this.lastCheck.getDate()) {
      this.quotaRemaining = 14500;
      this.lastCheck = now;
    }
  }

  async generate(prompt: string, options?: Record<string, any>): Promise<LLMResponse> {
    this.resetQuotaIfNeeded();

    if (!this.apiKey) {
      throw new Error('GROQ_API_KEY not configured');
    }

    if (this.quotaRemaining <= 0) {
      throw new Error('Groq daily quota exhausted');
    }

    try {
      // Simulate API call
      const startTime = Date.now();
      
      // In production, replace with actual Groq API call:
      // const response = await fetch(`${this.baseUrl}/chat/completions`, {
      //   method: 'POST',
      //   headers: {
      //     'Authorization': `Bearer ${this.apiKey}`,
      //     'Content-Type': 'application/json'
      //   },
      //   body: JSON.stringify({
      //     model: 'mixtral-8x7b-32768',
      //     messages: [{ role: 'user', content: prompt }]
      //   })
      // });

      // Simulated response for now
      const simulatedResponse = {
        content: `Groq response: ${prompt.substring(0, 50)}...`,
        provider: ProviderType.GROQ,
        tokensUsed: Math.floor(prompt.length / 4),
        costInr: 0.01,
        latency: 120
      };

      this.quotaRemaining--;
      return simulatedResponse;

    } catch (error) {
      throw new Error(`Groq API error: ${error.message}`);
    }
  }

  async isAvailable(): Promise<boolean> {
    this.resetQuotaIfNeeded();
    return this.quotaRemaining > 0 && !!this.apiKey;
  }

  getQuotaRemaining(): number {
    this.resetQuotaIfNeeded();
    return this.quotaRemaining;
  }

  getLatency(): number {
    return 120; // Average latency in ms
  }
}