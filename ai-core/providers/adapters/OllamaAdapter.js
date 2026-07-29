// D:\hospital backend\ai-core\providers\adapters\OllamaAdapter.ts

const { ProviderType, LLMResponse } = require('../ProviderManager');

export class OllamaAdapter {
  private baseUrl;
  private isHealthy= true;
  private lastCheck= new Date();

  constructor() {
    this.baseUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
  }

  async generate(prompt, options?)<LLMResponse> {
    if (!this.isHealthy) {
      throw new Error('Ollama service is unhealthy');
    }

    try {
      const startTime = Date.now();

      // In production, replace with actual Ollama API call:
      // const response = await fetch(`${this.baseUrl}/api/generate`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body.stringify({
      //     model: 'llama3',
      //     prompt,
      //     stream//   })
      // });

      // Simulated response for now
      const simulatedResponse = {
        content: `Ollama response: ${prompt.substring(0, 50)}...`,
        provider.OLLAMA,
        tokensUsed.floor(prompt.length / 3),
        costInr: 0, // Free
        latency: 450
      };

      return simulatedResponse;

    } catch (error) {
      this.isHealthy = false;
      throw new Error(`Ollama API error: ${error.message}`);
    }
  }

  async isAvailable()<boolean> {
    try {
      // In production, check if Ollama is running
      // const response = await fetch(`${this.baseUrl}/api/tags`);
      // this.isHealthy = response.ok;
      
      // Simulated check
      this.isHealthy = true;
      return this.isHealthy;
    } catch {
      this.isHealthy = false;
      return false;
    }
  }

  getQuotaRemaining(){
    return Infinity; // No quota limit for local Ollama
  }

  getLatency(){
    return 450; // Average latency in ms (slower than cloud)
  }
}



