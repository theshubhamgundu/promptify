-- ═════════════════════════════════════════════════════════════════════════════
-- TEST ADMIN RESET FUNCTIONS
-- ═════════════════════════════════════════════════════════════════════════════

-- ═════════════════════════════════════════════════════════════════════════════
-- STEP 1: Verify Functions Exist
-- ═════════════════════════════════════════════════════════════════════════════

SELECT 
    '=== FUNCTION STATUS ===' as section,
    proname as function_name,
    pg_get_function_arguments(oid) as parameters,
    prosecdef as has_security_definer,
    CASE 
        WHEN prosecdef THEN '✓ Can bypass RLS'
        ELSE '⚠️ Will NOT bypass RLS'
    END as security_status
FROM pg_proc
WHERE proname IN ('admin_reset_round', 'admin_reset_all_rounds')
    AND pronamespace = 'public'::regnamespace;

-- ═════════════════════════════════════════════════════════════════════════════
-- STEP 2: Check What Data Exists (Before Reset)
-- ═════════════════════════════════════════════════════════════════════════════

SELECT 
    '=== CURRENT DATA COUNTS ===' as section,
    'round_sessions' as table_name,
    COUNT(*) as count
FROM round_sessions

UNION ALL
SELECT 
    '=== CURRENT DATA COUNTS ===',
    'challenge_attempts',
    COUNT(*)
FROM challenge_attempts

UNION ALL
SELECT 
    '=== CURRENT DATA COUNTS ===',
    'quiz_answers',
    COUNT(*)
FROM quiz_answers

UNION ALL
SELECT 
    '=== CURRENT DATA COUNTS ===',
    'quiz_sessions',
    COUNT(*)
FROM quiz_sessions

UNION ALL
SELECT 
    '=== CURRENT DATA COUNTS ===',
    'score_events',
    COUNT(*)
FROM score_events;

-- ═════════════════════════════════════════════════════════════════════════════
-- STEP 3: List Teams and Rounds Available for Testing
-- ═════════════════════════════════════════════════════════════════════════════

SELECT 
    '=== TEAMS WITH ROUND SESSIONS ===' as section,
    t.id as team_id,
    t.name as team_name,
    r.id as round_id,
    r.name as round_name,
    rs.id as round_session_id,
    rs.status,
    rs.score
FROM teams t
JOIN round_sessions rs ON rs.team_id = t.id
JOIN rounds r ON r.id = rs.round_id
ORDER BY t.name, r.order_index;

-- ═════════════════════════════════════════════════════════════════════════════
-- STEP 4: Show Sample Data for One Team (Change team_id to test)
-- ═════════════════════════════════════════════════════════════════════════════

-- Change this to your actual team_id
DO $$
DECLARE
    v_team_id UUID;
    v_team_name TEXT;
BEGIN
    -- Get first team with data
    SELECT id, name INTO v_team_id, v_team_name
    FROM teams
    WHERE id IN (SELECT DISTINCT team_id FROM round_sessions)
    LIMIT 1;
    
    IF v_team_id IS NOT NULL THEN
        RAISE NOTICE 'Sample Team: % (ID: %)', v_team_name, v_team_id;
        
        -- Show what data exists for this team
        RAISE NOTICE 'Round Sessions: %', (SELECT COUNT(*) FROM round_sessions WHERE team_id = v_team_id);
        RAISE NOTICE 'Challenge Attempts: %', (SELECT COUNT(*) FROM challenge_attempts WHERE team_id = v_team_id);
        RAISE NOTICE 'Quiz Answers: %', (SELECT COUNT(*) FROM quiz_answers WHERE team_id = v_team_id);
        RAISE NOTICE 'Quiz Sessions: %', (SELECT COUNT(*) FROM quiz_sessions WHERE team_id = v_team_id);
    ELSE
        RAISE NOTICE 'No teams with round sessions found';
    END IF;
END $$;

-- ═════════════════════════════════════════════════════════════════════════════
-- INSTRUCTIONS FOR MANUAL TESTING
-- ═════════════════════════════════════════════════════════════════════════════

SELECT 
    '=== TESTING INSTRUCTIONS ===' as section,
    'To test the reset functions manually:' as step_1,
    '1. Note a team_id and round_id from the TEAMS WITH ROUND SESSIONS output above' as step_2,
    '2. Test single round reset:' as step_3,
    '   SELECT admin_reset_round(''YOUR_TEAM_ID''::uuid, ''YOUR_ROUND_ID''::uuid);' as step_4,
    '3. Or test full team reset:' as step_5,
    '   SELECT admin_reset_all_rounds(''YOUR_TEAM_ID''::uuid);' as step_6,
    '4. Check the returned JSON for success status and deleted counts' as step_7;
