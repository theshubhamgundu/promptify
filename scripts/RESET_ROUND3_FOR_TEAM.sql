-- ════════════════════════════════════════════════════════════════
-- RESET ROUND 3 (STAGE 3: VERTEX) FOR A SPECIFIC TEAM
-- ════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_team_id UUID := 'adb9fcee-fe7b-44e8-a6b8-6420f1bceda7'; -- Replace with your team ID
  v_round_id UUID;
  v_round_session_id UUID;
BEGIN
  -- Get Round 3 ID
  SELECT id INTO v_round_id FROM rounds WHERE name = 'Stage 3: Vertex' LIMIT 1;
  
  IF v_round_id IS NULL THEN
    RAISE EXCEPTION 'Stage 3: Vertex not found';
  END IF;

  -- Get round session ID
  SELECT id INTO v_round_session_id 
  FROM round_sessions 
  WHERE team_id = v_team_id AND round_id = v_round_id
  LIMIT 1;

  IF v_round_session_id IS NOT NULL THEN
    -- Delete challenge sessions
    DELETE FROM challenge_sessions 
    WHERE team_id = v_team_id 
      AND round_session_id = v_round_session_id;
    
    RAISE NOTICE 'Deleted challenge sessions';

    -- Delete round session
    DELETE FROM round_sessions 
    WHERE id = v_round_session_id;
    
    RAISE NOTICE 'Deleted round session';
  END IF;

  RAISE NOTICE 'Round 3 reset successfully for team %', v_team_id;
END $$;
