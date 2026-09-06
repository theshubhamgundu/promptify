-- =====================================================
-- Fix RLS Policies for Challenges Table
-- =====================================================
-- If challenges exist but still show "No questions",
-- RLS policies might be blocking access
-- =====================================================

-- Check existing RLS policies
SELECT 
    '=== CURRENT RLS POLICIES ===' as info,
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'challenges';

-- Enable RLS if not enabled
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (if any)
DROP POLICY IF EXISTS "Allow read access to challenges" ON challenges;
DROP POLICY IF EXISTS "challenges_select_policy" ON challenges;
DROP POLICY IF EXISTS "Enable read access for all users" ON challenges;

-- Create permissive SELECT policy for all authenticated users
CREATE POLICY "challenges_public_read" ON challenges
    FOR SELECT
    TO authenticated
    USING (true);

-- Also allow public access (for non-authenticated preview)
CREATE POLICY "challenges_anon_read" ON challenges
    FOR SELECT
    TO anon
    USING (true);

-- Success message
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════';
    RAISE NOTICE '✅ RLS POLICIES FIXED FOR CHALLENGES';
    RAISE NOTICE '═══════════════════════════════════════════════════';
    RAISE NOTICE '';
    RAISE NOTICE '📋 What was done:';
    RAISE NOTICE '   • Enabled RLS on challenges table';
    RAISE NOTICE '   • Created policy: challenges_public_read (authenticated)';
    RAISE NOTICE '   • Created policy: challenges_anon_read (anonymous)';
    RAISE NOTICE '   • All users can now read challenges';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Try now:';
    RAISE NOTICE '   1. Refresh your browser';
    RAISE NOTICE '   2. Click on Round 1';
    RAISE NOTICE '   3. Questions should appear!';
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;
