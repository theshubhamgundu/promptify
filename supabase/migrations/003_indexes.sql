-- Migration 003: Performance Indexes

-- Events
CREATE INDEX idx_events_status ON events(status);

-- Teams
CREATE INDEX idx_teams_event_id ON teams(event_id);
CREATE INDEX idx_teams_access_code ON teams(access_code);

-- Participants
CREATE INDEX idx_participants_team_id ON participants(team_id);
CREATE INDEX idx_participants_user_id ON participants(user_id);

-- Rounds
CREATE INDEX idx_rounds_event_id ON rounds(event_id);
CREATE INDEX idx_rounds_is_active ON rounds(is_active);

-- Challenges
CREATE INDEX idx_challenges_round_id ON challenges(round_id);

-- Hints
CREATE INDEX idx_hints_challenge_id ON hints(challenge_id);

-- Team Sessions
CREATE INDEX idx_team_sessions_team_id ON team_sessions(team_id);
CREATE INDEX idx_team_sessions_state ON team_sessions(state);

-- Round Sessions
CREATE INDEX idx_round_sessions_team_id ON round_sessions(team_id);
CREATE INDEX idx_round_sessions_round_id ON round_sessions(round_id);

-- Submissions
CREATE INDEX idx_submissions_team_id ON submissions(team_id);
CREATE INDEX idx_submissions_challenge_id ON submissions(challenge_id);
CREATE INDEX idx_submissions_round_session_id ON submissions(round_session_id);
CREATE INDEX idx_submissions_status ON submissions(status);

-- Hint Usage
CREATE INDEX idx_hint_usage_team_id ON hint_usage(team_id);
CREATE INDEX idx_hint_usage_hint_id ON hint_usage(hint_id);

-- Activity Logs
CREATE INDEX idx_activity_logs_team_id ON activity_logs(team_id);
CREATE INDEX idx_activity_logs_action ON activity_logs(action);
