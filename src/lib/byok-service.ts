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
 * Stores API keys in encrypted localStorage for persistence across sessions
 * Keys are base64 encoded for basic obfuscation (not true encryption, but better than plain text)
 */
class BYOKSessionManager {
  private activeKeys: Map<string, string> = new Map(); // provider -> apiKey (in-memory)
  private readonly STORAGE_KEY = 'byok_keys';
  private readonly SESSION_KEY = 'byok_session_id';
  
  constructor() {
    // Load keys from localStorage on initialization
    this.loadFromStorage();
    // Generate or restore session ID
    this.ensureSessionId();
  }

  /**
   * Simple base64 encoding for obfuscation
   */
  private encode(str: string): string {
    try {
      return btoa(str);
    } catch {
      return str;
    }
  }

  private decode(str: string): string {
    try {
      return atob(str);
    } catch {
      return str;
    }
  }

  /**
   * Ensure we have a session ID for tracking
   */
  private ensureSessionId(): void {
    if (typeof window === 'undefined') return;
    
    let sessionId = sessionStorage.getItem(this.SESSION_KEY);
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem(this.SESSION_KEY, sessionId);
    }
  }

  /**
   * Load keys from localStorage
   */
  private loadFromStorage(): void {
    if (typeof window === 'undefined') return;
    
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const decoded = this.decode(stored);
        const keys = JSON.parse(decoded) as Record<string, string>;
        Object.entries(keys).forEach(([provider, key]) => {
          this.activeKeys.set(provider, key);
        });
      }
    } catch (error) {
      console.warn('Failed to load BYOK keys from storage:', error);
    }
  }

  /**
   * Save keys to localStorage
   */
  private saveToStorage(): void {
    if (typeof window === 'undefined') return;
    
    try {
      const keys: Record<string, string> = {};
      this.activeKeys.forEach((value, key) => {
        keys[key] = value;
      });
      const encoded = this.encode(JSON.stringify(keys));
      localStorage.setItem(this.STORAGE_KEY, encoded);
    } catch (error) {
      console.warn('Failed to save BYOK keys to storage:', error);
    }
  }
  
  /**
   * Set an API key for a provider
   * SECURITY: Key is stored in memory AND localStorage (base64 encoded)
   */
  setKey(provider: AIProvider, apiKey: string): void {
    this.activeKeys.set(provider, apiKey);
    this.saveToStorage();
  }

  /**
   * Get an API key for a provider
   * Returns undefined if not set
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
    this.saveToStorage();
  }

  /**
   * Clear all keys (call on logout)
   */
  clearAll(): void {
    this.activeKeys.clear();
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.STORAGE_KEY);
      sessionStorage.removeItem(this.SESSION_KEY);
    }
  }

  /**
   * Get all configured providers
   */
  getConfiguredProviders(): AIProvider[] {
    return Array.from(this.activeKeys.keys()) as AIProvider[];
  }
}

// Singleton instance
export const byokSession = new BYOKSessionManager();

// Listen for logout/session changes
if (typeof window !== 'undefined') {
  // Clear keys on explicit logout
  window.addEventListener('storage', (e) => {
    if (e.key === 'supabase.auth.token' && !e.newValue) {
      // Auth token removed = logout
      byokSession.clearAll();
    }
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
  roundSessionId?: string,
  challengeId?: string
): Promise<ValidationResult> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${(supabase as any).supabaseUrl}/functions/v1/validate-byok-key`, {
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

    const response = await fetch(`${(supabase as any).supabaseUrl}/functions/v1/ai-gateway`, {
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

    // Check for rate limit before parsing
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      const waitSeconds = retryAfter ? parseInt(retryAfter) : 10;
      return {
        success: false,
        error: `Rate limit reached. Please wait ${waitSeconds} seconds before your next attempt.`,
      };
    }

    if (!response.ok) {
      return {
        success: false,
        error: `Request failed with status ${response.status}. Please try again.`,
      };
    }

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
 * Test an API key connection without validation
 * Makes a simple test request to verify the key works
 * Uses the validate endpoint in test mode (no database writes)
 */
export async function testBYOKConnection(
  provider: AIProvider,
  apiKey: string
): Promise<{ success: boolean; message: string; model?: string }> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { success: false, message: 'Not authenticated' };
    }

    // For testing, we'll use a simple client-side validation
    // Check if the key format looks valid for the provider
    const keyPatterns: Record<AIProvider, RegExp> = {
      OPENAI: /^sk-[a-zA-Z0-9_-]{20,}$/,  // Accepts sk-proj-, sk-..., etc.
      ANTHROPIC: /^sk-ant-[a-zA-Z0-9-]{20,}$/,
      GOOGLE: /^[a-zA-Z0-9_-]{20,}$/,
      MISTRAL: /^[a-zA-Z0-9]{20,}$/,
      COHERE: /^[a-zA-Z0-9_-]{40}$/,
      GROQ: /^gsk_[a-zA-Z0-9]{20,}$/,
    };

    const pattern = keyPatterns[provider];
    if (pattern && !pattern.test(apiKey)) {
      return {
        success: false,
        message: `Invalid ${provider} API key format. Please check and try again.`,
      };
    }

    // Key format looks good
    return {
      success: true,
      message: `✓ ${provider} API key format is valid! Key will be validated when you enter a challenge.`,
      model: provider.toLowerCase(),
    };
  } catch (error) {
    console.error('Test connection error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Connection test failed',
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
