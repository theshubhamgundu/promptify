-- ════════════════════════════════════════════════════════════════
-- Migration 042: Round 2 RPC Functions
-- Submit and evaluate Round 2 answers
-- ════════════════════════════════════════════════════════════════

-- Function to submit Round 2 answer
CREATE OR REPLACE FUNCTION submit_round2_answer(
    p_team_id UUID,
    p_round_id UUID,
    p_question_id TEXT,
    p_prompt_text TEXT,
    p_time_taken_seconds INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_session_id UUID;
    v_round_session_id UUID;
    v_submission_id UUID;
    v_score DECIMAL(6,2);
    v_current_sub_round INTEGER;
    v_current_question INTEGER;
    v_sub_round_score DECIMAL(6,2);
    v_evaluation_result JSONB;
BEGIN
    -- Get Round 2 session
    SELECT id, current_sub_round, current_question, round_session_id
    INTO v_session_id, v_current_sub_round, v_current_question, v_round_session_id
    FROM round2_sessions
    WHERE team_id = p_team_id AND round_id = p_round_id;
    
    IF v_session_id IS NULL THEN
        RAISE EXCEPTION 'Round 2 session not found for team';
    END IF;
    
    -- Check if already submitted for this question
    IF EXISTS (
        SELECT 1 FROM round2_submissions
        WHERE team_id = p_team_id AND question_id = p_question_id
    ) THEN
        RAISE EXCEPTION 'Question already answered (1 attempt only)';
    END IF;
    
    -- ═══════════════════════════════════════════════════════════
    -- EVALUATION LOGIC (Simplified - Frontend does heavy lifting)
    -- ═══════════════════════════════════════════════════════════
    
    -- For now, we'll store the submission and let the frontend
    -- calculate the score using the evaluation engine.
    -- In production, you'd want to run evaluation server-side
    -- via a Supabase Edge Function that calls your eval logic.
    
    -- Placeholder scores (will be updated by edge function)
    v_score := 0;
    v_evaluation_result := jsonb_build_object(
        'status', 'pending',
        'message', 'Evaluation in progress'
    );
    
    -- Insert submission
    INSERT INTO round2_submissions (
        team_id,
        round_session_id,
        question_id,
        prompt_text,
        time_taken_seconds,
        total_score,
        hidden_test_pass_rate,
        grammar_score,
        constraint_score,
        time_bonus,
        evaluation_details,
        submitted_at
    )
    VALUES (
        p_team_id,
        v_round_session_id,
        p_question_id,
        p_prompt_text,
        p_time_taken_seconds,
        v_score,
        0,
        0,
        0,
        0,
        v_evaluation_result,
        NOW()
    )
    RETURNING id INTO v_submission_id;
    
    -- Update session progress
    IF v_current_question < 4 THEN
        -- Move to next question
        UPDATE round2_sessions
        SET current_question = v_current_question + 1
        WHERE id = v_session_id;
    ELSE
        -- Complete current sub-round
        EXECUTE format(
            'UPDATE round2_sessions SET sub_round_%s_status = $1 WHERE id = $2',
            v_current_sub_round
        )
        USING 'COMPLETED', v_session_id;
        
        -- If not last sub-round, start next one
        IF v_current_sub_round < 4 THEN
            EXECUTE format(
                'UPDATE round2_sessions SET current_sub_round = $1, current_question = 1, sub_round_%s_status = $2, sub_round_%s_started_at = NOW() WHERE id = $3',
                v_current_sub_round + 1,
                v_current_sub_round + 1
            )
            USING v_current_sub_round + 1, 'IN_PROGRESS', v_session_id;
        ELSE
            -- Complete entire round
            UPDATE round2_sessions
            SET completed_at = NOW()
            WHERE id = v_session_id;
        END IF;
    END IF;
    
    -- Return result
    RETURN jsonb_build_object(
        'success', true,
        'submission_id', v_submission_id,
        'score', v_score,
        'message', 'Answer submitted. Evaluation pending.'
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Submission failed: %', SQLERRM;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION submit_round2_answer TO authenticated;

-- ═══════════════════════════════════════════════════════════════
-- Function to update evaluation results (called by edge function)
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_round2_evaluation(
    p_submission_id UUID,
    p_total_score DECIMAL(6,2),
    p_hidden_test_pass_rate DECIMAL(5,2),
    p_grammar_score DECIMAL(5,2),
    p_constraint_score DECIMAL(5,2),
    p_time_bonus DECIMAL(5,2),
    p_evaluation_details JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_team_id UUID;
    v_session_id UUID;
    v_question_id TEXT;
    v_sub_round INTEGER;
    v_sub_round_total DECIMAL(6,2);
    v_round_total DECIMAL(7,2);
BEGIN
    -- Get submission details
    SELECT team_id, round_session_id, question_id
    INTO v_team_id, v_session_id, v_question_id
    FROM round2_submissions
    WHERE id = p_submission_id;
    
    IF v_team_id IS NULL THEN
        RAISE EXCEPTION 'Submission not found';
    END IF;
    
    -- Update submission with evaluation results
    UPDATE round2_submissions
    SET 
        total_score = p_total_score,
        hidden_test_pass_rate = p_hidden_test_pass_rate,
        grammar_score = p_grammar_score,
        constraint_score = p_constraint_score,
        time_bonus = p_time_bonus,
        evaluation_details = p_evaluation_details
    WHERE id = p_submission_id;
    
    -- Get sub-round from question_id (P1-P4=1, C1-C4=2, CX1-CX4=3, D1-D4=4)
    v_sub_round := CASE 
        WHEN v_question_id LIKE 'P%' THEN 1
        WHEN v_question_id LIKE 'C%' THEN 2
        WHEN v_question_id LIKE 'CX%' THEN 3
        WHEN v_question_id LIKE 'D%' THEN 4
        ELSE 1
    END;
    
    -- Calculate sub-round total score
    SELECT COALESCE(SUM(total_score), 0)
    INTO v_sub_round_total
    FROM round2_submissions
    WHERE round_session_id = v_session_id
    AND question_id LIKE CASE v_sub_round
        WHEN 1 THEN 'P%'
        WHEN 2 THEN 'C%'
        WHEN 3 THEN 'CX%'
        WHEN 4 THEN 'D%'
    END;
    
    -- Calculate round total score
    SELECT COALESCE(SUM(total_score), 0)
    INTO v_round_total
    FROM round2_submissions
    WHERE round_session_id = v_session_id;
    
    -- Update session scores
    EXECUTE format(
        'UPDATE round2_sessions SET sub_round_%s_score = $1, total_score = $2 WHERE round_session_id = $3',
        v_sub_round
    )
    USING v_sub_round_total, v_round_total, v_session_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'score', p_total_score,
        'sub_round_total', v_sub_round_total,
        'round_total', v_round_total
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Evaluation update failed: %', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION update_round2_evaluation TO authenticated;
