-- Migration 017: BYOK Backend Enforcement & Unifying Prompt Heist
-- Creates BYOK tracking tables and drops legacy prompt tables

-- 1. BYOK Sessions (Tracks active, validated keys in memory)
CREATE TABLE IF NOT EXISTS byok_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    round_session_id UUID REFERENCES round_sessions(id) ON DELETE CASCADE,
    challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    provider_metadata JSONB DEFAULT '{}'::jsonb,
    is_validated BOOLEAN DEFAULT false,
    validated_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(team_id, round_session_id, challenge_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_byok_sessions_team ON byok_sessions(team_id);
CREATE INDEX IF NOT EXISTS idx_byok_sessions_challenge ON byok_sessions(challenge_id);
CREATE INDEX IF NOT EXISTS idx_byok_sessions_expires ON byok_sessions(expires_at);

-- 2. BYOK Usage Logs (Tracks LLM tokens for rate limiting and billing)
CREATE TABLE IF NOT EXISTS byok_usage_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    byok_session_id UUID REFERENCES byok_sessions(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    model TEXT,
    request_count INTEGER DEFAULT 1,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    latency_ms INTEGER,
    status_code INTEGER,
    error_type TEXT,
    rate_limited BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_byok_usage_team ON byok_usage_logs(team_id);
CREATE INDEX IF NOT EXISTS idx_byok_usage_challenge ON byok_usage_logs(challenge_id);

-- 3. Rate Limit RPC
CREATE OR REPLACE FUNCTION check_byok_rate_limit(
    p_team_id UUID,
    p_challenge_id UUID,
    p_request_count INTEGER,
    p_token_count INTEGER,
    p_max_requests INTEGER,
    p_max_tokens INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
    v_current_requests INTEGER := 0;
    v_current_tokens INTEGER := 0;
BEGIN
    -- Get current usage for this team & challenge
    SELECT 
        COALESCE(SUM(request_count), 0),
        COALESCE(SUM(total_tokens), 0)
    INTO v_current_requests, v_current_tokens
    FROM byok_usage_logs
    WHERE team_id = p_team_id AND challenge_id = p_challenge_id;

    -- Check if adding the new request exceeds limits
    IF (v_current_requests + p_request_count > p_max_requests) OR 
       (v_current_tokens + p_token_count > p_max_tokens) THEN
        RETURN FALSE;
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. View for BYOK Rate Limits
DROP TABLE IF EXISTS byok_rate_limits CASCADE;
CREATE OR REPLACE VIEW byok_rate_limits AS
SELECT 
    team_id,
    challenge_id,
    COALESCE(SUM(request_count), 0) as request_count,
    COALESCE(SUM(total_tokens), 0) as token_count
FROM byok_usage_logs
GROUP BY team_id, challenge_id;

-- Enable RLS on new tables
ALTER TABLE byok_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE byok_usage_logs ENABLE ROW LEVEL SECURITY;

-- BYOK Sessions: Teams can read their own sessions
CREATE POLICY byok_sessions_select ON byok_sessions
  FOR SELECT TO authenticated
  USING (
    team_id IN (
      SELECT team_id FROM participants WHERE user_id = auth.uid()
    )
  );

-- BYOK Usage Logs: Teams can read their own logs
CREATE POLICY byok_usage_logs_select ON byok_usage_logs
  FOR SELECT TO authenticated
  USING (
    team_id IN (
      SELECT team_id FROM participants WHERE user_id = auth.uid()
    )
  );

-- 5. Unify Prompt Heist -> Drop legacy tables
DROP TABLE IF EXISTS prompt_submissions CASCADE;
DROP TABLE IF EXISTS prompt_round_sessions CASCADE;
DROP TABLE IF EXISTS prompt_challenges CASCADE;
DROP FUNCTION IF EXISTS get_best_submission(UUID, UUID);
DROP FUNCTION IF EXISTS complete_sub_round(UUID, UUID, INT, DECIMAL);
DROP FUNCTION IF EXISTS submit_prompt_attempt(UUID, UUID, UUID, INT, TEXT, TEXT, JSONB, DECIMAL, INT, BOOLEAN, JSONB, BOOLEAN);
DROP FUNCTION IF EXISTS start_prompt_round_session(UUID, UUID, UUID);
