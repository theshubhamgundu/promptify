-- Migration 016: Complete Round Session Securely
-- Generic round completion that sums up evaluation results

CREATE OR REPLACE FUNCTION submit_round_session(
    p_round_session_id UUID
) RETURNS INTEGER AS $$
DECLARE
    v_team_id UUID;
    v_deadline_at TIMESTAMPTZ;
    v_total_score INTEGER := 0;
    v_status TEXT;
    v_last_heartbeat TIMESTAMPTZ;
BEGIN
    -- 1. Lock the round session to prevent race conditions
    SELECT team_id, deadline_at, status, last_heartbeat_at
    INTO v_team_id, v_deadline_at, v_status, v_last_heartbeat
    FROM round_sessions
    WHERE id = p_round_session_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Round session not found';
    END IF;

    IF v_status = 'COMPLETED' THEN
        RAISE EXCEPTION 'Session is already submitted';
    END IF;

    -- Security Enforcement: Was the heartbeat active in the last 60 seconds?
    -- If not, they probably turned off their internet or blocked the script.
    -- (We'll just log a violation here, but you could subtract points)
    IF v_last_heartbeat IS NOT NULL AND EXTRACT(EPOCH FROM (now() - v_last_heartbeat)) > 60 THEN
        INSERT INTO security_violations (team_id, round_session_id, violation_type, description)
        VALUES (v_team_id, p_round_session_id, 'HEARTBEAT_TIMEOUT', 'Client disconnected before submission');
    END IF;

    -- 2. Calculate total score from evaluation results
    SELECT COALESCE(SUM(er.score_awarded), 0)
    INTO v_total_score
    FROM challenge_attempts ca
    JOIN evaluation_results er ON ca.id = er.attempt_id
    WHERE ca.round_session_id = p_round_session_id;

    -- 3. Complete the round session
    UPDATE round_sessions
    SET 
        score = v_total_score,
        status = 'COMPLETED',
        completed_at = now()
    WHERE id = p_round_session_id;

    RETURN v_total_score;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
