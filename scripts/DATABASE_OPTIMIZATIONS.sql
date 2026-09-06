-- ═════════════════════════════════════════════════════════════════════════════
-- DATABASE OPTIMIZATIONS & FIXES
-- ═════════════════════════════════════════════════════════════════════════════

-- ═════════════════════════════════════════════════════════════════════════════
-- 1. ADD MISSING INDEXES (Performance)
-- ═════════════════════════════════════════════════════════════════════════════

-- Round sessions - frequent lookups
CREATE INDEX IF NOT EXISTS idx_round_sessions_team_status 
ON round_sessions(team_id, status);

CREATE INDEX IF NOT EXISTS idx_round_sessions_team_round 
ON round_sessions(team_id, round_id);

-- Challenge attempts - quiz lookups
CREATE INDEX IF NOT EXISTS idx_challenge_attempts_team_challenge 
ON challenge_attempts(team_id, challenge_id);

CREATE INDEX IF NOT EXISTS idx_challenge_attempts_round_session 
ON challenge_attempts(round_session_id);

-- Score events - leaderboard queries
CREATE INDEX IF NOT EXISTS idx_score_events_team_created 
ON score_events(team_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_score_events_round_session 
ON score_events(round_session_id);

-- Quiz answers - completion checking
CREATE INDEX IF NOT EXISTS idx_quiz_answers_round_session 
ON quiz_answers(round_session_id);

CREATE INDEX IF NOT EXISTS idx_quiz_answers_team 
ON quiz_answers(team_id);

-- Activity logs - admin dashboard
CREATE INDEX IF NOT EXISTS idx_activity_logs_team_created 
ON activity_logs(team_id, created_at DESC);

-- Security violations - monitoring
CREATE INDEX IF NOT EXISTS idx_security_violations_team 
ON security_violations(team_id, created_at DESC);

-- ═════════════════════════════════════════════════════════════════════════════
-- 2. ADD DATA RETENTION POLICIES (Prevent Infinite Growth)
-- ═════════════════════════════════════════════════════════════════════════════

-- Delete old activity logs after 90 days
CREATE OR REPLACE FUNCTION cleanup_old_activity_logs()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM activity_logs 
    WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$;

-- Delete old behavior analytics after 30 days
CREATE OR REPLACE FUNCTION cleanup_old_behavior_analytics()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM behavior_analytics 
    WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- 3. FIX ORPHANED DATA CHECK
-- ═════════════════════════════════════════════════════════════════════════════

-- Find challenge_attempts without round_sessions (orphaned data)
CREATE OR REPLACE FUNCTION find_orphaned_challenge_attempts()
RETURNS TABLE(id UUID, team_id UUID, created_at TIMESTAMPTZ)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT ca.id, ca.team_id, ca.created_at
    FROM challenge_attempts ca
    LEFT JOIN round_sessions rs ON ca.round_session_id = rs.id
    WHERE ca.round_session_id IS NOT NULL AND rs.id IS NULL;
END;
$$;

-- Find quiz_answers without round_sessions
CREATE OR REPLACE FUNCTION find_orphaned_quiz_answers()
RETURNS TABLE(id UUID, team_id UUID, created_at TIMESTAMPTZ)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT qa.id, qa.team_id, qa.answered_at
    FROM quiz_answers qa
    LEFT JOIN round_sessions rs ON qa.round_session_id = rs.id
    WHERE qa.round_session_id IS NOT NULL AND rs.id IS NULL;
END;
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- 4. CLEANUP ORPHANED DATA (Run manually when needed)
-- ═════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION cleanup_orphaned_data()
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_deleted_counts JSONB := '{}'::jsonb;
    v_count INT;
BEGIN
    -- Delete orphaned challenge_attempts
    DELETE FROM challenge_attempts ca
    WHERE ca.round_session_id IS NOT NULL 
    AND NOT EXISTS (
        SELECT 1 FROM round_sessions rs 
        WHERE rs.id = ca.round_session_id
    );
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('orphaned_challenge_attempts', v_count);
    
    -- Delete orphaned quiz_answers
    DELETE FROM quiz_answers qa
    WHERE qa.round_session_id IS NOT NULL 
    AND NOT EXISTS (
        SELECT 1 FROM round_sessions rs 
        WHERE rs.id = qa.round_session_id
    );
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('orphaned_quiz_answers', v_count);
    
    -- Delete orphaned quiz_sessions
    DELETE FROM quiz_sessions qs
    WHERE qs.round_session_id IS NOT NULL 
    AND NOT EXISTS (
        SELECT 1 FROM round_sessions rs 
        WHERE rs.id = qs.round_session_id
    );
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('orphaned_quiz_sessions', v_count);
    
    -- Delete orphaned score_events
    DELETE FROM score_events se
    WHERE se.round_session_id IS NOT NULL 
    AND NOT EXISTS (
        SELECT 1 FROM round_sessions rs 
        WHERE rs.id = se.round_session_id
    );
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('orphaned_score_events', v_count);
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Orphaned data cleaned up',
        'deleted_counts', v_deleted_counts
    );
END;
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- 5. VERIFICATION QUERIES
-- ═════════════════════════════════════════════════════════════════════════════

-- Check for orphaned data
SELECT 'Orphaned challenge_attempts' as issue, COUNT(*) as count
FROM challenge_attempts ca
LEFT JOIN round_sessions rs ON ca.round_session_id = rs.id
WHERE ca.round_session_id IS NOT NULL AND rs.id IS NULL

UNION ALL

SELECT 'Orphaned quiz_answers', COUNT(*)
FROM quiz_answers qa
LEFT JOIN round_sessions rs ON qa.round_session_id = rs.id
WHERE qa.round_session_id IS NOT NULL AND rs.id IS NULL

UNION ALL

SELECT 'Orphaned quiz_sessions', COUNT(*)
FROM quiz_sessions qs
LEFT JOIN round_sessions rs ON qs.round_session_id = rs.id
WHERE qs.round_session_id IS NOT NULL AND rs.id IS NULL;
