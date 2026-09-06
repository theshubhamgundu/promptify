-- ═════════════════════════════════════════════════════════════════════════════
-- FIX ADMIN RESET FUNCTIONS - Only Reference Tables That Actually Exist
-- ═════════════════════════════════════════════════════════════════════════════
-- Based on your actual schema with 37 tables
-- Removes references to non-existent Round 4/5 tables
-- ═════════════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS admin_reset_round(UUID, UUID);
DROP FUNCTION IF EXISTS admin_reset_all_rounds(UUID);

-- ═════════════════════════════════════════════════════════════════════════════
-- FUNCTION 1: admin_reset_round - Reset Single Round (FIXED)
-- ═════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION admin_reset_round(
    p_team_id UUID,
    p_round_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_round_session_id UUID;
    v_deleted_counts JSONB := '{}'::jsonb;
    v_team_name TEXT;
    v_round_name TEXT;
    v_count INT;
BEGIN
    SELECT name INTO v_team_name FROM teams WHERE id = p_team_id;
    SELECT name INTO v_round_name FROM rounds WHERE id = p_round_id;
    
    SELECT id INTO v_round_session_id
    FROM round_sessions
    WHERE team_id = p_team_id AND round_id = p_round_id;
    
    IF v_round_session_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'No round session found',
            'team_id', p_team_id,
            'round_id', p_round_id
        );
    END IF;
    
    -- Delete in dependency order (only tables that exist)
    
    -- Quiz-related (exist in schema)
    DELETE FROM quiz_answers WHERE round_session_id = v_round_session_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('quiz_answers', v_count);
    
    DELETE FROM quiz_sessions WHERE round_session_id = v_round_session_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('quiz_sessions', v_count);
    
    DELETE FROM challenge_attempts WHERE round_session_id = v_round_session_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('challenge_attempts', v_count);
    
    DELETE FROM evaluation_results 
    WHERE attempt_id IN (
        SELECT id FROM challenge_attempts WHERE round_session_id = v_round_session_id
    );
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('evaluation_results', v_count);
    
    -- Score and submissions (exist in schema)
    DELETE FROM score_events WHERE round_session_id = v_round_session_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('score_events', v_count);
    
    DELETE FROM submissions WHERE round_session_id = v_round_session_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('submissions', v_count);
    
    -- Prompt heist related (exist in schema)
    DELETE FROM prompt_submissions WHERE round_session_id = v_round_session_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('prompt_submissions', v_count);
    
    DELETE FROM prompt_round_sessions WHERE round_session_id = v_round_session_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('prompt_round_sessions', v_count);
    
    -- Challenge sessions (exists in schema)
    DELETE FROM challenge_sessions WHERE round_session_id = v_round_session_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('challenge_sessions', v_count);
    
    -- BYOK (exists in schema)
    DELETE FROM byok_usage_logs 
    WHERE byok_session_id IN (
        SELECT id FROM byok_sessions WHERE round_session_id = v_round_session_id
    );
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('byok_usage_logs', v_count);
    
    DELETE FROM byok_sessions WHERE round_session_id = v_round_session_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('byok_sessions', v_count);
    
    -- Security and analytics (exist in schema)
    DELETE FROM security_violations WHERE round_session_id = v_round_session_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('security_violations', v_count);
    
    DELETE FROM behavior_analytics WHERE round_session_id = v_round_session_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('behavior_analytics', v_count);
    
    DELETE FROM prompt_sheet_entries WHERE round_session_id = v_round_session_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('prompt_sheet_entries', v_count);
    
    -- Finally delete the round_session itself
    DELETE FROM round_sessions WHERE id = v_round_session_id;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('round_sessions', 1);
    
    INSERT INTO activity_logs (action, team_id, details)
    VALUES (
        'ADMIN_RESET_ROUND',
        p_team_id,
        jsonb_build_object(
            'round_id', p_round_id,
            'round_name', v_round_name,
            'deleted_counts', v_deleted_counts
        )
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Round reset successfully',
        'team_name', v_team_name,
        'round_name', v_round_name,
        'deleted_counts', v_deleted_counts
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM,
            'detail', SQLSTATE
        );
