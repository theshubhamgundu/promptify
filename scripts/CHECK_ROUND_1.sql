-- =====================================================
-- Check Round 1 Status
-- =====================================================
-- This script checks if Round 1 exists and why it might
-- not be showing on the dashboard
-- =====================================================

-- Check all rounds
SELECT 
    id,
    name,
    type,
    order_index,
    is_active,
    event_id,
    duration_minutes,
    description,
    created_at
FROM rounds
ORDER BY order_index;

-- Check if Round 1 specifically exists
SELECT 
    'Round 1 Check' as check_type,
    CASE 
        WHEN COUNT(*) = 0 THEN '❌ Round 1 (order_index=1) does NOT exist'
        ELSE '✅ Round 1 (order_index=1) exists'
    END as status,
    COUNT(*) as count
FROM rounds
WHERE order_index = 1;

-- Show Round 1 details if it exists
SELECT 
    'Round 1 Details' as info,
    id,
    name,
    type,
    is_active,
    order_index,
    event_id
FROM rounds
WHERE order_index = 1;

-- Check if there's a round with name containing "Genesis" or "Stage 1"
SELECT 
    'Genesis/Stage 1 Search' as info,
    id,
    name,
    type,
    order_index,
    is_active
FROM rounds
WHERE name ILIKE '%genesis%' OR name ILIKE '%stage 1%'
ORDER BY order_index;

-- Count total rounds
SELECT 
    'Total Rounds' as info,
    COUNT(*) as total_rounds,
    COUNT(*) FILTER (WHERE is_active = true) as active_rounds,
    COUNT(*) FILTER (WHERE is_active = false) as inactive_rounds
FROM rounds;

-- Show all rounds with their visibility status
SELECT 
    order_index,
    name,
    type,
    CASE 
        WHEN is_active THEN '✅ VISIBLE (is_active=true)'
        ELSE '❌ HIDDEN (is_active=false)'
    END as visibility_status,
    id
FROM rounds
ORDER BY order_index;
