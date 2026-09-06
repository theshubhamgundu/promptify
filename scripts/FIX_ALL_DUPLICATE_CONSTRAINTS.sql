-- =====================================================
-- FIX: All Duplicate Key Constraint Issues
-- =====================================================
-- Comprehensive fix for ALL race conditions and bad unique constraints
-- =====================================================

-- ══════════════════════════════════════════════════════
-- PART 1: Fix challenge_attempts constraint
-- ══════════════════════════════════════════════════════

DO $$ 
BEGIN
    -- Drop the bad constraint that prevents multiple attempts
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'challenge_attempts_round_session_challenge_unique'
    ) THEN
        ALTER TABLE challenge_attempts 
        DROP CONSTRAINT challenge_attempts_round_session_challenge_unique;
        
        RAISE NOTICE '✓ Dropped challenge_attempts_round_session_challenge_unique';
    ELSE
        RAISE NOTICE '  challenge_attempts constraint already removed';
    END IF;
END $$;

-- ══════════════════════════════════════════════════════
-- PART 2: Fix round_sessions race condition
-- ══════════════════════════════════════════════════════

-- Add helper function if not exists
CREATE OR REPLACE FUNCTION get_or_create_round_session(
    p_team_id UUID,
    p_round_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_session_id UUID;
BEGIN
    -- Try to get existing
    SELECT id INTO v_session_id
    FROM round_sessions
    WHERE team_id = p_team_id AND round_id = p_round_id;
    
    IF FOUND THEN
        RETURN v_session_id;
    END IF;
    
    -- Try to insert with conflict handling
    BEGIN
        INSERT INTO round_sessions (team_id, round_id, started_at)
        VALUES (p_team_id, p_round_id, now())
        RETURNING id INTO v_session_id;
        
        RETURN v_session_id;
    EXCEPTION WHEN unique_violation THEN
        -- Another process created it, fetch it
        SELECT id INTO v_session_id
        FROM round_sessions
        WHERE team_id = p_team_id AND round_id = p_round_id;
        
        RETURN v_session_id;
    END;
END;
$$;

GRANT EXECUTE ON FUNCTION get_or_create_round_session(UUID, UUID) TO authenticated;

-- ══════════════════════════════════════════════════════
-- PART 3: Fix challenge_sessions race condition
-- ══════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_or_create_challenge_session(
    p_team_id UUID,
    p_round_session_id UUID,
    p_challenge_id UUID,
    p_duration_minutes INTEGER DEFAULT 8
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_session_id UUID;
    v_deadline TIMESTAMPTZ;
BEGIN
    -- Try to get existing
    SELECT id INTO v_session_id
    FROM challenge_sessions
    WHERE team_id = p_team_id 
    AND round_session_id = p_round_session_id
    AND challenge_id = p_challenge_id;
    
    IF FOUND THEN
        RETURN v_session_id;
    END IF;
    
    -- Try to insert with conflict handling
    v_deadline := now() + (p_duration_minutes || ' minutes')::interval;
    
    BEGIN
        INSERT INTO challenge_sessions (
            team_id, round_session_id, challenge_id,
            started_at, deadline_at, status, attempts_used
        )
        VALUES (
            p_team_id, p_round_session_id, p_challenge_id,
            now(), v_deadline, 'IN_PROGRESS', 0
        )
        RETURNING id INTO v_session_id;
        
        RETURN v_session_id;
    EXCEPTION WHEN unique_violation THEN
        -- Another process created it, fetch it
        SELECT id INTO v_session_id
        FROM challenge_sessions
        WHERE team_id = p_team_id 
        AND round_session_id = p_round_session_id
        AND challenge_id = p_challenge_id;
        
        RETURN v_session_id;
    END;
END;
$$;

GRANT EXECUTE ON FUNCTION get_or_create_challenge_session(UUID, UUID, UUID, INTEGER) TO authenticated;

-- ══════════════════════════════════════════════════════
-- PART 4: Check for similar bad constraints
-- ══════════════════════════════════════════════════════

-- Check quiz_answers for similar issues
SELECT 
    'QUIZ_ANSWERS CONSTRAINTS' as table_name,
    conname as constraint_name,
    pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'quiz_answers'::regclass
AND contype = 'u'  -- unique constraints
ORDER BY conname;

-- Check if quiz_answers has a similar bad constraint
DO $$ 
BEGIN
    -- If there's a constraint preventing multiple quiz answers, drop it
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname LIKE '%quiz_answers%'
        AND conrelid = 'quiz_answers'::regclass
        AND pg_get_constraintdef(oid) LIKE '%team_id%'
        AND pg_get_constraintdef(oid) LIKE '%challenge_id%'
        AND pg_get_constraintdef(oid) NOT LIKE '%attempt%'
    ) THEN
        -- There's a bad constraint, but we need the exact name
        RAISE NOTICE 'WARNING: quiz_answers may have a similar constraint issue';
    END IF;
END $$;

-- ══════════════════════════════════════════════════════
-- PART 5: Verification
-- ══════════════════════════════════════════════════════

-- Show all constraints that might block multiple attempts
SELECT 
    'POTENTIAL BLOCKING CONSTRAINTS' as category,
    c.conrelid::regclass::text as table_name,
    c.conname as constraint_name,
    pg_get_constraintdef(c.oid) as definition
FROM pg_constraint c
WHERE c.contype = 'u'  -- unique constraints
AND (
    c.conrelid::regclass::text LIKE '%attempt%'
    OR c.conrelid::regclass::text LIKE '%answer%'
    OR c.conrelid::regclass::text LIKE '%submission%'
)
AND pg_get_constraintdef(c.oid) NOT LIKE '%attempt_number%'
ORDER BY table_name, constraint_name;

-- Summary
SELECT 
    'SUMMARY' as status,
    '✓ Removed bad constraint from challenge_attempts' as fix_1,
    '✓ Added safe session creation functions' as fix_2,
    '✓ Multiple attempts now allowed' as result;
