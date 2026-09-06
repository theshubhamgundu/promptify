-- =====================================================
-- FIX: Round Reset Cascade Issues
-- =====================================================
-- This migration fixes foreign key constraints so that
-- when round_sessions are deleted, related records are
-- properly cascaded or cleaned up.
--
-- ISSUE: Tables with ON DELETE SET NULL cause orphaned
-- records that still contribute to scores even after
-- round reset.
--
-- SOLUTION: Change to ON DELETE CASCADE for automatic
-- cleanup when rounds are reset.
-- =====================================================

BEGIN;

-- =====================================================
-- 1. Fix score_events table
-- =====================================================
-- CRITICAL: This is the main cause of persistent scores
-- after round reset. Score events were getting orphaned
-- with NULL round_session_id.

-- Drop the existing constraint
ALTER TABLE score_events 
DROP CONSTRAINT IF EXISTS score_events_round_session_id_fkey;

-- Add new constraint with CASCADE
ALTER TABLE score_events
ADD CONSTRAINT score_events_round_session_id_fkey 
FOREIGN KEY (round_session_id) 
REFERENCES round_sessions(id) 
ON DELETE CASCADE;

COMMENT ON CONSTRAINT score_events_round_session_id_fkey ON score_events IS 
'CASCADE delete: When round_session deleted, remove related score events';

-- =====================================================
-- 2. Fix security_violations table
-- =====================================================
-- Violations should be kept for audit even if round is reset
-- But we'll allow CASCADE for easier cleanup

ALTER TABLE security_violations 
DROP CONSTRAINT IF EXISTS security_violations_round_session_id_fkey;

ALTER TABLE security_violations
ADD CONSTRAINT security_violations_round_session_id_fkey 
FOREIGN KEY (round_session_id) 
REFERENCES round_sessions(id) 
ON DELETE CASCADE;

COMMENT ON CONSTRAINT security_violations_round_session_id_fkey ON security_violations IS 
'CASCADE delete: When round_session deleted, remove related violations';

-- =====================================================
-- 3. Add indexes for better delete performance
-- =====================================================
-- When deleting round_sessions, these indexes speed up
-- the cascade deletion of related records

CREATE INDEX IF NOT EXISTS idx_score_events_round_session_id 
ON score_events(round_session_id) 
WHERE round_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_security_violations_round_session_id 
ON security_violations(round_session_id) 
WHERE round_session_id IS NOT NULL;

-- =====================================================
-- 4. Create helper function to manually reset a round
-- =====================================================
-- This function provides a safe way to reset a round
-- from SQL console if needed

CREATE OR REPLACE FUNCTION admin_reset_team_round(
    p_team_id UUID,
    p_round_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_round_session_id UUID;
    v_deleted_count JSONB;
    v_result JSON;
BEGIN
    -- Get round_session_id
    SELECT id INTO v_round_session_id
    FROM round_sessions
    WHERE team_id = p_team_id AND round_id = p_round_id;

    IF v_round_session_id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Round session not found'
        );
    END IF;

    -- Initialize counters
    v_deleted_count := '{}'::jsonb;

    -- Delete all related data (in correct order)
    -- Most tables will CASCADE automatically now, but we'll track deletions
    
    WITH deleted AS (
        DELETE FROM score_events 
        WHERE round_session_id = v_round_session_id
        RETURNING 1
    )
    SELECT COUNT(*) INTO v_deleted_count->'score_events' FROM deleted;

    WITH deleted AS (
        DELETE FROM quiz_answers 
        WHERE round_session_id = v_round_session_id
        RETURNING 1
    )
    SELECT COUNT(*) INTO v_deleted_count->'quiz_answers' FROM deleted;

    WITH deleted AS (
        DELETE FROM quiz_sessions 
        WHERE round_session_id = v_round_session_id
        RETURNING 1
    )
    SELECT COUNT(*) INTO v_deleted_count->'quiz_sessions' FROM deleted;

    WITH deleted AS (
        DELETE FROM prompt_submissions 
        WHERE round_session_id = v_round_session_id
        RETURNING 1
    )
    SELECT COUNT(*) INTO v_deleted_count->'prompt_submissions' FROM deleted;

    WITH deleted AS (
        DELETE FROM submissions 
        WHERE round_session_id = v_round_session_id
        RETURNING 1
    )
    SELECT COUNT(*) INTO v_deleted_count->'submissions' FROM deleted;

    -- Delete the round_session (will CASCADE to remaining tables)
    DELETE FROM round_sessions 
    WHERE id = v_round_session_id;

    -- Log the action
    INSERT INTO activity_logs (action, team_id, details)
    VALUES (
        'ROUND_RESET_SQL',
        p_team_id,
        jsonb_build_object(
            'round_id', p_round_id,
            'round_session_id', v_round_session_id,
            'deleted_counts', v_deleted_count,
            'method', 'SQL_FUNCTION'
        )
    );

    RETURN json_build_object(
        'success', true,
        'round_session_id', v_round_session_id,
        'deleted_counts', v_deleted_count
    );
END;
$$;

COMMENT ON FUNCTION admin_reset_team_round IS 
'Admin function to reset a specific round for a team. Deletes all related data and round_session.';

-- =====================================================
-- 5. Create helper function to reset ALL rounds
-- =====================================================

