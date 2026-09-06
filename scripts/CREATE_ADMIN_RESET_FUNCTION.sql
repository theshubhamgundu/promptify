-- =====================================================
-- Create Admin Reset Function (RLS-Safe)
-- =====================================================
-- This function runs with elevated privileges to bypass
-- RLS policies that block client-side deletions
-- =====================================================

-- Drop existing function if exists
DROP FUNCTION IF EXISTS admin_reset_round(UUID, UUID);

-- Create the admin reset function
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
    WITH deleted AS (
        DELETE FROM challenge_attempts 
        WHERE round_session_id = v_round_session_id
        RETURNING 1
    )
    SELECT COUNT(*)::int INTO v_deleted_counts->'challenge_attempts' FROM deleted;
    
    -- 2. Delete quiz_answers
    WITH deleted AS (
        DELETE FROM quiz_answers 
        WHERE round_session_id = v_round_session_id
        RETURNING 1
    )
    SELECT COUNT(*)::int INTO v_deleted_counts->'quiz_answers' FROM deleted;
    
    -- 3. Delete quiz_sessions
    WITH deleted AS (
        DELETE FROM quiz_sessions 
        WHERE round_session_id = v_round_session_id
        RETURNING 1
    )
    SELECT COUNT(*)::int INTO v_deleted_counts->'quiz_sessions' FROM deleted;
    
    -- 4. Delete score_events
    WITH deleted AS (
        DELETE FROM score_events 
        WHERE round_session_id = v_round_session_id
        RETURNING 1
    )
    SELECT COUNT(*)::int INTO v_deleted_counts->'score_events' FROM deleted;
    
    -- 5. Delete submissions
    WITH deleted AS (
        DELETE FROM submissions 
        WHERE round_session_id = v_round_session_id
        RETURNING 1
    )
    SELECT COUNT(*)::int INTO v_deleted_counts->'submissions' FROM deleted;
    
    -- 6. Delete prompt_submissions
    WITH deleted AS (
        DELETE FROM prompt_submissions 
        WHERE round_session_id = v_round_session_id
        RETURNING 1
    )
    SELECT COUNT(*)::int INTO v_deleted_counts->'prompt_submissions' FROM deleted;
    
    -- 7. Delete security_violations
    WITH deleted AS (
        DELETE FROM security_violations 
        WHERE round_session_id = v_round_session_id
        RETURNING 1
    )
    SELECT COUNT(*)::int INTO v_deleted_counts->'security_violations' FROM deleted;
    
    -- 8. Delete vision_submissions
    WITH deleted AS (
        DELETE FROM vision_submissions 
        WHERE round_session_id = v_round_session_id
        RETURNING 1
    )
    SELECT COUNT(*)::int INTO v_deleted_counts->'vision_submissions' FROM deleted;
    
    -- 9. Delete round5_submissions
    WITH deleted AS (
        DELETE FROM round5_submissions 
        WHERE round_session_id = v_round_session_id
        RETURNING 1
    )
    SELECT COUNT(*)::int INTO v_deleted_counts->'round5_submissions' FROM deleted;
    
    -- 10. Delete round_sessions (parent record)
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

-- Grant execute permission to authenticated users (admins)
GRANT EXECUTE ON FUNCTION admin_reset_round(UUID, UUID) TO authenticated;

-- Verify function was created
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════';
    RAISE NOTICE '✅ admin_reset_round() Function Created';
    RAISE NOTICE '═══════════════════════════════════════════════════';
    RAISE NOTICE '';
    RAISE NOTICE '📋 Function Details:';
    RAISE NOTICE '   • Name: admin_reset_round';
    RAISE NOTICE '   • Parameters: team_id (UUID), round_id (UUID)';
    RAISE NOTICE '   • Security: DEFINER (bypasses RLS)';
    RAISE NOTICE '   • Returns: JSONB with success status';
    RAISE NOTICE '';
    RAISE NOTICE '🔧 Usage from Frontend:';
    RAISE NOTICE '   const { data, error } = await supabase.rpc(';
    RAISE NOTICE '     ''admin_reset_round'',';
    RAISE NOTICE '     { p_team_id: teamId, p_round_id: roundId }';
    RAISE NOTICE '   );';
    RAISE NOTICE '';
    RAISE NOTICE '📊 What it deletes:';
    RAISE NOTICE '   • challenge_attempts (quiz answers)';
    RAISE NOTICE '   • quiz_answers';
    RAISE NOTICE '   • quiz_sessions';
    RAISE NOTICE '   • score_events';
    RAISE NOTICE '   • submissions';
    RAISE NOTICE '   • security_violations';
    RAISE NOTICE '   • round_sessions (parent)';
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
WHERE proname = 'admin_reset_round';
