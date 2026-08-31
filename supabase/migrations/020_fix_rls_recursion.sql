-- Migration 020: Fix recursive RLS on auth_user_role()
-- The auth_user_role() function queries the `users` table, which has RLS enabled.
-- RLS on `users` calls auth_user_role() again → infinite recursion → "stack depth limit exceeded".
-- Fix: Use SECURITY DEFINER so the function bypasses RLS when reading from `users`.

CREATE OR REPLACE FUNCTION auth_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM public.users WHERE id = auth.uid() LIMIT 1;
$$;

-- Same fix for auth_user_team() which queries `participants` (also RLS-enabled)
CREATE OR REPLACE FUNCTION auth_user_team()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT team_id FROM public.participants WHERE user_id = auth.uid() LIMIT 1;
$$;
