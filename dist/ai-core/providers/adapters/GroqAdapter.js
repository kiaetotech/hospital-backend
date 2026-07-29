"use strict";
// D:\hospital backend\ai-core\providers\adapters\GroqAdapter.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.GroqAdapter = void 0;
const ProviderManager_1 = require("../ProviderManager");
class GroqAdapter {
    constructor() {
        this.baseUrl = 'https://api.groq.com/openai/v1';
        this.quotaRemaining = 14500; // Groq free tier: 14,500 requests/day
        this.lastCheck = new Date();
        this.apiKey = process.env.GROQ_API_KEY || '';
        this.resetQuotaIfNeeded();
    }
    resetQuotaIfNeeded() {
        const now = new Date();
        if (now.getDate() !== this.lastCheck.getDate()) {
            this.quotaRemaining = 14500;
            this.lastCheck = now;
        }
    }
    async generate(prompt, options) {
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
                provider: ProviderManager_1.ProviderType.GROQ,
                tokensUsed: Math.floor(prompt.length / 4),
                costInr: 0.01,
                latency: 120
            };
            this.quotaRemaining--;
            return simulatedResponse;
        }
        catch (error) {
            throw new Error(`Groq API error: ${error.message}`);
        }
    }
    async isAvailable() {
        this.resetQuotaIfNeeded();
        return this.quotaRemaining > 0 && !!this.apiKey;
    }
    getQuotaRemaining() {
        this.resetQuotaIfNeeded();
        return this.quotaRemaining;
    }
    getLatency() {
        return 120; // Average latency in ms
    }
}
exports.GroqAdapter = GroqAdapter;
