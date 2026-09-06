# Reset Button Not Working - Emergency Fix

## Problem

Admin clicked "Reset ALL Rounds" button:
- ✅ Score dropped to 0 
- ❌ BUT rounds still show as "COMPLETED ✓" in admin panel
- ❌ Participant cannot re-attempt the rounds

## Root Cause

The `round_sessions` records were NOT deleted even though other data was removed. This is why:
1. Rounds still appear as completed
2. Dashboard still shows "COMPLETED ✓" badge
3. QuizRound redirects immediately (checks if round_sessions.status = 'COMPLETED')

## Immediate Fix Steps

### Step 1: Check Current Status

Run this in Supabase SQL Editor:

```sql
-- File: scripts/CHECK_RESET_STATUS.sql
-- Replace the team_id with your actual team ID
```

This will show you:
- How many `round_sessions` still exist (should be 0 after reset)
- How many `challenge_attempts` exist (should be 0)
- What the team's total_score is (should be 0)

### Step 2: Manual Reset

If `round_sessions` still exist, run this manual cleanup:

```sql
-- File: scripts/MANUAL_RESET_TEAM.sql
-- Replace 'adb9fcee-fe7b-44e8-a6b8-6420f1bceda7' with your team ID
```

This will:
1. Delete ALL related data for the team
2. Delete ALL round_sessions
3. Reset team score to 0
4. Show you counts of what was deleted

### Step 3: Verify and Test

1. Run `CHECK_RESET_STATUS.sql` again - should show 0 round_sessions
2. Refresh the admin dashboard - rounds should NOT show "COMPLETED ✓"
3. Login as the team - should be able to click and start rounds

## Long-term Fix

The issue is likely that:

### Issue 1: SECURITY DEFINER might not be working

The `admin_reset_all_rounds` function uses `SECURITY DEFINER` but might not have proper permissions.

**Fix:** Grant explicit DELETE permissions:

```sql
-- Grant DELETE permission on round_sessions to authenticated users
ALTER TABLE round_sessions ENABLE ROW LEVEL SECURITY;

-- Create policy for admins to delete via functions
CREATE POLICY "Allow admin function to delete round_sessions"
ON round_sessions
FOR DELETE
TO authenticated
USING (true);  -- SECURITY DEFINER handles the actual authorization

-- Do the same for other tables if needed
```

### Issue 2: Foreign Key Constraints blocking deletion

Some tables might have foreign keys preventing `round_sessions` from being deleted.

**Check constraints:**

```sql
SELECT
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'round_sessions'
    AND tc.constraint_type = 'FOREIGN KEY';
```

**If you find blocking constraints, you need to ensure CASCADE is set:**

```sql
-- Example: If round_sessions is referenced by other tables
ALTER TABLE other_table
DROP CONSTRAINT IF EXISTS fk_round_session_id;

ALTER TABLE other_table
ADD CONSTRAINT fk_round_session_id
FOREIGN KEY (round_session_id)
REFERENCES round_sessions(id)
ON DELETE CASCADE;  -- This ensures child records are deleted automatically
```

### Issue 3: RLS Policies too restrictive

Even with `SECURITY DEFINER`, if RLS policies are overly strict, deletions might fail.

**Temporarily disable RLS for testing:**

```sql
-- Check if RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'round_sessions';

-- If rowsecurity = true, temporarily disable for testing
ALTER TABLE round_sessions DISABLE ROW LEVEL SECURITY;

-- Try the reset function again
SELECT admin_reset_all_rounds('team-id-here');

-- If it works, RLS was the issue - need to fix policies
-- Re-enable RLS after testing
ALTER TABLE round_sessions ENABLE ROW LEVEL SECURITY;
```

## Testing Checklist

After running manual reset:

- [ ] Run `CHECK_RESET_STATUS.sql` - round_sessions count = 0
- [ ] Admin dashboard shows rounds without "COMPLETED ✓" badge
- [ ] Team score shows 0
- [ ] Team can click on rounds and start them
- [ ] After completing round, it shows as "COMPLETED ✓" again
- [ ] Admin reset button works again

## Frontend Cache Issue

If data is deleted but UI still shows "COMPLETED ✓":

1. **Hard refresh** the page (Ctrl+Shift+R or Cmd+Shift+R)
2. **Clear browser cache** for localhost
3. **Check browser console** for React state issues
4. **Real-time subscription** should auto-update (I added this in Dashboard.tsx)

## Files to Use

1. **`scripts/CHECK_RESET_STATUS.sql`** - Diagnostic script
2. **`scripts/MANUAL_RESET_TEAM.sql`** - Emergency manual reset
3. **`src/pages/Dashboard.tsx`** - Updated with real-time subscription

## Summary

**Immediate action:** Run `MANUAL_RESET_TEAM.sql` to manually delete round_sessions

**Root cause:** The `admin_reset_all_rounds` RPC function is not deleting `round_sessions` table records, likely due to:
- RLS policies blocking deletion
- Foreign key constraints
- SECURITY DEFINER not having proper permissions

**Long-term fix:** Investigate why the RPC function fails to delete round_sessions and fix the underlying permission/constraint issue.
