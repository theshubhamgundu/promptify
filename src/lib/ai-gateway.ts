export interface AIProviderConfig {
  provider: 'openai' | 'gemini' | 'anthropic' | 'openrouter';
  model: string;
  temperature?: number;
}

export class AIGateway {
  static async generate(prompt: string, config: AIProviderConfig): Promise<string> {
    switch (config.provider) {
      case 'openai':
        return this.callOpenAI(prompt, config);
      case 'gemini':
        return this.callGemini(prompt, config);
      case 'anthropic':
        return this.callAnthropic(prompt, config);
      case 'openrouter':
        return this.callOpenRouter(prompt, config);
      default:
        throw new Error(`Unsupported provider: ${config.provider}`);
    }
  }

  private static async callOpenAI(prompt: string, config: AIProviderConfig): Promise<string> {
    const key = import.meta.env.VITE_OPENAI_API_KEY;
    if (!key) throw new Error("OpenAI API key missing");

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: config.temperature ?? 0.7
      })
    });

    if (!response.ok) throw new Error(`OpenAI API error: ${response.statusText}`);
    const data = await response.json();
    return data.choices[0].message.content;
  }

  private static async callGemini(prompt: string, config: AIProviderConfig): Promise<string> {
    const key = import.meta.env.VITE_GEMINI_API_KEY;
    if (!key) throw new Error("Gemini API key missing");

    // Using Gemini REST API
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${key}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: config.temperature ?? 0.7
        }
      })
    });

    if (!response.ok) throw new Error(`Gemini API error: ${response.statusText}`);
    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  }

  private static async callAnthropic(prompt: string, config: AIProviderConfig): Promise<string> {
    const key = import.meta.env.VITE_ANTHROPIC_API_KEY;
    if (!key) throw new Error("Anthropic API key missing");

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
        temperature: config.temperature ?? 0.7
      })
    });

    if (!response.ok) throw new Error(`Anthropic API error: ${response.statusText}`);
    const data = await response.json();
    return data.content[0].text;
  }

  private static async callOpenRouter(prompt: string, config: AIProviderConfig): Promise<string> {
    const key = import.meta.env.VITE_OPENROUTER_API_KEY;
    if (!key) throw new Error("OpenRouter API key missing");

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: config.temperature ?? 0.7
      })
    });

    if (!response.ok) throw new Error(`OpenRouter API error: ${response.statusText}`);
    const data = await response.json();
    return data.choices[0].message.content;
  }
}
