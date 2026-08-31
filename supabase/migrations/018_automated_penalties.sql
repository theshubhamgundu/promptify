-- 1. Add is_frozen flag to teams
ALTER TABLE teams ADD COLUMN IF NOT EXISTS is_frozen BOOLEAN DEFAULT false;

-- 2. Create security_violations table
CREATE TABLE IF NOT EXISTS security_violations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    round_session_id UUID REFERENCES round_sessions(id) ON DELETE SET NULL,
    violation_type TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE security_violations ENABLE ROW LEVEL SECURITY;
CREATE POLICY security_violations_select ON security_violations
  FOR SELECT TO authenticated
  USING (
    team_id IN (
      SELECT team_id FROM participants WHERE user_id = auth.uid()
    ) OR 
    auth.uid() IN (SELECT id FROM users WHERE role = 'ADMIN')
  );

CREATE POLICY security_violations_insert ON security_violations
  FOR INSERT TO authenticated
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM participants WHERE user_id = auth.uid()
    )
  );

-- 3. Trigger for Automated Penalties
CREATE OR REPLACE FUNCTION process_security_violation()
RETURNS TRIGGER AS $$
DECLARE
    v_violation_count INTEGER;
BEGIN
    -- Freeze team instantly on unauthorized extension
    IF NEW.violation_type = 'UNAUTHORIZED_EXTENSION' THEN
        UPDATE teams SET is_frozen = true WHERE id = NEW.team_id;
    END IF;
    
    -- Freeze team if they tab switch 3 times in a single round session
    IF NEW.violation_type = 'TAB_SWITCH' AND NEW.round_session_id IS NOT NULL THEN
        SELECT count(*) INTO v_violation_count 
        FROM security_violations 
        WHERE team_id = NEW.team_id AND round_session_id = NEW.round_session_id AND violation_type = 'TAB_SWITCH';
        
        IF v_violation_count >= 2 THEN -- This is the 3rd one since the trigger runs AFTER INSERT
            UPDATE teams SET is_frozen = true WHERE id = NEW.team_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_enforce_security_penalties ON security_violations;
CREATE TRIGGER trg_enforce_security_penalties
AFTER INSERT ON security_violations
FOR EACH ROW
EXECUTE FUNCTION process_security_violation();
