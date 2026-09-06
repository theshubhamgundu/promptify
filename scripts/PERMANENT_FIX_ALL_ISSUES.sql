-- =====================================================
-- PERMANENT FIX: All Quiz Issues
-- =====================================================
-- This fixes:
-- 1. Quiz reset leaving orphaned data
-- 2. Quiz submission failures
-- 3. "Already attempted" errors
-- 4. Challenge_attempts cascade issues
-- =====================================================

BEGIN;

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════';
    RAISE NOTICE '🔧 APPLYING PERMANENT FIX FOR ALL QUIZ ISSUES';
    RAISE NOTICE '═══════════════════════════════════════════════════';
    RAISE NOTICE '';
END $$;

-- =====================================================
-- 1. Fix CASCADE on ALL related tables
-- =====================================================

-- quiz_sessions
ALTER TABLE quiz_sessions 
DROP CONSTRAINT IF EXISTS quiz_sessions_round_session_id_fkey CASCADE;

ALTER TABLE quiz_sessions
ADD CONSTRAINT quiz_sessions_round_session_id_fkey 
FOREIGN KEY (round_session_id) 
REFERENCES round_sessions(id) 
ON DELETE CASCADE;

DO $$
BEGIN
    RAISE NOTICE '✅ Fixed CASCADE: quiz_sessions';
END $$;

-- quiz_answers
ALTER TABLE quiz_answers 
DROP CONSTRAINT IF EXISTS quiz_answers_round_session_id_fkey CASCADE;

ALTER TABLE quiz_answers
ADD CONSTRAINT quiz_answers_round_session_id_fkey 
FOREIGN KEY (round_session_id) 
REFERENCES round_sessions(id) 
ON DELETE CASCADE;

DO $$
BEGIN
    RAISE NOTICE '✅ Fixed CASCADE: quiz_answers';
END $$;

-- challenge_attempts (CRITICAL - used by QuizRound)
ALTER TABLE challenge_attempts 
DROP CONSTRAINT IF EXISTS challenge_attempts_round_session_id_fkey CASCADE;

ALTER TABLE challenge_attempts
ADD CONSTRAINT challenge_attempts_round_session_id_fkey 
FOREIGN KEY (round_session_id) 
REFERENCES round_sessions(id) 
ON DELETE CASCADE;

DO $$
BEGIN
    RAISE NOTICE '✅ Fixed CASCADE: challenge_attempts';
END $$;

-- score_events
ALTER TABLE score_events 
DROP CONSTRAINT IF EXISTS score_events_round_session_id_fkey CASCADE;

ALTER TABLE score_events
ADD CONSTRAINT score_events_round_session_id_fkey 
FOREIGN KEY (round_session_id) 
REFERENCES round_sessions(id) 
ON DELETE CASCADE;

DO $$
BEGIN
    RAISE NOTICE '✅ Fixed CASCADE: score_events';
END $$;

-- submissions
ALTER TABLE submissions 
DROP CONSTRAINT IF EXISTS submissions_round_session_id_fkey CASCADE;

ALTER TABLE submissions
ADD CONSTRAINT submissions_round_session_id_fkey 
FOREIGN KEY (round_session_id) 
REFERENCES round_sessions(id) 
ON DELETE CASCADE;

DO $$
BEGIN
    RAISE NOTICE '✅ Fixed CASCADE: submissions';
END $$;

-- prompt_submissions (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'prompt_submissions') THEN
        ALTER TABLE prompt_submissions 
        DROP CONSTRAINT IF EXISTS prompt_submissions_round_session_id_fkey CASCADE;
        
        ALTER TABLE prompt_submissions
        ADD CONSTRAINT prompt_submissions_round_session_id_fkey 
        FOREIGN KEY (round_session_id) 
        REFERENCES round_sessions(id) 
        ON DELETE CASCADE;
        
        RAISE NOTICE '✅ Fixed CASCADE: prompt_submissions';
    END IF;
END $$;

