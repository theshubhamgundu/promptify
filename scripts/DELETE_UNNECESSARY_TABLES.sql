-- ═════════════════════════════════════════════════════════════════════════════
-- DELETE UNNECESSARY TABLES - Clean Up Database
-- ═════════════════════════════════════════════════════════════════════════════
-- This script removes:
-- 1. Round 4 specific tables (Turing, Cipher, Polyglot, Jailbreak, etc.)
-- 2. Round 5 specific tables (Architect, Model Duel, Negotiation, Emergence)
-- 3. Duplicate scoring tables (round5_score_events)
-- 4. Duplicate announcement tables (system_announcements if exists)
-- ═════════════════════════════════════════════════════════════════════════════

-- ═════════════════════════════════════════════════════════════════════════════
-- ROUND 4 SPECIFIC TABLES
-- ═════════════════════════════════════════════════════════════════════════════

-- Turing Test Challenge
DROP TABLE IF EXISTS turing_test_interactions CASCADE;
DROP TABLE IF EXISTS turing_verdicts CASCADE;

-- Cipher Challenge
DROP TABLE IF EXISTS cipher_submissions CASCADE;

-- Polyglot Challenge
DROP TABLE IF EXISTS polyglot_submissions CASCADE;

-- Jailbreak Challenge
DROP TABLE IF EXISTS jailbreak_submissions CASCADE;

-- Prompt Zipper Challenge
DROP TABLE IF EXISTS prompt_zipper_evaluations CASCADE;
DROP TABLE IF EXISTS prompt_zipper_submissions CASCADE;

-- Visual Challenge
DROP TABLE IF EXISTS visual_challenge_submissions CASCADE;

-- Lie Detector Challenge
DROP TABLE IF EXISTS lie_detector_submissions CASCADE;

-- ═════════════════════════════════════════════════════════════════════════════
-- ROUND 5 SPECIFIC TABLES
-- ═════════════════════════════════════════════════════════════════════════════

-- Architect Challenge
DROP TABLE IF EXISTS architect_submissions CASCADE;

-- Model Duel Challenge
DROP TABLE IF EXISTS model_duel_evaluations CASCADE;
DROP TABLE IF EXISTS model_duel_strategies CASCADE;

-- Negotiation Challenge
DROP TABLE IF EXISTS negotiation_actions CASCADE;
DROP TABLE IF EXISTS negotiation_sessions CASCADE;

-- Emergence Challenge
DROP TABLE IF EXISTS emergence_sessions CASCADE;

-- Round 5 Scoring (Duplicate)
DROP TABLE IF EXISTS round5_score_events CASCADE;

-- ═════════════════════════════════════════════════════════════════════════════
-- DUPLICATE/UNUSED TABLES
-- ═════════════════════════════════════════════════════════════════════════════

-- Duplicate announcements table
DROP TABLE IF EXISTS system_announcements CASCADE;

-- ═════════════════════════════════════════════════════════════════════════════
-- VERIFICATION - Show Remaining Tables
-- ═════════════════════════════════════════════════════════════════════════════

SELECT 
    'CLEANUP COMPLETE' as status,
    COUNT(*) as total_tables_remaining
FROM information_schema.tables
WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE';

-- List remaining tables
SELECT 
    'Remaining Tables' as section,
    table_name
FROM information_schema.tables
WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Verify no round 4/5 tables remain
SELECT 
    'Verification - Should be EMPTY' as check_type,
    COUNT(*) as remaining_round_specific_tables
FROM information_schema.tables
WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
    AND (
        table_name LIKE '%turing%'
        OR table_name LIKE '%cipher%'
        OR table_name LIKE '%polyglot%'
        OR table_name LIKE '%jailbreak%'
        OR table_name LIKE '%prompt_zipper%'
        OR table_name LIKE '%visual_challenge%'
        OR table_name LIKE '%lie_detector%'
        OR table_name LIKE '%architect%'
        OR table_name LIKE '%model_duel%'
        OR table_name LIKE '%negotiation%'
        OR table_name LIKE '%emergence%'
        OR table_name = 'round5_score_events'
        OR table_name = 'system_announcements'
    );
