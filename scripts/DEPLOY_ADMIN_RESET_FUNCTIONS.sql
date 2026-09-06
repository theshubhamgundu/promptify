-- ═════════════════════════════════════════════════════════════════════════════
-- DEPLOY ADMIN RESET FUNCTIONS
-- ═════════════════════════════════════════════════════════════════════════════
-- This script creates two server-side functions with SECURITY DEFINER to bypass
-- RLS policies and allow admins to properly reset quiz/round data.
--
-- FUNCTIONS CREATED:
-- 1. admin_reset_round(team_id, round_id) - Reset a single round
-- 2. admin_reset_all_rounds(team_id) - Reset all rounds for a team
--
-- WHY THIS IS NEEDED:
-- - Client-side deletions are blocked by Row Level Security (RLS) policies
-- - SECURITY DEFINER runs with elevated privileges to bypass RLS
-- - This ensures admin reset buttons actually delete data from database
--
-- HOW TO USE:
-- 1. Run this script in Supabase SQL Editor
-- 2. Frontend will call these via supabase.rpc('admin_reset_round', {...})
-- 3. Functions return JSONB with success status and deletion counts
-- ═════════════════════════════════════════════════════════════════════════════

-- ╔═════════════════════════════════════════════════════════════════════════════╗
-- ║ FUNCTION 1: admin_reset_round - Reset Single Round                          ║
-- ╚═════════════════════════════════════════════════════════════════════════════╝

DROP FUNCTION IF EXISTS admin_reset_round(UUID, UUID);

