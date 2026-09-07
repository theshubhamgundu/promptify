-- Migration 022: Vision Challenge Schema (Round 3)

-- 1. Ensure 'VISION_CHALLENGE' is in round_type enum
ALTER TYPE round_type ADD VALUE IF NOT EXISTS 'VISION_CHALLENGE';

-- Track time and status at the individual challenge level for Round 3
CREATE TABLE IF NOT EXISTS challenge_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    round_session_id UUID REFERENCES round_sessions(id) ON DELETE CASCADE,
    challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    deadline_at TIMESTAMPTZ, -- For the 8-minute timer
    status TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'TIMEOUT')),
    total_time_seconds INTEGER,
    attempts_used INTEGER DEFAULT 0,
    is_correct BOOLEAN DEFAULT false,
    score INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(team_id, challenge_id)
);

CREATE INDEX IF NOT EXISTS idx_challenge_sessions_team ON challenge_sessions(team_id);
CREATE INDEX IF NOT EXISTS idx_challenge_sessions_challenge ON challenge_sessions(challenge_id);

DROP TRIGGER IF EXISTS update_challenge_sessions_updated_at ON challenge_sessions;
CREATE TRIGGER update_challenge_sessions_updated_at 
BEFORE UPDATE ON challenge_sessions 
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Update submissions table to track detailed metrics
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS time_taken_seconds INTEGER;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS evaluation_latency_ms INTEGER;

-- RLS Policies for challenge_sessions
ALTER TABLE challenge_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teams can view their own challenge sessions" ON challenge_sessions;
CREATE POLICY "Teams can view their own challenge sessions"
    ON challenge_sessions FOR SELECT
    TO authenticated
    USING (
        team_id IN (
            SELECT team_id FROM participants WHERE user_id = auth.uid()
        )
        OR 
        EXISTS (
            SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('ADMIN', 'COORDINATOR')
        )
    );

