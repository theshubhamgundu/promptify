// Edge Function: AI Gateway
// SECURITY: Validates permissions and enforces limits before forwarding to AI providers
// NEVER logs API keys or full prompt content (unless explicitly required for evaluation)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getProvider, AIProvider, AIRequest } from '../_shared/providers.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-byok-key',
};

interface GatewayRequest {
  provider: AIProvider;
  apiKey: string; // Passed in header, NEVER stored
  teamId: string;
  roundSessionId: string;
  challengeId: string;
  request: AIRequest;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get API key from secure header
    const apiKey = req.headers.get('x-byok-key');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'API key required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { provider, teamId, roundSessionId, challengeId, request: aiRequest }: Omit<GatewayRequest, 'apiKey'> = await req.json();

    // Validate inputs
    if (!provider || !teamId || !roundSessionId || !challengeId || !aiRequest) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify team access
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id')
      .eq('id', teamId)
      .single();

    if (teamError || !team) {
      return new Response(
        JSON.stringify({ error: 'Team not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify round session is active and not completed
    const { data: roundSession, error: sessionError } = await supabase
      .from('round_sessions')
      .select('id, team_id, round_id, completed_at')
      .eq('id', roundSessionId)
      .eq('team_id', teamId)
      .single();

    if (sessionError || !roundSession) {
      return new Response(
        JSON.stringify({ error: 'Invalid round session' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (roundSession.completed_at) {
      return new Response(
        JSON.stringify({ error: 'Round session has ended' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get challenge and its BYOK configuration
    const { data: challenge, error: challengeError } = await supabase
      .from('challenges')
      .select('id, configuration')
      .eq('id', challengeId)
      .single();

    if (challengeError || !challenge) {
      return new Response(
        JSON.stringify({ error: 'Challenge not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const byokConfig = (challenge.configuration as any)?.byok;
    if (!byokConfig?.enabled) {
      return new Response(
        JSON.stringify({ error: 'BYOK not enabled for this challenge' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify BYOK session exists and is valid
    const { data: byokSession, error: byokSessionError } = await supabase
      .from('byok_sessions')
      .select('*')
      .eq('team_id', teamId)
      .eq('round_session_id', roundSessionId)
      .eq('challenge_id', challengeId)
      .eq('provider', provider)
      .eq('is_validated', true)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (byokSessionError || !byokSession) {
      return new Response(
        JSON.stringify({ error: 'No valid BYOK session found. Please validate your API key first.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate model is allowed
    const allowedModels = byokConfig.allowed_models || [];
    if (allowedModels.length > 0 && !allowedModels.includes(aiRequest.model)) {
      return new Response(
        JSON.stringify({ error: `Model ${aiRequest.model} not allowed for this challenge` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check tools permission
    if (aiRequest.tools && !byokConfig.allowed_tools) {
      return new Response(
        JSON.stringify({ error: 'Tools are not allowed for this challenge' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Estimate tokens (rough estimate for rate limiting check)
    const estimatedInputTokens = JSON.stringify(aiRequest.messages).length / 4;
    const estimatedOutputTokens = aiRequest.maxTokens || byokConfig.max_tokens_per_request || 1000;
    const estimatedTotalTokens = estimatedInputTokens + estimatedOutputTokens;

    // Check rate limits using database function
    const { data: rateLimitOk, error: rateLimitError } = await supabase.rpc('check_byok_rate_limit', {
      p_team_id: teamId,
      p_challenge_id: challengeId,
      p_request_count: 1,
      p_token_count: Math.ceil(estimatedTotalTokens),
      p_max_requests: byokConfig.max_requests || 100,
      p_max_tokens: byokConfig.max_total_tokens || 50000,
    });

    if (rateLimitError || !rateLimitOk) {
      // Log rate limit event
      await supabase.from('byok_usage_logs').insert({
        byok_session_id: byokSession.id,
        team_id: teamId,
        challenge_id: challengeId,
        provider: provider,
        model: aiRequest.model,
        request_count: 0,
        rate_limited: true,
      });

      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Apply token limit per request
    const maxTokensPerRequest = byokConfig.max_tokens_per_request || 4000;
    if (aiRequest.maxTokens && aiRequest.maxTokens > maxTokensPerRequest) {
      aiRequest.maxTokens = maxTokensPerRequest;
    }

    // Send request to AI provider
    const providerAdapter = getProvider(provider);
    
    let aiResponse;
    let statusCode = 200;
    let errorType = null;

    try {
      aiResponse = await providerAdapter.sendRequest(
        { apiKey, maxTokens: maxTokensPerRequest },
        aiRequest
      );
    } catch (error) {
      statusCode = 500;
      errorType = error.message.includes('rate') ? 'RATE_LIMIT' : 
                  error.message.includes('timeout') ? 'TIMEOUT' : 
                  error.message.includes('auth') ? 'AUTH_ERROR' : 'PROVIDER_ERROR';
      
      // Log the failed request
      await supabase.from('byok_usage_logs').insert({
        byok_session_id: byokSession.id,
        team_id: teamId,
        challenge_id: challengeId,
        provider: provider,
        model: aiRequest.model,
        request_count: 1,
        status_code: statusCode,
        error_type: errorType,
      });

      return new Response(
        JSON.stringify({ error: `Provider error: ${errorType}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log successful usage (NO API KEY or full prompt content)
    await supabase.from('byok_usage_logs').insert({
      byok_session_id: byokSession.id,
      team_id: teamId,
      challenge_id: challengeId,
      provider: provider,
      model: aiResponse.model,
      request_count: 1,
      input_tokens: aiResponse.usage.inputTokens,
      output_tokens: aiResponse.usage.outputTokens,
      total_tokens: aiResponse.usage.totalTokens,
      latency_ms: aiResponse.latencyMs,
      status_code: statusCode,
      rate_limited: false,
    });

    // Log activity
    await supabase.from('activity_logs').insert({
      team_id: teamId,
      action: 'BYOK_AI_REQUEST',
      details: {
        provider: provider,
        model: aiResponse.model,
        challenge_id: challengeId,
        tokens: aiResponse.usage.totalTokens,
        latency_ms: aiResponse.latencyMs,
      },
    });

    // Return AI response
    return new Response(
      JSON.stringify({
        success: true,
        content: aiResponse.content,
        model: aiResponse.model,
        usage: aiResponse.usage,
        finishReason: aiResponse.finishReason,
        latencyMs: aiResponse.latencyMs,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Gateway error:', error.message); // NEVER log the API key
    return new Response(
      JSON.stringify({ error: 'Gateway error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
