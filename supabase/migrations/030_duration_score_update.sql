-- Migration 030: Update round durations and challenge scores/durations
-- Goal: 
-- 1. All rounds are 40 minutes.
-- 2. Total score for each round is 200.
-- 3. Each sub-round (challenge) gets equal time and score.

-- 1. Set all rounds duration to 40
UPDATE rounds 
SET duration_minutes = 40;

-- 2. Update challenges base_points and duration
DO $$ 
DECLARE
  r RECORD;
  c_count INTEGER;
  points_per_challenge INTEGER;
  duration_sec_per_challenge INTEGER;
BEGIN
  FOR r IN SELECT id FROM rounds LOOP
    -- Count challenges for this round
    SELECT COUNT(*) INTO c_count FROM challenges WHERE round_id = r.id;
    
    IF c_count > 0 THEN
      points_per_challenge := 200 / c_count;
      duration_sec_per_challenge := (40 * 60) / c_count;
      
      -- Update base points and duration_seconds inside configuration JSON
      UPDATE challenges
      SET 
        base_points = points_per_challenge,
        configuration = jsonb_set(
          COALESCE(configuration, '{}'::jsonb),
          '{duration_seconds}',
          to_jsonb(duration_sec_per_challenge)
        )
      WHERE round_id = r.id;
    END IF;
  END LOOP;
END $$;
