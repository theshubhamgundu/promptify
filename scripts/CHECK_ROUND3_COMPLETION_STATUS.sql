-- =====================================================
-- CHECK: Round 3 Completion Status
-- =====================================================
-- Diagnose why Round 3 shows as completed in the card
-- but not marked as COMPLETED in the status
-- =====================================================

-- Find your team (replace with actual team name or code)
-- Use this to get team_id:
SELECT id, name, code FROM teams WHERE code = 'TEST1234' OR name ILIKE '%beta%';

-- Set your team_id here (you'll need to run above query first)
-- Replace 'YOUR-TEAM-ID-HERE' with actual UUID
\set team_id 'YOUR-TEAM-ID-HERE'

-- Find Round 3 (Vision Challenge)
SELECT 
    'ROUND 3 INFO' as section,
    id as round_id,
    title,
    type,
    round_number,
    is_active
FROM rounds 
WHERE title ILIKE '%vertex%' OR title ILIKE '%vision%' OR round_number = 3
OR type = 'VISION_CHALLENGE';

-- Check round_sessions for this team and Round 3
SELECT 
    'ROUND_SESSIONS STATUS' as section,
    rs.id,
    rs.team_id,
    rs.round_id,
    r.title as round_name,
    rs.status,
    rs.score,
    rs.started_at,
    rs.completed_at
FROM round_sessions rs
JOIN rounds r ON rs.round_id = r.id
JOIN teams t ON rs.team_id = t.id
WHERE t.code = 'TEST1234'  -- Replace with your team code
AND (r.title ILIKE '%vertex%' OR r.type = 'VISION_CHALLENGE' OR r.round_number = 3);

-- Check challenge_sessions for Round 3
SELECT 
    'CHALLENGE_SESSIONS STATUS' as section,
    cs.id,
    cs.challenge_id,
    c.title as challenge_name,
    cs.status,
    cs.is_correct,
    cs.score,
    cs.attempts_used,
    cs.started_at,
    cs.completed_at
FROM challenge_sessions cs
JOIN challenges c ON cs.challenge_id = c.id
JOIN rounds r ON c.round_id = r.id
JOIN teams t ON cs.team_id = t.id
WHERE t.code = 'TEST1234'  -- Replace with your team code
AND (r.title ILIKE '%vertex%' OR r.type = 'VISION_CHALLENGE' OR r.round_number = 3)
ORDER BY cs.started_at;

-- Check how many challenges in Round 3
SELECT 
    'ROUND 3 CHALLENGES' as section,
    r.title as round_name,
    COUNT(c.id) as total_challenges,
    SUM(CASE WHEN cs.status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_challenges,
    SUM(CASE WHEN cs.is_correct = true THEN 1 ELSE 0 END) as correct_challenges
FROM rounds r
LEFT JOIN challenges c ON c.round_id = r.id
LEFT JOIN challenge_sessions cs ON cs.challenge_id = c.id 
    AND cs.team_id = (SELECT id FROM teams WHERE code = 'TEST1234')  -- Replace
WHERE r.title ILIKE '%vertex%' OR r.type = 'VISION_CHALLENGE' OR r.round_number = 3
GROUP BY r.id, r.title;

-- Summary: What needs to be fixed
SELECT 
    'DIAGNOSIS' as section,
    CASE 
        WHEN rs.status = 'COMPLETED' THEN 'Round session already marked COMPLETED ✓'
        WHEN rs.status IS NULL THEN 'ERROR: No round_session found!'
        WHEN rs.completed_at IS NOT NULL THEN 'Round has completed_at but status is: ' || rs.status
        WHEN rs.status = 'IN_PROGRESS' THEN 'Round is IN_PROGRESS but should be COMPLETED'
        ELSE 'Unknown status: ' || rs.status
    END as issue,
    rs.id as round_session_id,
    rs.status as current_status,
    rs.completed_at,
    (
        SELECT COUNT(*) 
        FROM challenge_sessions cs2 
        WHERE cs2.round_session_id = rs.id 
        AND cs2.status = 'COMPLETED'
    ) as completed_challenge_count,
    (
        SELECT COUNT(*) 
        FROM challenges c2 
        JOIN rounds r2 ON c2.round_id = r2.id
        WHERE r2.id = rs.round_id
    ) as total_challenge_count
FROM round_sessions rs
JOIN rounds r ON rs.round_id = r.id
JOIN teams t ON rs.team_id = t.id
WHERE t.code = 'TEST1234'  -- Replace with your team code
AND (r.title ILIKE '%vertex%' OR r.type = 'VISION_CHALLENGE' OR r.round_number = 3);
