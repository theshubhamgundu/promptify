-- Migration 033: Fix Quiz Answers Schema for Code-Based Questions
-- Allows `question_id` to be a string (e.g. "2nd-q1") instead of a strict UUID

-- 1. Drop the foreign key constraint that requires questions to exist in the database
ALTER TABLE quiz_answers
DROP CONSTRAINT IF EXISTS quiz_answers_question_id_fkey;

-- 2. Change the column type from UUID to TEXT
ALTER TABLE quiz_answers
ALTER COLUMN question_id TYPE TEXT USING question_id::TEXT;

-- 3. Update the submit_quiz_bulk function to use TEXT for question_id instead of UUID
CREATE OR REPLACE FUNCTION submit_quiz_bulk(
    p_team_id UUID,
    p_round_id UUID,
    p_answers JSONB,
    p_time_remaining INTEGER DEFAULT 0
)
RETURNS JSONB AS $$
DECLARE
    v_round_session_id UUID;
    v_quiz_session_id UUID;
    v_total_score INTEGER := 0;
    v_correct_count INTEGER := 0;
    v_total_questions INTEGER;
    v_answer JSONB;
    v_is_correct BOOLEAN;
    v_points_earned INTEGER;
    v_selected TEXT[];
    v_correct TEXT[];
    v_question_id TEXT; -- CHANGED from UUID to TEXT
    v_existing_status TEXT;
BEGIN
    -- 1. Get or create round_session, lock it to prevent races
    SELECT id INTO v_round_session_id
    FROM round_sessions
    WHERE team_id = p_team_id AND round_id = p_round_id
    FOR UPDATE;

    IF v_round_session_id IS NULL THEN
        INSERT INTO round_sessions (team_id, round_id, started_at, score)
        VALUES (p_team_id, p_round_id, now(), 0)
        RETURNING id INTO v_round_session_id;
    END IF;

    -- 2. Check if quiz_session already submitted (prevent duplicate)
    SELECT status INTO v_existing_status
    FROM quiz_sessions
    WHERE team_id = p_team_id AND round_id = p_round_id
    FOR UPDATE;

    IF v_existing_status = 'GRADED' THEN
        SELECT jsonb_build_object(
            'success', true,
            'already_submitted', true,
            'total_score', total_score,
            'correct_answers', correct_answers,
            'total_questions', total_questions
        ) INTO v_answer
        FROM quiz_sessions
        WHERE team_id = p_team_id AND round_id = p_round_id;
        
        RETURN v_answer;
    END IF;

    -- 3. Count total questions from the payload
    v_total_questions := jsonb_array_length(p_answers);

    -- 4. Process each answer
    FOR v_answer IN SELECT * FROM jsonb_array_elements(p_answers)
    LOOP
        -- CHANGED: Do not cast to UUID
        v_question_id := v_answer->>'question_id';
        
        -- Parse selected options
        SELECT ARRAY(
            SELECT jsonb_array_elements_text(v_answer->'selected_options')
            ORDER BY 1
        ) INTO v_selected;
        
        -- Parse correct answers
        SELECT ARRAY(
            SELECT jsonb_array_elements_text(v_answer->'correct_answers')
            ORDER BY 1
        ) INTO v_correct;
        
        -- Grade: compare sorted arrays
        v_is_correct := (v_selected = v_correct) AND (array_length(v_selected, 1) > 0);
        
        -- Calculate points
        v_points_earned := 0;
        IF v_is_correct THEN
            v_points_earned := COALESCE((v_answer->>'points')::INTEGER, 1);
            v_correct_count := v_correct_count + 1;
        END IF;
        
        v_total_score := v_total_score + v_points_earned;
        
        -- Upsert quiz_answer
        INSERT INTO quiz_answers (
            team_id,
            round_session_id,
            question_id,
            selected_options,
            is_correct,
            points_earned,
            answered_at
        ) VALUES (
            p_team_id,
            v_round_session_id,
            v_question_id,
            v_selected,
            v_is_correct,
            v_points_earned,
            now()
        )
        ON CONFLICT (round_session_id, question_id)
        DO UPDATE SET
            selected_options = EXCLUDED.selected_options,
            is_correct = EXCLUDED.is_correct,
            points_earned = EXCLUDED.points_earned,
            answered_at = now();
    END LOOP;

    -- 5. Upsert quiz_session
    INSERT INTO quiz_sessions (
        team_id,
        round_id,
        round_session_id,
        total_questions,
        total_score,
        correct_answers,
        status,
        submitted_at
    ) VALUES (
        p_team_id,
        p_round_id,
        v_round_session_id,
        v_total_questions,
        v_total_score,
        v_correct_count,
        'GRADED',
        now()
    )
    ON CONFLICT (team_id, round_id)
    DO UPDATE SET
        total_questions = EXCLUDED.total_questions,
        total_score = EXCLUDED.total_score,
        correct_answers = EXCLUDED.correct_answers,
        status = 'GRADED',
        submitted_at = now()
    RETURNING id INTO v_quiz_session_id;

    -- 6. Update round_session with final score
    UPDATE round_sessions
    SET 
        status = 'COMPLETED',
        score = v_total_score,
        completed_at = now()
    WHERE id = v_round_session_id;

    -- Return success payload
    RETURN jsonb_build_object(
        'success', true,
        'quiz_session_id', v_quiz_session_id,
        'total_score', v_total_score,
        'correct_answers', v_correct_count,
        'total_questions', v_total_questions
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
