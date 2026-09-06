-- =====================================================
-- Create Admin Reset All Rounds Function (RLS-Safe)
-- =====================================================
-- This function runs with elevated privileges to bypass
-- RLS policies that block client-side deletions
-- =====================================================

-- Drop existing function if exists
DROP FUNCTION IF EXISTS admin_reset_all_rounds(UUID);

-- Create the admin reset all rounds function
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
    
    -- 1. Delete challenge_attempts (quiz answers)
    WITH deleted AS (
        DELETE FROM challenge_attempts 
        WHERE team_id = p_team_id
        RETURNING 1
    )
    SELECT COUNT(*)::int INTO v_deleted_counts->'challenge_attempts' FROM deleted;
    
    -- 2. Delete quiz_answers
    WITH deleted AS (
        DELETE FROM quiz_answers 
        WHERE team_id = p_team_id
        RETURNING 1
    )
    SELECT COUNT(*)::int INTO v_deleted_counts->'quiz_answers' FROM deleted;
    
    -- 3. Delete quiz_sessions
    WITH deleted AS (
        DELETE FROM quiz_sessions 
        WHERE team_id = p_team_id
        RETURNING 1
    )
    SELECT COUNT(*)::int INTO v_deleted_counts->'quiz_sessions' FROM deleted;
    
    -- 4. Delete score_events
    WITH deleted AS (
        DELETE FROM score_events 
        WHERE team_id = p_team_id
        RETURNING 1
    )
    SELECT COUNT(*)::int INTO v_deleted_counts->'score_events' FROM deleted;
    
    -- 5. Delete round5_score_events
    WITH deleted AS (
        DELETE FROM round5_score_events 
        WHERE team_id = p_team_id
        RETURNING 1
    )
    SELECT COUNT(*)::int INTO v_deleted_counts->'round5_score_events' FROM deleted;
    
    -- 6. Delete submissions
    WITH deleted AS (
        DELETE FROM submissions 
        WHERE team_id = p_team_id
        RETURNING 1
    )
    SELECT COUNT(*)::int INTO v_deleted_counts->'submissions' FROM deleted;
    
    -- 7. Delete prompt_submissions
    WITH deleted AS (
        DELETE FROM prompt_submissions 
        WHERE team_id = p_team_id
        RETURNING 1
    )
    SELECT COUNT(*)::int INTO v_deleted_counts->'prompt_submissions' FROM deleted;
    
    -- 8. Delete prompt_round_sessions
    WITH deleted AS (
        DELETE FROM prompt_round_sessions 
        WHERE team_id = p_team_id
        RETURNING 1
    )
    SELECT COUNT(*)::int INTO v_deleted_counts->'prompt_round_sessions' FROM deleted;
    
    -- 9. Delete security_violations
    WITH deleted AS (
        DELETE FROM security_violations 
        WHERE team_id = p_team_id
        RETURNING 1
    )
    SELECT COUNT(*)::int INTO v_deleted_counts->'security_violations' FROM deleted;
    
    -- 10. Delete vision_submissions
    WITH deleted AS (
        DELETE FROM vision_submissions 
        WHERE team_id = p_team_id
        RETURNING 1
    )
    SELECT COUNT(*)::int INTO v_deleted_counts->'vision_submissions' FROM deleted;
    
    -- 11. Delete byok_usage
    WITH deleted AS (
        DELETE FROM byok_usage 
        WHERE team_id = p_team_id
        RETURNING 1
    )
    SELECT COUNT(*)::int INTO v_deleted_counts->'byok_usage' FROM deleted;
    
    -- 12. Delete turing_test_attempts
    WITH deleted AS (
        DELETE FROM turing_test_attempts 
        WHERE team_id = p_team_id
        RETURNING 1
    )
    SELECT COUNT(*)::int INTO v_deleted_counts->'turing_test_attempts' FROM deleted;
    
    -- 13. Delete jailbreak_attempts
    WITH deleted AS (
        DELETE FROM jailbreak_attempts 
        WHERE team_id = p_team_id
        RETURNING 1
    )
    SELECT COUNT(*)::int INTO v_deleted_counts->'jailbreak_attempts' FROM deleted;
    
    -- 14. Delete prompt_zipper_attempts
    WITH deleted AS (
        DELETE FROM prompt_zipper_attempts 
        WHERE team_id = p_team_id
        RETURNING 1
    )
    SELECT COUNT(*)::int INTO v_deleted_counts->'prompt_zipper_attempts' FROM deleted;
    
    -- 15. Delete round5_submissions
    WITH deleted AS (
        DELETE FROM round5_submissions 
        WHERE team_id = p_team_id
        RETURNING 1
    )
    SELECT COUNT(*)::int INTO v_deleted_counts->'round5_submissions' FROM deleted;
    
    -- 16. Delete round5_challenge_sessions
    WITH deleted AS (
        DELETE FROM round5_challenge_sessions 
        WHERE team_id = p_team_id
        RETURNING 1
    )
    SELECT COUNT(*)::int INTO v_deleted_counts->'round5_challenge_sessions' FROM deleted;
    
    -- 17. Delete interaction_logs
    WITH deleted AS (
        DELETE FROM interaction_logs 
        WHERE team_id = p_team_id
        RETURNING 1
    )
    SELECT COUNT(*)::int INTO v_deleted_counts->'interaction_logs' FROM deleted;
    
    -- 18. Delete round_sessions (parent records)
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

-- Grant execute permission to authenticated users (admins)
GRANT EXECUTE ON FUNCTION admin_reset_all_rounds(UUID) TO authenticated;

-- Verify function was created
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════';
    RAISE NOTICE '✅ admin_reset_all_rounds() Function Created';
    RAISE NOTICE '═══════════════════════════════════════════════════';
    RAISE NOTICE '';
    RAISE NOTICE '📋 Function Details:';
    RAISE NOTICE '   • Name: admin_reset_all_rounds';
    RAISE NOTICE '   • Parameters: team_id (UUID)';
    RAISE NOTICE '   • Security: DEFINER (bypasses RLS)';
    RAISE NOTICE '   • Returns: JSONB with success status';
    RAISE NOTICE '';
    RAISE NOTICE '🔧 Usage from Frontend:';
    RAISE NOTICE '   const { data, error } = await supabase.rpc(';
    RAISE NOTICE '     ''admin_reset_all_rounds'',';
    RAISE NOTICE '     { p_team_id: teamId }';
    RAISE NOTICE '   );';
    RAISE NOTICE '';
    RAISE NOTICE '📊 What it deletes:';
    RAISE NOTICE '   • ALL round_sessions for the team';
    RAISE NOTICE '   • challenge_attempts (quiz answers)';
    RAISE NOTICE '   • quiz_answers and quiz_sessions';
    RAISE NOTICE '   • score_events';
    RAISE NOTICE '   • submissions (all types)';
    RAISE NOTICE '   • security_violations';
    RAISE NOTICE '   • interaction_logs';
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;

-- Test the function exists
SELECT 
    'Function Verification' as test,
    proname as function_name,
    pronargs as num_params,
    prorettype::regtype as return_type,
    prosecdef as security_definer
FROM pg_proc
WHERE proname = 'admin_reset_all_rounds';
