-- =====================================================
-- VERIFICATION: Round Reset Cascade Fixes
-- =====================================================
-- This script verifies that the cascade fixes are
-- properly applied and working correctly.
-- =====================================================

DO $$
DECLARE
    v_score_events_cascade BOOLEAN;
    v_violations_cascade BOOLEAN;
    v_score_events_index_exists BOOLEAN;
    v_violations_index_exists BOOLEAN;
    v_reset_function_exists BOOLEAN;
    v_reset_all_function_exists BOOLEAN;
    v_view_exists BOOLEAN;
    v_orphaned_count INT;
    v_all_checks_passed BOOLEAN := true;
BEGIN
    RAISE NOTICE '🔍 Verifying Round Reset Cascade Fixes...';
    RAISE NOTICE '';
    
    -- =====================================================
    -- 1. Check score_events cascade
    -- =====================================================
    SELECT 
        confdeltype = 'c' INTO v_score_events_cascade
    FROM pg_constraint
    WHERE conname = 'score_events_round_session_id_fkey';
    
    IF v_score_events_cascade THEN
        RAISE NOTICE '✅ score_events: ON DELETE CASCADE configured';
    ELSE
        RAISE NOTICE '❌ score_events: ON DELETE CASCADE NOT configured';
        v_all_checks_passed := false;
    END IF;
    
    -- =====================================================
    -- 2. Check security_violations cascade
    -- =====================================================
    SELECT 
        confdeltype = 'c' INTO v_violations_cascade
    FROM pg_constraint
    WHERE conname = 'security_violations_round_session_id_fkey';
    
    IF v_violations_cascade THEN
        RAISE NOTICE '✅ security_violations: ON DELETE CASCADE configured';
    ELSE
        RAISE NOTICE '❌ security_violations: ON DELETE CASCADE NOT configured';
        v_all_checks_passed := false;
    END IF;
    
    -- =====================================================
    -- 3. Check indexes exist
    -- =====================================================
    SELECT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_score_events_round_session_id'
    ) INTO v_score_events_index_exists;
    
    IF v_score_events_index_exists THEN
        RAISE NOTICE '✅ Index on score_events.round_session_id exists';
    ELSE
        RAISE NOTICE '⚠️  Index on score_events.round_session_id missing (optional)';
    END IF;
    
    SELECT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_security_violations_round_session_id'
    ) INTO v_violations_index_exists;
    
    IF v_violations_index_exists THEN
        RAISE NOTICE '✅ Index on security_violations.round_session_id exists';
    ELSE
        RAISE NOTICE '⚠️  Index on security_violations.round_session_id missing (optional)';
    END IF;
    
    -- =====================================================
    -- 4. Check functions exist
    -- =====================================================
    SELECT EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'admin_reset_team_round'
    ) INTO v_reset_function_exists;
    
    IF v_reset_function_exists THEN
        RAISE NOTICE '✅ Function admin_reset_team_round() exists';
    ELSE
        RAISE NOTICE '⚠️  Function admin_reset_team_round() missing (optional)';
    END IF;
    
    SELECT EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'admin_reset_all_team_rounds'
    ) INTO v_reset_all_function_exists;
    
    IF v_reset_all_function_exists THEN
        RAISE NOTICE '✅ Function admin_reset_all_team_rounds() exists';
    ELSE
        RAISE NOTICE '⚠️  Function admin_reset_all_team_rounds() missing (optional)';
    END IF;
    
    -- =====================================================
    -- 5. Check view exists
    -- =====================================================
    SELECT EXISTS (
        SELECT 1 FROM pg_views 
        WHERE viewname = 'v_orphaned_score_events'
    ) INTO v_view_exists;
    
    IF v_view_exists THEN
        RAISE NOTICE '✅ View v_orphaned_score_events exists';
    ELSE
        RAISE NOTICE '⚠️  View v_orphaned_score_events missing (optional)';
    END IF;
    
    -- =====================================================
    -- 6. Check for orphaned records
    -- =====================================================
    IF v_view_exists THEN
        SELECT COUNT(*) INTO v_orphaned_count
        FROM v_orphaned_score_events;
        
        IF v_orphaned_count = 0 THEN
            RAISE NOTICE '✅ No orphaned score_events found';
        ELSE
            RAISE NOTICE '❌ Found % orphaned score_events!', v_orphaned_count;
            RAISE NOTICE '   Run: SELECT * FROM v_orphaned_score_events;';
            v_all_checks_passed := false;
        END IF;
    END IF;
    
    -- =====================================================
    -- Final Summary
    -- =====================================================
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    IF v_all_checks_passed THEN
        RAISE NOTICE '✅ ALL CRITICAL CHECKS PASSED!';
        RAISE NOTICE '';
        RAISE NOTICE '🎉 Round reset functionality is properly configured.';
        RAISE NOTICE '   You can now safely reset rounds from the admin UI.';
    ELSE
        RAISE NOTICE '❌ SOME CHECKS FAILED!';
        RAISE NOTICE '';
        RAISE NOTICE '⚠️  Please run FIX_ROUND_RESET_CASCADE.sql to fix issues.';
    END IF;
    RAISE NOTICE '========================================';
    
END $$;

-- =====================================================
-- Show constraint details for manual verification
-- =====================================================
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    CASE rc.delete_rule 
        WHEN 'CASCADE' THEN '✅ CASCADE'
        WHEN 'SET NULL' THEN '⚠️  SET NULL'
        ELSE rc.delete_rule 
    END as on_delete_action
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints AS rc
    ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND (
    (tc.table_name = 'score_events' AND kcu.column_name = 'round_session_id')
    OR (tc.table_name = 'security_violations' AND kcu.column_name = 'round_session_id')
  )
ORDER BY tc.table_name;
