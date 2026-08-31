-- Migration 014: Server-Side Scoring & Transactional Locks
-- Moving full quiz submission logic and scoring to the backend

-- =====================================================
-- SECURE QUIZ SUBMISSION
-- =====================================================

CREATE OR REPLACE FUNCTION submit_quiz_session(
    p_round_session_id UUID
) RETURNS INTEGER AS $$
DECLARE
    v_team_id UUID;
    v_deadline_at TIMESTAMPTZ;
    v_total_score INTEGER := 0;
    v_correct_count INTEGER := 0;
    v_status TEXT;
BEGIN
    -- 1. Lock the round session to prevent race conditions
    SELECT team_id, deadline_at, status 
    INTO v_team_id, v_deadline_at, v_status
    FROM round_sessions
    WHERE id = p_round_session_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Round session not found';
    END IF;

    IF v_status = 'COMPLETED' THEN
        RAISE EXCEPTION 'Session is already submitted';
    END IF;

    -- 2. Calculate total score and correct answers
    SELECT 
        COALESCE(SUM(qa.points_earned), 0),
        COUNT(*) FILTER (WHERE qa.is_correct = true)
    INTO v_total_score, v_correct_count
    FROM quiz_answers qa
    WHERE qa.round_session_id = p_round_session_id;

    -- 3. Mark quiz session as submitted and graded
    UPDATE quiz_sessions
    SET 
        total_score = v_total_score,
        correct_answers = v_correct_count,
        status = 'GRADED',
        submitted_at = now(),
        -- Calculate accurate remaining time securely
        time_remaining_seconds = GREATEST(0, EXTRACT(EPOCH FROM (v_deadline_at - now()))::INTEGER)
    WHERE round_session_id = p_round_session_id;

    -- 4. Complete the round session
    UPDATE round_sessions
    SET 
        score = v_total_score,
        status = 'COMPLETED',
        completed_at = now()
    WHERE id = p_round_session_id;

    RETURN v_total_score;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
