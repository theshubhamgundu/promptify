-- =====================================================
-- CLEANUP: Orphaned Round Data
-- =====================================================
-- This script cleans up any orphaned data that may exist
-- from rounds that were deleted before the CASCADE fixes
-- were applied.
--
-- Run this ONCE after applying the CASCADE fixes to
-- clean up historical orphaned records.
-- =====================================================

BEGIN;

-- =====================================================
-- 1. Find and report orphaned score_events
-- =====================================================
DO $$
DECLARE
    v_orphaned_scores INT;
BEGIN
    SELECT COUNT(*) INTO v_orphaned_scores
    FROM score_events
    WHERE round_session_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM round_sessions 
        WHERE round_sessions.id = score_events.round_session_id
      );
    
    IF v_orphaned_scores > 0 THEN
        RAISE NOTICE '🔍 Found % orphaned score_events', v_orphaned_scores;
    ELSE
        RAISE NOTICE '✅ No orphaned score_events found';
    END IF;
END $$;

-- =====================================================
-- 2. Delete orphaned score_events
-- =====================================================
DELETE FROM score_events
WHERE round_session_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM round_sessions 
    WHERE round_sessions.id = score_events.round_session_id
  );

-- =====================================================
-- 3. Find and report orphaned security_violations
-- =====================================================
DO $$
DECLARE
    v_orphaned_violations INT;
BEGIN
    SELECT COUNT(*) INTO v_orphaned_violations
    FROM security_violations
    WHERE round_session_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM round_sessions 
        WHERE round_sessions.id = security_violations.round_session_id
      );
    
    IF v_orphaned_violations > 0 THEN
        RAISE NOTICE '🔍 Found % orphaned security_violations', v_orphaned_violations;
    ELSE
        RAISE NOTICE '✅ No orphaned security_violations found';
    END IF;
END $$;

-- =====================================================
-- 4. Delete orphaned security_violations
-- =====================================================
DELETE FROM security_violations
WHERE round_session_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM round_sessions 
    WHERE round_sessions.id = security_violations.round_session_id
  );

-- =====================================================
-- 5. Find and report orphaned submissions
-- =====================================================
DO $$
DECLARE
    v_orphaned_submissions INT;
BEGIN
    SELECT COUNT(*) INTO v_orphaned_submissions
    FROM submissions
    WHERE round_session_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM round_sessions 
        WHERE round_sessions.id = submissions.round_session_id
      );
    
    IF v_orphaned_submissions > 0 THEN
        RAISE NOTICE '🔍 Found % orphaned submissions', v_orphaned_submissions;
    ELSE
        RAISE NOTICE '✅ No orphaned submissions found';
    END IF;
END $$;

-- =====================================================
-- 6. Delete orphaned submissions
-- =====================================================
DELETE FROM submissions
WHERE round_session_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM round_sessions 
    WHERE round_sessions.id = submissions.round_session_id
  );

-- =====================================================
-- 7. Find and report orphaned quiz_answers
-- =====================================================
DO $$
DECLARE
    v_orphaned_quiz INT;
BEGIN
    SELECT COUNT(*) INTO v_orphaned_quiz
    FROM quiz_answers
    WHERE round_session_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM round_sessions 
        WHERE round_sessions.id = quiz_answers.round_session_id
      );
    
    IF v_orphaned_quiz > 0 THEN
        RAISE NOTICE '🔍 Found % orphaned quiz_answers', v_orphaned_quiz;
    ELSE
        RAISE NOTICE '✅ No orphaned quiz_answers found';
    END IF;
END $$;

-- =====================================================
-- 8. Delete orphaned quiz_answers
-- =====================================================
DELETE FROM quiz_answers
WHERE round_session_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM round_sessions 
    WHERE round_sessions.id = quiz_answers.round_session_id
  );

-- =====================================================
-- 9. Find and report orphaned byok_usage (if table exists)
-- =====================================================
DO $$
DECLARE
    v_orphaned_byok INT := 0;
    v_table_exists BOOLEAN;
BEGIN
    -- Check if table exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'byok_usage'
    ) INTO v_table_exists;
    
    IF v_table_exists THEN
        SELECT COUNT(*) INTO v_orphaned_byok
        FROM byok_usage
        WHERE round_session_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM round_sessions 
            WHERE round_sessions.id = byok_usage.round_session_id
          );
        
        IF v_orphaned_byok > 0 THEN
            RAISE NOTICE '🔍 Found % orphaned byok_usage records', v_orphaned_byok;
        ELSE
            RAISE NOTICE '✅ No orphaned byok_usage found';
        END IF;
    ELSE
        RAISE NOTICE '⚠️  Table byok_usage does not exist (skipping)';
    END IF;
END $$;

-- =====================================================
-- 10. Delete orphaned byok_usage (if table exists)
-- =====================================================
DO $$
DECLARE
    v_table_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'byok_usage'
    ) INTO v_table_exists;
    
    IF v_table_exists THEN
        DELETE FROM byok_usage
        WHERE round_session_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM round_sessions 
            WHERE round_sessions.id = byok_usage.round_session_id
          );
    END IF;
END $$;

COMMIT;

-- =====================================================
-- Summary Report
-- =====================================================
DO $$
DECLARE
    v_total_score_events INT;
    v_total_round_sessions INT;
    v_teams_with_scores INT;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ CLEANUP COMPLETE';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    
    -- Count current state
    SELECT COUNT(*) INTO v_total_round_sessions FROM round_sessions;
    SELECT COUNT(*) INTO v_total_score_events FROM score_events;
    SELECT COUNT(DISTINCT team_id) INTO v_teams_with_scores FROM score_events;
    
    RAISE NOTICE '📊 Current Database State:';
    RAISE NOTICE '   • Round Sessions: %', v_total_round_sessions;
    RAISE NOTICE '   • Score Events: %', v_total_score_events;
    RAISE NOTICE '   • Teams with Scores: %', v_teams_with_scores;
    RAISE NOTICE '';
    RAISE NOTICE '🎉 All orphaned records have been cleaned up!';
    RAISE NOTICE '   Future round resets will automatically cascade.';
END $$;
