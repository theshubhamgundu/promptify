-- Migration 001: Core Platform Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enum types
CREATE TYPE event_status AS ENUM ('DRAFT', 'REGISTRATION_OPEN', 'LIVE', 'PAUSED', 'COMPLETED');
CREATE TYPE round_type AS ENUM ('QUIZ', 'PROMPT', 'ESCAPE_ROOM', 'AI_BATTLE', 'AI_GRANDMASTER');
CREATE TYPE challenge_type AS ENUM ('MULTIPLE_CHOICE', 'TEXT_INPUT', 'CODE_INPUT', 'FILE_UPLOAD', 'AI_PROMPT');
CREATE TYPE team_role AS ENUM ('MEMBER', 'CAPTAIN');
CREATE TYPE session_state AS ENUM ('CREATED', 'LOGIN_PENDING', 'VERIFICATION_PENDING', 'VERIFIED', 'ACTIVE', 'COMPLETED', 'SUSPENDED');
CREATE TYPE evaluation_status AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');
CREATE TYPE submission_status AS ENUM ('DRAFT', 'TESTING', 'READY', 'SUBMITTED', 'EVALUATING', 'EVALUATED', 'ERROR');

-- Events
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    status event_status NOT NULL DEFAULT 'DRAFT',
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Users (Extends auth.users, for Admins/Coordinators/Participants if needed)
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'PARTICIPANT' CHECK (role IN ('ADMIN', 'COORDINATOR', 'PARTICIPANT')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Teams
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    access_code TEXT UNIQUE NOT NULL, -- For team login
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Participants (Team members)
CREATE TABLE participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- Optional if auth.users is used for participants
    name TEXT NOT NULL,
    role team_role NOT NULL DEFAULT 'MEMBER',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Rounds
CREATE TABLE rounds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    type round_type NOT NULL,
    order_index INTEGER NOT NULL,
    duration_minutes INTEGER NOT NULL,
    scoring_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Challenges (Questions/Puzzles in a Round)
CREATE TABLE challenges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    round_id UUID REFERENCES rounds(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    type challenge_type NOT NULL,
    order_index INTEGER NOT NULL,
    base_points INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER,
    configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Hints
CREATE TABLE hints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    point_cost INTEGER NOT NULL DEFAULT 0,
    order_index INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Team Sessions (One per team, tracking active device and verification)
CREATE TABLE team_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    device_id TEXT, -- Device fingerprint
    state session_state NOT NULL DEFAULT 'CREATED',
    verified_by UUID REFERENCES users(id), -- Coordinator who verified
    verified_at TIMESTAMPTZ,
    last_heartbeat TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Round Sessions (Tracking a team's progress in a round)
CREATE TABLE round_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    round_id UUID REFERENCES rounds(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    score INTEGER NOT NULL DEFAULT 0,
    UNIQUE(team_id, round_id)
);

-- Submissions
CREATE TABLE submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE,
    round_session_id UUID REFERENCES round_sessions(id) ON DELETE CASCADE,
    status submission_status NOT NULL DEFAULT 'DRAFT',
    content TEXT, -- Markdown, Code, JSON, etc
    attempt_number INTEGER NOT NULL DEFAULT 1,
    score INTEGER,
    evaluation_result JSONB,
    submitted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Hint Usage
CREATE TABLE hint_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    hint_id UUID REFERENCES hints(id) ON DELETE CASCADE,
    used_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(team_id, hint_id)
);

-- Activity Logs (Immutable audit trail)
CREATE TABLE activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- Admin/Coordinator
    action TEXT NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_submissions_updated_at BEFORE UPDATE ON submissions FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
