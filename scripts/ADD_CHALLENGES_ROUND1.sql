-- =====================================================
-- Add CHALLENGES for Round 1 (Stage 1: Genesis)
-- =====================================================
-- The QuizRound component loads from 'challenges' table
-- NOT 'quiz_questions' table!
-- =====================================================

BEGIN;

DO $$
DECLARE
    v_round_id UUID;
    v_c1_id UUID;
    v_c2_id UUID;
    v_c3_id UUID;
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
    RAISE NOTICE '📝 ADDING CHALLENGES (QUIZ QUESTIONS) FOR ROUND 1';
    RAISE NOTICE '═══════════════════════════════════════════════════';
    RAISE NOTICE '';
    RAISE NOTICE 'Round 1 ID: %', v_round_id;
    RAISE NOTICE '';
    
    -- Delete existing challenges for this round (in case of re-run)
    DELETE FROM challenges WHERE round_id = v_round_id;
    
    -- Challenge 1 (Question 1)
    INSERT INTO challenges (
        round_id,
        title,
        description,
        type,
        base_points,
        order_index,
        configuration
    ) VALUES (
        v_round_id,
        'Question 1',
        'Select the best description of prompt engineering.',
        'MULTIPLE_CHOICE',
        66,
        1,
        jsonb_build_object(
            'options', jsonb_build_array(
                jsonb_build_object('label', 'A', 'text', 'Writing code for AI', 'is_correct', false),
                jsonb_build_object('label', 'B', 'text', 'Crafting effective inputs for AI models', 'is_correct', true),
                jsonb_build_object('label', 'C', 'text', 'Training neural networks', 'is_correct', false),
                jsonb_build_object('label', 'D', 'text', 'Building chatbots', 'is_correct', false)
            ),
            'correct_answer', 'B'
        )
    ) RETURNING id INTO v_c1_id;
    
    RAISE NOTICE '✅ Challenge 1 added: "Select the best description of prompt engineering."';
    
    -- Challenge 2 (Question 2)
    INSERT INTO challenges (
        round_id,
        title,
        description,
        type,
        base_points,
        order_index,
        configuration
    ) VALUES (
        v_round_id,
        'Question 2',
        'What is the primary goal of prompt engineering?',
        'MULTIPLE_CHOICE',
        66,
        2,
        jsonb_build_object(
            'options', jsonb_build_array(
                jsonb_build_object('label', 'A', 'text', 'To make AI models faster', 'is_correct', false),
                jsonb_build_object('label', 'B', 'text', 'To get desired outputs from AI models', 'is_correct', true),
                jsonb_build_object('label', 'C', 'text', 'To reduce AI model size', 'is_correct', false),
                jsonb_build_object('label', 'D', 'text', 'To train new AI models', 'is_correct', false)
            ),
            'correct_answer', 'B'
        )
    ) RETURNING id INTO v_c2_id;
    
    RAISE NOTICE '✅ Challenge 2 added: "What is the primary goal of prompt engineering?"';
    
    -- Challenge 3 (Question 3)
    INSERT INTO challenges (
        round_id,
        title,
        description,
        type,
        base_points,
        order_index,
        configuration
    ) VALUES (
        v_round_id,
        'Question 3',
        'Which of the following is a good practice in prompt engineering?',
        'MULTIPLE_CHOICE',
        66,
        3,
        jsonb_build_object(
            'options', jsonb_build_array(
                jsonb_build_object('label', 'A', 'text', 'Being vague and ambiguous', 'is_correct', false),
                jsonb_build_object('label', 'B', 'text', 'Using complex technical jargon only', 'is_correct', false),
                jsonb_build_object('label', 'C', 'text', 'Being clear and specific in instructions', 'is_correct', true),
                jsonb_build_object('label', 'D', 'text', 'Writing very long prompts always', 'is_correct', false)
            ),
            'correct_answer', 'C'
        )
    ) RETURNING id INTO v_c3_id;
    
    RAISE NOTICE '✅ Challenge 3 added: "Which of the following is a good practice in prompt engineering?"';
    
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════';
    RAISE NOTICE '✅ SUCCESS: 3 Challenges Added!';
    RAISE NOTICE '═══════════════════════════════════════════════════';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Summary:';
    RAISE NOTICE '   • Total Challenges: 3';
    RAISE NOTICE '   • Total Points: 198 (66 + 66 + 66)';
    RAISE NOTICE '   • Options per Challenge: 4';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 What to do now:';
    RAISE NOTICE '   1. Refresh your browser (Ctrl+Shift+R)';
    RAISE NOTICE '   2. Click on Round 1 (Stage 1: Genesis)';
    RAISE NOTICE '   3. You should now see 3 quiz questions!';
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;

COMMIT;

-- Verify the challenges were added
SELECT 
    '=== VERIFICATION ===' as status,
    c.order_index,
    c.title,
    c.description,
    c.type,
    c.base_points,
    jsonb_array_length(c.configuration->'options') as options_count,
    c.configuration->>'correct_answer' as correct_answer
FROM challenges c
WHERE c.round_id = (SELECT id FROM rounds WHERE order_index = 1)
ORDER BY c.order_index;
