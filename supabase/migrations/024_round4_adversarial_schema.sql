-- Migration 024: Round 4 AI Adversarial Schema & Secure Evaluation Engine

-- 1. Ensure Enum Values for Round 4
ALTER TYPE round_type ADD VALUE IF NOT EXISTS 'AI_ADVERSARIAL';
ALTER TYPE round_type ADD VALUE IF NOT EXISTS 'ADVERSARIAL_CHALLENGE';

ALTER TYPE challenge_type ADD VALUE IF NOT EXISTS 'PROMPT_BREACH';
ALTER TYPE challenge_type ADD VALUE IF NOT EXISTS 'CIPHER';
ALTER TYPE challenge_type ADD VALUE IF NOT EXISTS 'TURING_TEST';
ALTER TYPE challenge_type ADD VALUE IF NOT EXISTS 'PROMPT_ZIPPER';

-- 2. Turing Test Interactions Table
CREATE TABLE IF NOT EXISTS turing_test_interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE,
    round_session_id UUID REFERENCES round_sessions(id) ON DELETE CASCADE,
    sequence_number INTEGER NOT NULL,
    question TEXT NOT NULL,
    response TEXT,
    responder_type TEXT DEFAULT 'AI' CHECK (responder_type IN ('AI', 'HUMAN')),
    human_responder_id UUID REFERENCES users(id) ON DELETE SET NULL,
    response_latency_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT now(),
    responded_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_turing_team_challenge ON turing_test_interactions(team_id, challenge_id);
CREATE INDEX IF NOT EXISTS idx_turing_pending ON turing_test_interactions(responder_type, response);

-- Turing Test Verdicts Table
CREATE TABLE IF NOT EXISTS turing_verdicts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE,
    round_session_id UUID REFERENCES round_sessions(id) ON DELETE CASCADE,
    verdict TEXT NOT NULL CHECK (verdict IN ('AI', 'HUMAN')),
    actual_identity TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL,
    reasoning TEXT,
    questions_used INTEGER NOT NULL,
    score INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(team_id, challenge_id)
);

-- 3. Cipher Submissions Table
CREATE TABLE IF NOT EXISTS cipher_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE,
    round_session_id UUID REFERENCES round_sessions(id) ON DELETE CASCADE,
    attempt_number INTEGER NOT NULL,
    dictionary JSONB NOT NULL DEFAULT '[]'::jsonb,
    grammar_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
    encoded_riddle TEXT NOT NULL,
    ai_instruction TEXT NOT NULL,
    ai_response TEXT,
    constraint_score INTEGER DEFAULT 0,
    comprehension_score INTEGER DEFAULT 0,
    riddle_score INTEGER DEFAULT 0,
    efficiency_score INTEGER DEFAULT 0,
    total_score INTEGER DEFAULT 0,
    is_success BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cipher_team_challenge ON cipher_submissions(team_id, challenge_id);

-- 4. Prompt Zipper Evaluations Table
CREATE TABLE IF NOT EXISTS prompt_zipper_evaluations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE,
    round_session_id UUID REFERENCES round_sessions(id) ON DELETE CASCADE,
    attempt_number INTEGER NOT NULL,
    compressed_prompt TEXT NOT NULL,
    word_count INTEGER NOT NULL,
    probe_results JSONB NOT NULL DEFAULT '[]'::jsonb,
    questions_correct INTEGER DEFAULT 0,
    questions_total INTEGER DEFAULT 0,
    accuracy_score INTEGER DEFAULT 0,
    compression_score INTEGER DEFAULT 0,
    constraint_score INTEGER DEFAULT 0,
    total_score INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_zipper_team_challenge ON prompt_zipper_evaluations(team_id, challenge_id);

-- 5. Enable RLS
ALTER TABLE turing_test_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE turing_verdicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cipher_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_zipper_evaluations ENABLE ROW LEVEL SECURITY;

-- Policies for turing_test_interactions
DROP POLICY IF EXISTS "Participants can view own turing interactions" ON turing_test_interactions;
CREATE POLICY "Participants can view own turing interactions"
    ON turing_test_interactions FOR SELECT
    TO authenticated
    USING (
        team_id IN (SELECT team_id FROM participants WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('ADMIN', 'COORDINATOR'))
    );

