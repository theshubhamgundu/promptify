-- Migration 008: BYOK RLS Policies
-- Row Level Security for BYOK tables

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

-- Only Edge Functions can insert/update BYOK sessions (via service role)
-- Participants cannot directly insert sessions

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

-- Note: INSERT/UPDATE/DELETE operations on these tables should only be done via Edge Functions
-- using the service role key, not directly by clients
