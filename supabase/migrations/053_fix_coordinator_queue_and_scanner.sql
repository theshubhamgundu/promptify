-- Hotfix for PostgreSQL's PL/pgSQL output-column ambiguity in the coordinator
-- queue function. Apply after migration 051 if it has already been deployed.
CREATE OR REPLACE FUNCTION get_coordinator_verification_queue(p_event_id UUID)
RETURNS TABLE (
  id UUID, team_id UUID, team_name TEXT, team_code TEXT, status verification_status,
  created_at TIMESTAMPTZ, reviewed_at TIMESTAMPTZ, rejection_reason TEXT,
  members JSONB
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('ADMIN', 'COORDINATOR')) THEN
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
