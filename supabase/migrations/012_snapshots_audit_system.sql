-- Migration 012: Snapshots & Audit System
-- Complete event recovery and admin audit trail

-- ═══════════════════════════════════════════════════════════════════════
-- SNAPSHOTS SYSTEM
-- ═══════════════════════════════════════════════════════════════════════

-- Snapshot types
CREATE TYPE snapshot_type AS ENUM ('MANUAL', 'AUTO_PRE_RESTORE', 'SCHEDULED', 'PRE_CRITICAL_CHANGE');
CREATE TYPE snapshot_status AS ENUM ('CREATING', 'COMPLETED', 'FAILED', 'ARCHIVED');

-- Event snapshots metadata
CREATE TABLE event_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    snapshot_type snapshot_type NOT NULL DEFAULT 'MANUAL',
    status snapshot_status NOT NULL DEFAULT 'CREATING',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    description TEXT, -- Admin-provided reason/note
    data_checksum TEXT, -- SHA256 of snapshot data for integrity
    snapshot_size_bytes BIGINT,
    metadata JSONB DEFAULT '{}'::jsonb, -- Stats: team count, submission count, etc.
    is_archived BOOLEAN NOT NULL DEFAULT false
);

-- Snapshot data tables (immutable copies of event state)
-- Event configuration
CREATE TABLE snapshot_events (
    snapshot_id UUID NOT NULL REFERENCES event_snapshots(id) ON DELETE CASCADE,
    event_id UUID NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    status event_status NOT NULL,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    configuration JSONB DEFAULT '{}'::jsonb,
    PRIMARY KEY (snapshot_id, event_id)
);

-- Teams
CREATE TABLE snapshot_teams (
    snapshot_id UUID NOT NULL REFERENCES event_snapshots(id) ON DELETE CASCADE,
    team_id UUID NOT NULL,
    event_id UUID NOT NULL,
    name TEXT NOT NULL,
    access_code TEXT NOT NULL,
    is_frozen BOOLEAN DEFAULT false,
    frozen_reason TEXT,
    frozen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    PRIMARY KEY (snapshot_id, team_id)
);

-- Participants
CREATE TABLE snapshot_participants (
    snapshot_id UUID NOT NULL REFERENCES event_snapshots(id) ON DELETE CASCADE,
    participant_id UUID NOT NULL,
    team_id UUID NOT NULL,
    user_id UUID,
    name TEXT NOT NULL,
    role team_role NOT NULL,
    created_at TIMESTAMPTZ,
    PRIMARY KEY (snapshot_id, participant_id)
);

-- Rounds
CREATE TABLE snapshot_rounds (
    snapshot_id UUID NOT NULL REFERENCES event_snapshots(id) ON DELETE CASCADE,
    round_id UUID NOT NULL,
    event_id UUID NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    type round_type NOT NULL,
    order_index INTEGER NOT NULL,
    duration_minutes INTEGER NOT NULL,
    scoring_config JSONB NOT NULL,
    is_active BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ,
    PRIMARY KEY (snapshot_id, round_id)
);

-- Challenges
CREATE TABLE snapshot_challenges (
    snapshot_id UUID NOT NULL REFERENCES event_snapshots(id) ON DELETE CASCADE,
    challenge_id UUID NOT NULL,
    round_id UUID NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    type challenge_type NOT NULL,
    order_index INTEGER NOT NULL,
    base_points INTEGER NOT NULL,
    max_attempts INTEGER,
    configuration JSONB NOT NULL,
    created_at TIMESTAMPTZ,
    PRIMARY KEY (snapshot_id, challenge_id)
);

-- Round Sessions
CREATE TABLE snapshot_round_sessions (
    snapshot_id UUID NOT NULL REFERENCES event_snapshots(id) ON DELETE CASCADE,
    session_id UUID NOT NULL,
    team_id UUID NOT NULL,
    round_id UUID NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    score INTEGER NOT NULL,
    PRIMARY KEY (snapshot_id, session_id)
);

