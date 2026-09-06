-- Quick fix: Delete round_sessions for Team Beta Test
-- This will allow them to re-attempt the rounds

DELETE FROM round_sessions 
WHERE team_id = 'adb9fcee-fe7b-44e8-a6b8-6420f1bceda7';

-- Verify deletion
SELECT 
    'VERIFICATION' as check,
    COUNT(*) as round_sessions_remaining
FROM round_sessions 
WHERE team_id = 'adb9fcee-fe7b-44e8-a6b8-6420f1bceda7';

-- Should return 0