-- =====================================================
-- 2. Clean up ALL orphaned data NOW
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🧹 Cleaning up orphaned data...';
    RAISE NOTICE '';
END $$;

-- Delete orphaned quiz_sessions
WITH deleted AS (
    DELETE FROM quiz_sessions
    WHERE round_session_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM round_sessions WHERE round_sessions.id = quiz_sessions.round_session_id)
    RETURNING id
)
SELECT COUNT(*) FROM deleted;

-- Delete orphaned quiz_answers
WITH deleted AS (
    DELETE FROM quiz_answers
    WHERE round_session_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM round_sessions WHERE round_sessions.id = quiz_answers.round_session_id)
    RETURNING id
)
SELECT COUNT(*) FROM deleted;

-- Delete orphaned challenge_attempts
WITH deleted AS (
    DELETE FROM challenge_attempts
    WHERE round_session_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM round_sessions WHERE round_sessions.id = challenge_attempts.round_session_id)
    RETURNING id
)
SELECT COUNT(*) FROM deleted;

-- Delete orphaned score_events
WITH deleted AS (
    DELETE FROM score_events
    WHERE round_session_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM round_sessions WHERE round_sessions.id = score_events.round_session_id)
    RETURNING id
)
SELECT COUNT(*) FROM deleted;

DO $$
BEGIN
    RAISE NOTICE '✅ Orphaned data cleaned';
END $$;

-- =====================================================
-- 3. Fix RLS policies for challenges table
-- =====================================================

ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "challenges_public_read" ON challenges;
DROP POLICY IF EXISTS "challenges_anon_read" ON challenges;
DROP POLICY IF EXISTS "Allow read access to challenges" ON challenges;

CREATE POLICY "challenges_public_read" ON challenges
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "challenges_anon_read" ON challenges
    FOR SELECT TO anon USING (true);

DO $$
BEGIN
    RAISE NOTICE '✅ Fixed RLS: challenges';
END $$;

-- =====================================================
-- 4. Fix RLS policies for challenge_attempts
-- =====================================================

ALTER TABLE challenge_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "challenge_attempts_insert" ON challenge_attempts;
DROP POLICY IF EXISTS "challenge_attempts_select" ON challenge_attempts;
DROP POLICY IF EXISTS "challenge_attempts_update" ON challenge_attempts;

-- Allow authenticated users to insert their own attempts
CREATE POLICY "challenge_attempts_insert" ON challenge_attempts
    FOR INSERT TO authenticated
    WITH CHECK (
        team_id = (SELECT team_id FROM participants WHERE id = auth.uid() LIMIT 1)
        OR team_id IN (SELECT team_id FROM participants WHERE user_id = auth.uid())
    );

-- Allow users to read their team's attempts
CREATE POLICY "challenge_attempts_select" ON challenge_attempts
    FOR SELECT TO authenticated
    USING (
        team_id = (SELECT team_id FROM participants WHERE id = auth.uid() LIMIT 1)
        OR team_id IN (SELECT team_id FROM participants WHERE user_id = auth.uid())
    );

DO $$
BEGIN
    RAISE NOTICE '✅ Fixed RLS: challenge_attempts';
END $$;

-- =====================================================
-- 5. Add performance indexes
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_quiz_sessions_round_session 
ON quiz_sessions(round_session_id) WHERE round_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_quiz_answers_round_session 
ON quiz_answers(round_session_id) WHERE round_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_challenge_attempts_round_session 
ON challenge_attempts(round_session_id) WHERE round_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_score_events_round_session 
ON score_events(round_session_id) WHERE round_session_id IS NOT NULL;

DO $$
BEGIN
    RAISE NOTICE '✅ Added performance indexes';
END $$;

-- =====================================================
-- 6. Ensure submit_round_session function exists and works
-- =====================================================

