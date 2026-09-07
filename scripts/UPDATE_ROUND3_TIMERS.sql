-- ════════════════════════════════════════════════════════════════
-- UPDATE ROUND 3 CHALLENGE TIMERS TO 8 MINUTES EACH
-- Total: 5 challenges × 8 minutes = 40 minutes
-- ════════════════════════════════════════════════════════════════

UPDATE challenges
SET configuration = jsonb_set(
  configuration, 
  '{timeLimitMinutes}', 
  '8'
)
WHERE round_id = (SELECT id FROM rounds WHERE name = 'Stage 3: Vertex' LIMIT 1);

-- Verify the update
SELECT 
  title,
  configuration->'timeLimitMinutes' as time_limit_minutes
FROM challenges
WHERE round_id = (SELECT id FROM rounds WHERE name = 'Stage 3: Vertex' LIMIT 1)
ORDER BY order_index;