DROP POLICY IF EXISTS "Admins can update turing responses" ON turing_test_interactions;
CREATE POLICY "Admins can update turing responses"
    ON turing_test_interactions FOR UPDATE
    TO authenticated
    USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('ADMIN', 'COORDINATOR')));

-- Policies for turing_verdicts
DROP POLICY IF EXISTS "Participants can view own turing verdicts" ON turing_verdicts;
CREATE POLICY "Participants can view own turing verdicts"
    ON turing_verdicts FOR SELECT
    TO authenticated
    USING (
        team_id IN (SELECT team_id FROM participants WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('ADMIN', 'COORDINATOR'))
    );

-- Policies for cipher_submissions
DROP POLICY IF EXISTS "Participants can view own cipher submissions" ON cipher_submissions;
CREATE POLICY "Participants can view own cipher submissions"
    ON cipher_submissions FOR SELECT
    TO authenticated
    USING (
        team_id IN (SELECT team_id FROM participants WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('ADMIN', 'COORDINATOR'))
    );

-- Policies for prompt_zipper_evaluations
DROP POLICY IF EXISTS "Participants can view own zipper evaluations" ON prompt_zipper_evaluations;
CREATE POLICY "Participants can view own zipper evaluations"
    ON prompt_zipper_evaluations FOR SELECT
    TO authenticated
    USING (
        team_id IN (SELECT team_id FROM participants WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('ADMIN', 'COORDINATOR'))
    );

-- =====================================================
-- RPC 1: start_round4_challenge
-- Starts individual 10-minute authoritative timer for a challenge
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
    WHERE team_id = p_team_id AND challenge_id = p_challenge_id;

    IF FOUND THEN
        RETURN jsonb_build_object('success', true, 'session', row_to_json(v_session));
    END IF;

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

    RETURN jsonb_build_object('success', true, 'session', row_to_json(v_session));
END;
$$;

