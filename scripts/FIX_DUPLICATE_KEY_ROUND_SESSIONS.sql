-- =====================================================
-- FIX: Duplicate Key Violation on round_sessions
-- =====================================================
-- ERROR: duplicate key value violates unique constraint 
--        "round_sessions_team_id_round_id_key"
-- ROOT CAUSE: Race condition - multiple attempts to INSERT 
--             the same round_session simultaneously
-- SOLUTION: Use INSERT ... ON CONFLICT DO NOTHING
--           and always query after insert to return existing
-- =====================================================

-- Check current constraint
SELECT 
    'CURRENT CONSTRAINT' as info,
    conname as constraint_name,
    pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conname = 'round_sessions_team_id_round_id_key';

-- Create helper function to get or create round_session safely
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
    -- Try to get existing session
    SELECT id INTO v_session_id
    FROM round_sessions
    WHERE team_id = p_team_id AND round_id = p_round_id;
    
    -- If found, return it
    IF FOUND THEN
        RETURN v_session_id;
    END IF;
    
    -- Try to insert new session, ignore conflicts
    INSERT INTO round_sessions (team_id, round_id, started_at)
    VALUES (p_team_id, p_round_id, now())
    ON CONFLICT (team_id, round_id) DO NOTHING
    RETURNING id INTO v_session_id;
    
    -- If insert succeeded, return new id
    IF v_session_id IS NOT NULL THEN
        RETURN v_session_id;
    END IF;
    
    -- If we got here, another process created it between our SELECT and INSERT
    -- Query again to get the id
    SELECT id INTO v_session_id
    FROM round_sessions
    WHERE team_id = p_team_id AND round_id = p_round_id;
    
    RETURN v_session_id;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_or_create_round_session(UUID, UUID) TO authenticated;

-- Create function specifically for quiz rounds
CREATE OR REPLACE FUNCTION get_or_create_quiz_session(
    p_team_id UUID,
    p_round_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_round_session_id UUID;
    v_round_session RECORD;
BEGIN
    -- Get or create round session safely
    v_round_session_id := get_or_create_round_session(p_team_id, p_round_id);
    
    -- Get the full record
    SELECT * INTO v_round_session
    FROM round_sessions
    WHERE id = v_round_session_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'round_session', row_to_json(v_round_session)
    );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_or_create_quiz_session(UUID, UUID) TO authenticated;

-- Update all round initialization functions to use safe pattern
-- This is a template - apply to all round-specific functions

-- Example for start_prompt_round_session (if exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'start_prompt_round_session') THEN
        CREATE OR REPLACE FUNCTION start_prompt_round_session(
            p_team_id UUID,
            p_round_id UUID,
            p_round_session_id UUID
        )
        RETURNS UUID
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $func$
        DECLARE
            v_session_id UUID;
        BEGIN
            -- Check for existing prompt session
            SELECT id INTO v_session_id
            FROM prompt_round_sessions
            WHERE team_id = p_team_id AND round_id = p_round_id;
            
            IF FOUND THEN
                RETURN v_session_id;
            END IF;
            
            -- Try to insert, ignore conflicts
            INSERT INTO prompt_round_sessions (
                team_id, round_id, round_session_id,
                current_sub_round, total_score,
                sub_round_1_status, sub_round_2_status, 
                sub_round_3_status, sub_round_4_status
            ) VALUES (
                p_team_id, p_round_id, p_round_session_id,
                1, 0,
                'IN_PROGRESS', 'LOCKED', 'LOCKED', 'LOCKED'
            )
            ON CONFLICT (team_id, round_id) DO NOTHING
            RETURNING id INTO v_session_id;
            
            -- If conflict occurred, fetch the existing id
            IF v_session_id IS NULL THEN
                SELECT id INTO v_session_id
                FROM prompt_round_sessions
                WHERE team_id = p_team_id AND round_id = p_round_id;
            END IF;
            
            RETURN v_session_id;
        END;
        $func$;
        
        RAISE NOTICE 'Updated start_prompt_round_session with safe insert';
    END IF;
END $$;

-- Verify the fix
SELECT 
    'VERIFICATION' as status,
    'get_or_create_round_session function created' as message,
    EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'get_or_create_round_session'
    ) as function_exists;

-- Show any duplicate round_sessions that might exist
SELECT 
    'EXISTING DUPLICATES CHECK' as info,
    team_id,
    round_id,
    COUNT(*) as duplicate_count,
    array_agg(id ORDER BY started_at) as session_ids,
    array_agg(started_at ORDER BY started_at) as started_times
FROM round_sessions
GROUP BY team_id, round_id
HAVING COUNT(*) > 1;

-- If duplicates exist, keep the earliest one and delete others
-- UNCOMMENT BELOW IF YOU WANT TO AUTO-CLEAN DUPLICATES:
/*
WITH duplicates AS (
    SELECT 
        team_id,
        round_id,
        id,
        ROW_NUMBER() OVER (PARTITION BY team_id, round_id ORDER BY started_at ASC) as rn
    FROM round_sessions
)
DELETE FROM round_sessions
WHERE id IN (
    SELECT id FROM duplicates WHERE rn > 1
);
*/

SELECT '✓ Fix applied - race condition handling added to round_sessions creation' as status;