CREATE OR REPLACE FUNCTION submit_round_session(p_round_session_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_score INTEGER := 0;
    v_round_session RECORD;
BEGIN
    -- Get round session
    SELECT * INTO v_round_session
    FROM round_sessions
    WHERE id = p_round_session_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Round session not found: %', p_round_session_id;
    END IF;
    
    -- Calculate total score from challenge_attempts
    SELECT COALESCE(SUM(points_earned), 0) INTO v_total_score
    FROM challenge_attempts
    WHERE round_session_id = p_round_session_id;
    
    -- Also check score_events (fallback)
    IF v_total_score = 0 THEN
        SELECT COALESCE(SUM(points), 0) INTO v_total_score
        FROM score_events
        WHERE round_session_id = p_round_session_id;
    END IF;
    
    -- Update round session
    UPDATE round_sessions
    SET 
        status = 'COMPLETED',
        completed_at = NOW(),
        score = v_total_score
    WHERE id = p_round_session_id;
    
    -- Log activity
    INSERT INTO activity_logs (action, team_id, details)
    VALUES (
        'QUIZ_SUBMITTED',
        v_round_session.team_id,
        jsonb_build_object(
            'round_session_id', p_round_session_id,
            'round_id', v_round_session.round_id,
            'score', v_total_score
        )
    );
    
    RETURN v_total_score;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error in submit_round_session: %', SQLERRM;
        RAISE;
END;
$$;

DO $$
BEGIN
    RAISE NOTICE '✅ Created/Updated submit_round_session function';
END $$;

COMMIT;

-- =====================================================
-- FINAL VERIFICATION
-- =====================================================

DO $$
DECLARE
    v_orphaned_total INTEGER;
    v_cascade_ok INTEGER := 0;
BEGIN
    -- Count remaining orphaned records
    SELECT 
        (SELECT COUNT(*) FROM quiz_sessions WHERE round_session_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM round_sessions WHERE round_sessions.id = quiz_sessions.round_session_id)) +
        (SELECT COUNT(*) FROM quiz_answers WHERE round_session_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM round_sessions WHERE round_sessions.id = quiz_answers.round_session_id)) +
        (SELECT COUNT(*) FROM challenge_attempts WHERE round_session_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM round_sessions WHERE round_sessions.id = challenge_attempts.round_session_id)) +
        (SELECT COUNT(*) FROM score_events WHERE round_session_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM round_sessions WHERE round_sessions.id = score_events.round_session_id))
    INTO v_orphaned_total;
    
    -- Check CASCADE configuration
    SELECT COUNT(*) INTO v_cascade_ok
    FROM pg_constraint
    WHERE conname IN (
        'quiz_sessions_round_session_id_fkey',
        'quiz_answers_round_session_id_fkey',
        'challenge_attempts_round_session_id_fkey',
        'score_events_round_session_id_fkey'
    )
    AND confdeltype = 'c'; -- 'c' = CASCADE
    
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════';
    RAISE NOTICE '✅ PERMANENT FIX COMPLETE!';
    RAISE NOTICE '═══════════════════════════════════════════════════';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Verification:';
    RAISE NOTICE '   • Orphaned records: %', v_orphaned_total;
    RAISE NOTICE '   • CASCADE constraints: % configured', v_cascade_ok;
    RAISE NOTICE '';
    
    IF v_orphaned_total = 0 AND v_cascade_ok >= 4 THEN
        RAISE NOTICE '✅ ALL CHECKS PASSED!';
        RAISE NOTICE '';
        RAISE NOTICE '🎯 You can now:';
        RAISE NOTICE '   1. Take quizzes normally';
        RAISE NOTICE '   2. Submit quizzes without errors';
        RAISE NOTICE '   3. Admin can reset rounds';
        RAISE NOTICE '   4. Teams can re-attempt after reset';
        RAISE NOTICE '   5. No more orphaned data issues';
    ELSE
        RAISE NOTICE '⚠️  Some issues may remain';
        RAISE NOTICE '   Orphaned records: %', v_orphaned_total;
        RAISE NOTICE '   CASCADE constraints: %/4', v_cascade_ok;
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;