-- Submissions
CREATE TABLE snapshot_submissions (
    snapshot_id UUID NOT NULL REFERENCES event_snapshots(id) ON DELETE CASCADE,
    submission_id UUID NOT NULL,
    team_id UUID NOT NULL,
    challenge_id UUID NOT NULL,
    round_session_id UUID NOT NULL,
    status submission_status NOT NULL,
    content TEXT,
    attempt_number INTEGER NOT NULL,
    score INTEGER,
    evaluation_result JSONB,
    submitted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    PRIMARY KEY (snapshot_id, submission_id)
);

-- Team Sessions
CREATE TABLE snapshot_team_sessions (
    snapshot_id UUID NOT NULL REFERENCES event_snapshots(id) ON DELETE CASCADE,
    session_id UUID NOT NULL,
    team_id UUID NOT NULL,
    device_id TEXT,
    state session_state NOT NULL,
    verified_by UUID,
    verified_at TIMESTAMPTZ,
    last_heartbeat TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    PRIMARY KEY (snapshot_id, session_id)
);

-- Quiz data
CREATE TABLE snapshot_quiz_sessions (
    snapshot_id UUID NOT NULL REFERENCES event_snapshots(id) ON DELETE CASCADE,
    quiz_session_id UUID NOT NULL,
    team_id UUID NOT NULL,
    round_id UUID NOT NULL,
    round_session_id UUID NOT NULL,
    started_at TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ,
    total_score INTEGER,
    correct_answers INTEGER,
    status TEXT,
    PRIMARY KEY (snapshot_id, quiz_session_id)
);

CREATE TABLE snapshot_quiz_answers (
    snapshot_id UUID NOT NULL REFERENCES event_snapshots(id) ON DELETE CASCADE,
    answer_id UUID NOT NULL,
    team_id UUID NOT NULL,
    question_id UUID NOT NULL,
    selected_options TEXT[],
    is_correct BOOLEAN,
    points_earned INTEGER,
    answered_at TIMESTAMPTZ,
    PRIMARY KEY (snapshot_id, answer_id)
);

-- Snapshot restoration log
CREATE TABLE snapshot_restorations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    snapshot_id UUID NOT NULL REFERENCES event_snapshots(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    restored_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    restored_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reason TEXT NOT NULL, -- Admin-provided reason
    pre_restore_snapshot_id UUID REFERENCES event_snapshots(id), -- Auto-backup before restore
    status TEXT NOT NULL CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'FAILED', 'ROLLED_BACK')),
    error_message TEXT,
    affected_teams INTEGER,
    affected_submissions INTEGER,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes
CREATE INDEX idx_event_snapshots_event ON event_snapshots(event_id, created_at DESC);
CREATE INDEX idx_event_snapshots_status ON event_snapshots(status) WHERE status != 'ARCHIVED';
CREATE INDEX idx_snapshot_restorations_event ON snapshot_restorations(event_id, restored_at DESC);

-- ═══════════════════════════════════════════════════════════════════════
-- ADMIN AUDIT SYSTEM
-- ═══════════════════════════════════════════════════════════════════════

-- Audit action types
CREATE TYPE audit_action AS ENUM (
    'SCORE_OVERRIDE',
    'SCORE_ADJUSTMENT',
    'TEAM_FREEZE',
    'TEAM_UNFREEZE',
    'TIME_EXTENSION',
    'SESSION_RESET',
    'PARTICIPANT_VERIFICATION',
    'PARTICIPANT_REVOCATION',
    'EVENT_STATUS_CHANGE',
    'ROUND_STATUS_CHANGE',
    'CHALLENGE_MODIFICATION',
    'CHALLENGE_PUBLISH',
    'CHALLENGE_UNPUBLISH',
    'SNAPSHOT_CREATION',
    'SNAPSHOT_RESTORATION',
    'TEAM_DISQUALIFICATION',
    'SUBMISSION_REEVALUATION',
    'HINT_UNLOCK',
    'HINT_RESET',
    'ADMIN_ROLE_GRANT',
    'ADMIN_ROLE_REVOKE',
    'ROUND_START',
    'ROUND_END',
    'EVENT_PAUSE',
    'EVENT_RESUME',
    'MANUAL_SCORE_UPDATE'
);

