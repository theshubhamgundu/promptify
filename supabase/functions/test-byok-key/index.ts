// Test BYOK Key Edge Function
// Makes a minimal test request to verify API key works
// Does NOT register in database or count toward limits

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type AIProvider = 'OPENAI' | 'ANTHROPIC' | 'GOOGLE' | 'MISTRAL' | 'COHERE' | 'GROQ';

interface TestRequest {
  provider: AIProvider;
  apiKey: string;
}

interface TestResponse {
  success: boolean;
  message?: string;
  model?: string;
  error?: string;
}

// Minimal test requests for each provider
const TEST_CONFIGS: Record<AIProvider, { endpoint: string; method: string; headers: (key: string) => Record<string, string>; body: any; extractModel: (data: any) => string }> = {
  OPENAI: {
    endpoint: 'https://api.openai.com/v1/chat/completions',
    method: 'POST',
    headers: (key) => ({
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    }),
    body: {
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'Hi' }],
      max_tokens: 5,
    },
    extractModel: (data) => data.model || 'gpt-3.5-turbo',
  },
  ANTHROPIC: {
    endpoint: 'https://api.anthropic.com/v1/messages',
    method: 'POST',
    headers: (key) => ({
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    }),
    body: {
      model: 'claude-3-haiku-20240307',
      messages: [{ role: 'user', content: 'Hi' }],
      max_tokens: 5,
    },
    extractModel: (data) => data.model || 'claude-3-haiku',
  },
  GOOGLE: {
    endpoint: '', // Set dynamically with API key
    method: 'POST',
    headers: (key) => ({
      'Content-Type': 'application/json',
    }),
    body: {
      contents: [{ parts: [{ text: 'Hi' }] }],
      generationConfig: { maxOutputTokens: 5 },
    },
    extractModel: (data) => 'gemini-pro',
  },
  MISTRAL: {
    endpoint: 'https://api.mistral.ai/v1/chat/completions',
    method: 'POST',
    headers: (key) => ({
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    }),
    body: {
      model: 'mistral-tiny',
      messages: [{ role: 'user', content: 'Hi' }],
      max_tokens: 5,
    },
    extractModel: (data) => data.model || 'mistral-tiny',
  },
  COHERE: {
    endpoint: 'https://api.cohere.ai/v1/chat',
    method: 'POST',
    headers: (key) => ({
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    }),
    body: {
      message: 'Hi',
      max_tokens: 5,
    },
    extractModel: (data) => data.meta?.model || 'command',
  },
  GROQ: {
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    method: 'POST',
    headers: (key) => ({
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    }),
    body: {
      model: 'mixtral-8x7b-32768',
      messages: [{ role: 'user', content: 'Hi' }],
      max_tokens: 5,
    },
    extractModel: (data) => data.model || 'mixtral-8x7b-32768',
  },
};

async function testAPIKey(provider: AIProvider, apiKey: string): Promise<TestResponse> {
  const config = TEST_CONFIGS[provider];
  
  if (!config) {
    return {
      success: false,
      error: `Provider ${provider} is not supported`,
    };
  }

  try {
    // Special handling for Google (endpoint includes API key)
    let endpoint = config.endpoint;
    if (provider === 'GOOGLE') {
      endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;
    }

    const response = await fetch(endpoint, {
      method: config.method,
      headers: config.headers(apiKey),
      body: JSON.stringify(config.body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `API returned ${response.status}`;
      
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error?.message || errorData.message || errorMessage;
      } catch {
        // Keep default error message
      }

      return {
        success: false,
        error: errorMessage,
      };
    }

    const data = await response.json();
    const model = config.extractModel(data);

    return {
      success: true,
      message: `✓ ${provider} API key is valid and working!`,
      model,
    };
  } catch (error) {
    console.error('Test error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Connection test failed',
    };
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      throw new Error('Invalid authentication');
    }

    // Parse request
    const { provider, apiKey }: TestRequest = await req.json();

    if (!provider || !apiKey) {
      throw new Error('Missing provider or apiKey');
    }

    // Test the API key
    const result = await testAPIKey(provider, apiKey);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: result.success ? 200 : 400,
    });
  } catch (error) {
    console.error('Function error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
