-- Check existing Round 3 challenges
SELECT 
  c.id,
  c.order_index,
  c.title,
  c.challenge_type,
  c.base_points,
  c.configuration->'maxFiles' as max_files,
  (c.configuration->'subQuestions')::jsonb as sub_questions_count
FROM challenges c
JOIN rounds r ON c.round_id = r.id
WHERE r.name LIKE '%Round 3%'
ORDER BY c.order_index;