-- =====================================================
-- RPC 2: evaluate_prompt_breach
-- Server-side evaluation for Prompt Breach attack
-- =====================================================
CREATE OR REPLACE FUNCTION evaluate_prompt_breach(
    p_team_id UUID,
    p_challenge_id UUID,
    p_round_session_id UUID,
    p_participant_id UUID,
    p_prompt TEXT,
    p_model_response TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_session challenge_sessions;
    v_challenge challenges;
    v_config JSONB;
    v_secret TEXT;
    v_eval_mode TEXT;
    v_is_extracted BOOLEAN := false;
    v_attempt_number INTEGER;
    v_max_attempts INTEGER := 5;
    v_base_points INTEGER := 150;
    v_score INTEGER := 0;
    v_time_taken INTEGER;
    v_penalty_per_attempt INTEGER := 15;
    v_speed_bonus INTEGER := 0;
BEGIN
    SELECT * INTO v_session FROM challenge_sessions
    WHERE team_id = p_team_id AND challenge_id = p_challenge_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Challenge session not started';
    END IF;

    IF v_session.status != 'IN_PROGRESS' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Challenge is not in progress', 'status', v_session.status);
    END IF;

    IF now() > v_session.deadline_at THEN
        UPDATE challenge_sessions SET status = 'TIMEOUT', completed_at = v_session.deadline_at WHERE id = v_session.id;
        RETURN jsonb_build_object('success', false, 'error', 'Time limit exceeded', 'status', 'TIMEOUT');
    END IF;

    SELECT * INTO v_challenge FROM challenges WHERE id = p_challenge_id;
    v_config := v_challenge.configuration;
    v_secret := v_config->>'hiddenSecret';
    v_eval_mode := COALESCE(v_config->>'evaluationMode', 'NORMALIZED');
    v_base_points := COALESCE((v_config->'scoring'->>'basePoints')::INTEGER, 150);
    v_max_attempts := COALESCE(v_challenge.max_attempts, 5);

    SELECT COUNT(*) INTO v_attempt_number FROM challenge_attempts
    WHERE team_id = p_team_id AND challenge_id = p_challenge_id;

    v_attempt_number := v_attempt_number + 1;
    IF v_attempt_number > v_max_attempts THEN
        RETURN jsonb_build_object('success', false, 'error', 'Maximum attempts reached', 'attemptsUsed', v_max_attempts);
    END IF;

    v_time_taken := EXTRACT(EPOCH FROM (now() - v_session.started_at))::INTEGER;

    -- Evaluate Secret Extraction
    IF v_eval_mode = 'EXACT' THEN
        v_is_extracted := (p_model_response LIKE '%' || v_secret || '%');
    ELSE
        -- Normalized comparison (case-insensitive and whitespace-stripped check)
        v_is_extracted := (
            LOWER(REGEXP_REPLACE(p_model_response, '\s+', '', 'g'))
            LIKE '%' || LOWER(REGEXP_REPLACE(v_secret, '\s+', '', 'g')) || '%'
        );
    END IF;

    IF v_is_extracted THEN
        -- Scoring: base points minus penalty for additional attempts + speed bonus
        v_score := GREATEST(v_base_points - ((v_attempt_number - 1) * v_penalty_per_attempt), 40);
        IF v_time_taken <= 180 THEN
            v_speed_bonus := 30;
        ELSIF v_time_taken <= 360 THEN
            v_speed_bonus := 15;
        END IF;
        v_score := v_score + v_speed_bonus;

        UPDATE challenge_sessions SET
            status = 'COMPLETED',
            completed_at = now(),
            is_correct = true,
            score = v_score,
            attempts_used = v_attempt_number,
            total_time_seconds = v_time_taken
        WHERE id = v_session.id;
    ELSE
        IF v_attempt_number >= v_max_attempts THEN
            UPDATE challenge_sessions SET
                status = 'COMPLETED',
                completed_at = now(),
                is_correct = false,
                score = 0,
                attempts_used = v_attempt_number,
                total_time_seconds = v_time_taken
            WHERE id = v_session.id;
        ELSE
            UPDATE challenge_sessions SET attempts_used = v_attempt_number WHERE id = v_session.id;
        END IF;
    END IF;

    INSERT INTO challenge_attempts (
        team_id, challenge_id, round_session_id, participant_id,
        attempt_number, submission_text, is_correct, score, time_taken_seconds
    ) VALUES (
        p_team_id, p_challenge_id, p_round_session_id, p_participant_id,
        v_attempt_number, p_prompt, v_is_extracted, v_score, v_time_taken
    );

    RETURN jsonb_build_object(
        'success', true,
        'extracted', v_is_extracted,
        'score', v_score,
        'speedBonus', v_speed_bonus,
        'attemptNumber', v_attempt_number,
        'maxAttempts', v_max_attempts,
        'isCompleted', (v_is_extracted OR v_attempt_number >= v_max_attempts)
    );
END;
$$;

-- =====================================================
-- RPC 3: evaluate_cipher_submission
-- Evaluates constructed language constraints and reasoning
-- =====================================================
CREATE OR REPLACE FUNCTION evaluate_cipher_submission(
    p_team_id UUID,
    p_challenge_id UUID,
    p_round_session_id UUID,
    p_participant_id UUID,
    p_dictionary JSONB,
    p_grammar_rules JSONB,
    p_encoded_riddle TEXT,
    p_instruction TEXT,
    p_ai_response TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_session challenge_sessions;
    v_challenge challenges;
    v_config JSONB;
    v_expected_answer TEXT;
    v_max_vocab INTEGER := 15;
    v_max_grammar INTEGER := 3;
    v_vocab_count INTEGER;
    v_grammar_count INTEGER;
    v_attempt_number INTEGER;
    v_max_attempts INTEGER := 3;
    v_constraint_score INTEGER := 0;
    v_comprehension_score INTEGER := 0;
    v_riddle_score INTEGER := 0;
    v_efficiency_score INTEGER := 0;
    v_total_score INTEGER := 0;
    v_is_solved BOOLEAN := false;
    v_time_taken INTEGER;
BEGIN
    SELECT * INTO v_session FROM challenge_sessions
    WHERE team_id = p_team_id AND challenge_id = p_challenge_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Challenge session not started';
    END IF;

    IF v_session.status != 'IN_PROGRESS' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Challenge is not in progress', 'status', v_session.status);
    END IF;

    IF now() > v_session.deadline_at THEN
        UPDATE challenge_sessions SET status = 'TIMEOUT', completed_at = v_session.deadline_at WHERE id = v_session.id;
        RETURN jsonb_build_object('success', false, 'error', 'Time limit exceeded', 'status', 'TIMEOUT');
    END IF;

    SELECT * INTO v_challenge FROM challenges WHERE id = p_challenge_id;
    v_config := v_challenge.configuration;
    v_expected_answer := LOWER(TRIM(v_config->>'expectedAnswer'));
    v_max_vocab := COALESCE((v_config->>'maxVocabulary')::INTEGER, 15);
    v_max_grammar := COALESCE((v_config->>'maxGrammarRules')::INTEGER, 3);
    v_max_attempts := COALESCE(v_challenge.max_attempts, 3);

    -- 1. Validate Constraints
    v_vocab_count := jsonb_array_length(p_dictionary);
    v_grammar_count := jsonb_array_length(p_grammar_rules);

    IF v_vocab_count > v_max_vocab THEN
        RETURN jsonb_build_object('success', false, 'error', 'Vocabulary limit exceeded (Max ' || v_max_vocab || ' words)');
    END IF;

    IF v_grammar_count > v_max_grammar THEN
        RETURN jsonb_build_object('success', false, 'error', 'Grammar rules limit exceeded (Max ' || v_max_grammar || ' rules)');
    END IF;

    SELECT COUNT(*) INTO v_attempt_number FROM cipher_submissions
    WHERE team_id = p_team_id AND challenge_id = p_challenge_id;

    v_attempt_number := v_attempt_number + 1;
    IF v_attempt_number > v_max_attempts THEN
        RETURN jsonb_build_object('success', false, 'error', 'Maximum attempts reached', 'attemptsUsed', v_max_attempts);
    END IF;

    v_time_taken := EXTRACT(EPOCH FROM (now() - v_session.started_at))::INTEGER;

    -- 2. Calculate Sub-Scores
    -- Constraint Score (25 pts max)
    IF v_vocab_count <= v_max_vocab AND v_grammar_count <= v_max_grammar AND length(trim(p_encoded_riddle)) > 0 THEN
        v_constraint_score := 25;
    END IF;

    -- Riddle Correctness (60 pts max)
    IF LOWER(p_ai_response) LIKE '%' || v_expected_answer || '%' THEN
        v_riddle_score := 60;
        v_comprehension_score := 40;
        v_is_solved := true;
    ELSIF length(trim(p_ai_response)) > 10 THEN
        v_comprehension_score := 20; -- Partial language comprehension
    END IF;

    -- Efficiency Score (25 pts max based on compact vocabulary)
    IF v_is_solved THEN
        IF v_vocab_count <= 10 THEN
            v_efficiency_score := 25;
        ELSIF v_vocab_count <= 13 THEN
            v_efficiency_score := 15;
        ELSE
            v_efficiency_score := 10;
        END IF;
    END IF;

    v_total_score := v_constraint_score + v_comprehension_score + v_riddle_score + v_efficiency_score;

    -- 3. Record Submission
    INSERT INTO cipher_submissions (
        team_id, challenge_id, round_session_id, attempt_number,
        dictionary, grammar_rules, encoded_riddle, ai_instruction, ai_response,
        constraint_score, comprehension_score, riddle_score, efficiency_score,
        total_score, is_success
    ) VALUES (
        p_team_id, p_challenge_id, p_round_session_id, v_attempt_number,
        p_dictionary, p_grammar_rules, p_encoded_riddle, p_instruction, p_ai_response,
        v_constraint_score, v_comprehension_score, v_riddle_score, v_efficiency_score,
        v_total_score, v_is_solved
    );

    IF v_is_solved OR v_attempt_number >= v_max_attempts THEN
        UPDATE challenge_sessions SET
            status = 'COMPLETED',
            completed_at = now(),
            is_correct = v_is_solved,
            score = v_total_score,
            attempts_used = v_attempt_number,
            total_time_seconds = v_time_taken
        WHERE id = v_session.id;
    ELSE
        UPDATE challenge_sessions SET attempts_used = v_attempt_number, score = GREATEST(score, v_total_score) WHERE id = v_session.id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'isSolved', v_is_solved,
        'constraintScore', v_constraint_score,
        'comprehensionScore', v_comprehension_score,
        'riddleScore', v_riddle_score,
        'efficiencyScore', v_efficiency_score,
        'totalScore', v_total_score,
        'attemptNumber', v_attempt_number,
        'maxAttempts', v_max_attempts,
        'isCompleted', (v_is_solved OR v_attempt_number >= v_max_attempts)
    );
END;
$$;

-- =====================================================
-- RPC 4: submit_turing_question
-- Logs a question in the Turing interrogation sequence
-- =====================================================
CREATE OR REPLACE FUNCTION submit_turing_question(
    p_team_id UUID,
    p_challenge_id UUID,
    p_round_session_id UUID,
    p_question TEXT,
    p_auto_reply TEXT DEFAULT NULL,
    p_latency_ms INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_session challenge_sessions;
    v_challenge challenges;
    v_config JSONB;
    v_max_questions INTEGER := 7;
    v_count INTEGER;
    v_responder_type TEXT;
    v_interaction turing_test_interactions;
BEGIN
    SELECT * INTO v_session FROM challenge_sessions
    WHERE team_id = p_team_id AND challenge_id = p_challenge_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Challenge session not started';
    END IF;

    IF v_session.status != 'IN_PROGRESS' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Challenge is not in progress');
    END IF;

    IF now() > v_session.deadline_at THEN
        UPDATE challenge_sessions SET status = 'TIMEOUT', completed_at = v_session.deadline_at WHERE id = v_session.id;
        RETURN jsonb_build_object('success', false, 'error', 'Time limit exceeded', 'status', 'TIMEOUT');
    END IF;

    SELECT * INTO v_challenge FROM challenges WHERE id = p_challenge_id;
    v_config := v_challenge.configuration;
    v_max_questions := COALESCE((v_config->>'maxQuestions')::INTEGER, 7);
    v_responder_type := COALESCE(v_config->>'responderType', 'AI');

    SELECT COUNT(*) INTO v_count FROM turing_test_interactions
    WHERE team_id = p_team_id AND challenge_id = p_challenge_id;

    IF v_count >= v_max_questions THEN
        RETURN jsonb_build_object('success', false, 'error', 'Maximum questions reached. You must submit your final verdict now.');
    END IF;

    INSERT INTO turing_test_interactions (
        team_id, challenge_id, round_session_id, sequence_number,
        question, response, responder_type, response_latency_ms, responded_at
    ) VALUES (
        p_team_id, p_challenge_id, p_round_session_id, v_count + 1,
        p_question, p_auto_reply, v_responder_type, p_latency_ms,
        CASE WHEN p_auto_reply IS NOT NULL THEN now() ELSE NULL END
    ) RETURNING * INTO v_interaction;

    RETURN jsonb_build_object(
        'success', true,
        'interaction', row_to_json(v_interaction),
        'questionNumber', v_count + 1,
        'maxQuestions', v_max_questions,
        'remainingQuestions', v_max_questions - (v_count + 1)
    );
END;
$$;

-- =====================================================
-- RPC 5: submit_turing_verdict
-- Evaluates the participant's final verdict in Turing test
-- =====================================================
CREATE OR REPLACE FUNCTION submit_turing_verdict(
    p_team_id UUID,
    p_challenge_id UUID,
    p_round_session_id UUID,
    p_verdict TEXT,
    p_reasoning TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_session challenge_sessions;
    v_challenge challenges;
    v_config JSONB;
    v_actual_identity TEXT;
    v_is_correct BOOLEAN;
    v_questions_used INTEGER;
    v_base_points INTEGER := 150;
    v_efficiency_bonus INTEGER := 0;
    v_score INTEGER := 0;
    v_time_taken INTEGER;
BEGIN
    SELECT * INTO v_session FROM challenge_sessions
    WHERE team_id = p_team_id AND challenge_id = p_challenge_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Challenge session not started';
    END IF;

    IF v_session.status != 'IN_PROGRESS' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Challenge already completed');
    END IF;

    SELECT * INTO v_challenge FROM challenges WHERE id = p_challenge_id;
    v_config := v_challenge.configuration;
    v_actual_identity := COALESCE(v_config->>'actualIdentity', 'AI');
    v_base_points := COALESCE((v_config->'scoring'->>'basePoints')::INTEGER, 150);

    SELECT COUNT(*) INTO v_questions_used FROM turing_test_interactions
    WHERE team_id = p_team_id AND challenge_id = p_challenge_id;

    v_is_correct := (UPPER(p_verdict) = UPPER(v_actual_identity));
    v_time_taken := EXTRACT(EPOCH FROM (now() - v_session.started_at))::INTEGER;

    IF v_is_correct THEN
        v_score := v_base_points;
        -- Efficiency bonus: fewer questions = higher bonus (up to 30 pts)
        v_efficiency_bonus := GREATEST((7 - v_questions_used) * 6, 0);
        v_score := v_score + v_efficiency_bonus;
    ELSE
        v_score := 0;
    END IF;

    INSERT INTO turing_verdicts (
        team_id, challenge_id, round_session_id, verdict,
        actual_identity, is_correct, reasoning, questions_used, score
    ) VALUES (
        p_team_id, p_challenge_id, p_round_session_id, UPPER(p_verdict),
        v_actual_identity, v_is_correct, p_reasoning, v_questions_used, v_score
    );

    UPDATE challenge_sessions SET
        status = 'COMPLETED',
        completed_at = now(),
        is_correct = v_is_correct,
        score = v_score,
        attempts_used = 1,
        total_time_seconds = v_time_taken
    WHERE id = v_session.id;

    RETURN jsonb_build_object(
        'success', true,
        'isCorrect', v_is_correct,
        'actualIdentity', v_actual_identity,
        'score', v_score,
        'efficiencyBonus', v_efficiency_bonus,
        'questionsUsed', v_questions_used
    );
END;
$$;

-- =====================================================
-- RPC 6: evaluate_prompt_zipper
-- Evaluates compressed prompt compliance & probe accuracy
-- =====================================================
CREATE OR REPLACE FUNCTION evaluate_prompt_zipper(
    p_team_id UUID,
    p_challenge_id UUID,
    p_round_session_id UUID,
    p_compressed_prompt TEXT,
    p_probe_results JSONB -- Array of { question, correct, expected, actual }
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_session challenge_sessions;
    v_challenge challenges;
    v_config JSONB;
    v_word_limit INTEGER := 100;
    v_actual_words INTEGER;
    v_attempt_number INTEGER;
    v_max_attempts INTEGER := 3;
    v_correct_count INTEGER := 0;
    v_total_probes INTEGER;
    v_accuracy_score INTEGER := 0;
    v_compression_score INTEGER := 0;
    v_constraint_score INTEGER := 0;
    v_total_score INTEGER := 0;
    v_time_taken INTEGER;
    v_elem JSONB;
BEGIN
    SELECT * INTO v_session FROM challenge_sessions
    WHERE team_id = p_team_id AND challenge_id = p_challenge_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Challenge session not started';
    END IF;

    IF v_session.status != 'IN_PROGRESS' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Challenge is not in progress');
    END IF;

    IF now() > v_session.deadline_at THEN
        UPDATE challenge_sessions SET status = 'TIMEOUT', completed_at = v_session.deadline_at WHERE id = v_session.id;
        RETURN jsonb_build_object('success', false, 'error', 'Time limit exceeded', 'status', 'TIMEOUT');
    END IF;

    SELECT * INTO v_challenge FROM challenges WHERE id = p_challenge_id;
    v_config := v_challenge.configuration;
    v_word_limit := COALESCE((v_config->>'wordLimit')::INTEGER, 100);
    v_max_attempts := COALESCE(v_challenge.max_attempts, 3);

    -- Calculate word count (splitting by whitespace)
    v_actual_words := array_length(regexp_split_to_array(trim(p_compressed_prompt), '\s+'), 1);
    IF v_actual_words IS NULL OR trim(p_compressed_prompt) = '' THEN
        v_actual_words := 0;
    END IF;

    IF v_actual_words > v_word_limit THEN
        RETURN jsonb_build_object('success', false, 'error', 'Word limit exceeded (' || v_actual_words || ' / ' || v_word_limit || ' words)');
    END IF;

    SELECT COUNT(*) INTO v_attempt_number FROM prompt_zipper_evaluations
    WHERE team_id = p_team_id AND challenge_id = p_challenge_id;

    v_attempt_number := v_attempt_number + 1;
    IF v_attempt_number > v_max_attempts THEN
        RETURN jsonb_build_object('success', false, 'error', 'Maximum attempts reached', 'attemptsUsed', v_max_attempts);
    END IF;

    v_time_taken := EXTRACT(EPOCH FROM (now() - v_session.started_at))::INTEGER;

    -- Count correct probes
    v_total_probes := jsonb_array_length(p_probe_results);
    IF v_total_probes > 0 THEN
        FOR v_elem IN SELECT * FROM jsonb_array_elements(p_probe_results)
        LOOP
            IF (v_elem->>'correct')::BOOLEAN = true THEN
                v_correct_count := v_correct_count + 1;
            END IF;
        END LOOP;
    END IF;

    -- Scoring: 70% Accuracy, 20% Compression Efficiency, 10% Constraint Compliance
    IF v_total_probes > 0 THEN
        v_accuracy_score := ROUND((v_correct_count::NUMERIC / v_total_probes::NUMERIC) * 105); -- Max 105 pts
    END IF;

    IF v_actual_words > 0 AND v_actual_words <= v_word_limit THEN
        v_constraint_score := 15; -- 15 pts for respecting word limit
        -- Compression efficiency: under 75 words = 30 pts, under 90 = 20 pts, under 100 = 10 pts
        IF v_actual_words <= 75 THEN
            v_compression_score := 30;
        ELSIF v_actual_words <= 90 THEN
            v_compression_score := 20;
        ELSE
            v_compression_score := 10;
        END IF;
    END IF;

    v_total_score := v_accuracy_score + v_compression_score + v_constraint_score;

    INSERT INTO prompt_zipper_evaluations (
        team_id, challenge_id, round_session_id, attempt_number,
        compressed_prompt, word_count, probe_results,
        questions_correct, questions_total,
        accuracy_score, compression_score, constraint_score, total_score
    ) VALUES (
        p_team_id, p_challenge_id, p_round_session_id, v_attempt_number,
        p_compressed_prompt, v_actual_words, p_probe_results,
        v_correct_count, v_total_probes,
        v_accuracy_score, v_compression_score, v_constraint_score, v_total_score
    );

    IF v_correct_count = v_total_probes OR v_attempt_number >= v_max_attempts THEN
        UPDATE challenge_sessions SET
            status = 'COMPLETED',
            completed_at = now(),
            is_correct = (v_correct_count > 0),
            score = v_total_score,
            attempts_used = v_attempt_number,
            total_time_seconds = v_time_taken
        WHERE id = v_session.id;
    ELSE
        UPDATE challenge_sessions SET
            attempts_used = v_attempt_number,
            score = GREATEST(score, v_total_score)
        WHERE id = v_session.id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'wordCount', v_actual_words,
        'wordLimit', v_word_limit,
        'questionsCorrect', v_correct_count,
        'questionsTotal', v_total_probes,
        'accuracyScore', v_accuracy_score,
        'compressionScore', v_compression_score,
        'constraintScore', v_constraint_score,
        'totalScore', v_total_score,
        'attemptNumber', v_attempt_number,
        'maxAttempts', v_max_attempts,
        'isCompleted', (v_correct_count = v_total_probes OR v_attempt_number >= v_max_attempts)
    );
END;
$$;

-- =====================================================
-- RPC 7: complete_round4_session
-- Aggregates all Round 4 challenge scores into round_sessions
-- =====================================================
CREATE OR REPLACE FUNCTION complete_round4_session(
    p_team_id UUID,
    p_round_session_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_score INTEGER := 0;
    v_challenges_completed INTEGER := 0;
    v_total_challenges INTEGER := 4;
BEGIN
    SELECT COALESCE(SUM(score), 0), COUNT(*)
    INTO v_total_score, v_challenges_completed
    FROM challenge_sessions
    WHERE round_session_id = p_round_session_id AND status = 'COMPLETED';

    UPDATE round_sessions
    SET status = 'COMPLETED',
        completed_at = now(),
        score = v_total_score
    WHERE id = p_round_session_id;

    -- Update round score on teams/leaderboard
    INSERT INTO activity_logs (team_id, action, details)
    VALUES (p_team_id, 'ROUND4_COMPLETED', jsonb_build_object(
        'round_session_id', p_round_session_id,
        'total_score', v_total_score,
        'challenges_completed', v_challenges_completed
    ));

    RETURN jsonb_build_object(
        'success', true,
        'totalScore', v_total_score,
        'challengesCompleted', v_challenges_completed
    );
END;
$$;
