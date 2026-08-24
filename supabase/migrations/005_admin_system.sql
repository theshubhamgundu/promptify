-- Migration 005: Admin Control Center Schema Extensions

-- =====================================================
-- ADMIN ROLES & PERMISSIONS
-- =====================================================

CREATE TYPE admin_role AS ENUM ('SUPER_ADMIN', 'EVENT_ADMIN', 'COORDINATOR', 'EVALUATOR', 'OBSERVER');

CREATE TABLE admin_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role admin_role NOT NULL DEFAULT 'OBSERVER',
    event_id UUID REFERENCES events(id) ON DELETE CASCADE, -- NULL = global role
    granted_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, role, event_id)
);

-- =====================================================
-- EXTENDED EVENT CONFIGURATION
-- =====================================================

ALTER TABLE events ADD COLUMN IF NOT EXISTS max_teams INTEGER;
ALTER TABLE events ADD COLUMN IF NOT EXISTS team_size INTEGER DEFAULT 2;
ALTER TABLE events ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Asia/Kolkata';
ALTER TABLE events ADD COLUMN IF NOT EXISTS rules TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS registration_start TIMESTAMPTZ;
ALTER TABLE events ADD COLUMN IF NOT EXISTS registration_end TIMESTAMPTZ;
ALTER TABLE events ADD COLUMN IF NOT EXISTS config JSONB NOT NULL DEFAULT '{}'::jsonb;

-- =====================================================
-- SCORE EVENTS (Immutable Ledger)
-- =====================================================

CREATE TYPE score_event_type AS ENUM (
    'BASE_SCORE', 'SPEED_BONUS', 'HINT_PENALTY', 'ATTEMPT_PENALTY',
    'QUALITY_BONUS', 'ADMIN_ADJUSTMENT', 'RECALCULATION', 'INVALIDATION'
);

CREATE TABLE score_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    round_session_id UUID REFERENCES round_sessions(id) ON DELETE SET NULL,
    challenge_id UUID REFERENCES challenges(id) ON DELETE SET NULL,
    submission_id UUID REFERENCES submissions(id) ON DELETE SET NULL,
    event_type score_event_type NOT NULL,
    points INTEGER NOT NULL,
    reason TEXT,
    admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- ANNOUNCEMENTS
-- =====================================================

CREATE TYPE announcement_scope AS ENUM ('GLOBAL', 'ROUND', 'TEAM', 'PARTICIPANT');
CREATE TYPE announcement_severity AS ENUM ('INFO', 'WARNING', 'URGENT');

CREATE TABLE announcements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    scope announcement_scope NOT NULL DEFAULT 'GLOBAL',
    scope_target_id UUID, -- round_id, team_id, or participant_id depending on scope
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    severity announcement_severity NOT NULL DEFAULT 'INFO',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    scheduled_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- VERIFICATION REQUESTS
-- =====================================================

CREATE TYPE verification_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE verification_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    status verification_status NOT NULL DEFAULT 'PENDING',
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    device_info JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- EVENT SNAPSHOTS
-- =====================================================

CREATE TABLE event_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    snapshot_type TEXT NOT NULL DEFAULT 'MANUAL', -- MANUAL, AUTO_PRE_START, AUTO_PRE_ROUND, AUTO_POST_ROUND
    snapshot_data JSONB NOT NULL, -- full serialized event state
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- CHALLENGE VERSIONS (Immutable once used)
-- =====================================================

CREATE TABLE challenge_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL DEFAULT 1,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    type challenge_type NOT NULL,
    base_points INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER,
    configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_locked BOOLEAN NOT NULL DEFAULT false, -- true once a submission references it
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(challenge_id, version_number)
);

-- =====================================================
-- SECURITY EVENTS (Severity-tagged)
-- =====================================================

CREATE TYPE security_severity AS ENUM ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

CREATE TABLE security_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    participant_id UUID REFERENCES participants(id) ON DELETE SET NULL,
    severity security_severity NOT NULL DEFAULT 'INFO',
    event_type TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    is_reviewed BOOLEAN NOT NULL DEFAULT false,
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- SUPPORT CASES
-- =====================================================

CREATE TYPE support_status AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

CREATE TABLE support_cases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    priority TEXT NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
    status support_status NOT NULL DEFAULT 'OPEN',
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    resolution TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER update_support_cases_updated_at
    BEFORE UPDATE ON support_cases
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX idx_score_events_team ON score_events(team_id);
CREATE INDEX idx_score_events_session ON score_events(round_session_id);
CREATE INDEX idx_announcements_event ON announcements(event_id);
CREATE INDEX idx_announcements_active ON announcements(is_active, event_id);
CREATE INDEX idx_verification_requests_event ON verification_requests(event_id, status);
CREATE INDEX idx_security_events_severity ON security_events(event_id, severity);
CREATE INDEX idx_security_events_team ON security_events(team_id);
CREATE INDEX idx_support_cases_event ON support_cases(event_id, status);
CREATE INDEX idx_admin_roles_user ON admin_roles(user_id);
CREATE INDEX idx_event_snapshots_event ON event_snapshots(event_id);
CREATE INDEX idx_challenge_versions_challenge ON challenge_versions(challenge_id);
