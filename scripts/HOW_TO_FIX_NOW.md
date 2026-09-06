# How to Fix Quiz Reset Issue - RIGHT NOW

## The Problem

You reset the quiz round, but when you try to take it again, it still shows your previous answers (Questions 1, 2, 3 marked as answered with checkmarks).

## Why This Happens

The database has "orphaned" quiz data that wasn't deleted when you clicked reset. The foreign key CASCADE wasn't configured properly.

## Solution - Follow These Steps

### Option 1: Quick Fix (Fastest - Do This First)

This will fix YOUR current issue immediately:

1. **Open Supabase SQL Editor**
   - Go to your Supabase project
   - Click "SQL Editor" in the left sidebar

2. **Find Your IDs**
   
   Run this query:
   ```sql
   -- Find your team
   SELECT id, name FROM teams ORDER BY created_at DESC;
   
   -- Find the quiz round
   SELECT id, name, type FROM rounds 
   WHERE type IN ('QUIZ', 'KNOWLEDGE_TEST') 
   ORDER BY order_index;
   ```
   
   Copy your `team_id` and `round_id` (the UUID values)

3. **Run the Immediate Fix**
   
   - Open file: `scripts/IMMEDIATE_QUIZ_FIX.sql`
   - Replace `<YOUR_TEAM_ID>` with your actual team UUID
   - Replace `<YOUR_ROUND_ID>` with the quiz round UUID
   - Copy the entire modified script
   - Paste into Supabase SQL Editor
   - Click "Run"

4. **Refresh Browser**
   
   - Close the quiz tab
   - Go back to dashboard
   - Click on the quiz round again
   - It should now start fresh!

### Option 2: Permanent Fix (Prevents Future Issues)

After the quick fix works, run this to prevent it from happening again:

1. **Open Supabase SQL Editor**

2. **Run the Permanent Fix**
   
   - Open file: `scripts/RUN_THIS_FIRST.sql`
   - Copy the entire script
   - Paste into Supabase SQL Editor
   - Click "Run"

3. **Verify Success**
   
   You should see:
   ```
   ✅ QUIZ RESET FIX COMPLETE!
   ✅ CASCADE configured correctly
   ```

### Option 3: If You're Still Having Issues

If the above doesn't work, try this nuclear option:

```sql
-- Replace with your actual team_id and round_id
BEGIN;

-- Delete everything for this team/round
DELETE FROM quiz_sessions 
WHERE team_id = '<YOUR_TEAM_ID>' 
  AND round_id = '<YOUR_ROUND_ID>';

DELETE FROM quiz_answers 
WHERE team_id = '<YOUR_TEAM_ID>'
  AND question_id IN (
    SELECT id FROM quiz_questions WHERE round_id = '<YOUR_ROUND_ID>'
  );

DELETE FROM round_sessions 
WHERE team_id = '<YOUR_TEAM_ID>' 
  AND round_id = '<YOUR_ROUND_ID>';

COMMIT;
```

Then refresh your browser.

## What Each Script Does

### `IMMEDIATE_QUIZ_FIX.sql`
- Cleans up YOUR specific quiz data
- Removes orphaned records
- Lets you start the quiz fresh
- ⏱️ Takes: 5 seconds

### `RUN_THIS_FIRST.sql`
- Fixes the CASCADE relationships (permanent)
- Cleans up ALL orphaned data for ALL teams
- Prevents future reset issues
- ⏱️ Takes: 10 seconds

### `FIX_QUIZ_RESET_ISSUE.sql`
- Complete solution with helper functions
- Includes diagnostic tools
- For advanced troubleshooting
- ⏱️ Takes: 15 seconds

## Verification

After running the fix, verify it worked:

```sql
-- Check if your data is clean
SELECT COUNT(*) FROM quiz_sessions 
WHERE team_id = '<YOUR_TEAM_ID>' 
  AND round_id = '<YOUR_ROUND_ID>';
-- Should return: 0

SELECT COUNT(*) FROM quiz_answers 
WHERE team_id = '<YOUR_TEAM_ID>'
  AND question_id IN (
    SELECT id FROM quiz_questions WHERE round_id = '<YOUR_ROUND_ID>'
  );
-- Should return: 0
```

Both should return `0` if the cleanup worked.

## Expected Behavior After Fix

1. ✅ Admin resets quiz round
2. ✅ ALL quiz data is deleted (answers, sessions, etc.)
3. ✅ Team refreshes browser
4. ✅ Quiz starts completely fresh
5. ✅ No previous answers shown
6. ✅ No "already attempted" errors

## Still Not Working?

If you're still having issues after trying all the above:

1. Check browser console for errors (F12 → Console tab)
2. Try logging out and logging back in
3. Clear browser cache (Ctrl+Shift+Delete)
4. Make sure you're using the correct team_id and round_id
5. Check if there are RLS (Row Level Security) policies blocking deletion

## Need Help?

The issue is in these database tables:
- `quiz_sessions` - Tracks quiz progress
- `quiz_answers` - Stores team answers
- `challenge_attempts` - Alternative answer storage
- `round_sessions` - Parent session record

When you reset, ALL of these need to be deleted. The CASCADE fix ensures this happens automatically.
