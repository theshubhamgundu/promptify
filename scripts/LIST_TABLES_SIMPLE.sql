-- Simple list of tables with team_id column
SELECT table_name
FROM information_schema.columns
WHERE table_schema = 'public' 
    AND column_name = 'team_id'
ORDER BY table_name;
