-- Check what challenge types are valid
SELECT 
  c.type,
  COUNT(*) as count
FROM challenges c
GROUP BY c.type;
