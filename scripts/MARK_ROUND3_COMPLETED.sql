-- =====================================================
-- FIX: Mark Round 3 as COMPLETED
-- =====================================================
-- Manually marks Round 3 as completed if all challenges done
-- =====================================================

-- First, find Round 3 and your team
SELECT 
    'YOUR TEAM INFO' as info,
    id as team_id,
    name as team_name,
    code as team_code
FROM teams 
WHERE code = 'TEST1234'  -- Replace with your actual team code
LIMIT 1;

-- Find Round 3
SELECT 
    'ROUND 3 INFO' as info,
    id as round_id,
    title as round_name,
    type as round_type
FROM rounds 
WHERE title ILIKE '%vertex%' OR type = 'VISION_CHALLENGE' OR round_number = 3
LIMIT 1;

-- Check current status
SELECT 
    'CURRENT STATUS' as info,
    rs.id as round_session_id,
    rs.status as current_status,
    rs.score,
    rs.completed_at,
    r.title as round_name,
    t.name as team_name
FROM round_sessions rs
JOIN rounds r ON rs.round_id = r.id
JOIN teams t ON rs.team_id = t.id
WHERE t.code = 'TEST1234'  -- Replace
AND (r.title ILIKE '%vertex%' OR r.type = 'VISION_CHALLENGE' OR r.round_number = 3);

-- === FIX: Update round_sessions to COMPLETED ===
-- This will mark Round 3 as completed for your team

UPDATE round_sessions
SET 
    status = 'COMPLETED',
    completed_at = COALESCE(completed_at, now())  -- Set completed_at if not already set
WHERE id IN (
    SELECT rs.id
    FROM round_sessions rs
    JOIN rounds r ON rs.round_id = r.id
    JOIN teams t ON rs.team_id = t.id
    WHERE t.code = 'TEST1234'  -- Replace with your team code
    AND (r.title ILIKE '%vertex%' OR r.type = 'VISION_CHALLENGE' OR r.round_number = 3)
    AND rs.status != 'COMPLETED'  -- Only update if not already completed
)
RETURNING 
    id as round_session_id,
    status as new_status,
    score,
    completed_at;

-- Verify the fix
SELECT 
    'VERIFICATION' as info,
    rs.id as round_session_id,
    rs.status,
    rs.score,
    rs.completed_at,
    r.title as round_name,
    t.name as team_name,
    CASE 
        WHEN rs.status = 'COMPLETED' THEN '✓ Successfully marked as COMPLETED'
        ELSE '✗ Still not completed'
    END as result
FROM round_sessions rs
JOIN rounds r ON rs.round_id = r.id
JOIN teams t ON rs.team_id = t.id
WHERE t.code = 'TEST1234'  -- Replace
AND (r.title ILIKE '%vertex%' OR r.type = 'VISION_CHALLENGE' OR r.round_number = 3);

-- Optional: Calculate and update the score based on challenge_sessions
UPDATE round_sessions
SET score = (
    SELECT COALESCE(SUM(cs.score), 0)
    FROM challenge_sessions cs
    WHERE cs.round_session_id = round_sessions.id
)
WHERE id IN (
    SELECT rs.id
    FROM round_sessions rs
    JOIN rounds r ON rs.round_id = r.id
    JOIN teams t ON rs.team_id = t.id
    WHERE t.code = 'TEST1234'  -- Replace
    AND (r.title ILIKE '%vertex%' OR r.type = 'VISION_CHALLENGE' OR r.round_number = 3)
)
RETURNING 
    id as round_session_id,
    score as updated_score;

SELECT '✓ Round 3 marked as COMPLETED' as status;
