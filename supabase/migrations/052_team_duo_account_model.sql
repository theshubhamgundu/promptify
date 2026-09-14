-- One authentication account controls one team workspace. The two people in a
-- duo remain separate registration records in team_members and are never
-- given separate competition credentials.

CREATE UNIQUE INDEX IF NOT EXISTS participants_one_login_per_team
  ON participants(team_id)
  WHERE user_id IS NOT NULL;

COMMENT ON TABLE team_members IS
  'The two registered people in a team. Display these records in the shared team dashboard.';

COMMENT ON TABLE participants IS
  'Authorization link for the one shared team login. Do not create one login per duo member.';
