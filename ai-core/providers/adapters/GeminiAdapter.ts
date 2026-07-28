// D:\hospital backend\ai-core\providers\adapters\GeminiAdapter.ts

import { ProviderType, LLMResponse } from '../ProviderManager';

export class GeminiAdapter {
  private apiKey: string;
  private quotaRemaining: number = 60; // Gemini free tier: 60 requests/min
  private lastCheck: Date = new Date();
  private requestCount: number = 0;
  private minuteStart: Date = new Date();

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || '';
    this.resetQuotaIfNeeded();
  }

  private resetQuotaIfNeeded(): void {
    const now = new Date();
    // Reset per minute counter
    if (now.getTime() - this.minuteStart.getTime() > 60000) {
      this.requestCount = 0;
      this.minuteStart = now;
    }
  }

  async generate(prompt: string, options?: Record<string, any>): Promise<LLMResponse> {
    this.resetQuotaIfNeeded();

    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    if (this.requestCount >= this.quotaRemaining) {
      throw new Error('Gemini rate limit exceeded (60/min)');
    }

    try {
      const startTime = Date.now();

      // In production, replace with actual Gemini API call:
      // const response = await fetch(
      //   `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${this.apiKey}`,
      //   {
      //     method: 'POST',
      //     headers: { 'Content-Type': 'application/json' },
      //     body: JSON.stringify({
      //       contents: [{ parts: [{ text: prompt }] }]
      //     })
      //   }
      // );

      // Simulated response for now
      const simulatedResponse = {
        content: `Gemini response: ${prompt.substring(0, 50)}...`,
        provider: ProviderType.GEMINI,
        tokensUsed: Math.floor(prompt.length / 3),
        costInr: 0, // Free tier
        latency: 300
      };

      this.requestCount++;
      return simulatedResponse;

    } catch (error) {
      throw new Error(`Gemini API error: ${error.message}`);
    }
  }

  async isAvailable(): Promise<boolean> {
    this.resetQuotaIfNeeded();
    return this.requestCount < this.quotaRemaining && !!this.apiKey;
  }

  getQuotaRemaining(): number {
    this.resetQuotaIfNeeded();
    return Math.max(0, this.quotaRemaining - this.requestCount);
  }

  getLatency(): number {
    return 300; // Average latency in ms
  }
}