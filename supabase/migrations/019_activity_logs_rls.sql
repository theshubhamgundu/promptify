-- Migration 019: Fix Activity Logs RLS
-- Allow anonymous users (clients) to insert activity logs

-- Allow any client to insert into activity logs
CREATE POLICY "Clients can insert activity logs"
  ON activity_logs FOR INSERT
  WITH CHECK (true);
