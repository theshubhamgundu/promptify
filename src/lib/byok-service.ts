// BYOK Service - Frontend
// SECURITY: API keys are NEVER stored in localStorage, sessionStorage, or any persistent state

import { supabase } from './supabase';

export type AIProvider = 'OPENAI' | 'ANTHROPIC' | 'GOOGLE' | 'MISTRAL' | 'COHERE' | 'GROQ';

export interface BYOKConfig {
  enabled: boolean;
  required_providers: AIProvider[];
  allowed_models: string[];
  max_requests: number;
  max_tokens_per_request: number;
  max_total_tokens: number;
  allowed_tools: boolean;
  allowed_web_access: boolean;
  timeout_seconds: number;
}

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIRequest {
  messages: AIMessage[];
  model: string;
  maxTokens?: number;
  temperature?: number;
  tools?: any[];
}

export interface AIResponse {
  success: boolean;
  content?: string;
  model?: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  finishReason?: string;
  latencyMs?: number;
  error?: string;
}

export interface ValidationResult {
  success: boolean;
  provider?: AIProvider;
  metadata?: {
    provider: AIProvider;
    availableModels: string[];
    maxContextLength: number;
    supportsTools: boolean;
  };
  sessionExpiresAt?: string;
  error?: string;
}

export interface UsageStats {
  requestCount: number;
  tokenCount: number;
  remainingRequests: number;
  remainingTokens: number;
}

/**
 * BYOK Runtime Session Manager
 * Keeps API keys ONLY in memory for the active session
 * NEVER stores keys in localStorage, sessionStorage, or any persistent state
 */
class BYOKSessionManager {
  private activeKeys: Map<string, string> = new Map(); // provider -> apiKey (in-memory only)
  
  /**
   * Set an API key for a provider
   * SECURITY: Key is stored ONLY in memory and cleared on page unload
   */
  setKey(provider: AIProvider, apiKey: string): void {
    this.activeKeys.set(provider, apiKey);
  }

  /**
   * Get an API key for a provider
   * Returns undefined if not set or session expired
   */
  getKey(provider: AIProvider): string | undefined {
    return this.activeKeys.get(provider);
  }

  /**
   * Check if a key exists for a provider
   */
  hasKey(provider: AIProvider): boolean {
    return this.activeKeys.has(provider);
  }

  /**
   * Clear a specific provider's key
   */
  clearKey(provider: AIProvider): void {
    this.activeKeys.delete(provider);
  }

  /**
   * Clear all keys (call on logout or session end)
   */
  clearAll(): void {
    this.activeKeys.clear();
  }
}

// Singleton instance
export const byokSession = new BYOKSessionManager();

// Clear keys on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    byokSession.clearAll();
  });
}

/**
 * Validate an API key with the provider
 * SECURITY: Key is sent to Edge Function but NEVER stored in database
 */
export async function validateBYOKKey(
  provider: AIProvider,
  apiKey: string,
  teamId: string,
  roundSessionId: string,
  challengeId: string
): Promise<ValidationResult> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${supabase.supabaseUrl}/functions/v1/validate-byok-key`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        provider,
        apiKey, // Sent securely, NEVER stored
        teamId,
        roundSessionId,
        challengeId,
      }),
    });

    const result = await response.json();
    
    if (result.success) {
      // Store key in memory only
      byokSession.setKey(provider, apiKey);
    }

    return result;
  } catch (error) {
    console.error('Validation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Validation failed',
    };
  }
}

/**
 * Send an AI request through the secure gateway
 * SECURITY: API key is sent in header, NEVER stored
 */
export async function sendAIRequest(
  provider: AIProvider,
  teamId: string,
  roundSessionId: string,
  challengeId: string,
  request: AIRequest
): Promise<AIResponse> {
  try {
    const apiKey = byokSession.getKey(provider);
    if (!apiKey) {
      throw new Error('No API key found. Please validate your key first.');
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${supabase.supabaseUrl}/functions/v1/ai-gateway`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
        'x-byok-key': apiKey, // Secure header for API key
      },
      body: JSON.stringify({
        provider,
        teamId,
        roundSessionId,
        challengeId,
        request,
      }),
    });

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('AI request error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Request failed',
    };
  }
}

/**
 * Get usage statistics for a team/challenge
 */
export async function getBYOKUsageStats(
  teamId: string,
  challengeId: string,
  maxRequests: number,
  maxTokens: number
): Promise<UsageStats> {
  try {
    const { data, error } = await supabase
      .from('byok_rate_limits')
      .select('request_count, token_count')
      .eq('team_id', teamId)
      .eq('challenge_id', challengeId)
      .single();

    if (error || !data) {
      return {
        requestCount: 0,
        tokenCount: 0,
        remainingRequests: maxRequests,
        remainingTokens: maxTokens,
      };
    }

    return {
      requestCount: data.request_count,
      tokenCount: data.token_count,
      remainingRequests: Math.max(0, maxRequests - data.request_count),
      remainingTokens: Math.max(0, maxTokens - data.token_count),
    };
  } catch (error) {
    console.error('Failed to get usage stats:', error);
    return {
      requestCount: 0,
      tokenCount: 0,
      remainingRequests: maxRequests,
      remainingTokens: maxTokens,
    };
  }
}

/**
 * Get BYOK configuration from challenge
 */
export function getBYOKConfig(challengeConfiguration: any): BYOKConfig | null {
  const byok = challengeConfiguration?.byok;
  if (!byok || !byok.enabled) {
    return null;
  }
  return byok;
}
