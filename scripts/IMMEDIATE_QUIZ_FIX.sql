-- =====================================================
-- IMMEDIATE FIX: Clean Quiz Data After Failed Reset
-- =====================================================
-- Run this NOW to fix the current quiz reset issue
-- This will clean up orphaned quiz data
-- =====================================================

-- INSTRUCTIONS:
-- 1. Replace <YOUR_TEAM_ID> with your actual team UUID
-- 2. Replace <YOUR_ROUND_ID> with the quiz round UUID
-- 3. Run this script in Supabase SQL Editor
-- 4. Refresh your browser
-- 5. Try the quiz again

BEGIN;

-- =====================================================
-- Step 1: Find and display the problematic data
-- =====================================================
DO $$
DECLARE
    v_team_id UUID := '<YOUR_TEAM_ID>'::uuid;  -- REPLACE THIS
    v_round_id UUID := '<YOUR_ROUND_ID>'::uuid; -- REPLACE THIS
    v_round_session_id UUID;
    v_quiz_session_count INT;
    v_quiz_answers_count INT;
    v_challenge_attempts_count INT;
BEGIN
    RAISE NOTICE '═══════════════════════════════════════════════════';
    RAISE NOTICE '🔍 CHECKING QUIZ DATA FOR CLEANUP';
    RAISE NOTICE '═══════════════════════════════════════════════════';
    
    -- Check if round_session exists
    SELECT id INTO v_round_session_id
    FROM round_sessions
    WHERE team_id = v_team_id AND round_id = v_round_id;
    
    IF v_round_session_id IS NOT NULL THEN
        RAISE NOTICE '⚠️  round_session EXISTS: %', v_round_session_id;
        RAISE NOTICE '   This should have been deleted by admin reset!';
    ELSE
        RAISE NOTICE '✅ round_session does not exist (correct after reset)';
    END IF;
    
    -- Check quiz_sessions
    SELECT COUNT(*) INTO v_quiz_session_count
    FROM quiz_sessions
    WHERE team_id = v_team_id AND round_id = v_round_id;
    
    RAISE NOTICE '📊 quiz_sessions found: %', v_quiz_session_count;
    
    -- Check quiz_answers
    SELECT COUNT(*) INTO v_quiz_answers_count
    FROM quiz_answers qa
    JOIN quiz_questions qq ON qa.question_id = qq.id
    WHERE qa.team_id = v_team_id AND qq.round_id = v_round_id;
    
    RAISE NOTICE '📊 quiz_answers found: %', v_quiz_answers_count;
    
    -- Check challenge_attempts
    SELECT COUNT(*) INTO v_challenge_attempts_count
    FROM challenge_attempts ca
    JOIN challenges c ON ca.challenge_id = c.id
    WHERE c.round_id = v_round_id 
      AND (ca.team_id = v_team_id OR EXISTS (
        SELECT 1 FROM participants p 
        WHERE p.id = ca.participant_id AND p.team_id = v_team_id
      ));
    
    RAISE NOTICE '📊 challenge_attempts found: %', v_challenge_attempts_count;
    RAISE NOTICE '';
END $$;

-- =====================================================
-- Step 2: DELETE quiz_sessions
-- =====================================================
DELETE FROM quiz_sessions
WHERE team_id = '<YOUR_TEAM_ID>'::uuid 
  AND round_id = '<YOUR_ROUND_ID>'::uuid;

-- =====================================================
-- Step 3: DELETE quiz_answers
-- =====================================================
DELETE FROM quiz_answers
WHERE team_id = '<YOUR_TEAM_ID>'::uuid
  AND question_id IN (
    SELECT id FROM quiz_questions 
    WHERE round_id = '<YOUR_ROUND_ID>'::uuid
  );

-- =====================================================
-- Step 4: DELETE challenge_attempts (if quiz uses this)
-- =====================================================
DELETE FROM challenge_attempts ca
USING challenges c
WHERE ca.challenge_id = c.id
  AND c.round_id = '<YOUR_ROUND_ID>'::uuid
  AND (ca.team_id = '<YOUR_TEAM_ID>'::uuid OR EXISTS (
    SELECT 1 FROM participants p 
    WHERE p.id = ca.participant_id 
      AND p.team_id = '<YOUR_TEAM_ID>'::uuid
  ));

-- =====================================================
-- Step 5: DELETE round_session if it still exists
-- =====================================================
DELETE FROM round_sessions
WHERE team_id = '<YOUR_TEAM_ID>'::uuid 
  AND round_id = '<YOUR_ROUND_ID>'::uuid;

-- =====================================================
-- Step 6: Verify cleanup
-- =====================================================
DO $$
DECLARE
    v_team_id UUID := '<YOUR_TEAM_ID>'::uuid;
    v_round_id UUID := '<YOUR_ROUND_ID>'::uuid;
    v_remaining_records INT;
BEGIN
    SELECT 
        (SELECT COUNT(*) FROM quiz_sessions WHERE team_id = v_team_id AND round_id = v_round_id) +
        (SELECT COUNT(*) FROM quiz_answers qa JOIN quiz_questions qq ON qa.question_id = qq.id WHERE qa.team_id = v_team_id AND qq.round_id = v_round_id) +
        (SELECT COUNT(*) FROM round_sessions WHERE team_id = v_team_id AND round_id = v_round_id)
    INTO v_remaining_records;
    
    RAISE NOTICE '═══════════════════════════════════════════════════';
    RAISE NOTICE '✅ CLEANUP COMPLETE';
    RAISE NOTICE '═══════════════════════════════════════════════════';
    
    IF v_remaining_records = 0 THEN
        RAISE NOTICE '✅ All quiz data cleaned successfully!';
        RAISE NOTICE '';
        RAISE NOTICE '🎯 You can now:';
        RAISE NOTICE '   1. Refresh your browser';
        RAISE NOTICE '   2. Start the quiz again';
        RAISE NOTICE '   3. Quiz should start fresh with no previous answers';
    ELSE
        RAISE NOTICE '⚠️  WARNING: % records still remain!', v_remaining_records;
        RAISE NOTICE '   Check RLS policies or foreign key constraints.';
    END IF;
    RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;

COMMIT;

-- =====================================================
-- ALTERNATIVE: Find your team_id and round_id
-- =====================================================
-- If you don't know your team_id or round_id, run this:

-- Find your team:
-- SELECT id, name FROM teams ORDER BY created_at DESC;

-- Find quiz rounds:
-- SELECT id, name, type FROM rounds WHERE type IN ('QUIZ', 'KNOWLEDGE_TEST') ORDER BY order_index;

-- Then replace the UUIDs above and run again
