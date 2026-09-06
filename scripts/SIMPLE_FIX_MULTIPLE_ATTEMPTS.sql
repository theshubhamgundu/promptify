-- =====================================================
-- SIMPLE FIX: Allow Multiple Challenge Attempts
-- =====================================================
-- Just removes the constraint preventing multiple attempts
-- =====================================================

-- Drop the bad constraint
ALTER TABLE challenge_attempts 
DROP CONSTRAINT IF EXISTS challenge_attempts_round_session_challenge_unique;

-- Verify it's gone
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'challenge_attempts_round_session_challenge_unique'
        ) THEN 'ERROR: Constraint still exists'
        ELSE 'SUCCESS: Multiple attempts now allowed'
    END as status;
