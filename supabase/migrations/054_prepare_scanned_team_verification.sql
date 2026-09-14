-- A coordinator scan is itself a verification check-in. This lets staff scan
-- a registered team even if the shared team login has not yet opened its
-- waiting screen.
CREATE OR REPLACE FUNCTION prepare_scanned_team_verification(
  p_event_id UUID,
  p_team_code TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_team teams;
  v_request_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('ADMIN', 'COORDINATOR')) THEN
    RAISE EXCEPTION 'Only coordinators may scan teams';
  END IF;

  SELECT * INTO v_team FROM teams t
  WHERE t.event_id = p_event_id AND upper(t.access_code) = upper(trim(p_team_code))
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No team exists with code %', upper(trim(p_team_code)); END IF;

  SELECT vr.id INTO v_request_id FROM verification_requests vr
  WHERE vr.team_id = v_team.id AND vr.status = 'PENDING'
  ORDER BY vr.created_at DESC LIMIT 1;

  IF v_request_id IS NULL THEN
    INSERT INTO verification_requests(team_id, event_id, status, device_info)
    VALUES (v_team.id, p_event_id, 'PENDING', jsonb_build_object('source', 'COORDINATOR_QR_SCAN', 'scanned_at', now()))
    RETURNING id INTO v_request_id;
  END IF;

  INSERT INTO activity_logs(team_id, action, details)
  VALUES (v_team.id, 'TEAM_QR_SCANNED', jsonb_build_object('request_id', v_request_id, 'scanned_by', auth.uid()));

  RETURN jsonb_build_object('success', true, 'team_id', v_team.id, 'team_code', v_team.access_code, 'request_id', v_request_id);
END;
$$;

REVOKE ALL ON FUNCTION prepare_scanned_team_verification(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION prepare_scanned_team_verification(UUID, TEXT) TO authenticated;
