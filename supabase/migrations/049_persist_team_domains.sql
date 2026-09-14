-- Assign one domain once, at team registration, and reuse it across all rounds.
ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS domain TEXT
  CHECK (domain IN ('Healthcare','Fintech','Agriculture','Education','E-commerce','Logistics'));

-- Backfill teams that predate the field in stable registration order, per event.
WITH ranked AS (
  SELECT id,
         (ARRAY['Healthcare','Fintech','Agriculture','Education','E-commerce','Logistics'])
           [1 + ((row_number() OVER (PARTITION BY event_id ORDER BY created_at, id) - 1)::INTEGER % 6)] AS assigned_domain
  FROM teams
  WHERE domain IS NULL
)
UPDATE teams t SET domain = ranked.assigned_domain FROM ranked WHERE t.id = ranked.id;

ALTER TABLE teams ALTER COLUMN domain SET NOT NULL;

CREATE OR REPLACE FUNCTION assign_team_domain_on_registration()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_existing_teams INTEGER;
  v_domains TEXT[] := ARRAY['Healthcare','Fintech','Agriculture','Education','E-commerce','Logistics'];
BEGIN
  IF NEW.domain IS NOT NULL THEN RETURN NEW; END IF;

  -- Serialise assignment within an event. This makes the count-based cycle safe
  -- even when two registrations are accepted at the same time.
  PERFORM pg_advisory_xact_lock(hashtext(COALESCE(NEW.event_id::text, 'unassigned-event')));
  SELECT COUNT(*) INTO v_existing_teams
  FROM teams
  WHERE event_id IS NOT DISTINCT FROM NEW.event_id;

  NEW.domain := v_domains[1 + (v_existing_teams % array_length(v_domains, 1))];
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS teams_assign_domain_on_registration ON teams;
CREATE TRIGGER teams_assign_domain_on_registration
  BEFORE INSERT ON teams
  FOR EACH ROW EXECUTE FUNCTION assign_team_domain_on_registration();

-- Compatibility wrapper for the initial Apex migration. It no longer selects a
-- domain per round; it only returns the domain fixed at registration.
CREATE OR REPLACE FUNCTION assign_round5_domain(p_team_id UUID, p_round_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_domain TEXT;
BEGIN
  SELECT domain INTO v_domain FROM teams WHERE id = p_team_id;
  IF v_domain IS NULL THEN RAISE EXCEPTION 'Team has no assigned domain'; END IF;
  RETURN v_domain;
END $$;
