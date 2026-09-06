-- ═════════════════════════════════════════════════════════════════════════════
-- SAFE DATABASE AUDIT - Only Query Tables That Exist
-- ═════════════════════════════════════════════════════════════════════════════

-- ═════════════════════════════════════════════════════════════════════════════
-- STEP 1: List ALL Tables with Row Counts
-- ═════════════════════════════════════════════════════════════════════════════

SELECT 
    '=== ALL TABLES WITH DATA ===' as section,
    relname as table_name,
    n_live_tup as row_count,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||relname)) as total_size,
    CASE 
        WHEN n_live_tup = 0 THEN '⚠️ EMPTY'
        WHEN n_live_tup < 10 THEN '📊 Few Rows'
        ELSE '✓ Has Data'
    END as status
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC, relname;

-- ═════════════════════════════════════════════════════════════════════════════
-- STEP 2: All Table Names (Simple List)
-- ═════════════════════════════════════════════════════════════════════════════

SELECT 
    '=== COMPLETE TABLE LIST ===' as section,
    table_name
FROM information_schema.tables
WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- ═════════════════════════════════════════════════════════════════════════════
-- STEP 3: Identify Round-Specific Tables
-- ═════════════════════════════════════════════════════════════════════════════

SELECT 
    '=== ROUND-SPECIFIC TABLES ===' as section,
    table_name,
    CASE 
        WHEN table_name LIKE '%turing%' THEN '⚠️ Round 4 (Turing Test)'
        WHEN table_name LIKE '%cipher%' THEN '⚠️ Round 4 (Cipher)'
        WHEN table_name LIKE '%polyglot%' THEN '⚠️ Round 4 (Polyglot)'
        WHEN table_name LIKE '%jailbreak%' THEN '⚠️ Round 4 (Jailbreak)'
        WHEN table_name LIKE '%prompt_zipper%' THEN '⚠️ Round 4 (Zipper)'
        WHEN table_name LIKE '%visual_challenge%' THEN '⚠️ Round 4 (Visual)'
        WHEN table_name LIKE '%lie_detector%' THEN '⚠️ Round 4 (Lie Detector)'
        WHEN table_name LIKE '%architect%' THEN '⚠️ Round 5 (Architect)'
        WHEN table_name LIKE '%model_duel%' THEN '⚠️ Round 5 (Model Duel)'
        WHEN table_name LIKE '%negotiation%' THEN '⚠️ Round 5 (Negotiation)'
        WHEN table_name LIKE '%emergence%' THEN '⚠️ Round 5 (Emergence)'
        WHEN table_name = 'round5_score_events' THEN '⚠️ Round 5 Scoring'
    END as classification
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
    )
ORDER BY classification, table_name;

-- ═════════════════════════════════════════════════════════════════════════════
-- STEP 4: Check Duplicate Announcement Tables
-- ═════════════════════════════════════════════════════════════════════════════

SELECT 
    '=== ANNOUNCEMENT TABLES ===' as section,
    table_name,
    (SELECT n_live_tup FROM pg_stat_user_tables 
     WHERE schemaname = 'public' AND relname = t.table_name) as row_count
FROM information_schema.tables t
WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
    AND table_name LIKE '%announcement%'
ORDER BY table_name;

-- ═════════════════════════════════════════════════════════════════════════════
-- STEP 5: Check Scoring Tables
-- ═════════════════════════════════════════════════════════════════════════════

SELECT 
    '=== SCORING TABLES ===' as section,
    table_name,
    (SELECT n_live_tup FROM pg_stat_user_tables 
     WHERE schemaname = 'public' AND relname = t.table_name) as row_count,
    CASE 
        WHEN table_name = 'score_events' THEN '✓ Primary scoring'
        WHEN table_name = 'round5_score_events' THEN '⚠️ Duplicate - Round 5 only'
        ELSE 'Other'
    END as usage
FROM information_schema.tables t
WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
    AND table_name LIKE '%score%'
ORDER BY table_name;