-- RPC: start_challenge_session
-- Initializes the 8-minute timer when a team starts a specific challenge
CREATE OR REPLACE FUNCTION start_challenge_session(
    p_team_id UUID,
    p_round_session_id UUID,
    p_challenge_id UUID,
    p_duration_minutes INTEGER DEFAULT 8
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_session challenge_sessions;
    v_deadline TIMESTAMPTZ;
BEGIN
    -- Check if it already exists
    SELECT * INTO v_session FROM challenge_sessions
    WHERE team_id = p_team_id AND challenge_id = p_challenge_id;

    IF FOUND THEN
        RETURN jsonb_build_object('success', true, 'session', row_to_json(v_session));
    END IF;

    -- Create new
    v_deadline := now() + (p_duration_minutes || ' minutes')::interval;

    INSERT INTO challenge_sessions (
        team_id, round_session_id, challenge_id, started_at, deadline_at
    ) VALUES (
        p_team_id, p_round_session_id, p_challenge_id, now(), v_deadline
    ) RETURNING * INTO v_session;

    -- Log activity
    INSERT INTO activity_logs (team_id, action, details)
    VALUES (p_team_id, 'CHALLENGE_SESSION_STARTED', jsonb_build_object(
        'challenge_id', p_challenge_id,
        'deadline_at', v_deadline
    ));

    RETURN jsonb_build_object('success', true, 'session', row_to_json(v_session));
END;
$$;

-- =====================================================
-- RPC: evaluate_vision_submission
-- Server-side evaluation with attempt tracking, speed bonuses, and scoring
-- =====================================================
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
AS $$
DECLARE
    v_challenge_session challenge_sessions;
    v_challenge challenges;
    v_config JSONB;
    v_correct_answer TEXT;
    v_eval_type TEXT;
    v_is_correct BOOLEAN := false;
    v_attempt_number INTEGER;
    v_max_attempts INTEGER := 3;
    v_attempt_id UUID;
    v_score INTEGER := 0;
    v_base_points INTEGER;
    v_attempt_bonuses JSONB;
    v_speed_bonuses JSONB;
    v_time_taken INTEGER;
    v_eval_start TIMESTAMPTZ := clock_timestamp();
    v_eval_latency INTEGER;
    v_normalized_answer TEXT;
    v_normalized_correct TEXT;
BEGIN
    -- 1. Get the challenge session (must exist and be active)
    SELECT * INTO v_challenge_session
    FROM challenge_sessions
    WHERE team_id = p_team_id AND challenge_id = p_challenge_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Challenge session not found. Start the challenge first.';
    END IF;

    IF v_challenge_session.status != 'IN_PROGRESS' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Challenge already completed or timed out',
            'status', v_challenge_session.status
        );
    END IF;

    -- 2. Check deadline
    IF now() > v_challenge_session.deadline_at THEN
        UPDATE challenge_sessions
        SET status = 'TIMEOUT', completed_at = v_challenge_session.deadline_at,
            total_time_seconds = EXTRACT(EPOCH FROM (v_challenge_session.deadline_at - v_challenge_session.started_at))::INTEGER
        WHERE id = v_challenge_session.id;

        RETURN jsonb_build_object(
            'success', false,
            'error', 'Time expired for this challenge',
            'status', 'TIMEOUT'
        );
    END IF;

    -- 3. Get challenge config
    SELECT * INTO v_challenge FROM challenges WHERE id = p_challenge_id;
    v_config := v_challenge.configuration;
    v_correct_answer := v_config->>'correctAnswer';
    v_eval_type := COALESCE(v_config->>'evaluationType', 'EXACT_MATCH');
    v_base_points := COALESCE((v_config->'scoring'->>'basePoints')::INTEGER, v_challenge.base_points, 100);
    v_attempt_bonuses := COALESCE(v_config->'scoring'->'attemptBonuses', '[20, 10, 0]'::jsonb);
    v_speed_bonuses := COALESCE(v_config->'scoring'->'speedBonuses', '[]'::jsonb);
    v_max_attempts := COALESCE(v_challenge.max_attempts, 3);

    -- 4. Count existing attempts
    SELECT COUNT(*) INTO v_attempt_number
    FROM challenge_attempts
    WHERE team_id = p_team_id AND challenge_id = p_challenge_id;

    v_attempt_number := v_attempt_number + 1;

    IF v_attempt_number > v_max_attempts THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Maximum attempts exhausted',
            'attemptsUsed', v_max_attempts
        );
    END IF;

    -- 5. Calculate time taken
    v_time_taken := EXTRACT(EPOCH FROM (now() - v_challenge_session.started_at))::INTEGER;

    -- 6. Evaluate the answer
    v_normalized_answer := LOWER(TRIM(p_answer));
    v_normalized_correct := LOWER(TRIM(v_correct_answer));

    CASE v_eval_type
        WHEN 'EXACT_MATCH' THEN
            v_is_correct := (v_normalized_answer = v_normalized_correct);
        WHEN 'NUMERIC' THEN
            BEGIN
                v_is_correct := (v_normalized_answer::NUMERIC = v_normalized_correct::NUMERIC);
            EXCEPTION WHEN OTHERS THEN
                v_is_correct := false;
            END;
        WHEN 'NORMALIZED_TEXT' THEN
            -- Remove extra whitespace, punctuation for comparison
            v_is_correct := (
                REGEXP_REPLACE(v_normalized_answer, '[^a-z0-9]', '', 'g') =
                REGEXP_REPLACE(v_normalized_correct, '[^a-z0-9]', '', 'g')
            );
        ELSE
            v_is_correct := (v_normalized_answer = v_normalized_correct);
    END CASE;

    -- 7. Calculate score if correct
    IF v_is_correct THEN
        v_score := v_base_points;

        -- Add attempt bonus
        IF v_attempt_bonuses IS NOT NULL AND jsonb_array_length(v_attempt_bonuses) >= v_attempt_number THEN
            v_score := v_score + COALESCE((v_attempt_bonuses->(v_attempt_number - 1))::INTEGER, 0);
        END IF;

        -- Add speed bonus
        IF v_speed_bonuses IS NOT NULL THEN
            FOR i IN 0..jsonb_array_length(v_speed_bonuses) - 1 LOOP
                IF v_time_taken <= (v_speed_bonuses->i->>'maxSeconds')::INTEGER THEN
                    v_score := v_score + (v_speed_bonuses->i->>'bonus')::INTEGER;
                    EXIT; -- Take highest applicable bonus
                END IF;
            END LOOP;
        END IF;
    END IF;

    -- 8. Record the attempt
    INSERT INTO challenge_attempts (
        team_id, challenge_id, round_session_id, participant_id,
        attempt_number, payload, status, completed_at
    ) VALUES (
        p_team_id, p_challenge_id, p_round_session_id, p_participant_id,
        v_attempt_number,
        jsonb_build_object('answer', p_answer, 'time_taken', v_time_taken),
        'COMPLETED', now()
    ) RETURNING id INTO v_attempt_id;

    -- 9. Record evaluation
    v_eval_latency := EXTRACT(MILLISECOND FROM (clock_timestamp() - v_eval_start))::INTEGER;

    INSERT INTO evaluation_results (
        attempt_id, evaluator_type, score_awarded, passed,
        rubric_breakdown, raw_response
    ) VALUES (
        v_attempt_id, 'DETERMINISTIC', v_score, v_is_correct,
        jsonb_build_array(jsonb_build_object(
            'criterion', v_eval_type,
            'expected', v_correct_answer,
            'actual', p_answer,
            'passed', v_is_correct,
            'score', v_score
        )),
        jsonb_build_object(
            'evaluationType', v_eval_type,
            'timeTaken', v_time_taken,
            'attemptNumber', v_attempt_number,
            'evaluationLatencyMs', v_eval_latency
        )
    );

    -- 10. Update challenge session
    UPDATE challenge_sessions SET
        attempts_used = v_attempt_number,
        is_correct = CASE WHEN v_is_correct THEN true ELSE is_correct END,
        score = CASE WHEN v_is_correct THEN v_score ELSE score END,
        status = CASE
            WHEN v_is_correct THEN 'COMPLETED'
            WHEN v_attempt_number >= v_max_attempts THEN 'COMPLETED'
            ELSE 'IN_PROGRESS'
        END,
        completed_at = CASE
            WHEN v_is_correct OR v_attempt_number >= v_max_attempts THEN now()
            ELSE NULL
        END,
        total_time_seconds = CASE
            WHEN v_is_correct OR v_attempt_number >= v_max_attempts THEN v_time_taken
            ELSE NULL
        END
    WHERE id = v_challenge_session.id;

    -- 11. Update round session score (sum of all challenge scores)
    UPDATE round_sessions SET
        score = (
            SELECT COALESCE(SUM(score), 0) FROM challenge_sessions
            WHERE round_session_id = p_round_session_id
        )
    WHERE id = p_round_session_id;

    -- 12. Log activity
    INSERT INTO activity_logs (team_id, action, details)
    VALUES (p_team_id, 'VISION_SUBMISSION', jsonb_build_object(
        'challenge_id', p_challenge_id,
        'attempt_number', v_attempt_number,
        'is_correct', v_is_correct,
        'score', v_score,
        'time_taken', v_time_taken,
        'evaluation_latency_ms', v_eval_latency
    ));

    RETURN jsonb_build_object(
        'success', true,
        'isCorrect', v_is_correct,
        'score', v_score,
        'attemptNumber', v_attempt_number,
        'attemptsRemaining', v_max_attempts - v_attempt_number,
        'timeTaken', v_time_taken,
        'status', CASE
            WHEN v_is_correct THEN 'COMPLETED'
            WHEN v_attempt_number >= v_max_attempts THEN 'COMPLETED'
            ELSE 'IN_PROGRESS'
        END
    );
END;
$$;
