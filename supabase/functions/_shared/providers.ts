// Shared AI Provider Abstractions
// SECURITY: This file NEVER logs or stores API keys

export type AIProvider = 'OPENAI' | 'ANTHROPIC' | 'GOOGLE' | 'MISTRAL' | 'COHERE' | 'GROQ';

export interface ProviderConfig {
  apiKey: string; // NEVER logged or stored
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AIRequest {
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  model: string;
  maxTokens?: number;
  temperature?: number;
  tools?: any[];
}

export interface AIResponse {
  content: string;
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  finishReason: string;
  latencyMs: number;
}

export interface ProviderMetadata {
  provider: AIProvider;
  availableModels: string[];
  maxContextLength: number;
  supportsTools: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  provider: AIProvider;
  metadata?: ProviderMetadata;
  error?: string;
}

// Abstract Provider Interface
export interface IProviderAdapter {
  validate(apiKey: string): Promise<ValidationResult>;
  sendRequest(config: ProviderConfig, request: AIRequest): Promise<AIResponse>;
  getMetadata(): ProviderMetadata;
}

// OpenAI Provider
export class OpenAIProvider implements IProviderAdapter {
  getMetadata(): ProviderMetadata {
    return {
      provider: 'OPENAI',
      availableModels: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo', 'gpt-4o', 'gpt-4o-mini'],
      maxContextLength: 128000,
      supportsTools: true,
    };
  }

  async validate(apiKey: string): Promise<ValidationResult> {
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      if (response.ok) {
        return {
          isValid: true,
          provider: 'OPENAI',
          metadata: this.getMetadata(),
        };
      }

      return {
        isValid: false,
        provider: 'OPENAI',
        error: 'Invalid API key',
      };
    } catch (error) {
      return {
        isValid: false,
        provider: 'OPENAI',
        error: 'Validation failed',
      };
    }
  }

  async sendRequest(config: ProviderConfig, request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now();

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        max_tokens: request.maxTokens || config.maxTokens,
        temperature: request.temperature ?? config.temperature ?? 0.7,
        tools: request.tools,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const latencyMs = Date.now() - startTime;

    return {
      content: data.choices[0]?.message?.content || '',
      model: data.model,
      usage: {
        inputTokens: data.usage?.prompt_tokens || 0,
        outputTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
      },
      finishReason: data.choices[0]?.finish_reason || 'unknown',
      latencyMs,
    };
  }
}

// Anthropic Provider
export class AnthropicProvider implements IProviderAdapter {
  getMetadata(): ProviderMetadata {
    return {
      provider: 'ANTHROPIC',
      availableModels: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku', 'claude-3-5-sonnet'],
      maxContextLength: 200000,
      supportsTools: true,
    };
  }

  async validate(apiKey: string): Promise<ValidationResult> {
    try {
      // Simple validation by attempting to list models or a minimal request
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'test' }],
        }),
      });

      if (response.ok || response.status === 400) { // 400 might be ok for validation
        return {
          isValid: true,
          provider: 'ANTHROPIC',
          metadata: this.getMetadata(),
        };
      }

      return {
        isValid: false,
        provider: 'ANTHROPIC',
        error: 'Invalid API key',
      };
    } catch (error) {
      return {
        isValid: false,
        provider: 'ANTHROPIC',
        error: 'Validation failed',
      };
    }
  }

  async sendRequest(config: ProviderConfig, request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now();

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        max_tokens: request.maxTokens || config.maxTokens || 1024,
        temperature: request.temperature ?? config.temperature ?? 0.7,
        tools: request.tools,
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    const latencyMs = Date.now() - startTime;

    return {
      content: data.content[0]?.text || '',
      model: data.model,
      usage: {
        inputTokens: data.usage?.input_tokens || 0,
        outputTokens: data.usage?.output_tokens || 0,
        totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
      },
      finishReason: data.stop_reason || 'unknown',
      latencyMs,
    };
  }
}

// Google Provider (Gemini)
export class GoogleProvider implements IProviderAdapter {
  getMetadata(): ProviderMetadata {
    return {
      provider: 'GOOGLE',
      availableModels: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-pro'],
      maxContextLength: 2000000,
      supportsTools: true,
    };
  }

  async validate(apiKey: string): Promise<ValidationResult> {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
      );

      if (response.ok) {
        return {
          isValid: true,
          provider: 'GOOGLE',
          metadata: this.getMetadata(),
        };
      }

      return {
        isValid: false,
        provider: 'GOOGLE',
        error: 'Invalid API key',
      };
    } catch (error) {
      return {
        isValid: false,
        provider: 'GOOGLE',
        error: 'Validation failed',
      };
    }
  }

  async sendRequest(config: ProviderConfig, request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now();

    // Convert messages to Gemini format
    const contents = request.messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${request.model}:generateContent?key=${config.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: {
            maxOutputTokens: request.maxTokens || config.maxTokens,
            temperature: request.temperature ?? config.temperature ?? 0.7,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Google API error: ${response.status}`);
    }

    const data = await response.json();
    const latencyMs = Date.now() - startTime;

    return {
      content: data.candidates[0]?.content?.parts[0]?.text || '',
      model: request.model,
      usage: {
        inputTokens: data.usageMetadata?.promptTokenCount || 0,
        outputTokens: data.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: data.usageMetadata?.totalTokenCount || 0,
      },
      finishReason: data.candidates[0]?.finishReason || 'unknown',
      latencyMs,
    };
  }
}

// Provider Factory
export function getProvider(provider: AIProvider): IProviderAdapter {
  switch (provider) {
    case 'OPENAI':
      return new OpenAIProvider();
    case 'ANTHROPIC':
      return new AnthropicProvider();
    case 'GOOGLE':
      return new GoogleProvider();
    default:
      throw new Error(`Provider ${provider} not implemented`);
  }
}
