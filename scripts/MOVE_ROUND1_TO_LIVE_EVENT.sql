-- =====================================================
-- Move Round 1 to LIVE Event
-- =====================================================
-- Round 1 belongs to a different event than rounds 2-5
-- This moves it to the LIVE event so it shows on dashboard
-- =====================================================

-- Step 1: Show current situation
SELECT 
    '=== BEFORE FIX ===' as status,
    r.order_index,
    r.name,
    r.event_id,
    e.name as event_name,
    e.status as event_status
FROM rounds r
LEFT JOIN events e ON r.event_id = e.id
WHERE r.order_index IN (1, 2)
ORDER BY r.order_index;

-- Step 2: Get the LIVE event ID and update Round 1
DO $$
DECLARE
    v_live_event_id UUID;
    v_round1_old_event_id UUID;
BEGIN
    -- Get LIVE event
    SELECT id INTO v_live_event_id
    FROM events
    WHERE status = 'LIVE'
    LIMIT 1;
    
    -- Get Round 1's current event
    SELECT event_id INTO v_round1_old_event_id
    FROM rounds
    WHERE order_index = 1;
    
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════';
    RAISE NOTICE '🔄 MOVING ROUND 1 TO LIVE EVENT';
    RAISE NOTICE '═══════════════════════════════════════════════════';
    RAISE NOTICE '';
    RAISE NOTICE 'LIVE event ID: %', v_live_event_id;
    RAISE NOTICE 'Round 1 old event ID: %', v_round1_old_event_id;
    RAISE NOTICE '';
    
    -- Update Round 1 to belong to LIVE event
    UPDATE rounds
    SET event_id = v_live_event_id,
        is_active = true  -- Also activate it while we're at it
    WHERE order_index = 1;
    
    RAISE NOTICE '✅ Round 1 moved to LIVE event!';
    RAISE NOTICE '✅ Round 1 activated (is_active = true)!';
    RAISE NOTICE '';
END $$;

-- Step 3: Verify the fix
SELECT 
    '=== AFTER FIX ===' as status,
    r.order_index,
    r.name,
    r.event_id,
    r.is_active,
    e.name as event_name,
    e.status as event_status,
    CASE 
        WHEN e.status = 'LIVE' AND r.is_active = true 
        THEN '✅ WILL SHOW ON DASHBOARD'
        ELSE '❌ STILL HIDDEN'
    END as dashboard_status
FROM rounds r
LEFT JOIN events e ON r.event_id = e.id
WHERE r.order_index IN (1, 2, 3, 4, 5)
ORDER BY r.order_index;

-- Step 4: Show all rounds in LIVE event
WITH live_event AS (
    SELECT id FROM events WHERE status = 'LIVE' LIMIT 1
)
SELECT 
    '=== ALL ROUNDS IN LIVE EVENT ===' as status,
    r.order_index,
    r.name,
    r.type,
    r.is_active,
    CASE 
        WHEN r.is_active THEN '✅ VISIBLE'
        ELSE '⚠️ HIDDEN'
    END as visibility
FROM rounds r
WHERE r.event_id = (SELECT id FROM live_event)
ORDER BY r.order_index;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════';
    RAISE NOTICE '✅ FIX COMPLETE!';
    RAISE NOTICE '═══════════════════════════════════════════════════';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 What to do now:';
    RAISE NOTICE '   1. Hard refresh your browser (Ctrl+Shift+R)';
    RAISE NOTICE '   2. Or clear cache (Ctrl+Shift+Delete)';
    RAISE NOTICE '   3. Or logout and login again';
    RAISE NOTICE '   4. Round 1 should now appear on dashboard!';
    RAISE NOTICE '';
    RAISE NOTICE '📋 What was fixed:';
    RAISE NOTICE '   • Round 1 moved from old event to LIVE event';
    RAISE NOTICE '   • Round 1 activated (is_active = true)';
    RAISE NOTICE '   • Round 1 now in same event as rounds 2-5';
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;
