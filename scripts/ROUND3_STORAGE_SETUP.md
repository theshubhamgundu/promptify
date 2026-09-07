# Round 3: Vision Challenge - Storage Setup

## ✅ Completed
1. ✅ Created all 5 challenges in database
2. ✅ Fixed VisionRound.tsx to display question description
3. ✅ Reference images copied to `public/assets/round3/`

## 📦 Supabase Storage Bucket Setup

### Required Bucket
You need to create a Supabase Storage bucket for file uploads:

**Bucket Name:** `challenge-submissions`

### Setup Steps (via Supabase Dashboard)

1. Go to your Supabase project dashboard
2. Navigate to **Storage** in the left sidebar
3. Click **New Bucket**
4. Enter bucket name: `challenge-submissions`
5. Set **Public bucket**: `ON` (so uploaded files can be accessed)
6. Click **Create Bucket**

### Alternatively (via SQL)

Run this in your Supabase SQL editor:

```sql
-- Create the storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('challenge-submissions', 'challenge-submissions', true);

-- Set up storage policies for uploads
CREATE POLICY "Teams can upload challenge files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'challenge-submissions');

CREATE POLICY "Public can view challenge files"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'challenge-submissions');
```

## 🎯 Current Challenge Structure

| # | Title | Type | Files | Sub-Questions | Total Points |
|---|-------|------|-------|---------------|--------------|
| 1 | Same Place, Three Situations | Images | 3 | 1 | 250 |
| 2 | Same Scene, Five Perspectives | Images | 5 | 2 | 400 |
| 3 | Time Periods Journey | Video | 1 | 3 | 600 |
| 4 | Subtle Emotions | Images | 2 | 4 | 550 |
| 5 | Diverging Futures | Video | 1 | 5 | 850 |

**Total possible points:** 2,650

## 🔍 Testing Checklist

After creating the storage bucket, test:

1. ✅ Round 3 shows "Challenge 1 of 5" (not "1 of 3")
2. ✅ Challenge description displays above instructions
3. ✅ Reference image loads correctly
4. ✅ File upload drag-and-drop works
5. ✅ File type validation works (images only for challenge 1)
6. ✅ File size validation works (max 10MB for images)
7. ✅ Can upload exactly 3 files for challenge 1
8. ✅ Submit button becomes active after uploading 3 files
9. ✅ Files upload to Supabase Storage
10. ✅ Sub-question unlocks after main submission
11. ✅ Timer countdown works properly
12. ✅ Points are awarded correctly

## 📝 Notes

- **Challenge 1 & 2:** Image uploads (JPEG, PNG, WebP)
- **Challenge 3 & 5:** Video uploads (MP4, WebM, QuickTime)
- **Challenge 4:** Mixed (2 images: photo + emotion map)
- All files are stored in: `challenge-submissions/{team_id}/{challenge_id}/{timestamp}_{filename}`
