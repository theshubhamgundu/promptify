-- ═════════════════════════════════════════════════════════════════════════════
-- DROP UNUSED TABLES - Database Cleanup
-- ═════════════════════════════════════════════════════════════════════════════
-- ⚠️ WARNING: This will permanently delete tables and their data
-- ⚠️ Only run this if you're certain you don't need these features
-- ⚠️ BACKUP YOUR DATABASE BEFORE RUNNING THIS SCRIPT
-- ═════════════════════════════════════════════════════════════════════════════

-- Step 1: Check what data exists before deletion
SELECT 
    'BEFORE DELETION - Data Check' as section,
    'quiz_questions' as table_name,
    COUNT(*) as row_count
FROM quiz_questions

UNION ALL
SELECT 'BEFORE DELETION - Data Check', 'quiz_options', COUNT(*) FROM quiz_options
UNION ALL
SELECT 'BEFORE DELETION - Data Check', 'turing_test_interactions', COUNT(*) FROM turing_test_interactions
UNION ALL
SELECT 'BEFORE DELETION - Data Check', 'turing_verdicts', COUNT(*) FROM turing_verdicts
UNION ALL
SELECT 'BEFORE DELETION - Data Check', 'cipher_submissions', COUNT(*) FROM cipher_submissions
UNION ALL
SELECT 'BEFORE DELETION - Data Check', 'prompt_zipper_evaluations', COUNT(*) FROM prompt_zipper_evaluations
UNION ALL
SELECT 'BEFORE DELETION - Data Check', 'architect_submissions', COUNT(*) FROM architect_submissions
UNION ALL
SELECT 'BEFORE DELETION - Data Check', 'model_duel_tasks', COUNT(*) FROM model_duel_tasks
UNION ALL
SELECT 'BEFORE DELETION - Data Check', 'model_duel_strategies', COUNT(*) FROM model_duel_strategies
UNION ALL
SELECT 'BEFORE DELETION - Data Check', 'model_duel_evaluations', COUNT(*) FROM model_duel_evaluations
UNION ALL
SELECT 'BEFORE DELETION - Data Check', 'negotiation_scenarios', COUNT(*) FROM negotiation_scenarios
UNION ALL
SELECT 'BEFORE DELETION - Data Check', 'negotiation_sessions', COUNT(*) FROM negotiation_sessions
UNION ALL
SELECT 'BEFORE DELETION - Data Check', 'negotiation_actions', COUNT(*) FROM negotiation_actions
UNION ALL
SELECT 'BEFORE DELETION - Data Check', 'emergence_environments', COUNT(*) FROM emergence_environments
UNION ALL
SELECT 'BEFORE DELETION - Data Check', 'emergence_sessions', COUNT(*) FROM emergence_sessions
UNION ALL
SELECT 'BEFORE DELETION - Data Check', 'emergence_actions', COUNT(*) FROM emergence_actions;

-- ═════════════════════════════════════════════════════════════════════════════
-- OPTION A: Drop Duplicate Quiz System (quiz_questions + quiz_options)
-- ═════════════════════════════════════════════════════════════════════════════
-- You're using 'challenges' table for quizzes, so these are redundant

DROP TABLE IF EXISTS quiz_options CASCADE;
DROP TABLE IF EXISTS quiz_questions CASCADE;

-- ═════════════════════════════════════════════════════════════════════════════
-- OPTION B: Drop Round 4 Specific Tables (Turing Test, Cipher, Prompt Zipper)
-- ═════════════════════════════════════════════════════════════════════════════
-- Only drop if you're not using these challenge types

DROP TABLE IF EXISTS turing_test_interactions CASCADE;
DROP TABLE IF EXISTS turing_verdicts CASCADE;
DROP TABLE IF EXISTS cipher_submissions CASCADE;
DROP TABLE IF EXISTS prompt_zipper_evaluations CASCADE;

-- ═════════════════════════════════════════════════════════════════════════════
-- OPTION C: Drop Round 5 Specific Tables (Architect, Model Duel, Negotiation, Emergence)
-- ═════════════════════════════════════════════════════════════════════════════
-- Only drop if you're not using Round 5 features

-- Model Duel System
DROP TABLE IF EXISTS model_duel_evaluations CASCADE;
DROP TABLE IF EXISTS model_duel_strategies CASCADE;
DROP TABLE IF EXISTS model_duel_tasks CASCADE;

-- Architect System
DROP TABLE IF EXISTS architect_submissions CASCADE;

