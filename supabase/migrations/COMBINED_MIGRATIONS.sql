-- ============================================================================
-- BYOK SYSTEM - COMBINED MIGRATIONS
-- Copy and paste this entire file into Supabase SQL Editor
-- ============================================================================

-- Migration 007: BYOK (Bring Your Own Key) System
-- Secure AI provider integration without storing API keys

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enum for supported AI providers
CREATE TYPE ai_provider AS ENUM ('OPENAI', 'ANTHROPIC', 'GOOGLE', 'MISTRAL', 'COHERE', 'GROQ');

-- BYOK Configuration per Challenge
-- Extends the challenges.configuration JSONB with BYOK settings
-- Example structure for challenges.configuration:
-- {
--   "byok": {
--     "enabled": true,
--     "required_providers": ["OPENAI", "ANTHROPIC"],
--     "allowed_models": ["gpt-4", "gpt-3.5-turbo", "claude-3-sonnet"],
--     "max_requests": 100,
--     "max_tokens_per_request": 4000,
--     "max_total_tokens": 50000,
--     "allowed_tools": false,
--     "allowed_web_access": false,
--     "timeout_seconds": 30
--   }
-- }

-- BYOK Session Metadata (NO API KEYS STORED)
-- Tracks that a team has a valid provider connection for a round session
CREATE TABLE IF NOT EXISTS byok_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    round_session_id UUID NOT NULL REFERENCES round_sessions(id) ON DELETE CASCADE,
    challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE,
    provider ai_provider NOT NULL,
    provider_metadata JSONB DEFAULT '{}'::jsonb, -- Safe metadata like model capabilities, not keys
    is_validated BOOLEAN NOT NULL DEFAULT false,
    validated_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL, -- Session expiry
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(team_id, round_session_id, challenge_id, provider)
);

-- BYOK Usage Logs (Audit trail, NO KEYS or SENSITIVE PROMPTS)
CREATE TABLE IF NOT EXISTS byok_usage_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    byok_session_id UUID NOT NULL REFERENCES byok_sessions(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE,
    provider ai_provider NOT NULL,
    model TEXT NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 1,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    latency_ms INTEGER,
    status_code INTEGER,
    error_type TEXT, -- Generic error type, not full error message
    rate_limited BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- BYOK Rate Limits (Per team, per challenge)
CREATE TABLE IF NOT EXISTS byok_rate_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    request_count INTEGER NOT NULL DEFAULT 0,
    token_count INTEGER NOT NULL DEFAULT 0,
    last_request_at TIMESTAMPTZ,
    window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(team_id, challenge_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_byok_sessions_team_round ON byok_sessions(team_id, round_session_id);
CREATE INDEX IF NOT EXISTS idx_byok_sessions_expires ON byok_sessions(expires_at) WHERE is_validated = true;
CREATE INDEX IF NOT EXISTS idx_byok_usage_logs_team ON byok_usage_logs(team_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_byok_usage_logs_challenge ON byok_usage_logs(challenge_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_byok_rate_limits_team_challenge ON byok_rate_limits(team_id, challenge_id);

-- Function to clean up expired BYOK sessions
CREATE OR REPLACE FUNCTION cleanup_expired_byok_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM byok_sessions WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check and update rate limits
CREATE OR REPLACE FUNCTION check_byok_rate_limit(
    p_team_id UUID,
    p_challenge_id UUID,
    p_request_count INTEGER,
    p_token_count INTEGER,
    p_max_requests INTEGER,
    p_max_tokens INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
    v_current_requests INTEGER;
    v_current_tokens INTEGER;
BEGIN
    -- Get or create rate limit record
    INSERT INTO byok_rate_limits (team_id, challenge_id, request_count, token_count, last_request_at)
    VALUES (p_team_id, p_challenge_id, 0, 0, now())
    ON CONFLICT (team_id, challenge_id) DO NOTHING;
    
    -- Get current counts
    SELECT request_count, token_count INTO v_current_requests, v_current_tokens
    FROM byok_rate_limits
    WHERE team_id = p_team_id AND challenge_id = p_challenge_id;
    
    -- Check limits
    IF (v_current_requests + p_request_count > p_max_requests) OR
       (v_current_tokens + p_token_count > p_max_tokens) THEN
        RETURN false;
    END IF;
    
    -- Update counts
    UPDATE byok_rate_limits
    SET 
        request_count = request_count + p_request_count,
        token_count = token_count + p_token_count,
        last_request_at = now()
    WHERE team_id = p_team_id AND challenge_id = p_challenge_id;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments for documentation
COMMENT ON TABLE byok_sessions IS 'Tracks validated BYOK provider connections. NEVER stores API keys.';
COMMENT ON TABLE byok_usage_logs IS 'Audit trail of AI API usage. Does not store API keys or sensitive prompt content.';
COMMENT ON TABLE byok_rate_limits IS 'Rate limiting counters per team per challenge.';
COMMENT ON COLUMN byok_sessions.provider_metadata IS 'Safe provider metadata only - model names, capabilities, etc. NEVER API keys.';

-- ============================================================================
-- Migration 008: BYOK RLS Policies
-- Row Level Security for BYOK tables
-- ============================================================================

-- Enable RLS
ALTER TABLE byok_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE byok_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE byok_rate_limits ENABLE ROW LEVEL SECURITY;

-- BYOK Sessions Policies
-- Teams can read their own BYOK sessions
CREATE POLICY "Teams can view their own BYOK sessions"
    ON byok_sessions FOR SELECT
    USING (
        team_id IN (
            SELECT id FROM teams WHERE access_code = current_setting('app.current_team_code', true)
        )
    );

-- Admins can view all BYOK sessions
CREATE POLICY "Admins can view all BYOK sessions"
    ON byok_sessions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role IN ('ADMIN', 'COORDINATOR')
        )
    );

-- BYOK Usage Logs Policies
-- Teams can view their own usage logs
CREATE POLICY "Teams can view their own BYOK usage logs"
    ON byok_usage_logs FOR SELECT
    USING (
        team_id IN (
            SELECT id FROM teams WHERE access_code = current_setting('app.current_team_code', true)
        )
    );

-- Admins can view all usage logs
CREATE POLICY "Admins can view all BYOK usage logs"
    ON byok_usage_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role IN ('ADMIN', 'COORDINATOR')
        )
    );

-- BYOK Rate Limits Policies
-- Teams can view their own rate limits
CREATE POLICY "Teams can view their own BYOK rate limits"
    ON byok_rate_limits FOR SELECT
    USING (
        team_id IN (
            SELECT id FROM teams WHERE access_code = current_setting('app.current_team_code', true)
        )
    );

-- Admins can view all rate limits
CREATE POLICY "Admins can view all BYOK rate limits"
    ON byok_rate_limits FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role IN ('ADMIN', 'COORDINATOR')
        )
    );

-- ============================================================================
-- VERIFICATION QUERIES (Run these after to verify)
-- ============================================================================

-- Check tables were created
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' AND table_name LIKE 'byok%';

-- Check functions were created
-- SELECT routine_name FROM information_schema.routines 
-- WHERE routine_name IN ('cleanup_expired_byok_sessions', 'check_byok_rate_limit');

-- Check enum was created
-- SELECT enum_range(NULL::ai_provider);

-- ============================================================================
-- MIGRATIONS COMPLETE
-- ============================================================================
