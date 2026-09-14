-- Server-authoritative coordinator decisions. The browser must never be able
-- to approve a team by directly updating verification or session records.

CREATE UNIQUE INDEX IF NOT EXISTS team_sessions_one_per_team ON team_sessions(team_id);

CREATE OR REPLACE FUNCTION review_verification_request(
  p_request_id UUID,
  p_approved BOOLEAN,
  p_rejection_reason TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request verification_requests;
  v_reviewer UUID := auth.uid();
  v_is_allowed BOOLEAN;
BEGIN
  IF v_reviewer IS NULL THEN RAISE EXCEPTION 'Authentication is required'; END IF;
  SELECT * INTO v_request FROM verification_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Verification request not found'; END IF;
  IF v_request.status <> 'PENDING' THEN RAISE EXCEPTION 'This verification request has already been reviewed'; END IF;
  IF NOT p_approved AND coalesce(trim(p_rejection_reason), '') = '' THEN RAISE EXCEPTION 'A rejection reason is required'; END IF;

  SELECT EXISTS (SELECT 1 FROM users WHERE id = v_reviewer AND role IN ('ADMIN', 'COORDINATOR')) INTO v_is_allowed;
  IF NOT v_is_allowed THEN RAISE EXCEPTION 'Only an authorised coordinator can review a team'; END IF;

  UPDATE verification_requests
  SET status = CASE WHEN p_approved THEN 'APPROVED'::verification_status ELSE 'REJECTED'::verification_status END,
      reviewed_by = v_reviewer, reviewed_at = now(),
      rejection_reason = CASE WHEN p_approved THEN NULL ELSE trim(p_rejection_reason) END
  WHERE id = v_request.id;

  IF p_approved THEN
    INSERT INTO team_sessions(team_id, state, verified_by, verified_at, last_heartbeat)
    VALUES (v_request.team_id, 'VERIFIED', v_reviewer, now(), now())
    ON CONFLICT (team_id) DO UPDATE SET state = 'VERIFIED', verified_by = EXCLUDED.verified_by,
      verified_at = EXCLUDED.verified_at, last_heartbeat = EXCLUDED.last_heartbeat;
  END IF;

  INSERT INTO activity_logs(team_id, action, details)
  VALUES (v_request.team_id, CASE WHEN p_approved THEN 'VERIFICATION_APPROVED' ELSE 'VERIFICATION_REJECTED' END,
    jsonb_build_object('request_id', v_request.id, 'reviewer_id', v_reviewer,
      'reason', CASE WHEN p_approved THEN NULL ELSE trim(p_rejection_reason) END));
  RETURN jsonb_build_object('success', true, 'status', CASE WHEN p_approved THEN 'APPROVED' ELSE 'REJECTED' END);
END;
$$;

REVOKE ALL ON FUNCTION review_verification_request(UUID, BOOLEAN, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION review_verification_request(UUID, BOOLEAN, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION get_coordinator_verification_queue(p_event_id UUID)
RETURNS TABLE (
  id UUID, team_id UUID, team_name TEXT, team_code TEXT, status verification_status,
  created_at TIMESTAMPTZ, reviewed_at TIMESTAMPTZ, rejection_reason TEXT,
  members JSONB
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('ADMIN', 'COORDINATOR')) THEN
    RAISE EXCEPTION 'Only coordinators may access the verification queue';
  END IF;
  RETURN QUERY
  SELECT vr.id, vr.team_id, t.name, t.access_code, vr.status, vr.created_at,
    vr.reviewed_at, vr.rejection_reason,
    coalesce(jsonb_agg(jsonb_build_object('name', tm.full_name, 'email', tm.email, 'rollNumber', tm.roll_number)
      ORDER BY tm.member_number) FILTER (WHERE tm.id IS NOT NULL), '[]'::jsonb)
  FROM verification_requests vr
  JOIN teams t ON t.id = vr.team_id
  LEFT JOIN team_members tm ON tm.team_id = t.id
  WHERE vr.event_id = p_event_id
  GROUP BY vr.id, t.id
  ORDER BY CASE WHEN vr.status = 'PENDING' THEN 0 ELSE 1 END, vr.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION get_coordinator_verification_queue(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_coordinator_verification_queue(UUID) TO authenticated;

-- A team can enter the coordinator queue only after a participant has logged
-- in. Repeated requests are idempotent; a rejected team can submit again.
CREATE OR REPLACE FUNCTION request_team_verification(p_device_info JSONB DEFAULT '{}'::jsonb)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_team_id UUID;
  v_event_id UUID;
  v_request_id UUID;
BEGIN
  SELECT p.team_id INTO v_team_id FROM participants p WHERE p.user_id = auth.uid() LIMIT 1;
  IF v_team_id IS NULL THEN RAISE EXCEPTION 'Participant team context not found'; END IF;
  SELECT event_id INTO v_event_id FROM teams WHERE id = v_team_id;
  IF v_event_id IS NULL THEN RAISE EXCEPTION 'Team is not assigned to an event'; END IF;

  SELECT id INTO v_request_id FROM verification_requests
  WHERE team_id = v_team_id AND status = 'PENDING' LIMIT 1;
  IF v_request_id IS NULL THEN
    INSERT INTO verification_requests(team_id, event_id, status, device_info)
    VALUES (v_team_id, v_event_id, 'PENDING', coalesce(p_device_info, '{}'::jsonb))
    RETURNING id INTO v_request_id;
  END IF;
  INSERT INTO team_sessions(team_id, state, last_heartbeat)
  VALUES (v_team_id, 'VERIFICATION_PENDING', now())
  ON CONFLICT (team_id) DO UPDATE SET state = CASE WHEN team_sessions.state = 'VERIFIED' THEN 'VERIFIED'::session_state ELSE 'VERIFICATION_PENDING'::session_state END,
    last_heartbeat = EXCLUDED.last_heartbeat;
  RETURN jsonb_build_object('success', true, 'request_id', v_request_id);
END;
$$;

REVOKE ALL ON FUNCTION request_team_verification(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION request_team_verification(JSONB) TO authenticated;
