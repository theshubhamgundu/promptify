-- Migration 055: Abandon round session on Exit
-- When a team clicks "Exit" mid-round, the round session is marked as ABANDONED
-- and is_locked = true so they cannot re-enter.
-- The status column is TEXT so 'ABANDONED' needs no enum change.
-- is_locked column already exists from earlier migrations.

-- Ensure end_time column exists (some older migrations may not have it)
ALTER TABLE round_sessions ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ;

-- RPC: abandon_round_session
-- Sets status = 'ABANDONED', is_locked = true, end_time = now()
-- Called from the client when a team clicks Exit mid-round.
CREATE OR REPLACE FUNCTION abandon_round_session(
  p_team_id UUID,
  p_round_id UUID
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_session_id UUID;
BEGIN
  UPDATE round_sessions
  SET
    status    = 'ABANDONED',
    is_locked = true,
    end_time  = now()
  WHERE team_id = p_team_id
    AND round_id = p_round_id
    AND status NOT IN ('COMPLETED', 'ABANDONED')
  RETURNING id INTO v_session_id;

  IF v_session_id IS NULL THEN
    RETURN jsonb_build_object('success', true, 'note', 'No active session to abandon');
  END IF;

  INSERT INTO activity_logs(team_id, action, details)
  VALUES (
    p_team_id,
    'ROUND_ABANDONED',
    jsonb_build_object(
      'round_session_id', v_session_id,
      'round_id', p_round_id
    )
  );

  RETURN jsonb_build_object('success', true, 'session_id', v_session_id);
END $$;

-- Grant execute to authenticated users so the client RPC call works
GRANT EXECUTE ON FUNCTION abandon_round_session(UUID, UUID) TO authenticated;
