    -- =====================================================
    -- COMPLETE FIX - Run this to fix everything RIGHT NOW
    -- =====================================================
    -- This single script will:
    -- 1. Show you which team has issues
    -- 2. Delete all their round data
    -- 3. Verify it's clean
    -- =====================================================

    -- STEP 1: Find teams with rounds (check which one is yours)
    SELECT 
        '🔍 TEAMS WITH ROUNDS' as info,
        t.id,
        t.name,
        t.access_code,
        COUNT(rs.id) as round_count,
        SUM(rs.score) as total_score
    FROM teams t
    LEFT JOIN round_sessions rs ON t.id = rs.team_id
    GROUP BY t.id, t.name, t.access_code
    HAVING COUNT(rs.id) > 0
    ORDER BY total_score DESC;

    -- STEP 2: NUCLEAR DELETE - Choose ONE team and replace ID below
    -- ⚠️ THIS WILL DELETE EVERYTHING FOR THIS TEAM ⚠️

    DO $$
    DECLARE
        v_team_id UUID := '00000000-0000-0000-0000-000000000000'::uuid;  -- ⚠️ CHANGE THIS!
        v_team_name TEXT;
        v_score_before INT;
        v_rounds_before INT;
    BEGIN
        -- Validate team exists
        SELECT name INTO v_team_name FROM teams WHERE id = v_team_id;
        
        IF v_team_name IS NULL THEN
            RAISE EXCEPTION '❌ Team ID not found! Please update v_team_id in the script.';
        END IF;
        
        -- Get counts before
        SELECT COUNT(*), COALESCE(SUM(score), 0) 
        INTO v_rounds_before, v_score_before
        FROM round_sessions 
        WHERE team_id = v_team_id;
        
        IF v_rounds_before = 0 THEN
            RAISE NOTICE '✅ Team "%" already has no rounds!', v_team_name;
            RETURN;
        END IF;
        
        RAISE NOTICE '';
        RAISE NOTICE '🔥 DELETING ALL DATA FOR: %', v_team_name;
        RAISE NOTICE '   Rounds: %', v_rounds_before;
        RAISE NOTICE '   Score: %', v_score_before;
        RAISE NOTICE '';
        
        -- DELETE IN CORRECT ORDER
        
        -- 1. Score events (main culprit)
        DELETE FROM score_events WHERE team_id = v_team_id;
        RAISE NOTICE '✅ Deleted score_events';
        
        -- 2. Quiz data
        DELETE FROM quiz_answers WHERE team_id = v_team_id;
        RAISE NOTICE '✅ Deleted quiz_answers';
        
        DELETE FROM quiz_sessions WHERE team_id = v_team_id;
        RAISE NOTICE '✅ Deleted quiz_sessions';
        
        -- 3. Prompt data
        DELETE FROM prompt_submissions WHERE team_id = v_team_id;
        RAISE NOTICE '✅ Deleted prompt_submissions';
        
        DELETE FROM prompt_round_sessions WHERE team_id = v_team_id;
        RAISE NOTICE '✅ Deleted prompt_round_sessions';
        
        -- 4. General submissions
        DELETE FROM submissions WHERE team_id = v_team_id;
        RAISE NOTICE '✅ Deleted submissions';
        
        -- 5. FINAL - Delete round_sessions (will CASCADE remaining)
        DELETE FROM round_sessions WHERE team_id = v_team_id;
        RAISE NOTICE '✅ Deleted round_sessions';
        
        -- Log it
        INSERT INTO activity_logs (action, team_id, details)
        VALUES (
            'COMPLETE_RESET_SQL',
            v_team_id,
            jsonb_build_object(
                'team_name', v_team_name,
                'rounds_deleted', v_rounds_before,
                'score_removed', v_score_before,
                'method', 'COMPLETE_FIX_SCRIPT'
            )
        );
        
        RAISE NOTICE '';
        RAISE NOTICE '========================================';
        RAISE NOTICE '🎉 COMPLETE! ALL DATA DELETED';
        RAISE NOTICE '   Team: %', v_team_name;
        RAISE NOTICE '   Removed % rounds', v_rounds_before;
        RAISE NOTICE '   Removed % points', v_score_before;
        RAISE NOTICE '========================================';
        RAISE NOTICE '';
        RAISE NOTICE '✅ Refresh admin UI - rounds should be gone!';
        RAISE NOTICE '✅ Team can now re-attempt from scratch!';
        
    END $$;

    -- STEP 3: VERIFY (replace team ID)
    SELECT 
        '✅ VERIFICATION' as check_type,
        COALESCE((SELECT COUNT(*) FROM round_sessions WHERE team_id = '00000000-0000-0000-0000-000000000000'::uuid), 0) as round_sessions,
        COALESCE((SELECT SUM(score) FROM round_sessions WHERE team_id = '00000000-0000-0000-0000-000000000000'::uuid), 0) as total_score,
        COALESCE((SELECT COUNT(*) FROM quiz_answers WHERE team_id = '00000000-0000-0000-0000-000000000000'::uuid), 0) as quiz_answers;
    -- All should be 0!
