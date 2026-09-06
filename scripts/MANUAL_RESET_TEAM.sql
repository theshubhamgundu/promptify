-- ═════════════════════════════════════════════════════════════════════════════
-- MANUAL RESET TEAM - Emergency Fix
-- ═════════════════════════════════════════════════════════════════════════════
-- Use this if the admin_reset_all_rounds function isn't working properly
-- Replace 'adb9fcee-fe7b-44e8-a6b8-6420f1bceda7' with your team ID
-- ═════════════════════════════════════════════════════════════════════════════

-- IMPORTANT: Run CHECK_RESET_STATUS.sql first to see what data exists!

-- SIMPLE VERSION - Just delete what exists in your database
DO $$
DECLARE
    v_team_id UUID := 'adb9fcee-fe7b-44e8-a6b8-6420f1bceda7';
    v_count INT;
BEGIN
    RAISE NOTICE 'STARTING MANUAL RESET FOR TEAM: %', v_team_id;

    -- Delete only tables that exist
    BEGIN
        DELETE FROM challenge_attempts WHERE team_id = v_team_id;
        GET DIAGNOSTICS v_count = ROW_COUNT;
        RAISE NOTICE 'Deleted % challenge_attempts', v_count;
    EXCEPTION WHEN undefined_table THEN
        RAISE NOTICE 'Table challenge_attempts does not exist, skipping';
    END;

    BEGIN
        DELETE FROM quiz_answers WHERE team_id = v_team_id;
        GET DIAGNOSTICS v_count = ROW_COUNT;
        RAISE NOTICE 'Deleted % quiz_answers', v_count;
    EXCEPTION WHEN undefined_table THEN
        RAISE NOTICE 'Table quiz_answers does not exist, skipping';
    END;

    BEGIN
        DELETE FROM quiz_sessions WHERE team_id = v_team_id;
        GET DIAGNOSTICS v_count = ROW_COUNT;
        RAISE NOTICE 'Deleted % quiz_sessions', v_count;
    EXCEPTION WHEN undefined_table THEN
        RAISE NOTICE 'Table quiz_sessions does not exist, skipping';
    END;

    BEGIN
        DELETE FROM score_events WHERE team_id = v_team_id;
        GET DIAGNOSTICS v_count = ROW_COUNT;
        RAISE NOTICE 'Deleted % score_events', v_count;
    EXCEPTION WHEN undefined_table THEN
        RAISE NOTICE 'Table score_events does not exist, skipping';
    END;

    BEGIN
        DELETE FROM submissions WHERE team_id = v_team_id;
        GET DIAGNOSTICS v_count = ROW_COUNT;
        RAISE NOTICE 'Deleted % submissions', v_count;
    EXCEPTION WHEN undefined_table THEN
        RAISE NOTICE 'Table submissions does not exist, skipping';
    END;

    BEGIN
        DELETE FROM security_violations WHERE team_id = v_team_id;
        GET DIAGNOSTICS v_count = ROW_COUNT;
        RAISE NOTICE 'Deleted % security_violations', v_count;
    EXCEPTION WHEN undefined_table THEN
        RAISE NOTICE 'Table security_violations does not exist, skipping';
    END;

    BEGIN
        DELETE FROM byok_usage WHERE team_id = v_team_id;
        GET DIAGNOSTICS v_count = ROW_COUNT;
        RAISE NOTICE 'Deleted % byok_usage', v_count;
    EXCEPTION WHEN undefined_table THEN
        RAISE NOTICE 'Table byok_usage does not exist, skipping';
    END;

    BEGIN
        DELETE FROM interaction_logs WHERE team_id = v_team_id;
        GET DIAGNOSTICS v_count = ROW_COUNT;
        RAISE NOTICE 'Deleted % interaction_logs', v_count;
    EXCEPTION WHEN undefined_table THEN
        RAISE NOTICE 'Table interaction_logs does not exist, skipping';
    END;

    -- THE CRITICAL ONE - Delete round_sessions
    DELETE FROM round_sessions WHERE team_id = v_team_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % round_sessions ***CRITICAL***', v_count;

    RAISE NOTICE 'MANUAL RESET COMPLETED!';
END $$;

-- Verify
SELECT 
    'VERIFICATION' as check,
    (SELECT COUNT(*) FROM round_sessions WHERE team_id = 'adb9fcee-fe7b-44e8-a6b8-6420f1bceda7') as round_sessions_remaining;