-- Negotiation System
DROP TABLE IF EXISTS negotiation_actions CASCADE;
DROP TABLE IF EXISTS negotiation_sessions CASCADE;
DROP TABLE IF EXISTS negotiation_scenarios CASCADE;

-- Emergence System
DROP TABLE IF EXISTS emergence_actions CASCADE;
DROP TABLE IF EXISTS emergence_sessions CASCADE;
DROP TABLE IF EXISTS emergence_environments CASCADE;

-- ═════════════════════════════════════════════════════════════════════════════
-- OPTION D: Drop Other Unused Tables
-- ═════════════════════════════════════════════════════════════════════════════

-- Challenge versions (if not using versioning)
DROP TABLE IF EXISTS challenge_versions CASCADE;

-- Event snapshots (if not using this feature)
DROP TABLE IF EXISTS event_snapshots CASCADE;

-- Verification requests (if using different auth flow)
-- DROP TABLE IF EXISTS verification_requests CASCADE;

-- Support cases (if using external support system)
-- DROP TABLE IF EXISTS support_cases CASCADE;

-- System announcements (if using different announcement system)
-- DROP TABLE IF EXISTS system_announcements CASCADE;

-- ═════════════════════════════════════════════════════════════════════════════
-- Update admin_reset_all_rounds function to remove references
-- ═════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION admin_reset_all_rounds(p_team_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_deleted_counts JSONB := '{}'::jsonb;
    v_team_name TEXT;
    v_total_rounds INTEGER := 0;
    v_count INT;
BEGIN
    SELECT name INTO v_team_name FROM teams WHERE id = p_team_id;
    
    SELECT COUNT(*)::int INTO v_total_rounds
    FROM round_sessions
    WHERE team_id = p_team_id;
    
    IF v_total_rounds = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'No round sessions found');
    END IF;
    
    -- Core quiz/challenge data
    DELETE FROM quiz_answers WHERE team_id = p_team_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('quiz_answers', v_count);
    
    DELETE FROM quiz_sessions WHERE team_id = p_team_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('quiz_sessions', v_count);
    
    DELETE FROM challenge_attempts WHERE team_id = p_team_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('challenge_attempts', v_count);
    
    DELETE FROM score_events WHERE team_id = p_team_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('score_events', v_count);
    
    DELETE FROM round5_score_events WHERE team_id = p_team_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('round5_score_events', v_count);
    
    DELETE FROM submissions WHERE team_id = p_team_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('submissions', v_count);
    
    -- Prompt system
    DELETE FROM prompt_submissions WHERE team_id = p_team_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('prompt_submissions', v_count);
    
    DELETE FROM prompt_round_sessions WHERE team_id = p_team_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('prompt_round_sessions', v_count);
    
    DELETE FROM challenge_sessions WHERE team_id = p_team_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('challenge_sessions', v_count);
    
    -- BYOK
    DELETE FROM byok_sessions WHERE team_id = p_team_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('byok_sessions', v_count);
    
    DELETE FROM byok_usage_logs WHERE team_id = p_team_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('byok_usage_logs', v_count);
    
    -- Security and analytics
    DELETE FROM security_violations WHERE team_id = p_team_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('security_violations', v_count);
    
    DELETE FROM behavior_analytics WHERE team_id = p_team_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('behavior_analytics', v_count);
    
    DELETE FROM prompt_sheet_entries WHERE team_id = p_team_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('prompt_sheet_entries', v_count);
    
    -- Finally delete round_sessions
    DELETE FROM round_sessions WHERE team_id = p_team_id;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('round_sessions', v_total_rounds);
    
    INSERT INTO activity_logs (action, team_id, details)
    VALUES ('ADMIN_RESET_ALL_ROUNDS', p_team_id, jsonb_build_object('rounds_count', v_total_rounds, 'deleted_counts', v_deleted_counts));
    
    RETURN jsonb_build_object('success', true, 'message', 'All rounds reset', 'team_name', v_team_name, 'rounds_count', v_total_rounds, 'deleted_counts', v_deleted_counts);
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- Verification
-- ═════════════════════════════════════════════════════════════════════════════

SELECT 
    'VERIFICATION' as section,
    'Tables dropped successfully' as status,
    COUNT(*) as remaining_tables
FROM information_schema.tables
WHERE table_schema = 'public';

-- List remaining tables
SELECT 
    'REMAINING TABLES' as section,
    table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
