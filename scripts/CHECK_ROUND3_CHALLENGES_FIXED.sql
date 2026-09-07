-- Check existing Round 3 challenges
SELECT 
  c.id,
  c.order_index,
  c.title,
  c.description,
  c.type,
  c.base_points,
  c.configuration->'maxFiles' as max_files,
  c.configuration->'timeLimitMinutes' as time_limit,
  jsonb_array_length(c.configuration->'subQuestions') as sub_questions_count
FROM challenges c
JOIN rounds r ON c.round_id = r.id
WHERE r.name = 'Stage 3: Vertex'
ORDER BY c.order_index;
