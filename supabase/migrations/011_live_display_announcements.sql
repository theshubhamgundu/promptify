-- ============================================================================
-- Migration 011: Public Live Display & Announcement System Enhancements
-- ============================================================================

-- 1. Extend announcements table with pinned, priority, updated_at
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('NORMAL', 'IMPORTANT', 'URGENT'));
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Trigger for announcements updated_at
CREATE OR REPLACE FUNCTION update_announcements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trigger_update_announcements_updated_at ON announcements;
CREATE TRIGGER trigger_update_announcements_updated_at
    BEFORE UPDATE ON announcements
    FOR EACH ROW EXECUTE PROCEDURE update_announcements_updated_at();

-- 2. Extend teams & participants with college and department for leaderboard
ALTER TABLE teams ADD COLUMN IF NOT EXISTS college TEXT;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS department TEXT;

ALTER TABLE participants ADD COLUMN IF NOT EXISTS college TEXT;
ALTER TABLE participants ADD COLUMN IF NOT EXISTS department TEXT;

-- 3. Public Display Read Policies (Unauthenticated access for digital boards & projectors)
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active announcements" ON announcements;
CREATE POLICY "Public can view active announcements"
    ON announcements FOR SELECT
    USING (is_active = true);

DROP POLICY IF EXISTS "Admins have full access to announcements" ON announcements;
CREATE POLICY "Admins have full access to announcements"
    ON announcements FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role IN ('ADMIN', 'COORDINATOR')
        )
    );

-- 4. Enable Supabase Realtime Replication for instant push updates
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'announcements'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE announcements;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'round_sessions'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE round_sessions;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'score_events'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE score_events;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'teams'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE teams;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        NULL; -- Handle gracefully in environments where publication configuration is restricted
END $$;

-- 5. Indexes for fast real-time queries
CREATE INDEX IF NOT EXISTS idx_announcements_display ON announcements(event_id, is_active, pinned DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_teams_event ON teams(event_id);
