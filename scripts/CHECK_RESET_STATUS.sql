-- ═════════════════════════════════════════════════════════════════════════════
-- CHECK RESET STATUS - Diagnostic Script
-- ═════════════════════════════════════════════════════════════════════════════
-- This script checks if the reset actually deleted the round_sessions
-- Replace 'adb9fcee-fe7b-44e8-a6b8-6420f1bceda7' with your team ID
-- ═════════════════════════════════════════════════════════════════════════════

-- Step 1: Check if round_sessions still exist for this team
SELECT 
    'ROUND SESSIONS CHECK' as section,
    rs.id as round_session_id,
    r.name as round_name,
    rs.status,
    rs.score,
    rs.started_at,
    rs.completed_at
FROM round_sessions rs
JOIN rounds r ON rs.round_id = r.id
WHERE rs.team_id = 'adb9fcee-fe7b-44e8-a6b8-6420f1bceda7'
ORDER BY r.order_index;

-- Step 2: Check if challenge_attempts still exist
SELECT 
    'CHALLENGE ATTEMPTS CHECK' as section,
    COUNT(*) as total_attempts
FROM challenge_attempts
WHERE team_id = 'adb9fcee-fe7b-44e8-a6b8-6420f1bceda7';

-- Step 3: Check if quiz_sessions still exist
SELECT 
    'QUIZ SESSIONS CHECK' as section,
    COUNT(*) as total_quiz_sessions
FROM quiz_sessions
WHERE team_id = 'adb9fcee-fe7b-44e8-a6b8-6420f1bceda7';

-- Step 4: Check if score_events still exist
SELECT 
    'SCORE EVENTS CHECK' as section,
    COUNT(*) as total_score_events,
    COALESCE(SUM(points), 0) as total_points
FROM score_events
WHERE team_id = 'adb9fcee-fe7b-44e8-a6b8-6420f1bceda7';

-- Step 5: Check team name
SELECT 
    'TEAM INFO CHECK' as section,
    t.name as team_name,
    t.created_at
FROM teams t
WHERE t.id = 'adb9fcee-fe7b-44e8-a6b8-6420f1bceda7';

-- ═════════════════════════════════════════════════════════════════════════════
-- INTERPRETATION:
-- ═════════════════════════════════════════════════════════════════════════════
-- If round_sessions still exist → Reset function didn't delete them
-- If challenge_attempts = 0 → Quiz answers were deleted ✓
-- If quiz_sessions = 0 → Quiz sessions were deleted ✓
-- If score_events = 0 → Score events were deleted ✓
-- If total_score = 0 → Team score was reset ✓
-- ═════════════════════════════════════════════════════════════════════════════
