-- =====================================================
-- Fix create_challenge_attempt Function
-- =====================================================
-- This function is called when users select quiz answers
-- =====================================================

-- Drop existing function
DROP FUNCTION IF EXISTS create_challenge_attempt(UUID, UUID, UUID, UUID, JSONB);

-- Create the function to save quiz answers
CREATE OR REPLACE FUNCTION create_challenge_attempt(
    p_team_id UUID,
    p_round_session_id UUID,
    p_challenge_id UUID,
    p_participant_id UUID,
    p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_challenge RECORD;
    v_is_correct BOOLEAN := false;
    v_points_earned INTEGER := 0;
    v_correct_answer TEXT;
    v_selected_answer TEXT;
    v_attempt_id UUID;
BEGIN
    -- Get challenge details
    SELECT * INTO v_challenge
    FROM challenges
    WHERE id = p_challenge_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Challenge not found: %', p_challenge_id;
    END IF;
    
    -- Extract selected answer from payload
    IF p_payload ? 'selected_options' AND jsonb_array_length(p_payload->'selected_options') > 0 THEN
        v_selected_answer := p_payload->'selected_options'->>0;
    END IF;
    
    -- Get correct answer from challenge configuration
    IF v_challenge.configuration ? 'correct_answer' THEN
        v_correct_answer := v_challenge.configuration->>'correct_answer';
        
        -- Check if answer is correct
        v_is_correct := (v_selected_answer = v_correct_answer);
        
        -- Calculate points
        IF v_is_correct THEN
            v_points_earned := v_challenge.base_points;
        ELSE
            v_points_earned := 0;
        END IF;
    END IF;
    
    -- Insert or update challenge attempt
    INSERT INTO challenge_attempts (
        team_id,
        round_session_id,
        challenge_id,
        participant_id,
        payload,
        is_correct,
        points_earned,
        submitted_at
    ) VALUES (
        p_team_id,
        p_round_session_id,
        p_challenge_id,
        p_participant_id,
        p_payload,
        v_is_correct,
        v_points_earned,
        NOW()
    )
    ON CONFLICT (round_session_id, challenge_id) 
    DO UPDATE SET
        payload = EXCLUDED.payload,
        is_correct = EXCLUDED.is_correct,
        points_earned = EXCLUDED.points_earned,
        submitted_at = NOW()
    RETURNING id INTO v_attempt_id;
    
    -- Return result
    RETURN jsonb_build_object(
        'success', true,
        'attempt_id', v_attempt_id,
        'is_correct', v_is_correct,
        'points_earned', v_points_earned,
        'selected_answer', v_selected_answer,
        'correct_answer', v_correct_answer
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM,
            'detail', SQLSTATE
        );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION create_challenge_attempt(UUID, UUID, UUID, UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION create_challenge_attempt(UUID, UUID, UUID, UUID, JSONB) TO anon;

-- Add unique constraint to challenge_attempts if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'challenge_attempts_round_session_challenge_unique'
    ) THEN
        ALTER TABLE challenge_attempts
        ADD CONSTRAINT challenge_attempts_round_session_challenge_unique 
        UNIQUE (round_session_id, challenge_id);
    END IF;
END $$;

-- Verify function was created
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'create_challenge_attempt') THEN
        RAISE NOTICE '✅ create_challenge_attempt function created successfully';
        RAISE NOTICE '✅ Permissions granted';
        RAISE NOTICE '✅ Unique constraint added';
    ELSE
        RAISE EXCEPTION 'Failed to create create_challenge_attempt function';
    END IF;
END $$;

-- Show function signature
SELECT 
    'Function Check' as test,
    proname as function_name,
    pronargs as num_args,
    prorettype::regtype as return_type
FROM pg_proc
WHERE proname = 'create_challenge_attempt';
