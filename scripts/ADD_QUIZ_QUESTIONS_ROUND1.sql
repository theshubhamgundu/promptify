-- =====================================================
-- Add Quiz Questions for Round 1 (Stage 1: Genesis)
-- =====================================================
-- This creates sample quiz questions for testing
-- =====================================================

BEGIN;

-- Get Round 1 ID
DO $$
DECLARE
    v_round_id UUID;
    v_q1_id UUID;
    v_q2_id UUID;
    v_q3_id UUID;
BEGIN
    -- Get Round 1 ID
    SELECT id INTO v_round_id
    FROM rounds
    WHERE order_index = 1
    LIMIT 1;
    
    IF v_round_id IS NULL THEN
        RAISE EXCEPTION 'Round 1 not found!';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════';
    RAISE NOTICE '📝 ADDING QUIZ QUESTIONS FOR ROUND 1';
    RAISE NOTICE '═══════════════════════════════════════════════════';
    RAISE NOTICE '';
    RAISE NOTICE 'Round 1 ID: %', v_round_id;
    RAISE NOTICE '';
    
    -- Delete existing questions for this round (in case of re-run)
    DELETE FROM quiz_questions WHERE round_id = v_round_id;
    
    -- Question 1
    INSERT INTO quiz_questions (
        round_id,
        question_number,
        question_text,
        question_type,
        points,
        order_index
    ) VALUES (
        v_round_id,
        1,
        'Select the best description of prompt engineering.',
        'SINGLE_ANSWER',
        66,
        1
    ) RETURNING id INTO v_q1_id;
    
    -- Question 1 Options
    INSERT INTO quiz_options (question_id, option_label, option_text, is_correct, order_index) VALUES
    (v_q1_id, 'A', 'Writing code for AI', false, 1),
    (v_q1_id, 'B', 'Crafting effective inputs for AI models', true, 2),
    (v_q1_id, 'C', 'Training neural networks', false, 3),
    (v_q1_id, 'D', 'Building chatbots', false, 4);
    
    RAISE NOTICE '✅ Question 1 added: "Select the best description of prompt engineering."';
    
    -- Question 2
    INSERT INTO quiz_questions (
        round_id,
        question_number,
        question_text,
        question_type,
        points,
        order_index
    ) VALUES (
        v_round_id,
        2,
        'What is the primary goal of prompt engineering?',
        'SINGLE_ANSWER',
        66,
        2
    ) RETURNING id INTO v_q2_id;
    
    -- Question 2 Options
    INSERT INTO quiz_options (question_id, option_label, option_text, is_correct, order_index) VALUES
    (v_q2_id, 'A', 'To make AI models faster', false, 1),
    (v_q2_id, 'B', 'To get desired outputs from AI models', true, 2),
    (v_q2_id, 'C', 'To reduce AI model size', false, 3),
    (v_q2_id, 'D', 'To train new AI models', false, 4);
    
    RAISE NOTICE '✅ Question 2 added: "What is the primary goal of prompt engineering?"';
    
    -- Question 3
    INSERT INTO quiz_questions (
        round_id,
        question_number,
        question_text,
        question_type,
        points,
        order_index
    ) VALUES (
        v_round_id,
        3,
        'Which of the following is a good practice in prompt engineering?',
        'SINGLE_ANSWER',
        66,
        3
    ) RETURNING id INTO v_q3_id;
    
    -- Question 3 Options
    INSERT INTO quiz_options (question_id, option_label, option_text, is_correct, order_index) VALUES
    (v_q3_id, 'A', 'Being vague and ambiguous', false, 1),
    (v_q3_id, 'B', 'Using complex technical jargon only', false, 2),
    (v_q3_id, 'C', 'Being clear and specific in instructions', true, 3),
    (v_q3_id, 'D', 'Writing very long prompts always', false, 4);
    
    RAISE NOTICE '✅ Question 3 added: "Which of the following is a good practice in prompt engineering?"';
    
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════';
    RAISE NOTICE '✅ SUCCESS: 3 Questions Added!';
    RAISE NOTICE '═══════════════════════════════════════════════════';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Summary:';
    RAISE NOTICE '   • Total Questions: 3';
    RAISE NOTICE '   • Total Points: 198 (66 + 66 + 66)';
    RAISE NOTICE '   • Options per Question: 4';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 What to do now:';
    RAISE NOTICE '   1. Refresh your browser';
    RAISE NOTICE '   2. Click on Round 1 (Stage 1: Genesis)';
    RAISE NOTICE '   3. You should now see 3 quiz questions!';
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;

COMMIT;

-- Verify the questions were added
SELECT 
    '=== VERIFICATION ===' as status,
    qq.question_number,
    qq.question_text,
    qq.points,
    COUNT(qo.id) as options_count
FROM quiz_questions qq
LEFT JOIN quiz_options qo ON qo.question_id = qq.id
WHERE qq.round_id = (SELECT id FROM rounds WHERE order_index = 1)
GROUP BY qq.id, qq.question_number, qq.question_text, qq.points
ORDER BY qq.question_number;
