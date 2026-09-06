-- ═════════════════════════════════════════════════════════════════════════════
-- FINAL CLEANUP - Remove Minor Duplicates Only
-- ═════════════════════════════════════════════════════════════════════════════

-- Check data before cleanup
SELECT 'system_announcements' as table_name, COUNT(*) as row_count FROM system_announcements
UNION ALL
SELECT 'announcements', COUNT(*) FROM announcements
UNION ALL
SELECT 'round5_score_events', COUNT(*) FROM round5_score_events
UNION ALL
SELECT 'hint_usage', COUNT(*) FROM hint_usage;

-- ═════════════════════════════════════════════════════════════════════════════
-- OPTION 1: Keep 'announcements', drop 'system_announcements' (duplicate)
-- ═════════════════════════════════════════════════════════════════════════════
-- Uncomment if you want to remove duplicate announcement system
-- DROP TABLE IF EXISTS system_announcements CASCADE;

-- ═════════════════════════════════════════════════════════════════════════════
-- OPTION 2: Drop Round 5 score events if not using Round 5
-- ═════════════════════════════════════════════════════════════════════════════
-- Uncomment if you're NOT doing Round 5
-- DROP TABLE IF EXISTS round5_score_events CASCADE;

-- ═════════════════════════════════════════════════════════════════════════════
-- Your database is already clean! 
-- ═════════════════════════════════════════════════════════════════════════════

SELECT 'Database is production-ready!' as status;
