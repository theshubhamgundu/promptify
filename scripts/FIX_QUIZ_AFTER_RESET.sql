-- =====================================================
-- FIX: Quiz Loading After Reset
-- =====================================================
-- This script ensures quiz can be restarted after reset
--
-- The issue: After resetting rounds, quiz fails to load
-- because it expects quiz_sessions or other data
-- =====================================================

-- Step 1: Check if quiz_sessions exist for the team
SELECT 
    '🔍 CHECKING QUIZ SESSIONS' as info,
    t.name as team_name,
    COUNT(qs.id) as quiz_sessions_count
FROM teams t
LEFT JOIN quiz_sessions qs ON t.id = qs.team_id
WHERE t.access_code = 'TEST1234'  -- Change to your team's access code
GROUP BY t.id, t.name;

-- Step 2: Check RLS policies for quiz_sessions
SELECT 
    '🔍 RLS POLICIES' as info,
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE tablename IN ('quiz_sessions', 'quiz_answers', 'round_sessions')
ORDER BY tablename, policyname;

-- Step 3: Check if submit_round_session function exists
SELECT 
    '🔍 RPC FUNCTIONS' as info,
    proname as function_name,
    pg_get_functiondef(oid) as definition
FROM pg_proc
WHERE proname IN ('submit_round_session', 'start_quiz_session', 'submit_quiz_answer')
ORDER BY proname;

-- Step 4: Grant necessary permissions
-- Make sure teams can INSERT their own quiz_sessions after reset
GRANT INSERT, UPDATE, SELECT ON quiz_sessions TO authenticated;
GRANT INSERT, UPDATE, SELECT ON quiz_answers TO authenticated;
GRANT INSERT, SELECT ON round_sessions TO authenticated;

-- Step 5: Check challenge_attempts table (used for saving answers)
SELECT 
    '🔍 CHALLENGE ATTEMPTS TABLE' as info,
    EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'challenge_attempts'
    ) as table_exists;

-- If challenge_attempts doesn't exist, we need to create it or use quiz_answers instead
