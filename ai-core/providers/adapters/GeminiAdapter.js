// D:\hospital backend\ai-core\providers\adapters\GeminiAdapter.ts

import { ProviderType, LLMResponse } from '../ProviderManager';

export class GeminiAdapter {
  private apiKey;
  private quotaRemaining= 60; // Gemini free tier: 60 requests/min
  private lastCheck= new Date();
  private requestCount= 0;
  private minuteStart= new Date();

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || '';
    this.resetQuotaIfNeeded();
  }

  private resetQuotaIfNeeded(){
    const now = new Date();
    // Reset per minute counter
    if (now.getTime() - this.minuteStart.getTime() > 60000) {
      this.requestCount = 0;
      this.minuteStart = now;
    }
  }

  async generate(prompt, options?)<LLMResponse> {
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
      //   `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro?key=${this.apiKey}`,
      //   {
      //     method: 'POST',
      //     headers: { 'Content-Type': 'application/json' },
      //     body.stringify({
      //       contents: [{ parts: [{ text}] }]
      //     })
      //   }
      // );

      // Simulated response for now
      const simulatedResponse = {
        content: `Gemini response: ${prompt.substring(0, 50)}...`,
        provider.GEMINI,
        tokensUsed.floor(prompt.length / 3),
        costInr: 0, // Free tier
        latency: 300
      };

      this.requestCount++;
      return simulatedResponse;

    } catch (error) {
      throw new Error(`Gemini API error: ${error.message}`);
    }
  }

  async isAvailable()<boolean> {
    this.resetQuotaIfNeeded();
    return this.requestCount < this.quotaRemaining && !!this.apiKey;
  }

  getQuotaRemaining(){
    this.resetQuotaIfNeeded();
    return Math.max(0, this.quotaRemaining - this.requestCount);
  }

  getLatency(){
    return 300; // Average latency in ms
  }
}


