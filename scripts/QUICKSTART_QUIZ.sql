-- ========================================================================
-- QUICKSTART: Complete Quiz Setup (Event + Round + Questions)
-- ========================================================================
-- This creates EVERYTHING for testing. Just run it as-is!
-- ========================================================================

DO $$
DECLARE
    v_event_id UUID;
    v_round_id UUID;
    v_q1_id UUID;
    v_q2_id UUID;
    v_q3_id UUID;
BEGIN
    -- Create a test event (if you already have an event, skip this)
    INSERT INTO events (
        name,
        description,
        status,
        start_time,
        end_time
    ) VALUES (
        'Promptify Championship 2026',
        'Annual AI Prompt Engineering Competition',
        'LIVE',
        NOW(),
        NOW() + INTERVAL '7 days'
    ) RETURNING id INTO v_event_id;
    
    RAISE NOTICE '✓ Created event ID: %', v_event_id;
    
    -- Create quiz round
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
        'Round 1: Prompt Engineering Quiz',
        'Test your understanding of prompt engineering fundamentals with 3 questions.',
        'QUIZ',
        1,
        15,
        true,
        '{"allow_review": true, "show_correct_answers": true}'::jsonb
    ) RETURNING id INTO v_round_id;
    
    RAISE NOTICE '✓ Created round ID: %', v_round_id;
    
    -- Question 1
    INSERT INTO quiz_questions (
        round_id, question_number, question_text, question_type, points, order_index
    ) VALUES (
        v_round_id, 1,
        'What is the primary purpose of few-shot prompting?

Few-shot prompting involves providing the AI model with a few examples before asking it to perform a task.',
        'SINGLE_ANSWER', 1, 0
    ) RETURNING id INTO v_q1_id;
    
    INSERT INTO quiz_options (question_id, option_label, option_text, is_correct, order_index) VALUES
        (v_q1_id, 'A', 'To reduce the cost of API calls', false, 0),
        (v_q1_id, 'B', 'To provide examples that guide the model toward the desired output format', true, 1),
        (v_q1_id, 'C', 'To make prompts shorter', false, 2),
        (v_q1_id, 'D', 'To bypass filters', false, 3);
    
    -- Question 2
    INSERT INTO quiz_questions (
        round_id, question_number, question_text, question_type, points, order_index
    ) VALUES (
        v_round_id, 2,
        'A chatbot states a completely incorrect fact confidently. What is this called?',
        'SINGLE_ANSWER', 1, 1
    ) RETURNING id INTO v_q2_id;
    
    INSERT INTO quiz_options (question_id, option_label, option_text, is_correct, order_index) VALUES
        (v_q2_id, 'A', 'Model drift', false, 0),
        (v_q2_id, 'B', 'Hallucination', true, 1),
        (v_q2_id, 'C', 'Overfitting', false, 2),
        (v_q2_id, 'D', 'Temperature variation', false, 3);
    
    -- Question 3
    INSERT INTO quiz_questions (
        round_id, question_number, question_text, question_type, points, order_index
    ) VALUES (
        v_round_id, 3,
        'Which strategies reduce hallucinations? (Select ALL that apply)',
        'MULTI_SELECT', 2, 2
    ) RETURNING id INTO v_q3_id;
    
    INSERT INTO quiz_options (question_id, option_label, option_text, is_correct, order_index) VALUES
        (v_q3_id, 'A', 'Provide source documents', true, 0),
        (v_q3_id, 'B', 'Increase temperature to max', false, 1),
        (v_q3_id, 'C', 'Use RAG', true, 2),
        (v_q3_id, 'D', 'Make prompts very short', false, 3);
    
    -- Success message
    RAISE NOTICE '════════════════════════════════════════';
    RAISE NOTICE '✅ SUCCESS! Quiz ready to test';
    RAISE NOTICE '════════════════════════════════════════';
    RAISE NOTICE 'Event ID:  %', v_event_id;
    RAISE NOTICE 'Round ID:  %', v_round_id;
    RAISE NOTICE 'Questions: 3 (4 points total)';
    RAISE NOTICE 'Duration:  15 minutes';
    RAISE NOTICE '════════════════════════════════════════';
    RAISE NOTICE 'Next: Set this as your current event in the app';
    RAISE NOTICE 'Then go to Rounds → Start Quiz';
    RAISE NOTICE '════════════════════════════════════════';
END $$;

-- Verify the setup
SELECT 
    e.name as event_name,
    r.name as round_name,
    r.is_active,
    COUNT(qq.id) as questions,
    SUM(qq.points) as total_points
FROM events e
JOIN rounds r ON e.id = r.event_id
LEFT JOIN quiz_questions qq ON r.id = qq.round_id
WHERE r.type = 'QUIZ'
GROUP BY e.id, e.name, r.id, r.name, r.is_active
ORDER BY e.created_at DESC
LIMIT 1;
