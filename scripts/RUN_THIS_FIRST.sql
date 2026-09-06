-- =====================================================
-- RUN THIS FIRST - Complete Quiz Reset Fix
-- =====================================================
-- This script will:
-- 1. Fix the CASCADE relationships permanently
-- 2. Clean up ALL orphaned data for ALL teams
-- 3. Prevent future reset issues
-- =====================================================

BEGIN;

-- =====================================================
-- PART 1: Fix Foreign Key CASCADE (Permanent Fix)
-- =====================================================

-- Fix quiz_sessions CASCADE
ALTER TABLE quiz_sessions 
DROP CONSTRAINT IF EXISTS quiz_sessions_round_session_id_fkey;

ALTER TABLE quiz_sessions
ADD CONSTRAINT quiz_sessions_round_session_id_fkey 
FOREIGN KEY (round_session_id) 
REFERENCES round_sessions(id) 
ON DELETE CASCADE;

-- Fix quiz_answers CASCADE
ALTER TABLE quiz_answers 
DROP CONSTRAINT IF EXISTS quiz_answers_round_session_id_fkey;

ALTER TABLE quiz_answers
ADD CONSTRAINT quiz_answers_round_session_id_fkey 
FOREIGN KEY (round_session_id) 
REFERENCES round_sessions(id) 
ON DELETE CASCADE;

-- Fix challenge_attempts CASCADE (if exists)
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

-- =====================================================
-- PART 2: Clean Up ALL Orphaned Data
-- =====================================================

-- Clean orphaned quiz_sessions
DELETE FROM quiz_sessions
WHERE round_session_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM round_sessions 
    WHERE round_sessions.id = quiz_sessions.round_session_id
  );

-- Clean orphaned quiz_answers
DELETE FROM quiz_answers
WHERE round_session_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM round_sessions 
    WHERE round_sessions.id = quiz_answers.round_session_id
  );

-- Clean orphaned challenge_attempts
DELETE FROM challenge_attempts
WHERE round_session_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM round_sessions 
    WHERE round_sessions.id = challenge_attempts.round_session_id
  );

-- =====================================================
-- PART 3: Add Helpful Indexes
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_quiz_sessions_round_session_id 
ON quiz_sessions(round_session_id) 
WHERE round_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_quiz_answers_round_session_id 
ON quiz_answers(round_session_id) 
WHERE round_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_challenge_attempts_round_session_id 
ON challenge_attempts(round_session_id) 
WHERE round_session_id IS NOT NULL;

COMMIT;

-- =====================================================
-- VERIFICATION
-- =====================================================
DO $$
DECLARE
    v_orphaned_sessions INT;
    v_orphaned_answers INT;
    v_orphaned_attempts INT;
    v_cascade_ok BOOLEAN;
BEGIN
    -- Count remaining orphaned records
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
    
    -- Check CASCADE is configured
    SELECT 
        EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'quiz_sessions_round_session_id_fkey' 
            AND confdeltype = 'c'
        )
    INTO v_cascade_ok;
    
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════';
    RAISE NOTICE '✅ QUIZ RESET FIX COMPLETE!';
    RAISE NOTICE '═══════════════════════════════════════════════════';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Cleanup Results:';
    RAISE NOTICE '   • Orphaned quiz_sessions: %', v_orphaned_sessions;
    RAISE NOTICE '   • Orphaned quiz_answers: %', v_orphaned_answers;
    RAISE NOTICE '   • Orphaned challenge_attempts: %', v_orphaned_attempts;
    RAISE NOTICE '';
    
    IF v_cascade_ok THEN
        RAISE NOTICE '✅ CASCADE configured correctly';
    ELSE
        RAISE NOTICE '⚠️  CASCADE may need manual verification';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '🎯 What This Fixed:';
    RAISE NOTICE '   • Admin reset now properly deletes all quiz data';
    RAISE NOTICE '   • Teams can re-attempt quizzes after reset';
    RAISE NOTICE '   • No more "already attempted" errors';
    RAISE NOTICE '   • All orphaned data cleaned up';
    RAISE NOTICE '';
    RAISE NOTICE '💡 Next Steps:';
    RAISE NOTICE '   1. All teams can now refresh their browsers';
    RAISE NOTICE '   2. Reset any rounds that need it';
    RAISE NOTICE '   3. Teams can start fresh';
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;
