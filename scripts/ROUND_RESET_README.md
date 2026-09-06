# Round Reset System - Complete Guide

## 🎯 Problem Summary

After resetting rounds in the admin UI, teams still see old scores and can access previously completed rounds. This happens because:

1. **`score_events` table** - Not deleted during reset (main cause)
2. **Orphaned records** - Quiz answers, submissions remain even after `round_sessions` deleted
3. **CASCADE issues** - Some FK constraints use `SET NULL` instead of `CASCADE`

---

## ✅ Solution Overview

We've implemented a 3-layer solution:

### Layer 1: Database Fixes (ONE-TIME)
- Fix FK constraints to use `CASCADE` instead of `SET NULL`
- Add indexes for better performance
- Create helper functions for SQL-based resets

### Layer 2: Admin UI (ONGOING)
- Reset Individual Round button
- Reset ALL Rounds button  
- Comprehensive deletion logic in frontend

### Layer 3: Diagnostic & Cleanup Tools
- Scripts to diagnose issues
- Scripts to forcefully clean up orphaned data

---

## 📋 Step-by-Step Fix Instructions

### Step 1: Run Database Fix (ONE-TIME)

**File:** `FIX_ROUND_RESET_CASCADE.sql`

**What it does:**
- Changes `score_events.round_session_id` FK from `SET NULL` to `CASCADE`
- Changes `security_violations.round_session_id` FK from `SET NULL` to `CASCADE`
- Adds performance indexes
- Creates helper functions

**How to run:**
1. Open Supabase SQL Editor
2. Copy entire content of `FIX_ROUND_RESET_CASCADE.sql`
3. Click "Run"
4. ✅ You should see success messages

**Rollback:** If needed, run `ROLLBACK_ROUND_RESET_CASCADE.sql`

---

### Step 2: Verify Fixes Applied

**File:** `VERIFY_ROUND_RESET_FIX.sql`

**What it does:**
- Checks if CASCADE constraints are properly configured
- Reports on indexes and functions
- Shows constraint details

**How to run:**
1. Open Supabase SQL Editor
2. Copy entire content of `VERIFY_ROUND_RESET_FIX.sql`
3. Click "Run"
4. ✅ You should see "ALL CRITICAL CHECKS PASSED"

**Expected output:**
```
✅ score_events: ON DELETE CASCADE configured
✅ security_violations: ON DELETE CASCADE configured
✅ Index on score_events.round_session_id exists
...
✅ ALL CRITICAL CHECKS PASSED!
```

---

### Step 3: Clean Up Existing Orphaned Data

**File:** `CLEANUP_ORPHANED_DATA.sql`

**What it does:**
- Finds and deletes orphaned `score_events`
- Finds and deletes orphaned `quiz_answers`
- Finds and deletes orphaned `submissions`
- Cleans up historical mess from before CASCADE fix

**How to run:**
1. Open Supabase SQL Editor
2. Copy entire content of `CLEANUP_ORPHANED_DATA.sql`
3. Click "Run"
4. ✅ You should see counts of deleted records

**Note:** This is safe to run multiple times

---

### Step 4: Test Reset from Admin UI

1. Login as admin
2. Navigate to **Teams** → Click on a team
3. Scroll to **"Round Progress"** section
4. Click **"🔄 Reset Round"** for a specific round
5. Confirm the action
6. ✅ Round should disappear from the list
7. ✅ Team score should decrease
8. ✅ Team can now re-attempt the round

**Alternative:** Click **"🔥 Reset ALL Rounds"** to wipe everything

---

## 🔍 Troubleshooting

### Issue: "Reset button doesn't work"

**Diagnose:**
1. Open browser console (F12)
2. Look for errors when clicking reset
3. Check the console logs (we log every step with emojis)

**Fix:**
- If you see permission errors → Check RLS policies for admin role
- If you see "table doesn't exist" → That table isn't in your DB (safe to ignore)

---

### Issue: "Score still showing after reset"

**Diagnose:**
Run `DIAGNOSE_TEAM_DATA.sql`:

1. Get team ID: `SELECT id, name FROM teams;`
2. Replace `TEAM_ID_HERE` in script with actual UUID
3. Run each query to see what data exists

