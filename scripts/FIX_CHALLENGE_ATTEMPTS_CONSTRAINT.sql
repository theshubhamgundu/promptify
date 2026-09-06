-- =====================================================
-- FIX: Multiple Challenge Attempts Not Being Stored
-- =====================================================
-- ERROR: duplicate key value violates unique constraint 
--        "challenge_attempts_round_session_challenge_unique"
-- ROOT CAUSE: The unique constraint prevents storing multiple
--             attempts for the same challenge
-- SOLUTION: Drop the bad constraint and create a new one that
--           includes attempt_number, OR remove it entirely
-- =====================================================

-- Check current constraint
SELECT 
    'CURRENT PROBLEMATIC CONSTRAINT' as info,
    conname as constraint_name,
    pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conname LIKE '%challenge_attempts%'
AND conrelid = 'challenge_attempts'::regclass;

-- Show sample data that would violate the constraint
SELECT 
    'SAMPLE DATA BLOCKED BY CONSTRAINT' as info,
    round_session_id,
    challenge_id,
    COUNT(*) as attempt_count,
    array_agg(attempt_number ORDER BY attempt_number) as attempts,
    array_agg(id ORDER BY created_at) as attempt_ids
FROM challenge_attempts
GROUP BY round_session_id, challenge_id
HAVING COUNT(*) > 1
LIMIT 5;

-- === SOLUTION 1: Drop the constraint entirely ===
-- (Most straightforward - allows unlimited attempts per challenge)

ALTER TABLE challenge_attempts 
DROP CONSTRAINT IF EXISTS challenge_attempts_round_session_challenge_unique;

-- === SOLUTION 2: Create a better constraint (OPTIONAL) ===
-- This ensures one entry per (round_session, challenge, attempt_number)
-- Uncomment if you want this protection:

/*
ALTER TABLE challenge_attempts
ADD CONSTRAINT challenge_attempts_round_session_challenge_attempt_unique
UNIQUE (round_session_id, challenge_id, attempt_number);
*/

-- Verify the fix
SELECT 
    'VERIFICATION' as status,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'challenge_attempts_round_session_challenge_unique'
            AND conrelid = 'challenge_attempts'::regclass
        ) THEN 'FAILED - Constraint still exists!'
        ELSE 'SUCCESS - Constraint removed, multiple attempts now allowed'
    END as result;

-- Show current constraints on challenge_attempts table
SELECT 
    'REMAINING CONSTRAINTS' as info,
    conname as constraint_name,
    pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'challenge_attempts'::regclass
ORDER BY conname;

SELECT '✓ Fix applied - multiple challenge attempts now allowed' as status;