-- ═════════════════════════════════════════════════════════════════════════════
-- STEP 6: Empty Tables (Deletion Candidates)
-- ═════════════════════════════════════════════════════════════════════════════

SELECT 
    '=== EMPTY TABLES ===' as section,
    relname as table_name,
    n_live_tup as row_count,
    '⚠️ No data - safe to drop' as recommendation
FROM pg_stat_user_tables
WHERE schemaname = 'public'
    AND n_live_tup = 0
ORDER BY relname;

-- ═════════════════════════════════════════════════════════════════════════════
-- STEP 7: Tables With team_id Column (Used by Admin Reset)
-- ═════════════════════════════════════════════════════════════════════════════

SELECT 
    '=== TABLES WITH team_id ===' as section,
    table_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'public' 
    AND column_name = 'team_id'
ORDER BY table_name;

-- ═════════════════════════════════════════════════════════════════════════════
-- STEP 8: Tables With round_session_id Column (Used by Admin Reset)
-- ═════════════════════════════════════════════════════════════════════════════

SELECT 
    '=== TABLES WITH round_session_id ===' as section,
    table_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'public' 
    AND column_name = 'round_session_id'
ORDER BY table_name;

-- ═════════════════════════════════════════════════════════════════════════════
-- STEP 9: Foreign Key Cascade Status (Missing CASCADE = Problem)
-- ═════════════════════════════════════════════════════════════════════════════

SELECT 
    '=== CASCADE STATUS ===' as section,
    tc.table_name as child_table,
    kcu.column_name as child_column,
    ccu.table_name AS parent_table,
    rc.delete_rule as action,
    CASE 
        WHEN rc.delete_rule = 'CASCADE' THEN '✓ Good'
        WHEN kcu.column_name IN ('team_id', 'round_session_id', 'round_id') 
            AND rc.delete_rule != 'CASCADE' THEN '⚠️ SHOULD BE CASCADE'
        ELSE 'OK'
    END as status
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints AS rc
    ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
ORDER BY 
    CASE WHEN rc.delete_rule != 'CASCADE' THEN 0 ELSE 1 END,
    tc.table_name;

-- ═════════════════════════════════════════════════════════════════════════════
-- STEP 10: FINAL RECOMMENDATION - Tables to Delete
-- ═════════════════════════════════════════════════════════════════════════════

SELECT 
    '=== TABLES TO DELETE ===' as section,
    table_name,
    (SELECT n_live_tup FROM pg_stat_user_tables 
     WHERE schemaname = 'public' AND relname = t.table_name) as current_rows,
    CASE 
        WHEN table_name LIKE '%turing%' THEN 'Round 4 specific - no longer used'
        WHEN table_name LIKE '%cipher%' THEN 'Round 4 specific - no longer used'
        WHEN table_name LIKE '%polyglot%' THEN 'Round 4 specific - no longer used'
        WHEN table_name LIKE '%jailbreak%' THEN 'Round 4 specific - no longer used'
        WHEN table_name LIKE '%prompt_zipper%' THEN 'Round 4 specific - no longer used'
        WHEN table_name LIKE '%visual_challenge%' THEN 'Round 4 specific - no longer used'
        WHEN table_name LIKE '%lie_detector%' THEN 'Round 4 specific - no longer used'
        WHEN table_name LIKE '%architect%' THEN 'Round 5 specific - no longer used'
        WHEN table_name LIKE '%model_duel%' THEN 'Round 5 specific - no longer used'
        WHEN table_name LIKE '%negotiation%' THEN 'Round 5 specific - no longer used'
        WHEN table_name LIKE '%emergence%' THEN 'Round 5 specific - no longer used'
        WHEN table_name = 'round5_score_events' THEN 'Duplicate - use score_events instead'
        WHEN table_name = 'system_announcements' THEN 'Duplicate - use announcements instead'
    END as reason
FROM information_schema.tables t
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
        OR table_name IN ('round5_score_events', 'system_announcements')
    )
ORDER BY reason, table_name;
