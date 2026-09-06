-- Migration 031: Unified Submissions View
-- Creates a single view unifying all round-specific attempt/submission tables
-- and an RPC for admins to safely adjust scores on the correct underlying table.

-- 1. Drop the strict foreign key constraint on score_events so it can reference any attempt ID
ALTER TABLE score_events DROP CONSTRAINT IF EXISTS score_events_submission_id_fkey;

-- 2. Create the Unified Submissions View
DROP VIEW IF EXISTS vw_all_submissions;
CREATE OR REPLACE VIEW vw_all_submissions AS

-- Round 1, 3, 4 (partial) - Challenge Attempts
SELECT 
    ca.id,
    ca.team_id,
    ca.challenge_id,
    ca.round_session_id,
    ca.attempt_number,
    c.round_id,
    c.title as challenge_title,
    CASE 
        WHEN ca.status = 'PENDING' THEN 'SUBMITTED'
        WHEN ca.status IN ('COMPLETED', 'FAILED') THEN 'EVALUATED'
        ELSE ca.status 
    END as status,
    ca.created_at as submitted_at,
    COALESCE(er.score_awarded, 0) as score,
    er.raw_response as evaluation_result,
    ca.payload::text as content,
    'CHALLENGE_ATTEMPT' as source_table
FROM challenge_attempts ca
JOIN challenges c ON ca.challenge_id = c.id
LEFT JOIN evaluation_results er ON er.attempt_id = ca.id

UNION ALL

-- Round 2 - Prompt Submissions
SELECT 
    ps.id,
    ps.team_id,
    ps.challenge_id,
    ps.round_session_id,
    ps.attempt_number,
    c.round_id,
    c.title as challenge_title,
    CASE WHEN ps.passed THEN 'EVALUATED' ELSE 'EVALUATED' END as status,
    ps.submitted_at,
    ps.total_score as score,
    ps.evaluation_feedback as evaluation_result,
    ps.prompt_text as content,
    'PROMPT_SUBMISSION' as source_table
FROM prompt_submissions ps
JOIN challenges c ON ps.challenge_id = c.id

UNION ALL

-- Round 4 - Cipher Submissions
SELECT
    cs.id,
    cs.team_id,
    cs.challenge_id,
    cs.round_session_id,
    cs.attempt_number,
    c.round_id,
    c.title as challenge_title,
    'EVALUATED' as status,
    cs.created_at as submitted_at,
    cs.total_score as score,
    NULL::jsonb as evaluation_result,
    cs.encoded_riddle as content,
    'CIPHER_SUBMISSION' as source_table
FROM cipher_submissions cs
JOIN challenges c ON cs.challenge_id = c.id

UNION ALL

-- Round 5 - Architect Submissions
SELECT
    ars.id,
    ars.team_id,
    ars.challenge_id,
    ars.round_session_id,
    ars.attempt_number,
    c.round_id,
    c.title as challenge_title,
    'EVALUATED' as status,
    ars.created_at as submitted_at,
    ars.total_score as score,
    ars.validation_errors as evaluation_result,
    ars.architecture_graph::text as content,
    'ARCHITECT_SUBMISSION' as source_table
FROM architect_submissions ars
JOIN challenges c ON ars.challenge_id = c.id;

-- 3. Create an RPC for admin score overrides to update the correct underlying table
CREATE OR REPLACE FUNCTION admin_review_submission(
    p_submission_id UUID,
    p_source_table TEXT,
    p_score DECIMAL,
    p_review_reason TEXT,
    p_admin_id UUID
) RETURNS VOID AS $$
BEGIN
    IF p_source_table = 'CHALLENGE_ATTEMPT' THEN
        -- Upsert evaluation_results for this attempt
        IF EXISTS (SELECT 1 FROM evaluation_results WHERE attempt_id = p_submission_id) THEN
            UPDATE evaluation_results 
            SET score_awarded = p_score, feedback = array_append(feedback, p_review_reason)
            WHERE attempt_id = p_submission_id;
        ELSE
            INSERT INTO evaluation_results (attempt_id, evaluator_type, score_awarded, passed, feedback)
            VALUES (p_submission_id, 'MANUAL', p_score, p_score > 0, ARRAY[p_review_reason]);
        END IF;
        
        -- Mark attempt as evaluated
        UPDATE challenge_attempts SET status = 'COMPLETED' WHERE id = p_submission_id;

    ELSIF p_source_table = 'PROMPT_SUBMISSION' THEN
        UPDATE prompt_submissions 
        SET total_score = p_score, passed = (p_score > 0)
        WHERE id = p_submission_id;

    ELSIF p_source_table = 'CIPHER_SUBMISSION' THEN
        UPDATE cipher_submissions 
        SET total_score = p_score, is_success = (p_score > 0)
        WHERE id = p_submission_id;

    ELSIF p_source_table = 'ARCHITECT_SUBMISSION' THEN
        -- total_score is normally computed, but for manual override we force it
        UPDATE architect_submissions 
        SET total_score = p_score, is_valid = (p_score > 0)
        WHERE id = p_submission_id;

    ELSE
        RAISE EXCEPTION 'Unknown source table: %', p_source_table;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
