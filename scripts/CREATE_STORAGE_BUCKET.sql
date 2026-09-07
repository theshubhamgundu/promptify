-- ════════════════════════════════════════════════════════════════
-- CREATE STORAGE BUCKET FOR CHALLENGE FILE UPLOADS
-- ════════════════════════════════════════════════════════════════

-- Create the storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('challenge-submissions', 'challenge-submissions', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies for uploads
DO $$
BEGIN
  -- Policy for authenticated users to upload files
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND policyname = 'Teams can upload challenge files'
  ) THEN
    CREATE POLICY "Teams can upload challenge files"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'challenge-submissions');
  END IF;

  -- Policy for public to view files
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND policyname = 'Public can view challenge files'
  ) THEN
    CREATE POLICY "Public can view challenge files"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'challenge-submissions');
  END IF;

  -- Policy for teams to delete their own files
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND policyname = 'Teams can delete their own files'
  ) THEN
    CREATE POLICY "Teams can delete their own files"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'challenge-submissions');
  END IF;
END $$;

-- Verify bucket was created
SELECT id, name, public FROM storage.buckets WHERE id = 'challenge-submissions';
