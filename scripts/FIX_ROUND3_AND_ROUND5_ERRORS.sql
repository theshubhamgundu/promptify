-- =====================================================
-- FIX: Round 3 and Round 5 Loading Errors
-- =====================================================
-- ISSUES:
-- 1. Round 3: 406 error and undefined round_session_id
-- 2. Round 5: 409 conflict and 400 bad request on start_round5_challenge
-- =====================================================

-- ══════════════════════════════════════════════════════
-- PART 1: Fix Round 3 (VisionRound) Session Loading
-- ══════════════════════════════════════════════════════

-- Check if start_challenge_session function exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'start_challenge_session'
    ) THEN
        -- Create the function if it doesn't exist
        CREATE OR REPLACE FUNCTION start_challenge_session(
            p_team_id UUID,
            p_round_session_id UUID,
            p_challenge_id UUID,
            p_duration_minutes INTEGER DEFAULT 8
        )
        RETURNS JSONB
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $func$
        DECLARE
            v_session challenge_sessions;
            v_deadline TIMESTAMPTZ;
            v_challenge challenges;
        BEGIN
            -- Check if challenge exists
            SELECT * INTO v_challenge FROM challenges WHERE id = p_challenge_id;
            IF NOT FOUND THEN
                RETURN jsonb_build_object('success', false, 'error', 'Challenge not found');
            END IF;

            -- Check for existing session (return if found and active)
            SELECT * INTO v_session FROM challenge_sessions
            WHERE team_id = p_team_id 
            AND challenge_id = p_challenge_id
            ORDER BY started_at DESC
            LIMIT 1;

            IF FOUND THEN
                -- If session is completed or timed out, create a new one
                IF v_session.status IN ('COMPLETED', 'TIMEOUT') THEN
                    -- Create new session
                    v_deadline := now() + (p_duration_minutes || ' minutes')::interval;
                    
                    INSERT INTO challenge_sessions (
                        team_id, round_session_id, challenge_id, 
                        started_at, deadline_at, status, attempts_used
                    ) VALUES (
                        p_team_id, p_round_session_id, p_challenge_id,
                        now(), v_deadline, 'IN_PROGRESS', 0
                    ) RETURNING * INTO v_session;
                    
                    RETURN jsonb_build_object('success', true, 'session', row_to_json(v_session));
                END IF;
                
                -- Return existing active session
                RETURN jsonb_build_object('success', true, 'session', row_to_json(v_session));
            END IF;

            -- No existing session - create new one
            v_deadline := now() + (p_duration_minutes || ' minutes')::interval;

            INSERT INTO challenge_sessions (
                team_id, round_session_id, challenge_id,
                started_at, deadline_at, status, attempts_used
            ) VALUES (
                p_team_id, p_round_session_id, p_challenge_id,
                now(), v_deadline, 'IN_PROGRESS', 0
            ) RETURNING * INTO v_session;

            RETURN jsonb_build_object('success', true, 'session', row_to_json(v_session));
        END;
        $func$;
        
        RAISE NOTICE 'Created start_challenge_session function';
    ELSE
        RAISE NOTICE 'start_challenge_session function already exists';
    END IF;
END $$;

-- Check if evaluate_vision_submission function exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'evaluate_vision_submission'
    ) THEN
        -- Create the function if it doesn't exist
        CREATE OR REPLACE FUNCTION evaluate_vision_submission(
            p_team_id UUID,
            p_challenge_id UUID,
            p_round_session_id UUID,
            p_participant_id UUID,
            p_answer TEXT
        )
        RETURNS JSONB
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $func$
        DECLARE
            v_session challenge_sessions;
            v_challenge challenges;
            v_config JSONB;
            v_correct_answer TEXT;
            v_is_correct BOOLEAN := false;
            v_attempt_number INTEGER;
            v_score INTEGER := 0;
            v_time_taken INTEGER;
        BEGIN
            -- Get challenge session
            SELECT * INTO v_session FROM challenge_sessions
            WHERE team_id = p_team_id AND challenge_id = p_challenge_id
            ORDER BY started_at DESC
            LIMIT 1;

            IF NOT FOUND THEN
                RETURN jsonb_build_object('success', false, 'error', 'Challenge session not started');
            END IF;

            IF v_session.status != 'IN_PROGRESS' THEN
                RETURN jsonb_build_object('success', false, 'error', 'Challenge is not in progress');
            END IF;

            IF now() > v_session.deadline_at THEN
                UPDATE challenge_sessions SET status = 'TIMEOUT' WHERE id = v_session.id;
                RETURN jsonb_build_object('success', false, 'error', 'Time limit exceeded');
            END IF;

            -- Get challenge details
            SELECT * INTO v_challenge FROM challenges WHERE id = p_challenge_id;
            v_config := v_challenge.configuration;
            v_correct_answer := v_config->>'correctAnswer';
            
            -- Get attempt number
            v_attempt_number := v_session.attempts_used + 1;

            -- Check if max attempts exceeded
            IF v_attempt_number > v_challenge.max_attempts THEN
                RETURN jsonb_build_object(
                    'success', false, 
                    'error', 'Maximum attempts exceeded',
                    'attemptNumber', v_attempt_number
                );
            END IF;

            -- Evaluate answer
            v_is_correct := LOWER(TRIM(p_answer)) = LOWER(TRIM(v_correct_answer));

            IF v_is_correct THEN
                v_time_taken := EXTRACT(EPOCH FROM (now() - v_session.started_at))::INTEGER;
                v_score := v_challenge.base_points;
                
                -- Update session as completed
                UPDATE challenge_sessions 
                SET status = 'COMPLETED',
                    completed_at = now(),
                    attempts_used = v_attempt_number,
                    is_correct = true,
                    score = v_score,
                    total_time_seconds = v_time_taken
                WHERE id = v_session.id;
            ELSE
                -- Update attempts
                UPDATE challenge_sessions 
                SET attempts_used = v_attempt_number
                WHERE id = v_session.id;
            END IF;

            RETURN jsonb_build_object(
                'success', true,
                'isCorrect', v_is_correct,
                'score', v_score,
                'attemptNumber', v_attempt_number,
                'attemptsRemaining', v_challenge.max_attempts - v_attempt_number,
                'status', CASE WHEN v_is_correct THEN 'COMPLETED' ELSE 'IN_PROGRESS' END
            );
        END;
        $func$;
        
        RAISE NOTICE 'Created evaluate_vision_submission function';
    ELSE
        RAISE NOTICE 'evaluate_vision_submission function already exists';
    END IF;
