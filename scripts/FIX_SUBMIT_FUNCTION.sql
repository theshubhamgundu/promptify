-- =====================================================
-- Fix Quiz Submission Function
-- =====================================================
-- Creates the submit_round_session function with proper
-- permissions and error handling
-- =====================================================

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS submit_round_session(UUID);

-- Create the function with proper error handling
CREATE OR REPLACE FUNCTION submit_round_session(p_round_session_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_total_score INTEGER := 0;
    v_team_id UUID;
    v_round_id UUID;
    v_status TEXT;
BEGIN
    -- Get round session details
    SELECT team_id, round_id, status
    INTO v_team_id, v_round_id, v_status
    FROM round_sessions
    WHERE id = p_round_session_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Round session not found: %', p_round_session_id;
    END IF;
    
    -- Don't resubmit if already completed
    IF v_status = 'COMPLETED' THEN
        SELECT score INTO v_total_score
        FROM round_sessions
        WHERE id = p_round_session_id;
        
        RETURN v_total_score;
    END IF;
    
    -- Calculate total score from challenge_attempts
    SELECT COALESCE(SUM(points_earned), 0) INTO v_total_score
    FROM challenge_attempts
    WHERE round_session_id = p_round_session_id
      AND is_correct = true;
    
    -- If no challenge_attempts, try score_events
    IF v_total_score = 0 THEN
        SELECT COALESCE(SUM(points), 0) INTO v_total_score
        FROM score_events
        WHERE round_session_id = p_round_session_id;
    END IF;
    
    -- Update round session to COMPLETED
    UPDATE round_sessions
    SET 
        status = 'COMPLETED',
        completed_at = NOW(),
        score = v_total_score
    WHERE id = p_round_session_id;
    
    -- Create quiz_session if it doesn't exist (for quiz results page)
    INSERT INTO quiz_sessions (
        team_id,
        round_id,
        round_session_id,
        started_at,
        submitted_at,
        total_score,
        total_questions,
        correct_answers,
        status
    )
    SELECT 
        v_team_id,
        v_round_id,
        p_round_session_id,
        rs.started_at,
        NOW(),
        v_total_score,
        COUNT(DISTINCT ca.challenge_id),
        COUNT(DISTINCT ca.challenge_id) FILTER (WHERE ca.is_correct = true),
        'GRADED'
    FROM round_sessions rs
    LEFT JOIN challenge_attempts ca ON ca.round_session_id = p_round_session_id
    WHERE rs.id = p_round_session_id
    GROUP BY rs.started_at
    ON CONFLICT (team_id, round_id) 
    DO UPDATE SET
        submitted_at = NOW(),
        total_score = EXCLUDED.total_score,
        correct_answers = EXCLUDED.correct_answers,
        status = 'GRADED';
    
    -- Log the submission
    INSERT INTO activity_logs (action, team_id, details)
    VALUES (
        'QUIZ_SUBMITTED',
        v_team_id,
        jsonb_build_object(
            'round_session_id', p_round_session_id,
            'round_id', v_round_id,
            'score', v_total_score,
            'timestamp', NOW()
        )
    );
    
    RETURN v_total_score;
    
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error
        INSERT INTO activity_logs (action, team_id, details)
        VALUES (
            'QUIZ_SUBMIT_ERROR',
            v_team_id,
            jsonb_build_object(
                'error', SQLERRM,
                'round_session_id', p_round_session_id,
                'timestamp', NOW()
            )
        );
        
        -- Re-raise the error
        RAISE;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION submit_round_session(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION submit_round_session(UUID) TO anon;

-- Verify function was created
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'submit_round_session') THEN
        RAISE NOTICE '✅ submit_round_session function created successfully';
        RAISE NOTICE '✅ Permissions granted to authenticated and anon roles';
    ELSE
        RAISE EXCEPTION 'Failed to create submit_round_session function';
    END IF;
END $$;

-- Test the function exists and is callable
SELECT 
    'Function Check' as test,
    proname as function_name,
    pronargs as num_args,
    prorettype::regtype as return_type
FROM pg_proc
WHERE proname = 'submit_round_session';
