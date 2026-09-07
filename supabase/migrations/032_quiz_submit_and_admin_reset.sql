-- Migration 032: Quiz Bulk Submit + Admin Reset Functions
-- Handles: 500 concurrent participants, staggered bulk submissions, admin round reset

-- =====================================================
-- 1. SUBMIT QUIZ BULK — Single RPC for all quiz answers
-- =====================================================
-- Accepts a team's full quiz as one JSON payload.
-- Grades answers, updates quiz_session, updates round_session.
-- Uses row locking to prevent duplicate submissions.

-- 0. Fix quiz_answers schema for string IDs
ALTER TABLE quiz_answers DROP CONSTRAINT IF EXISTS quiz_answers_question_id_fkey;
ALTER TABLE quiz_answers ALTER COLUMN question_id TYPE TEXT USING question_id::TEXT;

CREATE OR REPLACE FUNCTION submit_quiz_bulk(
    p_team_id UUID,
    p_round_id UUID,
    p_answers JSONB,         -- [{ "question_id": "...", "selected_options": ["A"], "correct_answers": ["A"], "points": 1 }, ...]
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
    v_question_id TEXT;
    v_existing_status TEXT;
BEGIN
    -- 1. Get or create round_session, lock it to prevent races
    SELECT id INTO v_round_session_id
    FROM round_sessions
    WHERE team_id = p_team_id AND round_id = p_round_id
    FOR UPDATE;

    IF v_round_session_id IS NULL THEN
        -- Create a new round session
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
        -- Already submitted — return existing score
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
        time_remaining_seconds,
        submitted_at
    ) VALUES (
        p_team_id,
        p_round_id,
        v_round_session_id,
        v_total_questions,
        v_total_score,
        v_correct_count,
        'GRADED',
        p_time_remaining,
        now()
    )
    ON CONFLICT (team_id, round_id)
    DO UPDATE SET
        total_score = EXCLUDED.total_score,
        correct_answers = EXCLUDED.correct_answers,
        total_questions = EXCLUDED.total_questions,
        status = 'GRADED',
        time_remaining_seconds = EXCLUDED.time_remaining_seconds,
        submitted_at = now();

    -- 6. Update round_session score and status
    UPDATE round_sessions
    SET score = v_total_score,
        completed_at = now(),
        status = 'COMPLETED'
    WHERE id = v_round_session_id;

    -- 7. Log the submission
    INSERT INTO activity_logs (team_id, action, details)
    VALUES (
        p_team_id,
        'QUIZ_SUBMITTED',
        jsonb_build_object(
            'round_id', p_round_id,
            'total_score', v_total_score,
            'correct_answers', v_correct_count,
            'total_questions', v_total_questions,
            'time_remaining', p_time_remaining
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'already_submitted', false,
        'total_score', v_total_score,
        'correct_answers', v_correct_count,
        'total_questions', v_total_questions,
        'round_session_id', v_round_session_id
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =====================================================
-- 2. ADMIN RESET ROUND — Reset a single round for a team
-- =====================================================
-- Cleans ALL round-specific data so team can re-attempt.
-- Uses SECURITY DEFINER to bypass RLS.

CREATE OR REPLACE FUNCTION admin_reset_round(
    p_team_id UUID,
    p_round_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_round_session_id UUID;
    v_round_type TEXT;
    v_deleted_answers INTEGER := 0;
    v_deleted_sessions INTEGER := 0;
    v_deleted_submissions INTEGER := 0;
BEGIN
    -- 1. Get the round session ID and round type
    SELECT rs.id INTO v_round_session_id
    FROM round_sessions rs
    WHERE rs.team_id = p_team_id AND rs.round_id = p_round_id;

    SELECT r.type::TEXT INTO v_round_type
    FROM rounds r
    WHERE r.id = p_round_id;

    -- If no session exists, nothing to reset
    IF v_round_session_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', true,
            'message', 'No round session found — nothing to reset',
            'deleted_answers', 0,
            'deleted_sessions', 0
        );
    END IF;

    -- 2. Delete round-specific data based on round type

    -- QUIZ round data
    IF v_round_type IN ('QUIZ') THEN
        -- Delete quiz answers
        DELETE FROM quiz_answers
        WHERE team_id = p_team_id 
          AND round_session_id = v_round_session_id;
        GET DIAGNOSTICS v_deleted_answers = ROW_COUNT;

        -- Delete quiz session
        DELETE FROM quiz_sessions
        WHERE team_id = p_team_id AND round_id = p_round_id;
        GET DIAGNOSTICS v_deleted_sessions = ROW_COUNT;
    END IF;

    -- PROMPT / PROMPT HEIST round data
    IF v_round_type IN ('PROMPT') THEN
        DELETE FROM prompt_submissions
        WHERE team_id = p_team_id AND round_session_id = v_round_session_id;
        GET DIAGNOSTICS v_deleted_submissions = ROW_COUNT;

        DELETE FROM prompt_round_sessions
        WHERE team_id = p_team_id AND round_id = p_round_id;
    END IF;

    -- VISION CHALLENGE round data
    IF v_round_type IN ('VISION_CHALLENGE', 'ESCAPE_ROOM') THEN
        DELETE FROM challenge_sessions
        WHERE team_id = p_team_id AND round_session_id = v_round_session_id;
        GET DIAGNOSTICS v_deleted_submissions = ROW_COUNT;

        -- Also clean submissions
        DELETE FROM submissions
        WHERE team_id = p_team_id AND round_session_id = v_round_session_id;
    END IF;

    -- AI ADVERSARIAL round data
    IF v_round_type IN ('AI_ADVERSARIAL', 'ADVERSARIAL_CHALLENGE') THEN
        -- Turing test data
        DELETE FROM turing_test_interactions
        WHERE team_id = p_team_id AND round_session_id = v_round_session_id;
        
        DELETE FROM turing_verdicts
        WHERE team_id = p_team_id AND round_session_id = v_round_session_id;

        -- Cipher submissions
        DELETE FROM cipher_submissions
        WHERE team_id = p_team_id AND round_session_id = v_round_session_id;

        -- Challenge sessions
        DELETE FROM challenge_sessions
        WHERE team_id = p_team_id AND round_session_id = v_round_session_id;

        -- General submissions
        DELETE FROM submissions
        WHERE team_id = p_team_id AND round_session_id = v_round_session_id;
        
        GET DIAGNOSTICS v_deleted_submissions = ROW_COUNT;
    END IF;

    -- AI SYSTEMS round data (Round 5)
    IF v_round_type IN ('AI_SYSTEMS') THEN
        -- Prompt sheet entries
        DELETE FROM prompt_sheet_entries
        WHERE team_id = p_team_id AND round_session_id = v_round_session_id;

        -- Challenge sessions
        DELETE FROM challenge_sessions
        WHERE team_id = p_team_id AND round_session_id = v_round_session_id;

        -- General submissions
        DELETE FROM submissions
        WHERE team_id = p_team_id AND round_session_id = v_round_session_id;
        
        GET DIAGNOSTICS v_deleted_submissions = ROW_COUNT;
    END IF;

    -- 3. Clean generic data for ALL round types

    -- Challenge attempts and evaluations
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'challenge_attempts') THEN
        -- Delete evaluation results first (FK dependency)
        DELETE FROM evaluation_results
        WHERE attempt_id IN (
            SELECT id FROM challenge_attempts
            WHERE team_id = p_team_id AND round_session_id = v_round_session_id
        );

        DELETE FROM challenge_attempts
        WHERE team_id = p_team_id AND round_session_id = v_round_session_id;
    END IF;

    -- BYOK sessions and usage
    DELETE FROM byok_usage_logs
    WHERE byok_session_id IN (
        SELECT id FROM byok_sessions
        WHERE team_id = p_team_id AND round_session_id = v_round_session_id
    );

    DELETE FROM byok_sessions
    WHERE team_id = p_team_id AND round_session_id = v_round_session_id;

    -- 4. Delete the round session itself
    DELETE FROM round_sessions
    WHERE team_id = p_team_id AND round_id = p_round_id;

    -- 5. Log the admin action
    INSERT INTO activity_logs (team_id, action, details)
    VALUES (
        p_team_id,
        'ADMIN_RESET_ROUND',
        jsonb_build_object(
            'round_id', p_round_id,
            'round_type', v_round_type,
            'deleted_answers', v_deleted_answers,
            'deleted_sessions', v_deleted_sessions,
            'deleted_submissions', v_deleted_submissions,
            'reset_at', now()
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Round reset successfully',
        'round_type', v_round_type,
        'deleted_answers', v_deleted_answers,
        'deleted_sessions', v_deleted_sessions,
        'deleted_submissions', v_deleted_submissions
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =====================================================
-- 3. ADMIN RESET ALL ROUNDS — Reset every round for a team
-- =====================================================

CREATE OR REPLACE FUNCTION admin_reset_all_rounds(
    p_team_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_round RECORD;
    v_rounds_count INTEGER := 0;
    v_result JSONB;
    v_errors TEXT[] := '{}';
BEGIN
    -- Loop through all round sessions for this team
    FOR v_round IN
        SELECT rs.round_id
        FROM round_sessions rs
        WHERE rs.team_id = p_team_id
    LOOP
        v_result := admin_reset_round(p_team_id, v_round.round_id);
        
        IF (v_result->>'success')::BOOLEAN THEN
            v_rounds_count := v_rounds_count + 1;
        ELSE
            v_errors := array_append(v_errors, v_result->>'error');
        END IF;
    END LOOP;

    -- Log the full reset
    INSERT INTO activity_logs (team_id, action, details)
    VALUES (
        p_team_id,
        'ADMIN_RESET_ALL_ROUNDS',
        jsonb_build_object(
            'rounds_reset', v_rounds_count,
            'errors', v_errors,
            'reset_at', now()
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'rounds_count', v_rounds_count,
        'errors', v_errors
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON FUNCTION submit_quiz_bulk IS 'Bulk submit all quiz answers in one transaction. Prevents thundering herd by accepting full payload.';
COMMENT ON FUNCTION admin_reset_round IS 'Admin: Reset a specific round for a team, deleting all progress so they can re-attempt.';
COMMENT ON FUNCTION admin_reset_all_rounds IS 'Admin: Reset ALL rounds for a team.';
