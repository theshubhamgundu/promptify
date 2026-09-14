-- Persist Round 4 integrity locks so a browser refresh cannot restore access.
ALTER TABLE round_sessions ADD COLUMN IF NOT EXISTS security_locked BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE round_sessions ADD COLUMN IF NOT EXISTS security_lock_reason TEXT;
ALTER TABLE round_sessions ADD COLUMN IF NOT EXISTS security_locked_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION lock_round4_session(
  p_team_id UUID,
  p_round_session_id UUID,
  p_reason TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE round_sessions
  SET security_locked = true,
      security_lock_reason = p_reason,
      security_locked_at = now()
  WHERE id = p_round_session_id AND team_id = p_team_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Round session not found');
  END IF;

  INSERT INTO activity_logs(team_id, action, details)
  VALUES (p_team_id, 'ROUND4_INTEGRITY_LOCKED', jsonb_build_object('round_session_id', p_round_session_id, 'reason', p_reason));
  RETURN jsonb_build_object('success', true);
END $$;
