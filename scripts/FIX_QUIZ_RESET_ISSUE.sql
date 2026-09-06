-- =====================================================
-- FIX: Quiz "Already Attempted" Issue After Reset
-- =====================================================
-- This migration fixes the issue where after admin resets
-- a quiz round, teams still see "already attempted" and
-- cannot re-take the quiz.
--
-- ROOT CAUSE:
-- The quiz_sessions table has UNIQUE(team_id, round_id)
-- constraint which prevents creating multiple sessions.
-- After reset, orphaned quiz_sessions records prevent
-- new attempts.
--
-- SOLUTION:
-- 1. Fix CASCADE relationships
-- 2. Clean up orphaned quiz_sessions
-- 3. Ensure proper cleanup on reset
-- =====================================================

BEGIN;

-- =====================================================
-- 1. Verify and fix CASCADE on quiz_sessions
-- =====================================================
-- Ensure quiz_sessions properly cascades when round_sessions
-- is deleted

-- Drop existing constraint
ALTER TABLE quiz_sessions 
DROP CONSTRAINT IF EXISTS quiz_sessions_round_session_id_fkey;

-- Add with proper CASCADE
ALTER TABLE quiz_sessions
ADD CONSTRAINT quiz_sessions_round_session_id_fkey 
FOREIGN KEY (round_session_id) 
REFERENCES round_sessions(id) 
ON DELETE CASCADE;

COMMENT ON CONSTRAINT quiz_sessions_round_session_id_fkey ON quiz_sessions IS 
'CASCADE delete: When round_session deleted, remove quiz_session';

-- =====================================================
-- 2. Clean up orphaned quiz_sessions
-- =====================================================
-- Delete any quiz_sessions that reference non-existent
-- round_sessions

DELETE FROM quiz_sessions
WHERE round_session_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM round_sessions 
    WHERE round_sessions.id = quiz_sessions.round_session_id
  );

-- =====================================================
-- 3. Fix quiz_answers CASCADE
-- =====================================================
-- Ensure quiz_answers also cascade properly

ALTER TABLE quiz_answers 
DROP CONSTRAINT IF EXISTS quiz_answers_round_session_id_fkey;

ALTER TABLE quiz_answers
ADD CONSTRAINT quiz_answers_round_session_id_fkey 
FOREIGN KEY (round_session_id) 
REFERENCES round_sessions(id) 
ON DELETE CASCADE;

COMMENT ON CONSTRAINT quiz_answers_round_session_id_fkey ON quiz_answers IS 
'CASCADE delete: When round_session deleted, remove quiz_answers';

-- Clean up orphaned quiz_answers
DELETE FROM quiz_answers
WHERE round_session_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM round_sessions 
    WHERE round_sessions.id = quiz_answers.round_session_id
  );

-- =====================================================
-- 4. Fix challenge_attempts CASCADE
-- =====================================================
-- Ensure challenge_attempts cascade properly (used for quiz answers)

ALTER TABLE challenge_attempts 
DROP CONSTRAINT IF EXISTS challenge_attempts_round_session_id_fkey;

ALTER TABLE challenge_attempts
ADD CONSTRAINT challenge_attempts_round_session_id_fkey 
FOREIGN KEY (round_session_id) 
REFERENCES round_sessions(id) 
ON DELETE CASCADE;

COMMENT ON CONSTRAINT challenge_attempts_round_session_id_fkey ON challenge_attempts IS 
'CASCADE delete: When round_session deleted, remove challenge_attempts';

-- Clean up orphaned challenge_attempts
DELETE FROM challenge_attempts
WHERE round_session_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM round_sessions 
    WHERE round_sessions.id = challenge_attempts.round_session_id
  );

-- =====================================================
-- 5. Create index to speed up cascade deletes
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

-- =====================================================
-- 6. Create helper function to diagnose quiz issues
-- =====================================================

CREATE OR REPLACE FUNCTION diagnose_quiz_reset_issues(
    p_team_id UUID,
    p_round_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
    v_round_session_id UUID;
    v_quiz_session_id UUID;
    v_quiz_answers_count INT;
    v_challenge_attempts_count INT;
    v_orphaned_quiz_sessions INT;
    v_orphaned_quiz_answers INT;
    v_orphaned_challenge_attempts INT;
    v_result JSON;
BEGIN
    -- Get round_session_id if exists
    SELECT id INTO v_round_session_id
    FROM round_sessions
    WHERE team_id = p_team_id AND round_id = p_round_id;
    
    -- Get quiz_session_id if exists
    SELECT id INTO v_quiz_session_id
    FROM quiz_sessions
    WHERE team_id = p_team_id AND round_id = p_round_id;
    
    -- Count related records
    SELECT COUNT(*) INTO v_quiz_answers_count
    FROM quiz_answers
    WHERE team_id = p_team_id 
      AND round_session_id = v_round_session_id;
    
    SELECT COUNT(*) INTO v_challenge_attempts_count
    FROM challenge_attempts
    WHERE round_session_id = v_round_session_id;
    
    -- Count orphaned records
    SELECT COUNT(*) INTO v_orphaned_quiz_sessions
    FROM quiz_sessions qs
    WHERE qs.team_id = p_team_id 
      AND qs.round_id = p_round_id
      AND qs.round_session_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM round_sessions rs 
        WHERE rs.id = qs.round_session_id
      );
    
    SELECT COUNT(*) INTO v_orphaned_quiz_answers
    FROM quiz_answers qa
    WHERE qa.team_id = p_team_id
      AND qa.round_session_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM round_sessions rs 
        WHERE rs.id = qa.round_session_id
      );
    
    SELECT COUNT(*) INTO v_orphaned_challenge_attempts
    FROM challenge_attempts ca
    WHERE ca.round_session_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM round_sessions rs 
        WHERE rs.id = ca.round_session_id
      );
    
    v_result := json_build_object(
        'team_id', p_team_id,
        'round_id', p_round_id,
        'round_session_exists', (v_round_session_id IS NOT NULL),
        'round_session_id', v_round_session_id,
        'quiz_session_exists', (v_quiz_session_id IS NOT NULL),
        'quiz_session_id', v_quiz_session_id,
        'quiz_answers_count', v_quiz_answers_count,
        'challenge_attempts_count', v_challenge_attempts_count,
        'orphaned_quiz_sessions', v_orphaned_quiz_sessions,
        'orphaned_quiz_answers', v_orphaned_quiz_answers,
        'orphaned_challenge_attempts', v_orphaned_challenge_attempts,
        'has_issues', (
            v_orphaned_quiz_sessions > 0 OR 
            v_orphaned_quiz_answers > 0 OR 
            v_orphaned_challenge_attempts > 0 OR
            (v_quiz_session_id IS NOT NULL AND v_round_session_id IS NULL)
        )
    );
    
    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION diagnose_quiz_reset_issues IS 
