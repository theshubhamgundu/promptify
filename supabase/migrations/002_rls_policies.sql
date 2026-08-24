-- Migration 002: Row Level Security Policies

-- Enable RLS on all tables
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE hints ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE round_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hint_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user role
CREATE OR REPLACE FUNCTION auth_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT role FROM public.users WHERE id = auth.uid() LIMIT 1;
$$;

-- Helper function to get current user team (for participants)
CREATE OR REPLACE FUNCTION auth_user_team()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT team_id FROM public.participants WHERE user_id = auth.uid() LIMIT 1;
$$;


-- ==========================================
-- 1. Events (Public to read, Admin to write)
-- ==========================================
CREATE POLICY "Anyone can view live and open events"
  ON events FOR SELECT
  USING (status IN ('REGISTRATION_OPEN', 'LIVE', 'COMPLETED'));

CREATE POLICY "Admins can manage events"
  ON events FOR ALL
  USING (auth_user_role() = 'ADMIN');

-- ==========================================
-- 2. Users (Self read, Admin full)
-- ==========================================
CREATE POLICY "Users can view their own profile"
  ON users FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Admins can manage users"
  ON users FOR ALL
  USING (auth_user_role() = 'ADMIN');

-- ==========================================
-- 3. Teams (Public to read, Members/Admin to write)
-- ==========================================
CREATE POLICY "Anyone can view teams"
  ON teams FOR SELECT
  USING (true);

CREATE POLICY "Team members can view own access code"
  ON teams FOR SELECT
  USING (id = auth_user_team());

CREATE POLICY "Admins can manage teams"
  ON teams FOR ALL
  USING (auth_user_role() = 'ADMIN');

-- ==========================================
-- 4. Participants (Public to read, Admin to write)
-- ==========================================
CREATE POLICY "Anyone can view participants"
  ON participants FOR SELECT
  USING (true);

CREATE POLICY "Participants can update own profile"
  ON participants FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage participants"
  ON participants FOR ALL
  USING (auth_user_role() = 'ADMIN');

-- ==========================================
-- 5. Rounds (Read active, Admin full)
-- ==========================================
CREATE POLICY "Anyone can view active rounds"
  ON rounds FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage rounds"
  ON rounds FOR ALL
  USING (auth_user_role() = 'ADMIN');

-- ==========================================
-- 6. Challenges (Read active round challenges, Admin full)
-- ==========================================
CREATE POLICY "Anyone can view challenges for active rounds"
  ON challenges FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM rounds WHERE rounds.id = challenges.round_id AND rounds.is_active = true)
  );

CREATE POLICY "Admins can manage challenges"
  ON challenges FOR ALL
  USING (auth_user_role() = 'ADMIN');

-- ==========================================
-- 7. Hints (Read active, Admin full)
-- ==========================================
CREATE POLICY "Anyone can view hints for active rounds"
  ON hints FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM challenges
      JOIN rounds ON rounds.id = challenges.round_id
      WHERE challenges.id = hints.challenge_id AND rounds.is_active = true
    )
  );

CREATE POLICY "Admins can manage hints"
  ON hints FOR ALL
  USING (auth_user_role() = 'ADMIN');

-- ==========================================
-- 8. Team Sessions (Self/Admin/Coordinator)
-- ==========================================
CREATE POLICY "Teams can view their own session"
  ON team_sessions FOR SELECT
  USING (team_id = auth_user_team());

CREATE POLICY "Coordinators and Admins can view all sessions"
  ON team_sessions FOR SELECT
  USING (auth_user_role() IN ('COORDINATOR', 'ADMIN'));

CREATE POLICY "Admins can manage sessions"
  ON team_sessions FOR ALL
  USING (auth_user_role() = 'ADMIN');

-- ==========================================
-- 9. Round Sessions (Self read, Public read for leaderboard, Admin full)
-- ==========================================
CREATE POLICY "Anyone can view round sessions for leaderboard"
  ON round_sessions FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage round sessions"
  ON round_sessions FOR ALL
  USING (auth_user_role() = 'ADMIN');

-- ==========================================
-- 10. Submissions (Self full, Public read evaluated, Admin full)
-- ==========================================
CREATE POLICY "Teams can view their own submissions"
  ON submissions FOR SELECT
  USING (team_id = auth_user_team());

CREATE POLICY "Anyone can view evaluated submissions"
  ON submissions FOR SELECT
  USING (status = 'EVALUATED');

CREATE POLICY "Teams can insert their own submissions"
  ON submissions FOR INSERT
  WITH CHECK (team_id = auth_user_team());

CREATE POLICY "Teams can update their own drafts"
  ON submissions FOR UPDATE
  USING (team_id = auth_user_team() AND status = 'DRAFT');

CREATE POLICY "Admins can manage submissions"
  ON submissions FOR ALL
  USING (auth_user_role() = 'ADMIN');

-- ==========================================
-- 11. Hint Usage (Self read, Admin full)
-- ==========================================
CREATE POLICY "Teams can view their own hint usage"
  ON hint_usage FOR SELECT
  USING (team_id = auth_user_team());

CREATE POLICY "Admins can manage hint usage"
  ON hint_usage FOR ALL
  USING (auth_user_role() = 'ADMIN');

-- ==========================================
-- 12. Activity Logs (Admin/Coordinator only)
-- ==========================================
CREATE POLICY "Coordinators and Admins can view logs"
  ON activity_logs FOR SELECT
  USING (auth_user_role() IN ('COORDINATOR', 'ADMIN'));

CREATE POLICY "Admins can manage logs"
  ON activity_logs FOR ALL
  USING (auth_user_role() = 'ADMIN');