END $$;

-- ══════════════════════════════════════════════════════
-- PART 2: Fix Round 5 start_round5_challenge Function
-- ══════════════════════════════════════════════════════

-- Check if start_round5_challenge function exists and fix it
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'start_round5_challenge'
    ) THEN
        -- Drop and recreate with proper conflict handling
        DROP FUNCTION IF EXISTS start_round5_challenge(UUID, UUID, UUID, INTEGER);
        
        CREATE OR REPLACE FUNCTION start_round5_challenge(
            p_team_id UUID,
            p_round_session_id UUID,
            p_challenge_id UUID,
            p_duration_minutes INTEGER DEFAULT 10
        )
        RETURNS JSONB
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $func$
        DECLARE
            v_session challenge_sessions;
            v_deadline TIMESTAMPTZ;
            v_challenge challenges;
            v_dur INTEGER;
        BEGIN
            -- Get challenge
            SELECT * INTO v_challenge FROM challenges WHERE id = p_challenge_id;
            IF NOT FOUND THEN
                RETURN jsonb_build_object('success', false, 'error', 'Challenge not found');
            END IF;

            v_dur := COALESCE((v_challenge.configuration->>'durationMinutes')::INTEGER, p_duration_minutes, 10);

            -- Check for existing session
            SELECT * INTO v_session FROM challenge_sessions
            WHERE team_id = p_team_id AND challenge_id = p_challenge_id
            ORDER BY started_at DESC
            LIMIT 1;

            IF FOUND THEN
                -- If completed or timeout, allow restart
                IF v_session.status IN ('COMPLETED', 'TIMEOUT') THEN
                    v_deadline := now() + (v_dur || ' minutes')::interval;
                    
                    INSERT INTO challenge_sessions (
                        team_id, round_session_id, challenge_id,
                        started_at, deadline_at, status, attempts_used
                    ) VALUES (
                        p_team_id, p_round_session_id, p_challenge_id,
                        now(), v_deadline, 'IN_PROGRESS', 0
                    ) RETURNING * INTO v_session;
                    
                    RETURN jsonb_build_object('success', true, 'session', row_to_json(v_session), 'restarted', true);
                END IF;
                
                -- Return existing session
                RETURN jsonb_build_object('success', true, 'session', row_to_json(v_session), 'restarted', false);
            END IF;

            -- Create new session
            v_deadline := now() + (v_dur || ' minutes')::interval;

            INSERT INTO challenge_sessions (
                team_id, round_session_id, challenge_id,
                started_at, deadline_at, status, attempts_used
            ) VALUES (
                p_team_id, p_round_session_id, p_challenge_id,
                now(), v_deadline, 'IN_PROGRESS', 0
            ) RETURNING * INTO v_session;

            RETURN jsonb_build_object('success', true, 'session', row_to_json(v_session), 'restarted', false);
        END;
        $func$;
        
        RAISE NOTICE 'Updated start_round5_challenge function with conflict handling';
    ELSE
        RAISE NOTICE 'start_round5_challenge function does not exist - will be created by migration';
    END IF;
END $$;

-- ══════════════════════════════════════════════════════
-- PART 3: Verify and Clean Up Problematic Sessions
-- ══════════════════════════════════════════════════════

-- Find and report sessions with NULL round_session_id
SELECT 
    'SESSIONS WITH NULL round_session_id' as issue,
    cs.id,
    cs.team_id,
    t.name as team_name,
    cs.challenge_id,
    c.title as challenge_title,
    cs.status,
    cs.round_session_id
FROM challenge_sessions cs
LEFT JOIN teams t ON cs.team_id = t.id
LEFT JOIN challenges c ON cs.challenge_id = c.id
WHERE cs.round_session_id IS NULL;

-- Find orphaned round_sessions (no team_id or round_id)
SELECT 
    'ORPHANED ROUND SESSIONS' as issue,
    rs.id,
    rs.team_id,
    rs.round_id,
    rs.status,
    rs.started_at
FROM round_sessions rs
WHERE rs.team_id IS NULL OR rs.round_id IS NULL;

-- Summary
SELECT 
    'SUMMARY' as section,
    (SELECT COUNT(*) FROM challenge_sessions WHERE round_session_id IS NULL) as null_round_session_count,
    (SELECT COUNT(*) FROM round_sessions WHERE team_id IS NULL OR round_id IS NULL) as orphaned_round_sessions,
    (SELECT COUNT(*) FROM challenge_sessions WHERE status = 'IN_PROGRESS' AND deadline_at < now()) as expired_sessions;

SELECT '✓ Round 3 and Round 5 functions verified/created' as status;
