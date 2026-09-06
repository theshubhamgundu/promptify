-- =====================================================
-- EMERGENCY: Delete Team Rounds NOW
-- =====================================================
-- USE THIS SCRIPT to immediately delete all rounds
-- when the UI reset button doesn't work
--
-- INSTRUCTIONS:
-- 1. Get your team ID from the query below
-- 2. Copy the DELETE commands
-- 3. Replace TEAM_ID with your actual UUID
-- 4. Run them one by one
-- =====================================================

-- Step 1: Find your team
SELECT 
    id as team_id,
    name,
    access_code
FROM teams
ORDER BY created_at DESC;

-- Step 2: Check what will be deleted (PREVIEW)
-- Replace TEAM_ID below with actual UUID from step 1

SELECT 
    'WILL DELETE' as action,
    'round_sessions' as table_name,
    COUNT(*) as record_count,
    SUM(score) as total_score
FROM round_sessions
WHERE team_id = 'TEAM_ID'::uuid

UNION ALL

SELECT 
    'WILL DELETE',
    'score_events',
    COUNT(*),
    SUM(points)
FROM score_events
WHERE team_id = 'TEAM_ID'::uuid

UNION ALL

SELECT 
    'WILL DELETE',
    'quiz_answers',
    COUNT(*),
    NULL
FROM quiz_answers
WHERE team_id = 'TEAM_ID'::uuid;

-- Step 3: DELETE EVERYTHING (run these ONE BY ONE)
-- ⚠️ REPLACE 'TEAM_ID' WITH YOUR ACTUAL UUID! ⚠️

-- Delete score events FIRST (prevents orphans)
DELETE FROM score_events 
WHERE team_id = 'TEAM_ID'::uuid;
-- Check: You should see "DELETE X" where X is the count

-- Delete quiz answers
DELETE FROM quiz_answers 
WHERE team_id = 'TEAM_ID'::uuid;

-- Delete quiz sessions
DELETE FROM quiz_sessions 
WHERE team_id = 'TEAM_ID'::uuid;

-- Delete prompt submissions
DELETE FROM prompt_submissions 
WHERE team_id = 'TEAM_ID'::uuid;

-- Delete general submissions
DELETE FROM submissions 
WHERE team_id = 'TEAM_ID'::uuid;

-- Delete prompt round sessions
DELETE FROM prompt_round_sessions 
WHERE team_id = 'TEAM_ID'::uuid;

-- DELETE THE ROUND SESSIONS (FINAL STEP)
DELETE FROM round_sessions 
WHERE team_id = 'TEAM_ID'::uuid;
-- Check: You should see "DELETE 5" (based on your count)

-- Step 4: VERIFY everything is gone
SELECT 
    'VERIFICATION' as check_type,
    (SELECT COUNT(*) FROM round_sessions WHERE team_id = 'TEAM_ID'::uuid) as round_sessions,
    (SELECT COUNT(*) FROM score_events WHERE team_id = 'TEAM_ID'::uuid) as score_events,
    (SELECT COUNT(*) FROM quiz_answers WHERE team_id = 'TEAM_ID'::uuid) as quiz_answers;
-- All should be 0!

-- Step 5: Check the team's score calculation
SELECT 
    'SCORE CHECK' as info,
    COALESCE((SELECT SUM(points) FROM score_events WHERE team_id = 'TEAM_ID'::uuid), 0) as from_events,
    COALESCE((SELECT SUM(score) FROM round_sessions WHERE team_id = 'TEAM_ID'::uuid), 0) as from_sessions,
    COALESCE((SELECT COUNT(*) FROM round_sessions WHERE team_id = 'TEAM_ID'::uuid), 0) as session_count;
-- All should be 0!
