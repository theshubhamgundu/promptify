-- ========================================================================
-- ONE-CLICK SETUP - Run this entire script at once
-- ========================================================================
-- This automatically creates everything and links your Team Beta Test
-- ========================================================================

DO $$
DECLARE
    v_event_id UUID;
    v_team_id UUID;
    v_round_id UUID;
BEGIN
    -- Get your team (Team Beta Test)
    SELECT id INTO v_team_id
    FROM teams
    WHERE name = 'Team Beta Test'
    LIMIT 1;
    
    IF v_team_id IS NULL THEN
        RAISE EXCEPTION 'Team "Team Beta Test" not found. Change the team name in this script.';
    END IF;
    
    RAISE NOTICE '✓ Found team: % (ID: %)', 'Team Beta Test', v_team_id;
    
    -- Create event
    INSERT INTO events (
        name,
        description,
        status,
        start_time,
        end_time
    ) VALUES (
        'Promptify Championship 2026',
        'Annual AI Prompt Engineering Competition',
        'LIVE',
        NOW(),
        NOW() + INTERVAL '7 days'
    ) RETURNING id INTO v_event_id;
    
    RAISE NOTICE '✓ Created event ID: %', v_event_id;
    
    -- Link team to event
    UPDATE teams 
    SET event_id = v_event_id
    WHERE id = v_team_id;
    
    RAISE NOTICE '✓ Linked team to event';
    
    -- Create quiz round
    INSERT INTO rounds (
        event_id,
        name,
        description,
        type,
        order_index,
        duration_minutes,
        is_active,
        scoring_config
    ) VALUES (
        v_event_id,
        'Round 1: Prompt Engineering Quiz',
        'Test your prompt engineering knowledge.',
        'QUIZ',
        1,
        30,
        true,
        '{}'::jsonb
    ) RETURNING id INTO v_round_id;
    
    RAISE NOTICE '✓ Created round ID: %', v_round_id;
    
    -- Success summary
    RAISE NOTICE '════════════════════════════════════════';
    RAISE NOTICE '✅ SUCCESS! Everything is set up';
    RAISE NOTICE '════════════════════════════════════════';
    RAISE NOTICE 'Event ID:  %', v_event_id;
    RAISE NOTICE 'Team ID:   %', v_team_id;
    RAISE NOTICE 'Round ID:  %', v_round_id;
    RAISE NOTICE '════════════════════════════════════════';
    RAISE NOTICE 'IMPORTANT: Logout and login again!';
    RAISE NOTICE 'Then go to: Rounds → Start Quiz';
    RAISE NOTICE '════════════════════════════════════════';
    
END $$;

-- Verify the setup
SELECT 
    t.name as team_name,
    e.name as event_name,
    e.status as event_status,
    r.name as round_name,
    r.type as round_type,
    r.is_active
FROM teams t
JOIN events e ON t.event_id = e.id
LEFT JOIN rounds r ON r.event_id = e.id
WHERE t.name = 'Team Beta Test'
ORDER BY r.order_index;
