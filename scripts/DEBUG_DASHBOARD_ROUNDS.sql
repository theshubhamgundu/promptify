-- =====================================================
-- Debug Dashboard Rounds Display Issue
-- =====================================================
-- This checks why Round 1 isn't showing on dashboard
-- =====================================================

-- Check all events
SELECT 
    '=== ALL EVENTS ===' as section,
    id,
    name,
    status,
    start_time,
    end_time
FROM events
ORDER BY created_at DESC;

-- Check rounds for each event
SELECT 
    '=== ROUNDS BY EVENT ===' as section,
    r.order_index,
    r.name,
    r.type,
    r.is_active,
    r.event_id,
    e.name as event_name,
    r.id as round_id
FROM rounds r
LEFT JOIN events e ON r.event_id = e.id
ORDER BY r.event_id, r.order_index;

-- Check if Round 1 has same event_id as other rounds
SELECT 
    '=== EVENT ID CONSISTENCY CHECK ===' as section,
    order_index,
    name,
    event_id,
    CASE 
        WHEN event_id = (SELECT event_id FROM rounds WHERE order_index = 2) 
        THEN '✅ Same event as Round 2'
        ELSE '❌ DIFFERENT event!'
    END as consistency_check
FROM rounds
WHERE order_index IN (1, 2, 3, 4, 5)
ORDER BY order_index;

-- Check current LIVE or active event
SELECT 
    '=== CURRENT EVENT ===' as section,
    id,
    name,
    status,
    CASE 
        WHEN status = 'LIVE' THEN '✅ This is the LIVE event'
        ELSE '⚠️ Not LIVE'
    END as status_check
FROM events
WHERE status = 'LIVE'
ORDER BY created_at DESC
LIMIT 1;

-- Check which rounds belong to LIVE event
WITH live_event AS (
    SELECT id FROM events WHERE status = 'LIVE' LIMIT 1
)
SELECT 
    '=== ROUNDS IN LIVE EVENT ===' as section,
    r.order_index,
    r.name,
    r.type,
    r.is_active,
    CASE 
        WHEN r.is_active THEN '✅ ACTIVE (should show)'
        ELSE '❌ INACTIVE (hidden)'
    END as should_display
FROM rounds r
WHERE r.event_id = (SELECT id FROM live_event)
ORDER BY r.order_index;

-- DIAGNOSIS: Find the problem
DO $$
DECLARE
    v_live_event_id UUID;
    v_round1_event_id UUID;
    v_round1_active BOOLEAN;
    v_round1_exists BOOLEAN;
BEGIN
    -- Get LIVE event
    SELECT id INTO v_live_event_id
    FROM events
    WHERE status = 'LIVE'
    LIMIT 1;
    
    -- Check Round 1
    SELECT 
        event_id,
        is_active,
        TRUE
    INTO v_round1_event_id, v_round1_active, v_round1_exists
    FROM rounds
    WHERE order_index = 1;
    
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════';
    RAISE NOTICE '🔍 DIAGNOSIS: Why Round 1 Not Showing';
    RAISE NOTICE '═══════════════════════════════════════════════════';
    RAISE NOTICE '';
    
    IF NOT v_round1_exists THEN
        RAISE NOTICE '❌ PROBLEM: Round 1 does not exist!';
        RAISE NOTICE '   Solution: Create Round 1';
    ELSIF v_round1_event_id != v_live_event_id THEN
        RAISE NOTICE '❌ PROBLEM: Round 1 belongs to different event!';
        RAISE NOTICE '   Round 1 event_id: %', v_round1_event_id;
        RAISE NOTICE '   LIVE event_id: %', v_live_event_id;
        RAISE NOTICE '';
        RAISE NOTICE '   Solution: Update Round 1 to belong to LIVE event';
        RAISE NOTICE '   Run: UPDATE rounds SET event_id = ''%'' WHERE order_index = 1;', v_live_event_id;
    ELSIF NOT v_round1_active THEN
        RAISE NOTICE '❌ PROBLEM: Round 1 is_active = false';
        RAISE NOTICE '   Solution: UPDATE rounds SET is_active = true WHERE order_index = 1;';
    ELSE
        RAISE NOTICE '✅ Round 1 looks correct in database!';
        RAISE NOTICE '   Round 1 exists: YES';
        RAISE NOTICE '   Round 1 is_active: %', v_round1_active;
        RAISE NOTICE '   Round 1 in LIVE event: YES';
        RAISE NOTICE '';
        RAISE NOTICE '⚠️  If not showing on dashboard, try:';
        RAISE NOTICE '   1. Hard refresh browser (Ctrl+Shift+R)';
        RAISE NOTICE '   2. Clear browser cache';
        RAISE NOTICE '   3. Logout and login again';
        RAISE NOTICE '   4. Check browser console for errors (F12)';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;