-- Admin audit logs (immutable)
CREATE TABLE admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    action audit_action NOT NULL,
    target_type TEXT NOT NULL, -- 'event', 'round', 'team', 'challenge', 'participant', 'score', etc.
    target_id UUID NOT NULL,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    previous_value JSONB, -- State before change
    new_value JSONB, -- State after change
    reason TEXT, -- Admin-provided justification
    request_metadata JSONB DEFAULT '{}'::jsonb, -- IP, user agent, etc.
    is_system_action BOOLEAN DEFAULT false -- Automated vs manual
);

-- Indexes for audit queries
CREATE INDEX idx_admin_audit_logs_admin ON admin_audit_logs(admin_id, timestamp DESC);
CREATE INDEX idx_admin_audit_logs_action ON admin_audit_logs(action, timestamp DESC);
CREATE INDEX idx_admin_audit_logs_target ON admin_audit_logs(target_type, target_id, timestamp DESC);
CREATE INDEX idx_admin_audit_logs_event ON admin_audit_logs(event_id, timestamp DESC);
CREATE INDEX idx_admin_audit_logs_timestamp ON admin_audit_logs(timestamp DESC);

-- ═══════════════════════════════════════════════════════════════════════
-- SNAPSHOT FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════════

-- Create event snapshot
CREATE OR REPLACE FUNCTION create_event_snapshot(
    p_event_id UUID,
    p_created_by UUID,
    p_snapshot_type snapshot_type DEFAULT 'MANUAL',
    p_description TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_snapshot_id UUID;
    v_team_count INTEGER;
    v_submission_count INTEGER;
    v_participant_count INTEGER;
    v_metadata JSONB;
BEGIN
    -- Create snapshot record
    INSERT INTO event_snapshots (
        event_id,
        snapshot_type,
        status,
        created_by,
        description
    ) VALUES (
        p_event_id,
        p_snapshot_type,
        'CREATING',
        p_created_by,
        p_description
    ) RETURNING id INTO v_snapshot_id;

    -- Snapshot event configuration
    INSERT INTO snapshot_events (snapshot_id, event_id, name, description, status, start_time, end_time, configuration)
    SELECT v_snapshot_id, id, name, description, status, start_time, end_time, '{}'::jsonb
    FROM events WHERE id = p_event_id;

    -- Snapshot teams
    INSERT INTO snapshot_teams (snapshot_id, team_id, event_id, name, access_code, is_frozen, frozen_reason, frozen_at, created_at)
    SELECT v_snapshot_id, id, event_id, name, access_code, is_frozen, frozen_reason, frozen_at, created_at
    FROM teams WHERE event_id = p_event_id;

    SELECT COUNT(*) INTO v_team_count FROM teams WHERE event_id = p_event_id;

    -- Snapshot participants
    INSERT INTO snapshot_participants (snapshot_id, participant_id, team_id, user_id, name, role, created_at)
    SELECT v_snapshot_id, p.id, p.team_id, p.user_id, p.name, p.role, p.created_at
    FROM participants p
    JOIN teams t ON p.team_id = t.id
    WHERE t.event_id = p_event_id;

    SELECT COUNT(*) INTO v_participant_count FROM participants p
    JOIN teams t ON p.team_id = t.id WHERE t.event_id = p_event_id;

    -- Snapshot rounds
    INSERT INTO snapshot_rounds (snapshot_id, round_id, event_id, name, description, type, order_index, duration_minutes, scoring_config, is_active, created_at)
    SELECT v_snapshot_id, id, event_id, name, description, type, order_index, duration_minutes, scoring_config, is_active, created_at
    FROM rounds WHERE event_id = p_event_id;

    -- Snapshot challenges
    INSERT INTO snapshot_challenges (snapshot_id, challenge_id, round_id, title, description, type, order_index, base_points, max_attempts, configuration, created_at)
    SELECT v_snapshot_id, c.id, c.round_id, c.title, c.description, c.type, c.order_index, c.base_points, c.max_attempts, c.configuration, c.created_at
    FROM challenges c
    JOIN rounds r ON c.round_id = r.id
    WHERE r.event_id = p_event_id;

    -- Snapshot round sessions
    INSERT INTO snapshot_round_sessions (snapshot_id, session_id, team_id, round_id, started_at, completed_at, score)
    SELECT v_snapshot_id, rs.id, rs.team_id, rs.round_id, rs.started_at, rs.completed_at, rs.score
    FROM round_sessions rs
    JOIN rounds r ON rs.round_id = r.id
    WHERE r.event_id = p_event_id;

    -- Snapshot submissions
    INSERT INTO snapshot_submissions (snapshot_id, submission_id, team_id, challenge_id, round_session_id, status, content, attempt_number, score, evaluation_result, submitted_at, created_at)
    SELECT v_snapshot_id, s.id, s.team_id, s.challenge_id, s.round_session_id, s.status, s.content, s.attempt_number, s.score, s.evaluation_result, s.submitted_at, s.created_at
    FROM submissions s
    JOIN challenges c ON s.challenge_id = c.id
    JOIN rounds r ON c.round_id = r.id
    WHERE r.event_id = p_event_id;

    SELECT COUNT(*) INTO v_submission_count FROM submissions s
    JOIN challenges c ON s.challenge_id = c.id
    JOIN rounds r ON c.round_id = r.id
    WHERE r.event_id = p_event_id;

    -- Snapshot team sessions
    INSERT INTO snapshot_team_sessions (snapshot_id, session_id, team_id, device_id, state, verified_by, verified_at, last_heartbeat, created_at)
    SELECT v_snapshot_id, ts.id, ts.team_id, ts.device_id, ts.state, ts.verified_by, ts.verified_at, ts.last_heartbeat, ts.created_at
    FROM team_sessions ts
    JOIN teams t ON ts.team_id = t.id
    WHERE t.event_id = p_event_id;

    -- Snapshot quiz sessions
    INSERT INTO snapshot_quiz_sessions (snapshot_id, quiz_session_id, team_id, round_id, round_session_id, started_at, submitted_at, total_score, correct_answers, status)
    SELECT v_snapshot_id, qs.id, qs.team_id, qs.round_id, qs.round_session_id, qs.started_at, qs.submitted_at, qs.total_score, qs.correct_answers, qs.status
    FROM quiz_sessions qs
    JOIN rounds r ON qs.round_id = r.id
    WHERE r.event_id = p_event_id;

    -- Snapshot quiz answers
    INSERT INTO snapshot_quiz_answers (snapshot_id, answer_id, team_id, question_id, selected_options, is_correct, points_earned, answered_at)
    SELECT v_snapshot_id, qa.id, qa.team_id, qa.question_id, qa.selected_options, qa.is_correct, qa.points_earned, qa.answered_at
    FROM quiz_answers qa
    JOIN quiz_questions qq ON qa.question_id = qq.id
    JOIN rounds r ON qq.round_id = r.id
    WHERE r.event_id = p_event_id;

    -- Build metadata
    v_metadata := jsonb_build_object(
        'team_count', v_team_count,
        'participant_count', v_participant_count,
        'submission_count', v_submission_count,
        'snapshot_version', '1.0'
    );

    -- Mark as completed
    UPDATE event_snapshots
    SET 
        status = 'COMPLETED',
        completed_at = now(),
        metadata = v_metadata
    WHERE id = v_snapshot_id;

    RETURN v_snapshot_id;
END;
$$ LANGUAGE plpgsql;

-- Restore event from snapshot
CREATE OR REPLACE FUNCTION restore_event_from_snapshot(
    p_snapshot_id UUID,
    p_event_id UUID,
    p_restored_by UUID,
    p_reason TEXT
)
RETURNS UUID AS $$
DECLARE
    v_restoration_id UUID;
    v_pre_restore_snapshot_id UUID;
    v_affected_teams INTEGER;
    v_affected_submissions INTEGER;
BEGIN
    -- Create restoration record
    INSERT INTO snapshot_restorations (
        snapshot_id,
        event_id,
        restored_by,
        reason,
        status
    ) VALUES (
        p_snapshot_id,
        p_event_id,
        p_restored_by,
        p_reason,
        'IN_PROGRESS'
    ) RETURNING id INTO v_restoration_id;

    -- Create pre-restore backup snapshot
    v_pre_restore_snapshot_id := create_event_snapshot(
        p_event_id,
        p_restored_by,
        'AUTO_PRE_RESTORE',
        'Automatic backup before restoration of snapshot ' || p_snapshot_id::text
    );

    -- Update restoration with backup ID
    UPDATE snapshot_restorations
    SET pre_restore_snapshot_id = v_pre_restore_snapshot_id
    WHERE id = v_restoration_id;

    -- Begin transactional restore
    -- Delete current data (cascading deletes handle related records)
    DELETE FROM quiz_answers qa
    USING quiz_questions qq, rounds r
    WHERE qa.question_id = qq.id AND qq.round_id = r.id AND r.event_id = p_event_id;

    DELETE FROM quiz_sessions qs
    USING rounds r
    WHERE qs.round_id = r.id AND r.event_id = p_event_id;

    DELETE FROM submissions s
    USING challenges c, rounds r
    WHERE s.challenge_id = c.id AND c.round_id = r.id AND r.event_id = p_event_id;

    DELETE FROM round_sessions rs
    USING rounds r
    WHERE rs.round_id = r.id AND r.event_id = p_event_id;

    DELETE FROM team_sessions ts
    USING teams t
    WHERE ts.team_id = t.id AND t.event_id = p_event_id;

    DELETE FROM participants p
    USING teams t
    WHERE p.team_id = t.id AND t.event_id = p_event_id;

    DELETE FROM challenges c
    USING rounds r
    WHERE c.round_id = r.id AND r.event_id = p_event_id;

    DELETE FROM rounds WHERE event_id = p_event_id;
    DELETE FROM teams WHERE event_id = p_event_id;

    -- Restore event configuration
    UPDATE events e
    SET 
        name = se.name,
        description = se.description,
        status = se.status,
        start_time = se.start_time,
        end_time = se.end_time,
        updated_at = now()
    FROM snapshot_events se
    WHERE e.id = p_event_id AND se.snapshot_id = p_snapshot_id AND se.event_id = p_event_id;

    -- Restore teams
    INSERT INTO teams (id, event_id, name, access_code, is_frozen, frozen_reason, frozen_at, created_at)
    SELECT team_id, event_id, name, access_code, is_frozen, frozen_reason, frozen_at, created_at
    FROM snapshot_teams
    WHERE snapshot_id = p_snapshot_id;

    SELECT COUNT(*) INTO v_affected_teams FROM snapshot_teams WHERE snapshot_id = p_snapshot_id;

    -- Restore participants
    INSERT INTO participants (id, team_id, user_id, name, role, created_at)
    SELECT participant_id, team_id, user_id, name, role, created_at
    FROM snapshot_participants
    WHERE snapshot_id = p_snapshot_id;

    -- Restore rounds
    INSERT INTO rounds (id, event_id, name, description, type, order_index, duration_minutes, scoring_config, is_active, created_at)
    SELECT round_id, event_id, name, description, type, order_index, duration_minutes, scoring_config, is_active, created_at
    FROM snapshot_rounds
    WHERE snapshot_id = p_snapshot_id;

    -- Restore challenges
    INSERT INTO challenges (id, round_id, title, description, type, order_index, base_points, max_attempts, configuration, created_at)
    SELECT challenge_id, round_id, title, description, type, order_index, base_points, max_attempts, configuration, created_at
    FROM snapshot_challenges
    WHERE snapshot_id = p_snapshot_id;

    -- Restore round sessions
    INSERT INTO round_sessions (id, team_id, round_id, started_at, completed_at, score)
    SELECT session_id, team_id, round_id, started_at, completed_at, score
    FROM snapshot_round_sessions
    WHERE snapshot_id = p_snapshot_id;

    -- Restore submissions
    INSERT INTO submissions (id, team_id, challenge_id, round_session_id, status, content, attempt_number, score, evaluation_result, submitted_at, created_at)
    SELECT submission_id, team_id, challenge_id, round_session_id, status, content, attempt_number, score, evaluation_result, submitted_at, created_at
    FROM snapshot_submissions
    WHERE snapshot_id = p_snapshot_id;

    SELECT COUNT(*) INTO v_affected_submissions FROM snapshot_submissions WHERE snapshot_id = p_snapshot_id;

    -- Restore team sessions
    INSERT INTO team_sessions (id, team_id, device_id, state, verified_by, verified_at, last_heartbeat, created_at)
    SELECT session_id, team_id, device_id, state, verified_by, verified_at, last_heartbeat, created_at
    FROM snapshot_team_sessions
    WHERE snapshot_id = p_snapshot_id;

    -- Restore quiz sessions
    INSERT INTO quiz_sessions (id, team_id, round_id, round_session_id, started_at, submitted_at, total_score, correct_answers, status)
    SELECT quiz_session_id, team_id, round_id, round_session_id, started_at, submitted_at, total_score, correct_answers, status
    FROM snapshot_quiz_sessions
    WHERE snapshot_id = p_snapshot_id;

    -- Restore quiz answers
    INSERT INTO quiz_answers (id, team_id, question_id, selected_options, is_correct, points_earned, answered_at)
    SELECT answer_id, team_id, question_id, selected_options, is_correct, points_earned, answered_at
    FROM snapshot_quiz_answers
    WHERE snapshot_id = p_snapshot_id;

    -- Mark restoration as completed
    UPDATE snapshot_restorations
    SET 
        status = 'COMPLETED',
        affected_teams = v_affected_teams,
        affected_submissions = v_affected_submissions,
        metadata = jsonb_build_object(
            'completed_at', now(),
            'pre_restore_snapshot_id', v_pre_restore_snapshot_id
        )
    WHERE id = v_restoration_id;

    RETURN v_restoration_id;
EXCEPTION
    WHEN OTHERS THEN
        -- Mark restoration as failed
        UPDATE snapshot_restorations
        SET 
            status = 'FAILED',
            error_message = SQLERRM
        WHERE id = v_restoration_id;
        
        RAISE;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════════════
-- AUDIT FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════════

-- Log admin action
CREATE OR REPLACE FUNCTION log_admin_action(
    p_admin_id UUID,
    p_action audit_action,
    p_target_type TEXT,
    p_target_id UUID,
    p_event_id UUID,
    p_previous_value JSONB DEFAULT NULL,
    p_new_value JSONB DEFAULT NULL,
    p_reason TEXT DEFAULT NULL,
    p_request_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
    v_audit_id UUID;
BEGIN
    INSERT INTO admin_audit_logs (
        admin_id,
        action,
        target_type,
        target_id,
        event_id,
        previous_value,
        new_value,
        reason,
        request_metadata
    ) VALUES (
        p_admin_id,
        p_action,
        p_target_type,
        p_target_id,
        p_event_id,
        p_previous_value,
        p_new_value,
        p_reason,
        p_request_metadata
    ) RETURNING id INTO v_audit_id;

    RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE event_snapshots IS 'Event snapshot metadata for recovery and audit';
COMMENT ON TABLE admin_audit_logs IS 'Immutable audit trail of all admin actions';
COMMENT ON FUNCTION create_event_snapshot IS 'Creates complete immutable snapshot of event state';
COMMENT ON FUNCTION restore_event_from_snapshot IS 'Restores event from snapshot with pre-restore backup';
COMMENT ON FUNCTION log_admin_action IS 'Creates immutable audit log entry for admin actions';

