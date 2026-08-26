-- Migration 009: Quiz System for Championship Rounds

-- Quiz questions table
CREATE TABLE quiz_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    round_id UUID REFERENCES rounds(id) ON DELETE CASCADE,
    question_number INTEGER NOT NULL,
    question_text TEXT NOT NULL,
    question_type TEXT NOT NULL CHECK (question_type IN ('SINGLE_ANSWER', 'MULTI_SELECT')),
    image_url TEXT, -- Optional image for visual questions
    points INTEGER NOT NULL DEFAULT 1,
    order_index INTEGER NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb, -- For additional question data
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(round_id, question_number)
);

-- Quiz options (answer choices)
CREATE TABLE quiz_options (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_id UUID REFERENCES quiz_questions(id) ON DELETE CASCADE,
    option_label TEXT NOT NULL, -- A, B, C, D
    option_text TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL DEFAULT false,
    order_index INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(question_id, option_label)
);

-- Quiz answers (team's submitted answers)
CREATE TABLE quiz_answers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    round_session_id UUID REFERENCES round_sessions(id) ON DELETE CASCADE,
    question_id UUID REFERENCES quiz_questions(id) ON DELETE CASCADE,
    selected_options TEXT[] NOT NULL, -- Array of option labels (e.g., ['A'] or ['A', 'C'])
    is_correct BOOLEAN, -- Calculated on submission
    points_earned INTEGER DEFAULT 0,
    answered_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(round_session_id, question_id)
);

-- Quiz sessions (for tracking quiz progress)
CREATE TABLE quiz_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    round_id UUID REFERENCES rounds(id) ON DELETE CASCADE,
    round_session_id UUID REFERENCES round_sessions(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ DEFAULT now(),
    submitted_at TIMESTAMPTZ,
    time_remaining_seconds INTEGER, -- Track time when paused/submitted
    total_score INTEGER DEFAULT 0,
    total_questions INTEGER NOT NULL,
    correct_answers INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'SUBMITTED', 'GRADED')),
    UNIQUE(team_id, round_id)
);

-- Indexes for performance
CREATE INDEX idx_quiz_questions_round ON quiz_questions(round_id);
CREATE INDEX idx_quiz_options_question ON quiz_options(question_id);
CREATE INDEX idx_quiz_answers_team_session ON quiz_answers(team_id, round_session_id);
CREATE INDEX idx_quiz_answers_question ON quiz_answers(question_id);
CREATE INDEX idx_quiz_sessions_team_round ON quiz_sessions(team_id, round_id);

-- Function to calculate quiz score
CREATE OR REPLACE FUNCTION calculate_quiz_score(p_round_session_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_total_score INTEGER := 0;
    v_correct_count INTEGER := 0;
    v_total_questions INTEGER;
BEGIN
    -- Calculate total score and correct answers
    SELECT 
        COALESCE(SUM(qa.points_earned), 0),
        COUNT(*) FILTER (WHERE qa.is_correct = true)
    INTO v_total_score, v_correct_count
    FROM quiz_answers qa
    WHERE qa.round_session_id = p_round_session_id;

    -- Get total questions for this round
    SELECT COUNT(*)
    INTO v_total_questions
    FROM quiz_questions qq
    JOIN round_sessions rs ON qq.round_id = rs.round_id
    WHERE rs.id = p_round_session_id;

    -- Update quiz session
    UPDATE quiz_sessions
    SET 
        total_score = v_total_score,
        correct_answers = v_correct_count,
        status = 'GRADED'
    WHERE round_session_id = p_round_session_id;

    -- Update round session score
    UPDATE round_sessions
    SET score = v_total_score
    WHERE id = p_round_session_id;

    RETURN v_total_score;
END;
$$ LANGUAGE plpgsql;

-- Function to submit quiz answer
CREATE OR REPLACE FUNCTION submit_quiz_answer(
    p_team_id UUID,
    p_round_session_id UUID,
    p_question_id UUID,
    p_selected_options TEXT[]
)
RETURNS JSONB AS $$
DECLARE
    v_correct_options TEXT[];
    v_is_correct BOOLEAN;
    v_points INTEGER;
    v_points_earned INTEGER := 0;
    v_question_type TEXT;
BEGIN
    -- Get question details
    SELECT question_type, points
    INTO v_question_type, v_points
    FROM quiz_questions
    WHERE id = p_question_id;

    -- Get correct options
    SELECT ARRAY_AGG(option_label ORDER BY option_label)
    INTO v_correct_options
    FROM quiz_options
    WHERE question_id = p_question_id AND is_correct = true;

    -- Check if answer is correct
    IF v_question_type = 'SINGLE_ANSWER' THEN
        v_is_correct := (p_selected_options[1] = v_correct_options[1]);
    ELSE -- MULTI_SELECT
        -- Sort both arrays and compare
        v_is_correct := (
            ARRAY(SELECT unnest(p_selected_options) ORDER BY 1) = 
            ARRAY(SELECT unnest(v_correct_options) ORDER BY 1)
        );
    END IF;

    -- Calculate points earned
    IF v_is_correct THEN
        v_points_earned := v_points;
    END IF;

    -- Insert or update answer
    INSERT INTO quiz_answers (
        team_id,
        round_session_id,
        question_id,
        selected_options,
        is_correct,
        points_earned
    ) VALUES (
        p_team_id,
        p_round_session_id,
        p_question_id,
        p_selected_options,
        v_is_correct,
        v_points_earned
    )
    ON CONFLICT (round_session_id, question_id)
    DO UPDATE SET
        selected_options = EXCLUDED.selected_options,
        is_correct = EXCLUDED.is_correct,
        points_earned = EXCLUDED.points_earned,
        answered_at = now();

    RETURN jsonb_build_object(
        'is_correct', v_is_correct,
        'points_earned', v_points_earned,
        'correct_options', v_correct_options
    );
END;
$$ LANGUAGE plpgsql;

-- Function to start quiz session
CREATE OR REPLACE FUNCTION start_quiz_session(
    p_team_id UUID,
    p_round_id UUID,
    p_round_session_id UUID
)
RETURNS UUID AS $$
DECLARE
    v_session_id UUID;
    v_total_questions INTEGER;
BEGIN
    -- Get total questions
    SELECT COUNT(*)
    INTO v_total_questions
    FROM quiz_questions
    WHERE round_id = p_round_id;

    -- Create or get existing session
    INSERT INTO quiz_sessions (
        team_id,
        round_id,
        round_session_id,
        total_questions,
        status
    ) VALUES (
        p_team_id,
        p_round_id,
        p_round_session_id,
        v_total_questions,
        'IN_PROGRESS'
    )
    ON CONFLICT (team_id, round_id)
    DO UPDATE SET
        round_session_id = EXCLUDED.round_session_id,
        started_at = now(),
        status = 'IN_PROGRESS'
    RETURNING id INTO v_session_id;

    RETURN v_session_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE quiz_questions IS 'Quiz questions for championship rounds';
COMMENT ON TABLE quiz_options IS 'Multiple choice options for quiz questions';
COMMENT ON TABLE quiz_answers IS 'Team submitted answers for quiz questions';
COMMENT ON TABLE quiz_sessions IS 'Tracks team progress through quiz rounds';