END;
$$;

GRANT EXECUTE ON FUNCTION admin_reset_round(UUID, UUID) TO authenticated;

-- ═════════════════════════════════════════════════════════════════════════════
-- FUNCTION 2: admin_reset_all_rounds - Reset All Rounds for a Team (FIXED)
-- ═════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION admin_reset_all_rounds(
    p_team_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_deleted_counts JSONB := '{}'::jsonb;
    v_team_name TEXT;
    v_total_rounds INTEGER := 0;
    v_count INT;
BEGIN
    SELECT name INTO v_team_name FROM teams WHERE id = p_team_id;
    
    SELECT COUNT(*)::int INTO v_total_rounds
    FROM round_sessions
    WHERE team_id = p_team_id;
    
    IF v_total_rounds = 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'No round sessions found for this team'
        );
    END IF;
    
    -- Delete all data for this team (only tables that exist)
    
    DELETE FROM quiz_answers WHERE team_id = p_team_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('quiz_answers', v_count);
    
    DELETE FROM quiz_sessions WHERE team_id = p_team_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('quiz_sessions', v_count);
    
    DELETE FROM evaluation_results
    WHERE attempt_id IN (
        SELECT id FROM challenge_attempts WHERE team_id = p_team_id
    );
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('evaluation_results', v_count);
    
    DELETE FROM challenge_attempts WHERE team_id = p_team_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('challenge_attempts', v_count);
    
    DELETE FROM score_events WHERE team_id = p_team_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('score_events', v_count);
    
    DELETE FROM submissions WHERE team_id = p_team_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('submissions', v_count);
    
    DELETE FROM prompt_submissions WHERE team_id = p_team_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('prompt_submissions', v_count);
    
    DELETE FROM prompt_round_sessions WHERE team_id = p_team_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('prompt_round_sessions', v_count);
    
    DELETE FROM challenge_sessions WHERE team_id = p_team_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('challenge_sessions', v_count);
    
    DELETE FROM byok_usage_logs WHERE team_id = p_team_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('byok_usage_logs', v_count);
    
    DELETE FROM byok_sessions WHERE team_id = p_team_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('byok_sessions', v_count);
    
    DELETE FROM security_violations WHERE team_id = p_team_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('security_violations', v_count);
    
    DELETE FROM behavior_analytics WHERE team_id = p_team_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('behavior_analytics', v_count);
    
    DELETE FROM prompt_sheet_entries WHERE team_id = p_team_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('prompt_sheet_entries', v_count);
    
    -- Finally delete all round_sessions
    DELETE FROM round_sessions WHERE team_id = p_team_id;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('round_sessions', v_total_rounds);
    
    INSERT INTO activity_logs (action, team_id, details)
    VALUES (
        'ADMIN_RESET_ALL_ROUNDS',
        p_team_id,
        jsonb_build_object(
            'rounds_count', v_total_rounds,
            'deleted_counts', v_deleted_counts
        )
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'All rounds reset successfully',
        'team_name', v_team_name,
        'rounds_count', v_total_rounds,
        'deleted_counts', v_deleted_counts
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM,
            'detail', SQLSTATE
        );
END;
$$;

GRANT EXECUTE ON FUNCTION admin_reset_all_rounds(UUID) TO authenticated;

-- ═════════════════════════════════════════════════════════════════════════════
-- VERIFICATION
-- ═════════════════════════════════════════════════════════════════════════════

SELECT 
    'DEPLOYMENT STATUS' as check_type,
    proname as function_name,
    prosecdef as security_definer,
    'Successfully deployed - Fixed to match actual schema' as status
FROM pg_proc
WHERE proname IN ('admin_reset_round', 'admin_reset_all_rounds')
AND pronamespace = 'public'::regnamespace;
