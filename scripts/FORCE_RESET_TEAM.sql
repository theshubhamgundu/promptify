-- =====================================================
-- FORCE RESET: Nuclear Team Reset
-- =====================================================
-- This script FORCEFULLY deletes ALL data for a team
-- Use this when normal reset doesn't work
--
-- USAGE:
-- 1. Get team ID: SELECT id, name FROM teams;
-- 2. Replace TEAM_ID_HERE with actual UUID
-- 3. Run this script
-- =====================================================

BEGIN;

-- Replace with your team ID
DO $$
DECLARE
    v_team_id UUID := 'TEAM_ID_HERE'::uuid;  -- ⚠️ CHANGE THIS!
    v_team_name TEXT;
    v_deleted JSONB := '{}'::jsonb;
BEGIN
    -- Get team name
    SELECT name INTO v_team_name FROM teams WHERE id = v_team_id;
    
    IF v_team_name IS NULL THEN
        RAISE EXCEPTION 'Team not found! Check the team ID.';
    END IF;
    
    RAISE NOTICE '🔥 FORCE RESETTING TEAM: %', v_team_name;
    RAISE NOTICE '⚠️  Team ID: %', v_team_id;
    RAISE NOTICE '';
    
    -- Delete in correct order to avoid FK conflicts
    
    -- 1. Score events (CRITICAL - main cause of persistent scores)
    WITH deleted AS (DELETE FROM score_events WHERE team_id = v_team_id RETURNING 1)
    SELECT COUNT(*) INTO v_deleted->'score_events' FROM deleted;
    RAISE NOTICE '✅ Deleted % score_events', v_deleted->'score_events';
    
    -- 2. Quiz data
    WITH deleted AS (DELETE FROM quiz_answers WHERE team_id = v_team_id RETURNING 1)
    SELECT COUNT(*) INTO v_deleted->'quiz_answers' FROM deleted;
    RAISE NOTICE '✅ Deleted % quiz_answers', v_deleted->'quiz_answers';
    
    WITH deleted AS (DELETE FROM quiz_sessions WHERE team_id = v_team_id RETURNING 1)
    SELECT COUNT(*) INTO v_deleted->'quiz_sessions' FROM deleted;
    RAISE NOTICE '✅ Deleted % quiz_sessions', v_deleted->'quiz_sessions';
    
    -- 3. Prompt data
    WITH deleted AS (DELETE FROM prompt_submissions WHERE team_id = v_team_id RETURNING 1)
    SELECT COUNT(*) INTO v_deleted->'prompt_submissions' FROM deleted;
    RAISE NOTICE '✅ Deleted % prompt_submissions', v_deleted->'prompt_submissions';
    
    WITH deleted AS (DELETE FROM prompt_round_sessions WHERE team_id = v_team_id RETURNING 1)
    SELECT COUNT(*) INTO v_deleted->'prompt_round_sessions' FROM deleted;
    RAISE NOTICE '✅ Deleted % prompt_round_sessions', v_deleted->'prompt_round_sessions';
    
    -- 4. Submissions
    WITH deleted AS (DELETE FROM submissions WHERE team_id = v_team_id RETURNING 1)
    SELECT COUNT(*) INTO v_deleted->'submissions' FROM deleted;
    RAISE NOTICE '✅ Deleted % submissions', v_deleted->'submissions';
    
    -- 5. Vision data (if exists)
    BEGIN
        WITH deleted AS (DELETE FROM vision_submissions WHERE team_id = v_team_id RETURNING 1)
        SELECT COUNT(*) INTO v_deleted->'vision_submissions' FROM deleted;
        RAISE NOTICE '✅ Deleted % vision_submissions', v_deleted->'vision_submissions';
    EXCEPTION WHEN undefined_table THEN
        RAISE NOTICE '⚠️  vision_submissions table does not exist';
    END;
    
    -- 6. Round 4 data (if exists)
    BEGIN
        DELETE FROM turing_test_attempts WHERE team_id = v_team_id;
        DELETE FROM jailbreak_attempts WHERE team_id = v_team_id;
        DELETE FROM prompt_zipper_attempts WHERE team_id = v_team_id;
        RAISE NOTICE '✅ Deleted round 4 data';
    EXCEPTION WHEN undefined_table THEN
        RAISE NOTICE '⚠️  Round 4 tables do not exist';
    END;
    
    -- 7. Round 5 data (if exists)
    BEGIN
        DELETE FROM round5_submissions WHERE team_id = v_team_id;
        DELETE FROM round5_challenge_sessions WHERE team_id = v_team_id;
        DELETE FROM round5_score_events WHERE team_id = v_team_id;
        RAISE NOTICE '✅ Deleted round 5 data';
    EXCEPTION WHEN undefined_table THEN
        RAISE NOTICE '⚠️  Round 5 tables do not exist';
    END;
    
    -- 8. Security violations
    WITH deleted AS (DELETE FROM security_violations WHERE team_id = v_team_id RETURNING 1)
    SELECT COUNT(*) INTO v_deleted->'security_violations' FROM deleted;
    RAISE NOTICE '✅ Deleted % security_violations', v_deleted->'security_violations';
    
    -- 9. FINAL: Delete all round_sessions (will CASCADE to remaining tables)
    WITH deleted AS (DELETE FROM round_sessions WHERE team_id = v_team_id RETURNING 1)
    SELECT COUNT(*) INTO v_deleted->'round_sessions' FROM deleted;
    RAISE NOTICE '✅ Deleted % round_sessions', v_deleted->'round_sessions';
    
    -- Log the action
    INSERT INTO activity_logs (action, team_id, details)
    VALUES (
        'FORCE_RESET_SQL',
        v_team_id,
        jsonb_build_object(
            'team_name', v_team_name,
            'deleted_counts', v_deleted,
            'method', 'NUCLEAR_RESET'
        )
    );
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '🎉 FORCE RESET COMPLETE!';
    RAISE NOTICE '   Team: %', v_team_name;
    RAISE NOTICE '   All data has been deleted.';
    RAISE NOTICE '========================================';
END $$;

COMMIT;

-- Verify the reset
SELECT 
    'VERIFICATION' as check_type,
    (SELECT COUNT(*) FROM round_sessions WHERE team_id = 'TEAM_ID_HERE'::uuid) as round_sessions,
    (SELECT COUNT(*) FROM score_events WHERE team_id = 'TEAM_ID_HERE'::uuid) as score_events,
    (SELECT COUNT(*) FROM quiz_answers WHERE team_id = 'TEAM_ID_HERE'::uuid) as quiz_answers,
    (SELECT COUNT(*) FROM submissions WHERE team_id = 'TEAM_ID_HERE'::uuid) as submissions;

-- All counts should be 0 ^^
