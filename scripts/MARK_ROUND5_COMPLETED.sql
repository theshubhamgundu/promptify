-- =====================================================
-- Mark Round 5 as COMPLETED
-- =====================================================
-- This script manually marks Round 5 (Stage 5: Apex) as completed
-- for the current team, so it shows the green checkmark on the dashboard.
--
-- Use this after you've finished all Round 5 challenges.
-- =====================================================

-- Step 1: Find your Round 5 session
SELECT 
    rs.id,
    rs.team_id,
    t.name as team_name,
    r.name as round_name,
    rs.status,
    rs.started_at,
    rs.completed_at,
    rs.score
FROM round_sessions rs
JOIN teams t ON t.id = rs.team_id
JOIN rounds r ON r.id = rs.round_id
WHERE r.name ILIKE '%apex%' OR r.name ILIKE '%round 5%' OR r.order_index = 5;

-- Step 2: Mark Round 5 as COMPLETED (uncomment and run after confirming above)
/*
UPDATE round_sessions
SET 
    status = 'COMPLETED',
    completed_at = NOW(),
    score = COALESCE(score, 0)
WHERE round_id IN (
    SELECT id FROM rounds WHERE name ILIKE '%apex%' OR name ILIKE '%round 5%' OR order_index = 5
)
AND status != 'COMPLETED';
*/

-- Step 3: Verify the update
SELECT 
    rs.id,
    rs.team_id,
    t.name as team_name,
    r.name as round_name,
    rs.status,
    rs.completed_at,
    rs.score
FROM round_sessions rs
JOIN teams t ON t.id = rs.team_id
JOIN rounds r ON r.id = rs.round_id
WHERE r.name ILIKE '%apex%' OR r.name ILIKE '%round 5%' OR r.order_index = 5;
