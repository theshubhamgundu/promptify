-- ═════════════════════════════════════════════════════════════════════════════
-- FIX RLS POLICIES - Remove References to Non-Existent Tables
-- ═════════════════════════════════════════════════════════════════════════════
-- Your quiz system uses 'challenges' table, not 'quiz_questions'/'quiz_options'
-- ═════════════════════════════════════════════════════════════════════════════

-- ═════════════════════════════════════════════════════════════════════════════
-- Drop Non-Existent Table RLS (These tables don't exist)
-- ═════════════════════════════════════════════════════════════════════════════

-- These tables don't exist in your schema, so drop any RLS on them
DROP POLICY IF EXISTS "Teams can view quiz questions for their active rounds" ON quiz_questions;
DROP POLICY IF EXISTS "Admins can manage quiz questions" ON quiz_questions;
DROP POLICY IF EXISTS "Teams can view quiz options" ON quiz_options;
DROP POLICY IF EXISTS "Admins can manage quiz options" ON quiz_options;

-- Disable RLS on non-existent tables (will error if tables don't exist, but that's ok)
DO $$ 
BEGIN
    ALTER TABLE IF EXISTS quiz_questions DISABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS quiz_options DISABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN
    -- Tables don't exist, that's fine
    NULL;
END $$;

-- ═════════════════════════════════════════════════════════════════════════════
-- Fix quiz_answers and quiz_sessions RLS (These tables DO exist)
-- ═════════════════════════════════════════════════════════════════════════════

-- Drop old policies
DROP POLICY IF EXISTS "Teams can view their own quiz answers" ON quiz_answers;
DROP POLICY IF EXISTS "Teams can submit their own quiz answers" ON quiz_answers;
DROP POLICY IF EXISTS "Teams can update their own quiz answers" ON quiz_answers;
DROP POLICY IF EXISTS "Admins can manage quiz answers" ON quiz_answers;

DROP POLICY IF EXISTS "Teams can view their own quiz sessions" ON quiz_sessions;
DROP POLICY IF EXISTS "Teams can create their own quiz sessions" ON quiz_sessions;
DROP POLICY IF EXISTS "Teams can update their own quiz sessions" ON quiz_sessions;
DROP POLICY IF EXISTS "Admins can manage quiz sessions" ON quiz_sessions;

-- ═════════════════════════════════════════════════════════════════════════════
-- Create SIMPLE RLS policies (No complex lookups)
-- ═════════════════════════════════════════════════════════════════════════════

-- quiz_answers: Teams can access their own data
CREATE POLICY "quiz_answers_team_access"
ON quiz_answers FOR ALL
USING (
    team_id = (current_setting('app.team_id', true)::uuid)
    OR
    EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.role IN ('ADMIN', 'COORDINATOR')
    )
);

-- quiz_sessions: Teams can access their own sessions
CREATE POLICY "quiz_sessions_team_access"
ON quiz_sessions FOR ALL
USING (
    team_id = (current_setting('app.team_id', true)::uuid)
    OR
    EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.role IN ('ADMIN', 'COORDINATOR')
    )
);

-- ═════════════════════════════════════════════════════════════════════════════
-- Alternative: DISABLE RLS Completely for Quiz Tables (More Permissive)
-- ═════════════════════════════════════════════════════════════════════════════
-- Uncomment these if you want to completely disable RLS on quiz tables:

-- ALTER TABLE quiz_answers DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE quiz_sessions DISABLE ROW LEVEL SECURITY;

-- ═════════════════════════════════════════════════════════════════════════════
-- VERIFICATION
-- ═════════════════════════════════════════════════════════════════════════════

SELECT 
    'RLS Status' as check_type,
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename IN ('quiz_answers', 'quiz_sessions', 'quiz_questions', 'quiz_options')
ORDER BY tablename;

SELECT 
    'Active Policies' as check_type,
    schemaname,
    tablename,
    policyname
FROM pg_policies
WHERE schemaname = 'public'
    AND tablename IN ('quiz_answers', 'quiz_sessions')
ORDER BY tablename, policyname;