**Common causes:**
- `score_events` not deleted → Run `FORCE_RESET_TEAM.sql`
- `round_sessions` still exist → CASCADE not configured
- Orphaned `quiz_answers` → Run `CLEANUP_ORPHANED_DATA.sql`

---

### Issue: "Nuclear option - nothing works"

**Use the force reset:**

**File:** `FORCE_RESET_TEAM.sql`

1. Get team ID: `SELECT id, name FROM teams;`
2. Edit `FORCE_RESET_TEAM.sql`
3. Replace `TEAM_ID_HERE` with actual UUID (in 2 places)
4. Run the script
5. ✅ Everything for that team will be deleted

**Warning:** This is irreversible!

---

## 📊 Understanding the Data Model

```
round_sessions (master record for round attempt)
    ├── score_events ⚠️ WAS SET NULL → NOW CASCADE
    ├── quiz_answers (CASCADE)
    ├── quiz_sessions (CASCADE)
    ├── prompt_submissions (CASCADE)
    ├── submissions (CASCADE)
    ├── security_violations ⚠️ WAS SET NULL → NOW CASCADE
    └── [other round-specific tables] (CASCADE)
```

**Key insight:** When you delete `round_sessions`, everything should CASCADE automatically. But `score_events` and `security_violations` were keeping NULL references, causing scores to persist.

---

## 🚀 Using SQL Functions (Alternative to UI)

### Reset Single Round via SQL

```sql
SELECT admin_reset_team_round(
    '<team-uuid>'::uuid,
    '<round-uuid>'::uuid
);
```

**Example:**
```sql
SELECT admin_reset_team_round(
    'a009fcce-1234-5678-90ab-cdef12345678'::uuid,
    'b12345ab-cdef-1234-5678-90abcdef1234'::uuid
);
```

### Reset ALL Rounds via SQL

```sql
SELECT admin_reset_all_team_rounds('<team-uuid>'::uuid);
```

**Example:**
```sql
SELECT admin_reset_all_team_rounds(
    'a009fcce-1234-5678-90ab-cdef12345678'::uuid
);
```

---

## 📁 File Reference

| File | Purpose | Run When |
|------|---------|----------|
| `FIX_ROUND_RESET_CASCADE.sql` | Fix database constraints | ONE-TIME setup |
| `VERIFY_ROUND_RESET_FIX.sql` | Verify fixes applied | After running FIX script |
| `CLEANUP_ORPHANED_DATA.sql` | Clean historical orphans | After FIX script |
| `DIAGNOSE_TEAM_DATA.sql` | Debug specific team | When reset doesn't work |
| `FORCE_RESET_TEAM.sql` | Nuclear reset for one team | Last resort |
| `ROLLBACK_ROUND_RESET_CASCADE.sql` | Undo database changes | If something breaks |

---

## ✅ Success Checklist

After completing all steps, verify:

- [ ] Run `VERIFY_ROUND_RESET_FIX.sql` → All checks pass
- [ ] Run `CLEANUP_ORPHANED_DATA.sql` → No orphans found
- [ ] Reset a round from UI → Round disappears
- [ ] Check team score → Score decreases
- [ ] Team logs in → Can re-attempt reset round
- [ ] Check browser console → No errors
- [ ] Run diagnostics → All counts are 0 after reset

---

## 🆘 Support

If issues persist:

1. Run `DIAGNOSE_TEAM_DATA.sql` and share results
2. Check browser console for errors
3. Verify admin role: `SELECT role FROM users WHERE id = auth.uid();`
4. Check RLS policies are allowing admin deletes

---

## 🔧 Technical Details

### Why CASCADE is Better

**Before (SET NULL):**
```sql
round_session_id UUID REFERENCES round_sessions(id) ON DELETE SET NULL
```
- Round deleted → FK set to NULL
- Record remains in database
- Score still counts toward total
- ❌ Orphaned data accumulates

**After (CASCADE):**
```sql
round_session_id UUID REFERENCES round_sessions(id) ON DELETE CASCADE
```
- Round deleted → Record automatically deleted
- No orphaned data
- Clean slate for re-attempts
- ✅ Everything works as expected

### Performance Considerations

- Added indexes on `round_session_id` columns
- Deletion is fast even with thousands of records
- CASCADE deletes happen in single transaction
- No manual cleanup loops needed

---

**Last Updated:** 2024
**Version:** 1.0
