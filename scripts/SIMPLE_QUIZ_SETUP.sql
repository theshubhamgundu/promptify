-- ========================================================================
-- SIMPLE QUIZ SETUP - Copy and paste this entire file into Supabase SQL Editor
-- ========================================================================
-- This creates one quiz round with 3 sample questions for testing
-- ========================================================================

-- STEP 1: Get your event ID (run this first to see available events)
-- SELECT id, name, status FROM events ORDER BY created_at DESC;

-- STEP 2: Replace 'YOUR_EVENT_ID_HERE' below with the actual event UUID
-- Then run the rest of this script

-- ========================================================================
-- Create Quiz Round
-- ========================================================================

DO $$
DECLARE
    v_event_id UUID := 'YOUR_EVENT_ID_HERE'; -- ⚠️ REPLACE THIS WITH YOUR EVENT ID
    v_round_id UUID;
    v_question1_id UUID;
    v_question2_id UUID;
    v_question3_id UUID;
BEGIN
    -- Create the round
    INSERT INTO rounds (
        event_id,
        name,
        description,
        type,
        order_index,
        duration_minutes,
        is_active,
        scoring_config
    ) VALUES (
        v_event_id,
        'Quiz Round 1: Prompt Engineering Basics',
        'Test your understanding of prompt engineering fundamentals with 3 sample questions.',
        'QUIZ',
        1,
        15, -- 15 minutes for testing
        true,
        jsonb_build_object(
            'allow_review', true,
            'show_correct_answers', true
        )
    ) RETURNING id INTO v_round_id;
    
    RAISE NOTICE '✓ Created round with ID: %', v_round_id;
    
    -- ========================================================================
    -- Question 1: Single Answer
    -- ========================================================================
    
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
        'What is the primary purpose of few-shot prompting?

Few-shot prompting involves providing the AI model with a few examples before asking it to perform a task.',
        'SINGLE_ANSWER',
        1,
        0
    ) RETURNING id INTO v_question1_id;
    
    -- Options for Question 1
    INSERT INTO quiz_options (question_id, option_label, option_text, is_correct, order_index) VALUES
        (v_question1_id, 'A', 'To reduce the cost of API calls', false, 0),
        (v_question1_id, 'B', 'To provide examples that guide the model toward the desired output format and style', true, 1),
        (v_question1_id, 'C', 'To make prompts shorter and more efficient', false, 2),
        (v_question1_id, 'D', 'To bypass content moderation filters', false, 3);
    
    RAISE NOTICE '✓ Created Question 1 (Single Answer)';
    
    -- ========================================================================
    -- Question 2: Single Answer
    -- ========================================================================
    
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
        'A chatbot confidently states a fact that is completely incorrect. What is this behavior called?',
        'SINGLE_ANSWER',
        1,
        1
    ) RETURNING id INTO v_question2_id;
    
    -- Options for Question 2
    INSERT INTO quiz_options (question_id, option_label, option_text, is_correct, order_index) VALUES
        (v_question2_id, 'A', 'Model drift', false, 0),
        (v_question2_id, 'B', 'Hallucination', true, 1),
        (v_question2_id, 'C', 'Overfitting', false, 2),
        (v_question2_id, 'D', 'Temperature variation', false, 3);
    
    RAISE NOTICE '✓ Created Question 2 (Single Answer)';
    
    -- ========================================================================
    -- Question 3: Multi-Select
    -- ========================================================================
    
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
        'Which of the following are effective strategies to reduce hallucinations in AI responses?

(Select ALL that apply)',
        'MULTI_SELECT',
        2,
        2
    ) RETURNING id INTO v_question3_id;
    
    -- Options for Question 3
    INSERT INTO quiz_options (question_id, option_label, option_text, is_correct, order_index) VALUES
        (v_question3_id, 'A', 'Provide source documents and ask the model to cite them', true, 0),
        (v_question3_id, 'B', 'Increase the temperature parameter to maximum', false, 1),
        (v_question3_id, 'C', 'Use retrieval-augmented generation (RAG)', true, 2),
        (v_question3_id, 'D', 'Make prompts as short as possible', false, 3);
    
    RAISE NOTICE '✓ Created Question 3 (Multi-Select)';
    
    -- ========================================================================
    -- Summary
    -- ========================================================================
    
    RAISE NOTICE '════════════════════════════════════════════════════════';
    RAISE NOTICE 'SUCCESS! Quiz round created successfully';
    RAISE NOTICE '════════════════════════════════════════════════════════';
    RAISE NOTICE 'Round ID: %', v_round_id;
    RAISE NOTICE 'Round Name: Quiz Round 1: Prompt Engineering Basics';
    RAISE NOTICE 'Questions: 3 (2 single-answer, 1 multi-select)';
    RAISE NOTICE 'Total Points: 4';
    RAISE NOTICE 'Duration: 15 minutes';
    RAISE NOTICE 'Status: ACTIVE (is_active = true)';
    RAISE NOTICE '════════════════════════════════════════════════════════';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Login as a participant';
    RAISE NOTICE '2. Go to Rounds page';
    RAISE NOTICE '3. Click "Start Quiz" button';
    RAISE NOTICE '════════════════════════════════════════════════════════';
    
END $$;

-- ========================================================================
-- Verify the setup (run this to check everything was created correctly)
-- ========================================================================

SELECT 
    r.id as round_id,
    r.name as round_name,
    r.is_active,
    r.duration_minutes,
    COUNT(qq.id) as total_questions,
    SUM(qq.points) as total_points
FROM rounds r
LEFT JOIN quiz_questions qq ON r.id = qq.round_id
WHERE r.type = 'QUIZ'
GROUP BY r.id, r.name, r.is_active, r.duration_minutes
ORDER BY r.created_at DESC
LIMIT 1;

-- View the questions
SELECT 
    qq.question_number,
    LEFT(qq.question_text, 60) || '...' as question_preview,
    qq.question_type,
    qq.points,
    COUNT(qo.id) as option_count,
    COUNT(qo.id) FILTER (WHERE qo.is_correct = true) as correct_answers
FROM quiz_questions qq
LEFT JOIN quiz_options qo ON qq.id = qo.question_id
WHERE qq.round_id = (
    SELECT id FROM rounds 
    WHERE type = 'QUIZ' 
    ORDER BY created_at DESC 
    LIMIT 1
)
GROUP BY qq.id, qq.question_number, qq.question_text, qq.question_type, qq.points
ORDER BY qq.question_number;