'Diagnose quiz reset issues for a specific team and round. Shows orphaned records and inconsistencies.';

-- =====================================================
-- 7. Create helper function to force clean quiz data
-- =====================================================

CREATE OR REPLACE FUNCTION force_clean_quiz_data(
    p_team_id UUID,
    p_round_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
    v_deleted_counts JSONB := '{}'::jsonb;
BEGIN
    -- Delete quiz_sessions for this team/round
    WITH deleted AS (
        DELETE FROM quiz_sessions 
        WHERE team_id = p_team_id AND round_id = p_round_id
        RETURNING 1
    )
    SELECT COUNT(*) INTO v_deleted_counts->'quiz_sessions' FROM deleted;
    
    -- Delete quiz_answers for this team/round
    WITH deleted AS (
        DELETE FROM quiz_answers 
        WHERE team_id = p_team_id 
          AND question_id IN (
            SELECT id FROM quiz_questions WHERE round_id = p_round_id
          )
        RETURNING 1
    )
    SELECT COUNT(*) INTO v_deleted_counts->'quiz_answers' FROM deleted;
    
    -- Delete challenge_attempts for this team/round
    WITH deleted AS (
        DELETE FROM challenge_attempts ca
        USING challenges c
        WHERE ca.challenge_id = c.id
          AND c.round_id = p_round_id
          AND (ca.team_id = p_team_id OR EXISTS (
            SELECT 1 FROM participants p 
            WHERE p.id = ca.participant_id AND p.team_id = p_team_id
          ))
        RETURNING 1
    )
    SELECT COUNT(*) INTO v_deleted_counts->'challenge_attempts' FROM deleted;
    
    RETURN json_build_object(
        'success', true,
        'team_id', p_team_id,
        'round_id', p_round_id,
        'deleted_counts', v_deleted_counts
    );
END;
$$;

COMMENT ON FUNCTION force_clean_quiz_data IS 
'Force clean all quiz-related data for a team/round. Use when reset leaves orphaned data.';

-- =====================================================
-- 8. Grant permissions
-- =====================================================

REVOKE ALL ON FUNCTION diagnose_quiz_reset_issues FROM PUBLIC;
REVOKE ALL ON FUNCTION force_clean_quiz_data FROM PUBLIC;

COMMIT;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================
DO $$ 
BEGIN 
    RAISE NOTICE '✅ Quiz reset fix applied successfully!';
    RAISE NOTICE '';
    RAISE NOTICE '📋 Summary of changes:';
    RAISE NOTICE '  • Fixed CASCADE on quiz_sessions.round_session_id';
    RAISE NOTICE '  • Fixed CASCADE on quiz_answers.round_session_id';
    RAISE NOTICE '  • Fixed CASCADE on challenge_attempts.round_session_id';
    RAISE NOTICE '  • Cleaned up orphaned quiz_sessions records';
    RAISE NOTICE '  • Cleaned up orphaned quiz_answers records';
    RAISE NOTICE '  • Cleaned up orphaned challenge_attempts records';
    RAISE NOTICE '  • Added indexes for better performance';
    RAISE NOTICE '  • Created diagnose_quiz_reset_issues() function';
    RAISE NOTICE '  • Created force_clean_quiz_data() function';
    RAISE NOTICE '';
    RAISE NOTICE '🔧 Usage from SQL:';
    RAISE NOTICE '  -- Diagnose issues:';
    RAISE NOTICE '  SELECT diagnose_quiz_reset_issues(';
    RAISE NOTICE '    ''<team_id>''::uuid,';
    RAISE NOTICE '    ''<round_id>''::uuid';
    RAISE NOTICE '  );';
    RAISE NOTICE '';
    RAISE NOTICE '  -- Force clean if issues found:';
    RAISE NOTICE '  SELECT force_clean_quiz_data(';
    RAISE NOTICE '    ''<team_id>''::uuid,';
    RAISE NOTICE '    ''<round_id>''::uuid';
    RAISE NOTICE '  );';
    RAISE NOTICE '';
    RAISE NOTICE '💡 Teams can now re-attempt quizzes after admin reset!';
END $$;
