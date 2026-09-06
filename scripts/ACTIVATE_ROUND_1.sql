-- =====================================================
-- Activate Round 1 (Stage 1: Genesis)
-- =====================================================
-- This will make Round 1 visible on the dashboard
-- =====================================================

-- Show current status
SELECT 
    'BEFORE' as status,
    id,
    name,
    order_index,
    is_active,
    type
FROM rounds
WHERE order_index = 1;

-- Activate Round 1
UPDATE rounds
SET is_active = true
WHERE order_index = 1;

-- Show updated status
SELECT 
    'AFTER' as status,
    id,
    name,
    order_index,
    is_active,
    type
FROM rounds
WHERE order_index = 1;

-- Show all rounds status
SELECT 
    order_index,
    name,
    type,
    CASE 
        WHEN is_active THEN '✅ VISIBLE'
        ELSE '❌ HIDDEN'
    END as visibility
FROM rounds
ORDER BY order_index;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '═══════════════════════════════════════════════════';
    RAISE NOTICE '✅ Round 1 (Stage 1: Genesis) is now ACTIVE!';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 What to do now:';
    RAISE NOTICE '   1. Refresh your dashboard in the browser';
    RAISE NOTICE '   2. Round 1 should now appear in Event Rounds';
    RAISE NOTICE '   3. You can click on it to start the quiz';
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;