CREATE OR REPLACE FUNCTION admin_reset_round(
    p_team_id UUID,
    p_round_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- This bypasses RLS!
SET search_path = public
AS $$
DECLARE
    v_round_session_id UUID;
    v_deleted_counts JSONB := '{}'::jsonb;
    v_team_name TEXT;
    v_round_name TEXT;
    v_count INT;
BEGIN
    -- Get team and round names for logging
    SELECT name INTO v_team_name FROM teams WHERE id = p_team_id;
    SELECT name INTO v_round_name FROM rounds WHERE id = p_round_id;
    
    -- Get round_session_id
    SELECT id INTO v_round_session_id
    FROM round_sessions
    WHERE team_id = p_team_id AND round_id = p_round_id;
    
    IF v_round_session_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'No round session found for this team and round',
            'team_id', p_team_id,
            'round_id', p_round_id
        );
    END IF;
    
    -- Delete all related data (in correct dependency order)
    
    -- 1. Delete challenge_attempts (quiz answers)
    BEGIN
        WITH deleted AS (
            DELETE FROM challenge_attempts 
            WHERE round_session_id = v_round_session_id
            RETURNING 1
        )
        SELECT COUNT(*)::int INTO v_count FROM deleted;
        v_deleted_counts := v_deleted_counts || jsonb_build_object('challenge_attempts', v_count);
    EXCEPTION WHEN undefined_table THEN
        v_deleted_counts := v_deleted_counts || jsonb_build_object('challenge_attempts', 0);
    END;
    
    -- 2. Delete quiz_answers
    BEGIN
        WITH deleted AS (
            DELETE FROM quiz_answers 
            WHERE round_session_id = v_round_session_id
            RETURNING 1
        )
        SELECT COUNT(*)::int INTO v_count FROM deleted;
        v_deleted_counts := v_deleted_counts || jsonb_build_object('quiz_answers', v_count);
    EXCEPTION WHEN undefined_table THEN
        v_deleted_counts := v_deleted_counts || jsonb_build_object('quiz_answers', 0);
    END;
    
    -- 3. Delete quiz_sessions
    BEGIN
        WITH deleted AS (
            DELETE FROM quiz_sessions 
            WHERE round_session_id = v_round_session_id
            RETURNING 1
        )
        SELECT COUNT(*)::int INTO v_count FROM deleted;
        v_deleted_counts := v_deleted_counts || jsonb_build_object('quiz_sessions', v_count);
    EXCEPTION WHEN undefined_table THEN
        v_deleted_counts := v_deleted_counts || jsonb_build_object('quiz_sessions', 0);
    END;
    
    -- 4. Delete score_events
    BEGIN
        WITH deleted AS (
            DELETE FROM score_events 
            WHERE round_session_id = v_round_session_id
            RETURNING 1
        )
        SELECT COUNT(*)::int INTO v_count FROM deleted;
        v_deleted_counts := v_deleted_counts || jsonb_build_object('score_events', v_count);
    EXCEPTION WHEN undefined_table THEN
        v_deleted_counts := v_deleted_counts || jsonb_build_object('score_events', 0);
    END;
    
    -- 5. Delete submissions
    BEGIN
        WITH deleted AS (
            DELETE FROM submissions 
            WHERE round_session_id = v_round_session_id
            RETURNING 1
        )
        SELECT COUNT(*)::int INTO v_count FROM deleted;
        v_deleted_counts := v_deleted_counts || jsonb_build_object('submissions', v_count);
    EXCEPTION WHEN undefined_table THEN
        v_deleted_counts := v_deleted_counts || jsonb_build_object('submissions', 0);
    END;
    
    -- 6. Delete security_violations (if exists)
    BEGIN
        WITH deleted AS (
            DELETE FROM security_violations 
            WHERE round_session_id = v_round_session_id
            RETURNING 1
        )
        SELECT COUNT(*)::int INTO v_count FROM deleted;
        v_deleted_counts := v_deleted_counts || jsonb_build_object('security_violations', v_count);
    EXCEPTION WHEN undefined_table THEN
        v_deleted_counts := v_deleted_counts || jsonb_build_object('security_violations', 0);
    END;
    
    -- 7. Delete byok_usage (if exists)
    BEGIN
        WITH deleted AS (
            DELETE FROM byok_usage 
            WHERE round_session_id = v_round_session_id
            RETURNING 1
        )
        SELECT COUNT(*)::int INTO v_count FROM deleted;
        v_deleted_counts := v_deleted_counts || jsonb_build_object('byok_usage', v_count);
    EXCEPTION WHEN undefined_table THEN
        v_deleted_counts := v_deleted_counts || jsonb_build_object('byok_usage', 0);
    END;
    
    -- 8. Delete interaction_logs (if exists)
    BEGIN
        WITH deleted AS (
            DELETE FROM interaction_logs 
            WHERE round_session_id = v_round_session_id
            RETURNING 1
        )
        SELECT COUNT(*)::int INTO v_count FROM deleted;
        v_deleted_counts := v_deleted_counts || jsonb_build_object('interaction_logs', v_count);
    EXCEPTION WHEN undefined_table THEN
        v_deleted_counts := v_deleted_counts || jsonb_build_object('interaction_logs', 0);
    END;
    
    -- 9. Delete round_sessions (parent record)
    DELETE FROM round_sessions 
    WHERE id = v_round_session_id;
    
    v_deleted_counts := v_deleted_counts || jsonb_build_object('round_sessions', 1);
    
    -- Log the action
    INSERT INTO activity_logs (action, team_id, details)
    VALUES (
        'ADMIN_RESET_ROUND',
        p_team_id,
        jsonb_build_object(
            'admin_action', 'RESET_ROUND',
            'round_id', p_round_id,
            'round_name', v_round_name,
            'team_name', v_team_name,
            'round_session_id', v_round_session_id,
            'deleted_counts', v_deleted_counts,
            'timestamp', NOW()
        )
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Round reset successfully',
        'team_id', p_team_id,
        'team_name', v_team_name,
        'round_id', p_round_id,
        'round_name', v_round_name,
        'round_session_id', v_round_session_id,
        'deleted_counts', v_deleted_counts
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM,
            'detail', SQLSTATE,
            'team_id', p_team_id,
            'round_id', p_round_id
        );
END;
$$;

GRANT EXECUTE ON FUNCTION admin_reset_round(UUID, UUID) TO authenticated;


