-- ═════════════════════════════════════════════════════════════════════════════
-- DATABASE ANALYSIS - Complete Schema Review
-- ═════════════════════════════════════════════════════════════════════════════

-- 1. LIST ALL TABLES
SELECT 
    '=== ALL TABLES ===' as section,
    schemaname,
    tablename,
    CASE 
        WHEN rowsecurity THEN '🔒 RLS ENABLED'
        ELSE '⚠️ RLS DISABLED'
    END as security_status
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- 2. TABLE COLUMNS - Show all columns for each table
SELECT 
    '=== TABLE COLUMNS ===' as section,
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- 3. FOREIGN KEY RELATIONSHIPS
SELECT 
    '=== FOREIGN KEYS ===' as section,
    tc.table_name as child_table,
    kcu.column_name as child_column,
    ccu.table_name AS parent_table,
    ccu.column_name AS parent_column,
    rc.delete_rule as on_delete_action
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints AS rc
    ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

-- 4. TABLES WITH team_id COLUMN (Critical for reset operations)
SELECT 
    '=== TABLES WITH team_id ===' as section,
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'public' 
    AND column_name = 'team_id'
ORDER BY table_name;

-- 5. TABLES WITH round_session_id COLUMN
SELECT 
    '=== TABLES WITH round_session_id ===' as section,
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'public' 
    AND column_name = 'round_session_id'
ORDER BY table_name;

-- 6. UNIQUE CONSTRAINTS (Important for duplicate key errors)
SELECT 
    '=== UNIQUE CONSTRAINTS ===' as section,
    tc.table_name,
    tc.constraint_name,
    string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as constrained_columns
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'UNIQUE'
    AND tc.table_schema = 'public'
GROUP BY tc.table_name, tc.constraint_name
ORDER BY tc.table_name;

-- 7. PRIMARY KEYS
SELECT 
    '=== PRIMARY KEYS ===' as section,
    tc.table_name,
    kcu.column_name as primary_key_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'PRIMARY KEY'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name;

-- 8. RLS POLICIES
SELECT 
    '=== RLS POLICIES ===' as section,
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd as operation,
    qual as using_expression
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 9. CUSTOM FUNCTIONS (Including our reset functions)
SELECT 
    '=== CUSTOM FUNCTIONS ===' as section,
    n.nspname as schema,
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments,
    pg_get_function_result(p.oid) as return_type,
    CASE 
        WHEN p.prosecdef THEN '🔒 SECURITY DEFINER'
        ELSE 'SECURITY INVOKER'
    END as security_mode
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
    AND p.prokind = 'f'
ORDER BY p.proname;

-- 10. TABLE ROW COUNTS (Actual data in tables)
SELECT 
    '=== TABLE ROW COUNTS ===' as section,
    schemaname,
    relname as table_name,
    n_live_tup as approximate_row_count
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC;

-- 11. CHECK FOR MISSING CASCADE RELATIONSHIPS
-- These are foreign keys that DON'T have ON DELETE CASCADE
SELECT 
    '=== MISSING CASCADE (POTENTIAL ISSUES) ===' as section,
    tc.table_name as child_table,
    kcu.column_name as child_column,
    ccu.table_name AS parent_table,
    rc.delete_rule as current_action,
    '⚠️ SHOULD BE CASCADE' as recommendation
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints AS rc
    ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND rc.delete_rule != 'CASCADE'
    AND (kcu.column_name IN ('round_session_id', 'team_id', 'round_id'))
ORDER BY tc.table_name;
