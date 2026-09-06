-- =====================================================
-- CLEAN ALL QUIZ DATA - Universal Fix
-- =====================================================
-- This script cleans up ALL orphaned quiz data
-- for ALL teams, so anyone affected can start fresh
-- =====================================================

BEGIN;

RAISE NOTICE '═══════════════════════════════════════════════════';
RAISE NOTICE '🧹 CLEANING ALL ORPHANED QUIZ DATA';
RAISE NOTICE '═══════════════════════════════════════════════════';
RAISE NOTICE '';

-- =====================================================
-- Step 1: Show what will be cleaned
-- =====================================================
DO $$
DECLARE
    v_orphaned_sessions INT;
    v_orphaned_answers INT;
    v_orphaned_attempts INT;
BEGIN
    SELECT COUNT(*) INTO v_orphaned_sessions
    FROM quiz_sessions
    WHERE round_session_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM round_sessions 
        WHERE round_sessions.id = quiz_sessions.round_session_id
      );
    
    SELECT COUNT(*) INTO v_orphaned_answers
    FROM quiz_answers
    WHERE round_session_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM round_sessions 
        WHERE round_sessions.id = quiz_answers.round_session_id
      );
    
    SELECT COUNT(*) INTO v_orphaned_attempts
    FROM challenge_attempts
    WHERE round_session_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM round_sessions 
        WHERE round_sessions.id = challenge_attempts.round_session_id
      );
    
    RAISE NOTICE '📊 Found orphaned records:';
    RAISE NOTICE '   • quiz_sessions: %', v_orphaned_sessions;
    RAISE NOTICE '   • quiz_answers: %', v_orphaned_answers;
    RAISE NOTICE '   • challenge_attempts: %', v_orphaned_attempts;
    RAISE NOTICE '';
    
    IF v_orphaned_sessions > 0 OR v_orphaned_answers > 0 OR v_orphaned_attempts > 0 THEN
        RAISE NOTICE '🔧 Cleaning up now...';
    ELSE
        RAISE NOTICE '✅ No orphaned data found - database is clean!';
    END IF;
    RAISE NOTICE '';
END $$;

-- =====================================================
-- Step 2: Delete orphaned quiz_sessions
-- =====================================================
WITH deleted AS (
    DELETE FROM quiz_sessions
    WHERE round_session_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM round_sessions 
        WHERE round_sessions.id = quiz_sessions.round_session_id
      )
    RETURNING id, team_id, round_id
)
SELECT COUNT(*) as deleted_count FROM deleted;

-- =====================================================
-- Step 3: Delete orphaned quiz_answers
-- =====================================================
WITH deleted AS (
    DELETE FROM quiz_answers
    WHERE round_session_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM round_sessions 
        WHERE round_sessions.id = quiz_answers.round_session_id
      )
    RETURNING id
)
SELECT COUNT(*) as deleted_count FROM deleted;

-- =====================================================
-- Step 4: Delete orphaned challenge_attempts
-- =====================================================
WITH deleted AS (
    DELETE FROM challenge_attempts
    WHERE round_session_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM round_sessions 
        WHERE round_sessions.id = challenge_attempts.round_session_id
      )
    RETURNING id
)
SELECT COUNT(*) as deleted_count FROM deleted;

-- =====================================================
-- Step 5: Fix CASCADE for future (if not already done)
-- =====================================================
ALTER TABLE quiz_sessions 
DROP CONSTRAINT IF EXISTS quiz_sessions_round_session_id_fkey;

ALTER TABLE quiz_sessions
ADD CONSTRAINT quiz_sessions_round_session_id_fkey 
FOREIGN KEY (round_session_id) 
REFERENCES round_sessions(id) 
ON DELETE CASCADE;

ALTER TABLE quiz_answers 
DROP CONSTRAINT IF EXISTS quiz_answers_round_session_id_fkey;

ALTER TABLE quiz_answers
ADD CONSTRAINT quiz_answers_round_session_id_fkey 
FOREIGN KEY (round_session_id) 
REFERENCES round_sessions(id) 
ON DELETE CASCADE;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'challenge_attempts' 
        AND column_name = 'round_session_id'
    ) THEN
        ALTER TABLE challenge_attempts 
        DROP CONSTRAINT IF EXISTS challenge_attempts_round_session_id_fkey;
        
        ALTER TABLE challenge_attempts
        ADD CONSTRAINT challenge_attempts_round_session_id_fkey 
        FOREIGN KEY (round_session_id) 
        REFERENCES round_sessions(id) 
        ON DELETE CASCADE;
    END IF;
END $$;

COMMIT;

-- =====================================================
-- Final Verification
-- =====================================================
DO $$
DECLARE
    v_remaining_orphaned INT;
BEGIN
    SELECT 
        (SELECT COUNT(*) FROM quiz_sessions WHERE round_session_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM round_sessions WHERE round_sessions.id = quiz_sessions.round_session_id)) +
        (SELECT COUNT(*) FROM quiz_answers WHERE round_session_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM round_sessions WHERE round_sessions.id = quiz_answers.round_session_id)) +
        (SELECT COUNT(*) FROM challenge_attempts WHERE round_session_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM round_sessions WHERE round_sessions.id = challenge_attempts.round_session_id))
    INTO v_remaining_orphaned;
    
    RAISE NOTICE '═══════════════════════════════════════════════════';
    RAISE NOTICE '✅ CLEANUP COMPLETE!';
    RAISE NOTICE '═══════════════════════════════════════════════════';
    RAISE NOTICE '';
    
    IF v_remaining_orphaned = 0 THEN
        RAISE NOTICE '✅ All orphaned quiz data removed!';
        RAISE NOTICE '✅ CASCADE relationships fixed!';
        RAISE NOTICE '';
        RAISE NOTICE '🎯 What to do now:';
        RAISE NOTICE '   1. Have all teams refresh their browsers';
        RAISE NOTICE '   2. They can now re-attempt quizzes after reset';
        RAISE NOTICE '   3. No more "already attempted" errors!';
    ELSE
        RAISE NOTICE '⚠️  Warning: % orphaned records still remain', v_remaining_orphaned;
        RAISE NOTICE '   This may indicate RLS policy issues or other constraints';
        RAISE NOTICE '   Check the logs and run diagnostics';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;
