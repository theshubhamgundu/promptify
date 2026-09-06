-- =====================================================
-- Check Quiz Questions for Round 1
-- =====================================================
-- Verify if questions exist for Stage 1: Genesis
-- =====================================================

-- Get Round 1 ID
DO $$
DECLARE
    v_round1_id UUID;
BEGIN
    SELECT id INTO v_round1_id
    FROM rounds
    WHERE order_index = 1;
    
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════';
    RAISE NOTICE '🔍 CHECKING QUIZ QUESTIONS FOR ROUND 1';
    RAISE NOTICE '═══════════════════════════════════════════════════';
    RAISE NOTICE '';
    RAISE NOTICE 'Round 1 ID: %', v_round1_id;
    RAISE NOTICE '';
END $$;

-- Check quiz_questions table (new quiz system)
SELECT 
    '=== QUIZ_QUESTIONS TABLE ===' as source,
    COUNT(*) as question_count,
    round_id
FROM quiz_questions
WHERE round_id = (SELECT id FROM rounds WHERE order_index = 1)
GROUP BY round_id;

-- Check challenges table (old system - might still be used)
SELECT 
    '=== CHALLENGES TABLE ===' as source,
    COUNT(*) as challenge_count,
    type,
    round_id
FROM challenges
WHERE round_id = (SELECT id FROM rounds WHERE order_index = 1)
GROUP BY round_id, type;

-- Show detailed quiz questions if they exist
SELECT 
    '=== QUIZ QUESTIONS DETAILS ===' as info,
    question_number,
    question_text,
    question_type,
    points,
    (SELECT COUNT(*) FROM quiz_options WHERE question_id = qq.id) as options_count
FROM quiz_questions qq
WHERE round_id = (SELECT id FROM rounds WHERE order_index = 1)
ORDER BY question_number;

-- Show detailed challenges if they exist
SELECT 
    '=== CHALLENGES DETAILS ===' as info,
    title,
    type,
    base_points,
    order_index
FROM challenges
WHERE round_id = (SELECT id FROM rounds WHERE order_index = 1)
ORDER BY order_index;

-- Diagnosis
DO $$
DECLARE
    v_round1_id UUID;
    v_quiz_questions_count INT;
    v_challenges_count INT;
    v_quiz_options_count INT;
BEGIN
    SELECT id INTO v_round1_id
    FROM rounds
    WHERE order_index = 1;
    
    SELECT COUNT(*) INTO v_quiz_questions_count
    FROM quiz_questions
    WHERE round_id = v_round1_id;
    
    SELECT COUNT(*) INTO v_challenges_count
    FROM challenges
    WHERE round_id = v_round1_id;
    
    SELECT COUNT(*) INTO v_quiz_options_count
    FROM quiz_options qo
    JOIN quiz_questions qq ON qo.question_id = qq.id
    WHERE qq.round_id = v_round1_id;
    
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════';
    RAISE NOTICE '📊 DIAGNOSIS';
    RAISE NOTICE '═══════════════════════════════════════════════════';
    RAISE NOTICE '';
    RAISE NOTICE 'Quiz Questions: %', v_quiz_questions_count;
    RAISE NOTICE 'Challenges: %', v_challenges_count;
    RAISE NOTICE 'Quiz Options: %', v_quiz_options_count;
    RAISE NOTICE '';
    
    IF v_quiz_questions_count = 0 AND v_challenges_count = 0 THEN
        RAISE NOTICE '❌ PROBLEM: No questions found!';
        RAISE NOTICE '';
        RAISE NOTICE '💡 SOLUTIONS:';
        RAISE NOTICE '   Option 1: Import from HTML file';
        RAISE NOTICE '   • You have: Prompt_Engineering_Question_Bank.htm';
        RAISE NOTICE '   • Run: npm run seed-quiz or use parse-html-to-ts.js';
        RAISE NOTICE '';
        RAISE NOTICE '   Option 2: Use existing setup script';
        RAISE NOTICE '   • Run: scripts/SIMPLE_QUIZ_SETUP.sql';
        RAISE NOTICE '   • Or: scripts/ONE_CLICK_SETUP.sql';
        RAISE NOTICE '';
        RAISE NOTICE '   Option 3: Create questions manually';
        RAISE NOTICE '   • Insert into quiz_questions table';
        RAISE NOTICE '   • Add options to quiz_options table';
    ELSIF v_quiz_questions_count > 0 AND v_quiz_options_count = 0 THEN
        RAISE NOTICE '⚠️  PROBLEM: Questions exist but no options!';
        RAISE NOTICE '   Each question needs answer options.';
        RAISE NOTICE '   Add options to quiz_options table.';
    ELSE
        RAISE NOTICE '✅ Questions and options found!';
        RAISE NOTICE '   This should work. Check browser console for errors.';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;
