-- =====================================================
-- ROLLBACK: Round Reset Cascade Fixes
-- =====================================================
-- This script reverts the changes made by
-- FIX_ROUND_RESET_CASCADE.sql
--
-- Use this if you need to revert to the original
-- ON DELETE SET NULL behavior
-- =====================================================

BEGIN;

-- =====================================================
-- 1. Revert score_events constraint
-- =====================================================

ALTER TABLE score_events 
DROP CONSTRAINT IF EXISTS score_events_round_session_id_fkey;

ALTER TABLE score_events
ADD CONSTRAINT score_events_round_session_id_fkey 
FOREIGN KEY (round_session_id) 
REFERENCES round_sessions(id) 
ON DELETE SET NULL;

-- =====================================================
-- 2. Revert security_violations constraint
-- =====================================================

ALTER TABLE security_violations 
DROP CONSTRAINT IF EXISTS security_violations_round_session_id_fkey;

ALTER TABLE security_violations
ADD CONSTRAINT security_violations_round_session_id_fkey 
FOREIGN KEY (round_session_id) 
REFERENCES round_sessions(id) 
ON DELETE SET NULL;

-- =====================================================
-- 3. Drop indexes
-- =====================================================

DROP INDEX IF EXISTS idx_score_events_round_session_id;
DROP INDEX IF EXISTS idx_security_violations_round_session_id;

-- =====================================================
-- 4. Drop helper functions
-- =====================================================

DROP FUNCTION IF EXISTS admin_reset_team_round(UUID, UUID);
DROP FUNCTION IF EXISTS admin_reset_all_team_rounds(UUID);

-- =====================================================
-- 5. Drop view
-- =====================================================

DROP VIEW IF EXISTS v_orphaned_score_events;

-- =====================================================
-- 6. Drop constraint
-- =====================================================

ALTER TABLE score_events
DROP CONSTRAINT IF EXISTS score_events_valid_refs;

COMMIT;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================
DO $$ 
BEGIN 
    RAISE NOTICE '↩️  Round reset cascade fixes rolled back successfully!';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  WARNING: Round resets will now leave orphaned score_events';
    RAISE NOTICE '   You will need to manually delete score_events when resetting rounds.';
END $$;
