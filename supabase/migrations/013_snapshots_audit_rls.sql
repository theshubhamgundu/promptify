-- Migration 013: RLS Policies for Snapshots & Audit System

-- ═══════════════════════════════════════════════════════════════════════
-- SNAPSHOT RLS POLICIES
-- ═══════════════════════════════════════════════════════════════════════

-- Enable RLS
ALTER TABLE event_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE snapshot_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE snapshot_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE snapshot_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE snapshot_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE snapshot_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE snapshot_round_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE snapshot_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE snapshot_team_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE snapshot_quiz_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE snapshot_quiz_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE snapshot_restorations ENABLE ROW LEVEL SECURITY;

-- Admin-only access to snapshots
CREATE POLICY admin_view_snapshots ON event_snapshots
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'ADMIN'
        )
    );

CREATE POLICY admin_create_snapshots ON event_snapshots
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'ADMIN'
        )
    );

-- No updates allowed (immutable)
CREATE POLICY no_snapshot_updates ON event_snapshots
    FOR UPDATE
    USING (false);

-- Only soft delete (archival)
CREATE POLICY admin_archive_snapshots ON event_snapshots
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'ADMIN'
        )
    )
    WITH CHECK (is_archived = true); -- Only allow setting archived flag

-- Admin read access to snapshot data tables
CREATE POLICY admin_view_snapshot_events ON snapshot_events
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'ADMIN')
    );

CREATE POLICY admin_view_snapshot_teams ON snapshot_teams
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'ADMIN')
    );

CREATE POLICY admin_view_snapshot_participants ON snapshot_participants
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'ADMIN')
    );

CREATE POLICY admin_view_snapshot_rounds ON snapshot_rounds
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'ADMIN')
    );

CREATE POLICY admin_view_snapshot_challenges ON snapshot_challenges
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'ADMIN')
    );

CREATE POLICY admin_view_snapshot_round_sessions ON snapshot_round_sessions
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'ADMIN')
    );

CREATE POLICY admin_view_snapshot_submissions ON snapshot_submissions
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'ADMIN')
    );

CREATE POLICY admin_view_snapshot_team_sessions ON snapshot_team_sessions
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'ADMIN')
    );

CREATE POLICY admin_view_snapshot_quiz_sessions ON snapshot_quiz_sessions
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'ADMIN')
    );

CREATE POLICY admin_view_snapshot_quiz_answers ON snapshot_quiz_answers
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'ADMIN')
    );

-- Restoration logs (admin only)
CREATE POLICY admin_view_restorations ON snapshot_restorations
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'ADMIN')
    );

CREATE POLICY admin_create_restorations ON snapshot_restorations
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'ADMIN')
    );

-- ═══════════════════════════════════════════════════════════════════════
-- AUDIT LOG RLS POLICIES
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- Admin can view all audit logs
CREATE POLICY admin_view_audit_logs ON admin_audit_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'ADMIN'
        )
    );

-- Teams can view audit logs that affect them (limited scope)
CREATE POLICY team_view_own_audit_logs ON admin_audit_logs
    FOR SELECT
    USING (
        target_type = 'team' 
        AND target_id IN (
            SELECT t.id FROM teams t
            JOIN participants p ON p.team_id = t.id
            WHERE p.user_id = auth.uid()
        )
        AND action IN (
            'SCORE_OVERRIDE',
            'SCORE_ADJUSTMENT',
            'TIME_EXTENSION',
            'EVENT_STATUS_CHANGE',
            'ROUND_STATUS_CHANGE'
        )
    );

-- Audit logs are write-once (only inserts allowed)
CREATE POLICY system_insert_audit_logs ON admin_audit_logs
    FOR INSERT
    WITH CHECK (true); -- System function will enforce proper values

-- No updates or deletes (immutable)
CREATE POLICY no_audit_updates ON admin_audit_logs
    FOR UPDATE
    USING (false);

CREATE POLICY no_audit_deletes ON admin_audit_logs
    FOR DELETE
    USING (false);

-- ═══════════════════════════════════════════════════════════════════════
-- HELPER VIEWS FOR COMMON QUERIES
-- ═══════════════════════════════════════════════════════════════════════

-- Snapshot summary view
CREATE OR REPLACE VIEW snapshot_summary AS
SELECT 
    es.id,
    es.event_id,
    e.name AS event_name,
    es.snapshot_type,
    es.status,
    es.created_by,
    u.full_name AS created_by_name,
    es.created_at,
    es.completed_at,
    es.description,
    es.metadata,
    (es.metadata->>'team_count')::INTEGER AS team_count,
    (es.metadata->>'participant_count')::INTEGER AS participant_count,
    (es.metadata->>'submission_count')::INTEGER AS submission_count
FROM event_snapshots es
LEFT JOIN events e ON es.event_id = e.id
LEFT JOIN users u ON es.created_by = u.id
WHERE es.is_archived = false
ORDER BY es.created_at DESC;

-- Audit log with readable names
CREATE OR REPLACE VIEW audit_log_readable AS
SELECT 
    al.id,
    al.admin_id,
    u.full_name AS admin_name,
    u.email AS admin_email,
    al.action,
    al.target_type,
    al.target_id,
    al.event_id,
    e.name AS event_name,
    al.timestamp,
    al.previous_value,
    al.new_value,
    al.reason,
    al.is_system_action
FROM admin_audit_logs al
LEFT JOIN users u ON al.admin_id = u.id
LEFT JOIN events e ON al.event_id = e.id
ORDER BY al.timestamp DESC;

-- Recent restorations view
CREATE OR REPLACE VIEW recent_restorations AS
SELECT 
    sr.id,
    sr.snapshot_id,
    sr.event_id,
    e.name AS event_name,
    sr.restored_by,
    u.full_name AS restored_by_name,
    sr.restored_at,
    sr.reason,
    sr.status,
    sr.affected_teams,
    sr.affected_submissions,
    sr.pre_restore_snapshot_id
FROM snapshot_restorations sr
LEFT JOIN events e ON sr.event_id = e.id
LEFT JOIN users u ON sr.restored_by = u.id
ORDER BY sr.restored_at DESC;

COMMENT ON VIEW snapshot_summary IS 'User-friendly view of event snapshots with metadata';
COMMENT ON VIEW audit_log_readable IS 'Audit logs with human-readable admin names and event names';
COMMENT ON VIEW recent_restorations IS 'Recent snapshot restorations with context';