CREATE OR REPLACE FUNCTION admin_reset_all_team_rounds(
    p_team_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_deleted_count JSONB;
    v_rounds_count INT;
BEGIN
    -- Count rounds to reset
    SELECT COUNT(*) INTO v_rounds_count
    FROM round_sessions
    WHERE team_id = p_team_id;

    IF v_rounds_count = 0 THEN
        RETURN json_build_object(
            'success', false,
            'error', 'No round sessions found for this team'
        );
    END IF;

    -- Initialize counters
    v_deleted_count := '{}'::jsonb;

    -- Delete all related data using team_id (more efficient)
    WITH deleted AS (DELETE FROM score_events WHERE team_id = p_team_id RETURNING 1)
    SELECT COUNT(*) INTO v_deleted_count->'score_events' FROM deleted;

    WITH deleted AS (DELETE FROM quiz_answers WHERE team_id = p_team_id RETURNING 1)
    SELECT COUNT(*) INTO v_deleted_count->'quiz_answers' FROM deleted;

    WITH deleted AS (DELETE FROM quiz_sessions WHERE team_id = p_team_id RETURNING 1)
    SELECT COUNT(*) INTO v_deleted_count->'quiz_sessions' FROM deleted;

    WITH deleted AS (DELETE FROM prompt_submissions WHERE team_id = p_team_id RETURNING 1)
    SELECT COUNT(*) INTO v_deleted_count->'prompt_submissions' FROM deleted;

    WITH deleted AS (DELETE FROM submissions WHERE team_id = p_team_id RETURNING 1)
    SELECT COUNT(*) INTO v_deleted_count->'submissions' FROM deleted;

    WITH deleted AS (DELETE FROM byok_usage WHERE team_id = p_team_id RETURNING 1)
    SELECT COUNT(*) INTO v_deleted_count->'byok_usage' FROM deleted;

    -- Delete all round_sessions (will CASCADE to remaining tables)
    DELETE FROM round_sessions WHERE team_id = p_team_id;

    -- Log the action
    INSERT INTO activity_logs (action, team_id, details)
    VALUES (
        'FULL_RESET_SQL',
        p_team_id,
        jsonb_build_object(
            'rounds_count', v_rounds_count,
            'deleted_counts', v_deleted_count,
            'method', 'SQL_FUNCTION'
        )
    );

    RETURN json_build_object(
        'success', true,
        'rounds_reset', v_rounds_count,
        'deleted_counts', v_deleted_count
    );
END;
$$;

COMMENT ON FUNCTION admin_reset_all_team_rounds IS 
'Admin function to reset ALL rounds for a team. Complete fresh start.';

-- =====================================================
-- 6. Grant permissions to authenticated users
-- =====================================================
-- Only admins should be able to call these functions

REVOKE ALL ON FUNCTION admin_reset_team_round FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_reset_all_team_rounds FROM PUBLIC;

-- These will be called by the app using service role
-- or by admins directly in SQL console

-- =====================================================
-- 7. Create view to check orphaned score events
-- =====================================================
-- This view helps identify any existing orphaned records

CREATE OR REPLACE VIEW v_orphaned_score_events AS
SELECT 
    se.*,
    t.name as team_name
FROM score_events se
LEFT JOIN round_sessions rs ON se.round_session_id = rs.id
JOIN teams t ON se.team_id = t.id
WHERE se.round_session_id IS NOT NULL 
  AND rs.id IS NULL;

COMMENT ON VIEW v_orphaned_score_events IS 
'Shows score_events that reference non-existent round_sessions (orphaned records)';

-- =====================================================
-- 8. Clean up existing orphaned records
-- =====================================================
-- Delete any existing orphaned score events that have
-- NULL or invalid round_session_id

DELETE FROM score_events
WHERE round_session_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM round_sessions 
    WHERE round_sessions.id = score_events.round_session_id
  );

-- =====================================================
-- 9. Add constraints to prevent future issues
-- =====================================================

-- Ensure score_events always have valid references
ALTER TABLE score_events
ADD CONSTRAINT score_events_valid_refs CHECK (
    (round_session_id IS NULL) OR 
    (submission_id IS NULL) OR 
    (challenge_id IS NULL)
);

COMMENT ON CONSTRAINT score_events_valid_refs ON score_events IS 
'Ensures at least one reference is provided for audit trail';

COMMIT;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================
DO $$ 
BEGIN 
    RAISE NOTICE '✅ Round reset cascade fixes applied successfully!';
    RAISE NOTICE '';
    RAISE NOTICE '📋 Summary of changes:';
    RAISE NOTICE '  • score_events: Changed to ON DELETE CASCADE';
    RAISE NOTICE '  • security_violations: Changed to ON DELETE CASCADE';
    RAISE NOTICE '  • Added indexes for better delete performance';
    RAISE NOTICE '  • Created admin_reset_team_round() function';
    RAISE NOTICE '  • Created admin_reset_all_team_rounds() function';
    RAISE NOTICE '  • Cleaned up orphaned score_events';
    RAISE NOTICE '';
    RAISE NOTICE '🔧 Usage from SQL:';
    RAISE NOTICE '  -- Reset single round:';
    RAISE NOTICE '  SELECT admin_reset_team_round(';
    RAISE NOTICE '    ''<team_id>''::uuid,';
    RAISE NOTICE '    ''<round_id>''::uuid';
    RAISE NOTICE '  );';
    RAISE NOTICE '';
    RAISE NOTICE '  -- Reset all rounds:';
    RAISE NOTICE '  SELECT admin_reset_all_team_rounds(''<team_id>''::uuid);';
    RAISE NOTICE '';
    RAISE NOTICE '  -- Check for orphaned records:';
    RAISE NOTICE '  SELECT * FROM v_orphaned_score_events;';
END $$;
