-- System Announcements Table
-- This table stores announcements that can be displayed system-wide or per event.
CREATE TABLE system_announcements (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  content text NOT NULL,
  is_active boolean DEFAULT true,
  event_id uuid REFERENCES events(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Indexes for quick lookup
CREATE INDEX idx_system_announcements_active ON system_announcements(is_active);
CREATE INDEX idx_system_announcements_event ON system_announcements(event_id);
