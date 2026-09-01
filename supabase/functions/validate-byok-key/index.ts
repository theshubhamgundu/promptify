// Edge Function: Validate BYOK API Key
// SECURITY: This function NEVER stores or logs the raw API key

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getProvider, AIProvider } from '../_shared/providers.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ValidateRequest {
  provider: AIProvider;
  apiKey: string; // NEVER stored, only validated
  teamId: string;
  roundSessionId?: string;
  challengeId?: string;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Parse request
    const { provider, apiKey, teamId, roundSessionId, challengeId }: ValidateRequest = await req.json();

    // Validate inputs (NOT the API key, just the structure)
    if (!provider || !apiKey || !teamId) {
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

    // Initialize Supabase client with service role for database operations
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

    // Verify round session exists and belongs to team
    const { data: roundSession, error: sessionError } = await supabase
      .from('round_sessions')
      .select('id, team_id, round_id')
      .eq('id', roundSessionId)
      .eq('team_id', teamId)
      .single();

    if (sessionError || !roundSession) {
      return new Response(
        JSON.stringify({ error: 'Invalid round session' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get challenge configuration
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

    // Check if BYOK is enabled for this challenge
    const byokConfig = (challenge.configuration as any)?.byok;
    if (!byokConfig?.enabled) {
      return new Response(
        JSON.stringify({ error: 'BYOK not enabled for this challenge' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate provider is allowed
    const allowedProviders = byokConfig.required_providers || [];
    if (!allowedProviders.includes(provider)) {
      return new Response(
        JSON.stringify({ error: `Provider ${provider} not allowed for this challenge` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate API key with provider (NEVER stored)
    const providerAdapter = getProvider(provider);
    const validationResult = await providerAdapter.validate(apiKey);

    if (!validationResult.isValid) {
      return new Response(
        JSON.stringify({
          success: false,
          error: validationResult.error || 'Invalid API key',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create BYOK session record (NO API KEY STORED)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 4); // 4 hour session

    const { error: insertError } = await supabase
      .from('byok_sessions')
      .upsert({
        team_id: teamId,
        round_session_id: roundSessionId || null,
        challenge_id: challengeId || null,
        provider: provider,
        provider_metadata: validationResult.metadata || {},
        is_validated: true,
        validated_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error('Failed to create BYOK session:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to create session' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log validation activity (NO API KEY)
    await supabase.from('activity_logs').insert({
      team_id: teamId,
      action: 'BYOK_KEY_VALIDATED',
      details: {
        provider: provider,
        challenge_id: challengeId || null,
        round_session_id: roundSessionId || null,
        context: challengeId ? 'CHALLENGE' : 'DASHBOARD'
      },
    });

    // Return success with metadata only (NO API KEY)
    return new Response(
      JSON.stringify({
        success: true,
        provider: provider,
        metadata: validationResult.metadata,
        sessionExpiresAt: expiresAt.toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Validation error:', error.message); // Log error message, NOT the key
    return new Response(
      JSON.stringify({ error: 'Validation failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