-- ╔═════════════════════════════════════════════════════════════════════════════╗
-- ║ FUNCTION 2: admin_reset_all_rounds - Reset All Rounds                       ║
-- ╚═════════════════════════════════════════════════════════════════════════════╝

DROP FUNCTION IF EXISTS admin_reset_all_rounds(UUID);

CREATE OR REPLACE FUNCTION admin_reset_all_rounds(
    p_team_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- This bypasses RLS!
SET search_path = public
AS $$
DECLARE
    v_round_session_ids UUID[];
    v_deleted_counts JSONB := '{}'::jsonb;
    v_team_name TEXT;
    v_total_rounds INTEGER := 0;
    v_count INT;
BEGIN
    -- Get team name for logging
    SELECT name INTO v_team_name FROM teams WHERE id = p_team_id;
    
    -- Get all round_session_ids for this team
    SELECT ARRAY_AGG(id) INTO v_round_session_ids
    FROM round_sessions
    WHERE team_id = p_team_id;
    
    IF v_round_session_ids IS NULL OR ARRAY_LENGTH(v_round_session_ids, 1) = 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'No round sessions found for this team',
            'team_id', p_team_id
        );
    END IF;
    
    v_total_rounds := ARRAY_LENGTH(v_round_session_ids, 1);
    
    -- Delete all related data (in correct dependency order)
    -- Using team_id is more efficient than looping through sessions
    
    -- Delete only tables that exist
    BEGIN
        WITH deleted AS (DELETE FROM challenge_attempts WHERE team_id = p_team_id RETURNING 1)
        SELECT COUNT(*)::int INTO v_count FROM deleted;
        v_deleted_counts := v_deleted_counts || jsonb_build_object('challenge_attempts', v_count);
    EXCEPTION WHEN undefined_table THEN
        v_deleted_counts := v_deleted_counts || jsonb_build_object('challenge_attempts', 0);
    END;
    
    BEGIN
        WITH deleted AS (DELETE FROM quiz_answers WHERE team_id = p_team_id RETURNING 1)
        SELECT COUNT(*)::int INTO v_count FROM deleted;
        v_deleted_counts := v_deleted_counts || jsonb_build_object('quiz_answers', v_count);
    EXCEPTION WHEN undefined_table THEN
        v_deleted_counts := v_deleted_counts || jsonb_build_object('quiz_answers', 0);
    END;
    
    BEGIN
        WITH deleted AS (DELETE FROM quiz_sessions WHERE team_id = p_team_id RETURNING 1)
        SELECT COUNT(*)::int INTO v_count FROM deleted;
        v_deleted_counts := v_deleted_counts || jsonb_build_object('quiz_sessions', v_count);
    EXCEPTION WHEN undefined_table THEN
        v_deleted_counts := v_deleted_counts || jsonb_build_object('quiz_sessions', 0);
    END;
    
    BEGIN
        WITH deleted AS (DELETE FROM score_events WHERE team_id = p_team_id RETURNING 1)
        SELECT COUNT(*)::int INTO v_count FROM deleted;
        v_deleted_counts := v_deleted_counts || jsonb_build_object('score_events', v_count);
    EXCEPTION WHEN undefined_table THEN
        v_deleted_counts := v_deleted_counts || jsonb_build_object('score_events', 0);
    END;
    
    BEGIN
        WITH deleted AS (DELETE FROM submissions WHERE team_id = p_team_id RETURNING 1)
        SELECT COUNT(*)::int INTO v_count FROM deleted;
        v_deleted_counts := v_deleted_counts || jsonb_build_object('submissions', v_count);
    EXCEPTION WHEN undefined_table THEN
        v_deleted_counts := v_deleted_counts || jsonb_build_object('submissions', 0);
    END;
    
    BEGIN
        WITH deleted AS (DELETE FROM security_violations WHERE team_id = p_team_id RETURNING 1)
        SELECT COUNT(*)::int INTO v_count FROM deleted;
        v_deleted_counts := v_deleted_counts || jsonb_build_object('security_violations', v_count);
    EXCEPTION WHEN undefined_table THEN
        v_deleted_counts := v_deleted_counts || jsonb_build_object('security_violations', 0);
    END;
    
    BEGIN
        WITH deleted AS (DELETE FROM byok_usage WHERE team_id = p_team_id RETURNING 1)
        SELECT COUNT(*)::int INTO v_count FROM deleted;
        v_deleted_counts := v_deleted_counts || jsonb_build_object('byok_usage', v_count);
    EXCEPTION WHEN undefined_table THEN
        v_deleted_counts := v_deleted_counts || jsonb_build_object('byok_usage', 0);
    END;
    
    BEGIN
        WITH deleted AS (DELETE FROM interaction_logs WHERE team_id = p_team_id RETURNING 1)
        SELECT COUNT(*)::int INTO v_count FROM deleted;
        v_deleted_counts := v_deleted_counts || jsonb_build_object('interaction_logs', v_count);
    EXCEPTION WHEN undefined_table THEN
        v_deleted_counts := v_deleted_counts || jsonb_build_object('interaction_logs', 0);
    END;
    
    -- Delete round_sessions (parent records)
    DELETE FROM round_sessions 
    WHERE team_id = p_team_id;
    
    v_deleted_counts := v_deleted_counts || jsonb_build_object('round_sessions', v_total_rounds);
    
    -- Log the action
    INSERT INTO activity_logs (action, team_id, details)
    VALUES (
        'ADMIN_RESET_ALL_ROUNDS',
        p_team_id,
        jsonb_build_object(
            'admin_action', 'RESET_ALL_ROUNDS',
            'team_name', v_team_name,
            'rounds_count', v_total_rounds,
            'deleted_counts', v_deleted_counts,
            'timestamp', NOW()
        )
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'All rounds reset successfully',
        'team_id', p_team_id,
        'team_name', v_team_name,
        'rounds_count', v_total_rounds,
        'deleted_counts', v_deleted_counts
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM,
            'detail', SQLSTATE,
            'team_id', p_team_id
        );
