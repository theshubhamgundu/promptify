-- Apex challenge sessions are unique by team/challenge. Admin resets create a
-- new round session, so safely reuse that row instead of failing with 23505.
CREATE OR REPLACE FUNCTION start_apex_challenge_session(
  p_team_id UUID,
  p_round_session_id UUID,
  p_challenge_id UUID,
  p_duration_minutes INTEGER
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_session challenge_sessions;
BEGIN
  SELECT * INTO v_session
  FROM challenge_sessions
  WHERE team_id = p_team_id AND challenge_id = p_challenge_id
  FOR UPDATE;

  IF FOUND AND v_session.round_session_id = p_round_session_id THEN
    RETURN jsonb_build_object('success', true, 'session', row_to_json(v_session));
  END IF;

  IF FOUND THEN
    UPDATE challenge_sessions
    SET round_session_id = p_round_session_id,
        started_at = now(),
        deadline_at = now() + make_interval(mins => p_duration_minutes),
        completed_at = NULL,
        status = 'IN_PROGRESS',
        total_time_seconds = NULL,
        attempts_used = 0,
        is_correct = false,
        score = 0
    WHERE id = v_session.id
    RETURNING * INTO v_session;
  ELSE
    INSERT INTO challenge_sessions(team_id, round_session_id, challenge_id, started_at, deadline_at, status)
    VALUES (p_team_id, p_round_session_id, p_challenge_id, now(),
      now() + make_interval(mins => p_duration_minutes), 'IN_PROGRESS')
    RETURNING * INTO v_session;
  END IF;

  RETURN jsonb_build_object('success', true, 'session', row_to_json(v_session));
END $$;
