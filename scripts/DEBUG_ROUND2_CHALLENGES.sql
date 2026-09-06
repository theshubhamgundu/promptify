-- =====================================================
-- DEBUG: Round 2 Challenge Navigation Issue
-- =====================================================
-- Check the actual sub_round_number values in the database
-- to understand why navigation is failing
-- =====================================================

-- Find Round 2
SELECT 
    'ROUND 2 INFO' as section,
    id,
    title,
    description,
    round_number
FROM rounds 
WHERE title ILIKE '%prompt%' OR title ILIKE '%round 2%' OR round_number = 2
ORDER BY round_number;

-- Check prompt_challenges table (specific Round 2 table)
SELECT 
    'PROMPT_CHALLENGES TABLE' as section,
    id,
    round_id,
    sub_round_number,
    challenge_type,
    title,
    max_points,
    time_limit_seconds,
    max_attempts
FROM prompt_challenges
WHERE round_id IN (
    SELECT id FROM rounds 
    WHERE title ILIKE '%prompt%' OR title ILIKE '%round 2%' OR round_number = 2
)
ORDER BY sub_round_number;

-- Check generic challenges table 
SELECT 
    'GENERIC CHALLENGES TABLE' as section,
    id,
    round_id,
    order_index,
    sub_round_number,
    type,
    title,
    base_points,
    time_limit_seconds,
    max_attempts,
    configuration->>'challenge_type' as config_challenge_type
FROM challenges
WHERE round_id IN (
    SELECT id FROM rounds 
    WHERE title ILIKE '%prompt%' OR title ILIKE '%round 2%' OR round_number = 2
)
ORDER BY COALESCE(sub_round_number, order_index, 0);

-- Check if there are any challenges with duplicate sub_round_numbers
SELECT 
    'DUPLICATE SUB_ROUND CHECK' as section,
    round_id,
    sub_round_number,
    COUNT(*) as count
FROM (
    SELECT round_id, sub_round_number FROM prompt_challenges
    WHERE round_id IN (SELECT id FROM rounds WHERE title ILIKE '%prompt%' OR title ILIKE '%round 2%' OR round_number = 2)
    UNION ALL
    SELECT round_id, sub_round_number FROM challenges
    WHERE round_id IN (SELECT id FROM rounds WHERE title ILIKE '%prompt%' OR title ILIKE '%round 2%' OR round_number = 2)
    AND sub_round_number IS NOT NULL
) combined
GROUP BY round_id, sub_round_number
HAVING COUNT(*) > 1;

-- Final summary
SELECT 
    'SUMMARY' as section,
    (SELECT COUNT(*) FROM prompt_challenges WHERE round_id IN (SELECT id FROM rounds WHERE title ILIKE '%prompt%' OR title ILIKE '%round 2%' OR round_number = 2)) as prompt_challenges_count,
    (SELECT COUNT(*) FROM challenges WHERE round_id IN (SELECT id FROM rounds WHERE title ILIKE '%prompt%' OR title ILIKE '%round 2%' OR round_number = 2)) as generic_challenges_count;
