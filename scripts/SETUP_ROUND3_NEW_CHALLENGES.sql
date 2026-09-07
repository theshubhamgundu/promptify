-- ════════════════════════════════════════════════════════════════
-- ROUND 3: VISION CHALLENGES - NEW SETUP
-- Progressive sub-questions that unlock after each submission
-- ════════════════════════════════════════════════════════════════

-- First, get the Round 3 ID
DO $$
DECLARE
  v_round_id UUID;
  v_challenge1_id UUID;
  v_challenge2_id UUID;
  v_challenge3_id UUID;
  v_challenge4_id UUID;
  v_challenge5_id UUID;
BEGIN
  -- Get Round 3 ID (Stage 3: Vertex)
  SELECT id INTO v_round_id FROM rounds WHERE name = 'Stage 3: Vertex' LIMIT 1;
  
  IF v_round_id IS NULL THEN
    RAISE EXCEPTION 'Stage 3: Vertex not found';
  END IF;

  -- Delete existing challenges for Round 3
  DELETE FROM challenges WHERE round_id = v_round_id;

  -- ══════════════════════════════════════════════════════════════
  -- CHALLENGE 1: Same Place, Three Situations
  -- ══════════════════════════════════════════════════════════════
  INSERT INTO challenges (
    id, round_id, title, description, type, order_index,
    base_points, max_attempts, configuration
  ) VALUES (
    gen_random_uuid(), v_round_id,
    'Same Place, Three Situations',
    'Using the given image as reference, create 3 images showing: Normal conditions → During disaster → After recovery',
    'IMAGE_GENERATION',
    1, 200, 3,
    jsonb_build_object(
      'mediaUrl', '/assets/round3/question-1.jpeg',
      'mediaType', 'image',
      'requiresFileUpload', true,
      'acceptedFileTypes', ARRAY['image/jpeg', 'image/png', 'image/webp'],
      'maxFileSize', 10485760,
      'maxFiles', 3,
      'timeLimitMinutes', 15,
      'instructions', 'Upload exactly 3 images in this order: Normal → Disaster → Recovery',
      'subQuestions', jsonb_build_array(
        jsonb_build_object(
          'id', 1,
          'unlockAfterSubmit', true,
          'title', 'Change the Angle',
          'description', 'Keep everyone in the same location but change the camera angle',
          'maxFiles', 3,
          'points', 50
        )
      ),
      'scoring', jsonb_build_object(
        'basePoints', 200,
        'subQuestionPoints', ARRAY[50]
      )
    )
  ) RETURNING id INTO v_challenge1_id;

  -- ══════════════════════════════════════════════════════════════
  -- CHALLENGE 2: Same Scene, Five Perspectives
  -- ══════════════════════════════════════════════════════════════
  INSERT INTO challenges (
    id, round_id, title, description, challenge_type, order_index,
    base_points, max_attempts, time_limit_minutes,
    configuration
  ) VALUES (
    gen_random_uuid(), v_round_id,
    'Same Scene, Five Perspectives',
    'Generate 5 visual representations of the same scene with the turtle: Normal photo → Thermal → CCTV → Satellite → X-ray',
    'IMAGE_GENERATION',
    2, 250, 3, 20,
    jsonb_build_object(
      'mediaUrl', '/assets/round3/question-2.jpeg',
      'mediaType', 'image',
      'requiresFileUpload', true,
      'acceptedFileTypes', ARRAY['image/jpeg', 'image/png', 'image/webp'],
      'maxFileSize', 10485760,
      'maxFiles', 5,
      'instructions', 'Upload exactly 5 images: Normal → Thermal → CCTV → Satellite → X-ray. Maintain the same people, objects, and spatial relationships.',
      'subQuestions', jsonb_build_array(
        jsonb_build_object(
          'id', 1,
          'unlockAfterSubmit', true,
          'title', 'Add Three Objects',
          'description', 'Place exactly 3 small objects near the turtle. They must remain in the same relative positions in all 5 images.',
          'maxFiles', 5,
          'points', 75
        ),
        jsonb_build_object(
          'id', 2,
          'unlockAfterSubmit', true,
          'title', 'Change Background',
          'description', 'Change the background of the turtle to any other environment while maintaining all 5 perspectives',
          'maxFiles', 5,
          'points', 75
        )
      ),
      'scoring', jsonb_build_object(
        'basePoints', 250,
        'subQuestionPoints', ARRAY[75, 75]
      )
    )
  ) RETURNING id INTO v_challenge2_id;

  -- ══════════════════════════════════════════════════════════════
  -- CHALLENGE 3: Time Periods Video
  -- ══════════════════════════════════════════════════════════════
  INSERT INTO challenges (
    id, round_id, title, description, challenge_type, order_index,
    base_points, max_attempts, time_limit_minutes,
    configuration
  ) VALUES (
    gen_random_uuid(), v_round_id,
    'Time Periods Journey',
    'Create a 20-second video showing the same place across 5 time periods: Ancient → Medieval → 2026 → 2100 → 2500',
    'VIDEO_GENERATION',
    3, 300, 3, 25,
    jsonb_build_object(
      'mediaUrl', '/assets/round3/question-3.jpeg',
      'mediaType', 'image',
      'requiresFileUpload', true,
      'acceptedFileTypes', ARRAY['video/mp4', 'video/webm', 'video/quicktime'],
      'maxFileSize', 52428800,
      'maxFiles', 1,
      'minDuration', 18,
      'maxDuration', 22,
      'instructions', 'Upload a 20-second video showing all 5 time periods with the same location and landmarks',
      'subQuestions', jsonb_build_array(
        jsonb_build_object(
          'id', 1,
          'unlockAfterSubmit', true,
          'title', 'Fictional Person Legacy',
          'description', 'Introduce a fictional person in the first period. Their legacy must influence something visible in every later period.',
          'maxFiles', 1,
          'points', 100
        ),
        jsonb_build_object(
          'id', 2,
          'unlockAfterSubmit', true,
          'title', 'Natural Resource Evolution',
          'description', 'Show one important natural resource in the first period. By the final period, show what happens when it becomes rare or unavailable.',
          'maxFiles', 1,
          'points', 100
        ),
        jsonb_build_object(
          'id', 3,
          'unlockAfterSubmit', true,
          'title', 'Different Lighting Conditions',
          'description', 'Each period must use a different natural lighting condition while still clearly showing the same place.',
          'maxFiles', 1,
          'points', 100
        )
      ),
      'scoring', jsonb_build_object(
        'basePoints', 300,
        'subQuestionPoints', ARRAY[100, 100, 100]
      )
    )
  ) RETURNING id INTO v_challenge3_id;

  -- ══════════════════════════════════════════════════════════════
  -- CHALLENGE 4: Group Photo Emotions
  -- ══════════════════════════════════════════════════════════════
  INSERT INTO challenges (
    id, round_id, title, description, challenge_type, order_index,
    base_points, max_attempts, time_limit_minutes,
    configuration
  ) VALUES (
    gen_random_uuid(), v_round_id,
    'Subtle Emotions',
    'Generate a realistic group photo where each person shows a different emotion using only subtle expressions. Provide an emotion map.',
    'IMAGE_GENERATION',
    4, 250, 3, 20,
    jsonb_build_object(
      'requiresFileUpload', true,
      'acceptedFileTypes', ARRAY['image/jpeg', 'image/png', 'image/webp'],
      'maxFileSize', 10485760,
      'maxFiles', 2,
      'instructions', 'Upload: 1) The group photo with subtle emotions, 2) An emotion map/list showing intended emotion for each person',
      'subQuestions', jsonb_build_array(
        jsonb_build_object(
          'id', 1,
          'unlockAfterSubmit', true,
          'title', 'Change One Emotion',
          'description', 'Select one person and change their emotion completely, while every other person remains exactly as in the original.',
          'maxFiles', 2,
          'points', 75
        ),
        jsonb_build_object(
          'id', 2,
          'unlockAfterSubmit', true,
          'title', 'Different Eye Directions',
          'description', 'Make three people look in different directions without changing their facial expressions or identities.',
          'maxFiles', 2,
          'points', 75
        ),
        jsonb_build_object(
          'id', 3,
          'unlockAfterSubmit', true,
          'title', 'Rearrange Two People',
          'description', 'Rearrange the positions of two people while preserving their original emotions.',
          'maxFiles', 2,
          'points', 75
        ),
        jsonb_build_object(
          'id', 4,
          'unlockAfterSubmit', true,
          'title', 'Casual to Tense',
          'description', 'Keep the same people and composition but transform from casual gathering to tense situation using environmental and body-language changes.',
          'maxFiles', 2,
          'points', 75
        )
      ),
      'scoring', jsonb_build_object(
        'basePoints', 250,
        'subQuestionPoints', ARRAY[75, 75, 75, 75]
      )
    )
  ) RETURNING id INTO v_challenge4_id;

  -- ══════════════════════════════════════════════════════════════
  -- CHALLENGE 5: Split Timeline Decision
  -- ══════════════════════════════════════════════════════════════
  INSERT INTO challenges (
    id, round_id, title, description, challenge_type, order_index,
    base_points, max_attempts, time_limit_minutes,
    configuration
  ) VALUES (
    gen_random_uuid(), v_round_id,
    'Diverging Futures',
    'Create a 20-30 second split-screen video showing how one technology decision creates two different city futures',
    'VIDEO_GENERATION',
    5, 350, 3, 30,
    jsonb_build_object(
      'requiresFileUpload', true,
      'acceptedFileTypes', ARRAY['video/mp4', 'video/webm', 'video/quicktime'],
      'maxFileSize', 52428800,
      'maxFiles', 1,
      'minDuration', 20,
      'maxDuration', 30,
      'instructions', 'Upload a split-screen video showing: Same starting city → One decision → World A (accepted) vs World B (rejected) → At least 3 consequences in each → Final comparison',
      'subQuestions', jsonb_build_array(
        jsonb_build_object(
          'id', 1,
          'unlockAfterSubmit', true,
          'title', 'Replace One Consequence',
          'description', 'Replace one consequence in World A with a completely different consequence.',
          'maxFiles', 1,
          'points', 100
        ),
        jsonb_build_object(
          'id', 2,
          'unlockAfterSubmit', true,
          'title', 'Technology Failure',
          'description', 'Introduce a failure of the technology in one world. Modify later events to logically follow from that failure.',
          'maxFiles', 1,
          'points', 100
        ),
        jsonb_build_object(
          'id', 3,
          'unlockAfterSubmit', true,
          'title', 'Different Citizen Reactions',
          'description', 'Keep the technology and decision unchanged, but change how the citizens react to it.',
          'maxFiles', 1,
          'points', 100
        ),
        jsonb_build_object(
          'id', 4,
          'unlockAfterSubmit', true,
          'title', 'Day to Night Transition',
          'description', 'Change one important stage from daytime to nighttime and modify lighting, activity, transportation, and environment accordingly.',
          'maxFiles', 1,
          'points', 100
        ),
        jsonb_build_object(
          'id', 5,
          'unlockAfterSubmit', true,
          'title', 'Natural Disaster Impact',
          'description', 'Introduce a natural disaster at the same point in both timelines. Show how each world handles it differently based on their technology decision.',
          'maxFiles', 1,
          'points', 100
        )
      ),
      'scoring', jsonb_build_object(
        'basePoints', 350,
        'subQuestionPoints', ARRAY[100, 100, 100, 100, 100]
      )
    )
  ) RETURNING id INTO v_challenge5_id;

  RAISE NOTICE 'Stage 3 challenges created successfully!';
  RAISE NOTICE 'Challenge 1: % (3 images, 1 sub-question)', v_challenge1_id;
  RAISE NOTICE 'Challenge 2: % (5 images, 2 sub-questions)', v_challenge2_id;
  RAISE NOTICE 'Challenge 3: % (1 video, 3 sub-questions)', v_challenge3_id;
  RAISE NOTICE 'Challenge 4: % (2 images, 4 sub-questions)', v_challenge4_id;
  RAISE NOTICE 'Challenge 5: % (1 video, 5 sub-questions)', v_challenge5_id;

END $$;