END;
$$;

GRANT EXECUTE ON FUNCTION admin_reset_all_rounds(UUID) TO authenticated;


-- ╔═════════════════════════════════════════════════════════════════════════════╗
-- ║ VERIFICATION                                                                 ║
-- ╚═════════════════════════════════════════════════════════════════════════════╝

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════════════════════';
    RAISE NOTICE '✅ ADMIN RESET FUNCTIONS DEPLOYED SUCCESSFULLY';
    RAISE NOTICE '═══════════════════════════════════════════════════════════════════';
    RAISE NOTICE '';
    RAISE NOTICE '📋 Functions Created:';
    RAISE NOTICE '   1. admin_reset_round(team_id, round_id)';
    RAISE NOTICE '   2. admin_reset_all_rounds(team_id)';
    RAISE NOTICE '';
    RAISE NOTICE '🔒 Security: DEFINER mode (bypasses RLS)';
    RAISE NOTICE '📊 Returns: JSONB with success status and deletion counts';
    RAISE NOTICE '';
    RAISE NOTICE '🔧 Frontend Usage:';
    RAISE NOTICE '   // Reset single round';
    RAISE NOTICE '   await supabase.rpc(''admin_reset_round'', {';
    RAISE NOTICE '     p_team_id: teamId,';
    RAISE NOTICE '     p_round_id: roundId';
    RAISE NOTICE '   });';
    RAISE NOTICE '';
    RAISE NOTICE '   // Reset all rounds';
    RAISE NOTICE '   await supabase.rpc(''admin_reset_all_rounds'', {';
    RAISE NOTICE '     p_team_id: teamId';
    RAISE NOTICE '   });';
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════════════════════';
END $$;

-- Verify functions exist
SELECT 
    'Function Verification' as section,
    proname as function_name,
    pronargs as num_params,
    prorettype::regtype as return_type,
    prosecdef as security_definer
FROM pg_proc
WHERE proname IN ('admin_reset_round', 'admin_reset_all_rounds')
ORDER BY proname;
