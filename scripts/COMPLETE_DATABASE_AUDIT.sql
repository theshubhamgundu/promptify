-- ═════════════════════════════════════════════════════════════════════════════
-- COMPLETE DATABASE AUDIT - Find All Tables & Identify Cleanup Targets
-- ═════════════════════════════════════════════════════════════════════════════

-- ═════════════════════════════════════════════════════════════════════════════
-- STEP 1: List ALL Tables with Row Counts
-- ═════════════════════════════════════════════════════════════════════════════

SELECT 
    '=== ALL TABLES WITH DATA ===' as section,
    schemaname,
    relname as table_name,
    n_live_tup as row_count,
    CASE 
        WHEN n_live_tup = 0 THEN '⚠️ EMPTY - CANDIDATE FOR DELETION'
        ELSE '✓ Has Data'
    END as status
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC, relname;

-- ═════════════════════════════════════════════════════════════════════════════
-- STEP 2: Identify Duplicate/Unused Quiz Tables
-- ═════════════════════════════════════════════════════════════════════════════

-- We use 'challenges' table with type='MULTIPLE_CHOICE' for quizzes
-- Check if quiz_questions/quiz_options tables exist and are unused

SELECT 
    '=== QUIZ TABLE ANALYSIS ===' as section,
    'Using challenges table' as current_system,
    COUNT(*) as quiz_challenges_count
FROM challenges
WHERE type = 'MULTIPLE_CHOICE'

UNION ALL

SELECT 
    '=== QUIZ TABLE ANALYSIS ===',
    'quiz_questions table (UNUSED?)',
    COALESCE((SELECT COUNT(*)::int FROM quiz_questions), 0)

UNION ALL

SELECT 
    '=== QUIZ TABLE ANALYSIS ===',
    'quiz_options table (UNUSED?)',
    COALESCE((SELECT COUNT(*)::int FROM quiz_options), 0);

-- ═════════════════════════════════════════════════════════════════════════════
-- STEP 3: Check for Round 4 & Round 5 Specific Tables (Should be dropped)
-- ═════════════════════════════════════════════════════════════════════════════

SELECT 
    '=== ROUND-SPECIFIC TABLES ===' as section,
    table_name,
    CASE 
        WHEN table_name LIKE '%round4%' OR table_name LIKE '%round_4%' THEN '⚠️ ROUND 4 SPECIFIC'
        WHEN table_name LIKE '%round5%' OR table_name LIKE '%round_5%' THEN '⚠️ ROUND 5 SPECIFIC'
        WHEN table_name LIKE '%turing%' THEN '⚠️ ROUND 4 (Turing Test)'
        WHEN table_name LIKE '%cipher%' THEN '⚠️ ROUND 4 (Cipher)'
        WHEN table_name LIKE '%polyglot%' THEN '⚠️ ROUND 4'
        WHEN table_name LIKE '%jailbreak%' THEN '⚠️ ROUND 4'
        WHEN table_name LIKE '%prompt_zipper%' THEN '⚠️ ROUND 4'
        WHEN table_name LIKE '%visual_challenge%' THEN '⚠️ ROUND 4'
        WHEN table_name LIKE '%architect%' THEN '⚠️ ROUND 5'
        WHEN table_name LIKE '%model_duel%' THEN '⚠️ ROUND 5'
        WHEN table_name LIKE '%negotiation%' THEN '⚠️ ROUND 5'
        WHEN table_name LIKE '%emergence%' THEN '⚠️ ROUND 5'
        ELSE 'CORE TABLE'
    END as classification
FROM information_schema.tables
WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
ORDER BY classification, table_name;

-- ═════════════════════════════════════════════════════════════════════════════
-- STEP 4: Check for Duplicate Scoring Systems
-- ═════════════════════════════════════════════════════════════════════════════

SELECT 
    '=== SCORING SYSTEM ANALYSIS ===' as section,
    'score_events (MAIN)' as table_name,
    COUNT(*) as row_count,
    'Primary scoring table' as usage
FROM score_events

UNION ALL

SELECT 
    '=== SCORING SYSTEM ANALYSIS ===',
    'round5_score_events (DUPLICATE?)',
    COUNT(*),
    'Round 5 specific - may be redundant'
FROM round5_score_events

UNION ALL

SELECT 
    '=== SCORING SYSTEM ANALYSIS ===',
    'round_sessions.score',
    COUNT(*),
    'Score stored in round_sessions'
FROM round_sessions WHERE score > 0;

-- ═════════════════════════════════════════════════════════════════════════════
-- STEP 5: Check for Unused/Empty Tables
-- ═════════════════════════════════════════════════════════════════════════════

