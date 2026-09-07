-- Migration 015: Phase 5 Production Hardening
-- Consolidating Quiz Engine to dynamic challenges, adding analytics and heartbeats

-- 1. Add heartbeat tracking for strict security
ALTER TABLE round_sessions 
ADD COLUMN IF NOT EXISTS last_heartbeat_at TIMESTAMPTZ;

-- 2. Create Behavior Analytics Table
CREATE TABLE IF NOT EXISTS behavior_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    round_session_id UUID REFERENCES round_sessions(id) ON DELETE CASCADE,
    challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('CHALLENGE_VIEWED', 'ANSWER_CHANGED', 'HINT_REQUESTED', 'VALIDATION_ERROR')),
    event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_behavior_analytics_team ON behavior_analytics(team_id);
CREATE INDEX idx_behavior_analytics_session ON behavior_analytics(round_session_id);

ALTER TABLE behavior_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY analytics_insert ON behavior_analytics
    FOR INSERT TO authenticated
    WITH CHECK (team_id IN (SELECT team_id FROM participants WHERE user_id = auth.uid()));

CREATE POLICY analytics_select_admin ON behavior_analytics
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'ADMIN'));

-- 3. Replace old quiz submission with a generic challenge evaluation RPC
CREATE OR REPLACE FUNCTION evaluate_deterministic_challenge(
    p_attempt_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    v_challenge_id UUID;
    v_payload JSONB;
    v_configuration JSONB;
    v_type TEXT;
    v_is_correct BOOLEAN := false;
    v_points_earned INTEGER := 0;
    v_base_points INTEGER := 0;
    v_expected_answer JSONB;
    v_submitted_answer JSONB;
BEGIN
    -- Get attempt and challenge details
    SELECT ca.challenge_id, ca.payload, c.configuration, c.type, c.base_points
    INTO v_challenge_id, v_payload, v_configuration, v_type, v_base_points
    FROM challenge_attempts ca
    JOIN challenges c ON ca.challenge_id = c.id
    WHERE ca.id = p_attempt_id;

    -- Evaluate based on type
    IF v_type = 'MULTIPLE_CHOICE' THEN
        -- Expected answer is stored in configuration.options where is_correct = true
        SELECT jsonb_agg(opt->>'id')
        INTO v_expected_answer
        FROM jsonb_array_elements(v_configuration->'options') AS opt
        WHERE (opt->>'is_correct')::boolean = true;

        -- Submitted answer
        v_submitted_answer := v_payload->'selected_options';

        -- Direct array comparison (needs sorting in real life, but for now simple eq)
        IF v_expected_answer @> v_submitted_answer AND v_submitted_answer @> v_expected_answer THEN
            v_is_correct := true;
            v_points_earned := v_base_points;
        END IF;
    END IF;

    -- Store result
    INSERT INTO evaluation_results (
        attempt_id,
        evaluator_type,
        score_awarded,
        is_passed,
        feedback
    ) VALUES (
        p_attempt_id,
        'DETERMINISTIC',
        v_points_earned,
        v_is_correct,
        jsonb_build_array(CASE WHEN v_is_correct THEN 'Correct!' ELSE 'Incorrect' END)
    );

    -- Complete attempt
    PERFORM complete_challenge_attempt(p_attempt_id, 'COMPLETED');

    RETURN v_is_correct;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Secure Ping RPC
CREATE OR REPLACE FUNCTION record_session_heartbeat(
    p_round_session_id UUID
) RETURNS VOID AS $$
BEGIN
    UPDATE round_sessions 
    SET last_heartbeat_at = now()
    WHERE id = p_round_session_id 
      AND status = 'IN_PROGRESS';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Drop Legacy Quiz Tables
-- Warning: This drops old data. Safe here because we are migrating to the new dynamic engine.
DROP TABLE IF EXISTS quiz_answers CASCADE;
DROP TABLE IF EXISTS quiz_options CASCADE;
DROP TABLE IF EXISTS quiz_questions CASCADE;
DROP TABLE IF EXISTS quiz_sessions CASCADE;
DROP FUNCTION IF EXISTS calculate_quiz_score(UUID);
DROP FUNCTION IF EXISTS submit_quiz_answer(UUID, UUID, UUID, TEXT[]);
DROP FUNCTION IF EXISTS start_quiz_session(UUID, UUID, UUID);
