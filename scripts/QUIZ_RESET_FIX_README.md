# Quiz Reset Issue - Root Cause and Fix

## Problem Description

After an admin resets a quiz round from the Team Detail page, teams still see "already attempted" and cannot re-take the quiz.

## Root Cause

The issue is caused by orphaned records in the `quiz_sessions` table due to incomplete CASCADE deletion:

1. **`quiz_sessions` table has `UNIQUE(team_id, round_id)` constraint** - This prevents multiple quiz sessions for the same team/round combination

2. **When admin resets a round:**
   - Admin deletes `round_sessions` record
   - This should CASCADE delete to `quiz_sessions`, `quiz_answers`, and `challenge_attempts`
   - However, the CASCADE wasn't properly configured on all foreign keys

3. **When team tries to start quiz again:**
   - A new `round_sessions` is created ✅
   - But old `quiz_sessions` record still exists with old `round_session_id` ❌
   - UNIQUE constraint prevents creating new `quiz_sessions` ❌
   - Or orphaned answers cause the quiz to show as already attempted ❌

## Database Schema Issues

### Before Fix:

```sql
-- quiz_sessions had foreign key but CASCADE wasn't working properly
quiz_sessions.round_session_id -> round_sessions.id (CASCADE unclear)

-- Same issues with:
quiz_answers.round_session_id -> round_sessions.id
challenge_attempts.round_session_id -> round_sessions.id
```

### After Fix:

```sql
-- All properly CASCADE now
quiz_sessions.round_session_id -> round_sessions.id ON DELETE CASCADE
quiz_answers.round_session_id -> round_sessions.id ON DELETE CASCADE  
challenge_attempts.round_session_id -> round_sessions.id ON DELETE CASCADE
```

## Solution

Run the fix script to:
1. Fix CASCADE relationships
2. Clean up orphaned records
3. Add helper functions for diagnosis

## How to Apply the Fix

### Step 1: Run the Fix Script

```bash
# Using psql
psql -h <your-host> -d <your-db> -U <your-user> -f scripts/FIX_QUIZ_RESET_ISSUE.sql

# Or in Supabase SQL Editor:
# Copy and paste the contents of FIX_QUIZ_RESET_ISSUE.sql
```

### Step 2: Diagnose Existing Issues (Optional)

If teams are currently experiencing this issue, diagnose their data:

```sql
-- Replace with actual team_id and round_id
SELECT diagnose_quiz_reset_issues(
  '<team_id>'::uuid,
  '<round_id>'::uuid
);

-- Example output:
{
  "team_id": "...",
  "round_id": "...",
  "round_session_exists": false,
  "quiz_session_exists": true,  -- ❌ This is the problem!
  "orphaned_quiz_sessions": 1,   -- ❌ Orphaned record
  "has_issues": true             -- ❌ Needs cleanup
}
```

### Step 3: Clean Up Affected Teams (If Needed)

If diagnosis shows orphaned data:

```sql
-- Force clean the orphaned data
SELECT force_clean_quiz_data(
  '<team_id>'::uuid,
  '<round_id>'::uuid
);

-- Output:
{
  "success": true,
  "deleted_counts": {
    "quiz_sessions": 1,
    "quiz_answers": 5,
    "challenge_attempts": 5
  }
}
```

### Step 4: Verify the Fix

After running the fix, reset a round and verify:

1. Admin resets a quiz round for a team
2. Team can start the quiz again
3. No "already attempted" message
4. Fresh quiz with no previous answers

## Prevention

The fix ensures that future resets will work correctly because:

1. **CASCADE deletion** - When `round_sessions` is deleted, all related records automatically delete
2. **No orphaned records** - UNIQUE constraint won't block new attempts
3. **Clean state** - Teams start fresh after reset

## Testing

### Test Scenario:

1. Team attempts a quiz (answer some questions)
2. Admin resets the round from Team Detail page
3. Team should be able to start the quiz from scratch
4. No previous answers should be loaded
5. No "already attempted" errors

### Verification Query:

```sql
-- After reset, these should all return 0 rows:
SELECT * FROM quiz_sessions WHERE team_id = '<team_id>' AND round_id = '<round_id>';
SELECT * FROM quiz_answers WHERE team_id = '<team_id>' AND round_session_id = '<old_session_id>';
SELECT * FROM challenge_attempts WHERE round_session_id = '<old_session_id>';
```

## Related Files

- `scripts/FIX_QUIZ_RESET_ISSUE.sql` - The fix script
- `supabase/migrations/009_quiz_system.sql` - Original quiz schema
- `src/pages/admin/TeamDetail.tsx` - Admin reset implementation
- `src/pages/QuizRound.tsx` - Quiz initialization logic

## Additional Notes

### Why CASCADE Matters

Without proper CASCADE:
- Admin deletes `round_sessions`
- `quiz_sessions` remains with `round_session_id = <old_id>`
- UNIQUE constraint blocks new `quiz_sessions` creation
- Team cannot re-attempt quiz

With proper CASCADE:
- Admin deletes `round_sessions`
- `quiz_sessions`, `quiz_answers`, `challenge_attempts` auto-delete
- Team can create fresh `quiz_sessions`
- Everything works! ✅

### Other Affected Tables

This fix also applies to:
- `prompt_submissions`
- `submissions`
- `security_violations`
- `score_events`
- All Round 4 & 5 specific tables

These were already handled by `FIX_ROUND_RESET_CASCADE.sql`, but quiz tables needed additional attention due to the UNIQUE constraint.

## Support

If teams still experience issues after applying this fix:

1. Run the diagnosis function
2. Check for orphaned records
3. Use force clean function
4. Check browser console for errors
5. Verify Supabase RLS policies allow deletion
