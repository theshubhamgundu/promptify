-- =====================================================
-- FIX: Round 4 Text Inputs Not Accepting Text
-- =====================================================
-- ISSUE: Text inputs are disabled when isTimedOut=true
-- ROOT CAUSE: start_round4_challenge returns old sessions with expired deadlines
-- SOLUTION: Allow session restart if status is COMPLETED or TIMEOUT
-- =====================================================

CREATE OR REPLACE FUNCTION start_round4_challenge(
    p_team_id UUID,
    p_round_session_id UUID,
    p_challenge_id UUID,
    p_duration_minutes INTEGER DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_session challenge_sessions;
    v_deadline TIMESTAMPTZ;
    v_challenge challenges;
    v_dur INTEGER;
BEGIN
    SELECT * INTO v_challenge FROM challenges WHERE id = p_challenge_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Challenge not found');
    END IF;

    v_dur := COALESCE((v_challenge.configuration->>'durationMinutes')::INTEGER, p_duration_minutes, 10);

    SELECT * INTO v_session FROM challenge_sessions
    WHERE team_id = p_team_id AND challenge_id = p_challenge_id
    ORDER BY started_at DESC
    LIMIT 1;

    IF FOUND THEN
        -- If session exists and is completed/timeout, allow restart with fresh timer
        IF v_session.status IN ('COMPLETED', 'TIMEOUT') THEN
            v_deadline := now() + (v_dur || ' minutes')::interval;
            
            -- Create new session for retry
            INSERT INTO challenge_sessions (
                team_id, round_session_id, challenge_id, started_at, deadline_at, status
            ) VALUES (
                p_team_id, p_round_session_id, p_challenge_id, now(), v_deadline, 'IN_PROGRESS'
            ) RETURNING * INTO v_session;
            
            INSERT INTO activity_logs (team_id, action, details)
            VALUES (p_team_id, 'ROUND4_CHALLENGE_RESTARTED', jsonb_build_object(
                'challenge_id', p_challenge_id,
                'challenge_title', v_challenge.title,
                'deadline_at', v_deadline,
                'previous_status', v_session.status
            ));
            
            RETURN jsonb_build_object('success', true, 'session', row_to_json(v_session), 'restarted', true);
        END IF;
        
        -- Return existing active session
        RETURN jsonb_build_object('success', true, 'session', row_to_json(v_session), 'restarted', false);
    END IF;

    -- No existing session - create new one
    v_deadline := now() + (v_dur || ' minutes')::interval;

    INSERT INTO challenge_sessions (
        team_id, round_session_id, challenge_id, started_at, deadline_at, status
    ) VALUES (
        p_team_id, p_round_session_id, p_challenge_id, now(), v_deadline, 'IN_PROGRESS'
    ) RETURNING * INTO v_session;

    INSERT INTO activity_logs (team_id, action, details)
    VALUES (p_team_id, 'ROUND4_CHALLENGE_STARTED', jsonb_build_object(
        'challenge_id', p_challenge_id,
        'challenge_title', v_challenge.title,
        'deadline_at', v_deadline
    ));

    RETURN jsonb_build_object('success', true, 'session', row_to_json(v_session), 'restarted', false);
END;
$$;

-- Verify the fix
SELECT 'Function start_round4_challenge updated successfully' AS status;

-- Check for any expired challenge sessions that would cause the issue
SELECT 
    cs.team_id,
    t.name as team_name,
    c.title as challenge_title,
    cs.status,
    cs.deadline_at,
    CASE 
        WHEN cs.deadline_at < now() AND cs.status = 'IN_PROGRESS' THEN 'EXPIRED - WILL BE FIXED'
        WHEN cs.status IN ('COMPLETED', 'TIMEOUT') THEN 'WILL BE RESTARTED ON NEXT ACCESS'
        ELSE 'OK'
    END as fix_status
FROM challenge_sessions cs
JOIN teams t ON cs.team_id = t.id
JOIN challenges c ON cs.challenge_id = c.id
WHERE cs.round_session_id IN (
    SELECT id FROM round_sessions 
    WHERE round_id IN (SELECT id FROM rounds WHERE title ILIKE '%round 4%' OR title ILIKE '%adversarial%')
)
ORDER BY cs.started_at DESC;