SELECT 
    '=== EMPTY TABLES (CANDIDATES FOR DELETION) ===' as section,
    relname as table_name,
    n_live_tup as row_count
FROM pg_stat_user_tables
WHERE schemaname = 'public'
    AND n_live_tup = 0
ORDER BY relname;

-- ═════════════════════════════════════════════════════════════════════════════
-- STEP 6: Find Tables Without Foreign Key Relationships (Orphaned?)
-- ═════════════════════════════════════════════════════════════════════════════

WITH fk_tables AS (
    SELECT DISTINCT tc.table_name
    FROM information_schema.table_constraints AS tc
    WHERE tc.constraint_type IN ('FOREIGN KEY', 'PRIMARY KEY')
        AND tc.table_schema = 'public'
)
SELECT 
    '=== TABLES WITH NO FK RELATIONSHIPS ===' as section,
    t.table_name,
    'No foreign keys - check if needed' as note
FROM information_schema.tables t
WHERE t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
    AND t.table_name NOT IN (SELECT table_name FROM fk_tables)
ORDER BY t.table_name;

-- ═════════════════════════════════════════════════════════════════════════════
-- STEP 7: Check for Announcements/System Tables (May have duplicates)
-- ═════════════════════════════════════════════════════════════════════════════

SELECT 
    '=== ANNOUNCEMENT TABLES ===' as section,
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns 
     WHERE table_schema = 'public' 
     AND information_schema.columns.table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
    AND table_name LIKE '%announcement%'
ORDER BY table_name;

-- ═════════════════════════════════════════════════════════════════════════════
-- STEP 8: Summary - What Should Be Deleted
-- ═════════════════════════════════════════════════════════════════════════════

SELECT 
    '=== DELETION RECOMMENDATIONS ===' as section,
    'Category' as category,
    'Table Pattern' as pattern,
    'Reason' as reason;

-- Add actual recommendations
SELECT 
    '=== DELETION RECOMMENDATIONS ===',
    'Duplicate Quiz System',
    'quiz_questions, quiz_options',
    'Using challenges table instead'

UNION ALL

SELECT 
    '=== DELETION RECOMMENDATIONS ===',
    'Round 4 Specific',
    'turing_*, cipher_*, polyglot_*, etc',
    'Round 4 no longer in use'

UNION ALL

SELECT 
    '=== DELETION RECOMMENDATIONS ===',
    'Round 5 Specific',
    'architect_*, model_duel_*, negotiation_*, emergence_*',
    'Round 5 no longer in use'

UNION ALL

SELECT 
    '=== DELETION RECOMMENDATIONS ===',
    'Duplicate Scoring',
    'round5_score_events',
    'Redundant with score_events'

UNION ALL

SELECT 
    '=== DELETION RECOMMENDATIONS ===',
    'Empty Tables',
    'Check output from Step 5',
    'Tables with 0 rows';

-- ═════════════════════════════════════════════════════════════════════════════
-- STEP 9: Get Exact List of Tables to Drop
-- ═════════════════════════════════════════════════════════════════════════════

SELECT 
    '=== TABLES TO DROP (EXACT LIST) ===' as section,
    table_name,
    CASE 
        WHEN table_name IN ('quiz_questions', 'quiz_options') THEN 'Duplicate quiz system'
        WHEN table_name LIKE '%turing%' THEN 'Round 4 specific'
        WHEN table_name LIKE '%cipher%' THEN 'Round 4 specific'
        WHEN table_name LIKE '%polyglot%' THEN 'Round 4 specific'
        WHEN table_name LIKE '%jailbreak%' THEN 'Round 4 specific'
        WHEN table_name LIKE '%prompt_zipper%' THEN 'Round 4 specific'
        WHEN table_name LIKE '%visual_challenge%' THEN 'Round 4 specific'
        WHEN table_name LIKE '%lie_detector%' THEN 'Round 4 specific'
        WHEN table_name LIKE '%architect%' THEN 'Round 5 specific'
        WHEN table_name LIKE '%model_duel%' THEN 'Round 5 specific'
        WHEN table_name LIKE '%negotiation%' THEN 'Round 5 specific'
        WHEN table_name LIKE '%emergence%' THEN 'Round 5 specific'
        WHEN table_name = 'round5_score_events' THEN 'Duplicate scoring'
        WHEN table_name = 'system_announcements' THEN 'Duplicate announcements table'
    END as reason
FROM information_schema.tables
WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
    AND (
        table_name IN ('quiz_questions', 'quiz_options', 'round5_score_events', 'system_announcements')
        OR table_name LIKE '%turing%'
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
    )
ORDER BY reason, table_name;
