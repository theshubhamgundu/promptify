-- Migration 023: Seed Vision Challenge Round

ALTER TYPE round_type ADD VALUE IF NOT EXISTS 'VISION_CHALLENGE';

DO $$
DECLARE
    v_event_id UUID;
    v_round_id UUID;
BEGIN
    -- Get the first event
    SELECT id INTO v_event_id FROM events LIMIT 1;
    
    IF v_event_id IS NULL THEN
        RAISE NOTICE 'No events found. Skipping seed.';
        RETURN;
    END IF;

    -- Delete any previous existing Vision demo round to avoid duplicate order_index / collisions
    DELETE FROM rounds WHERE type = 'VISION_CHALLENGE' AND event_id = v_event_id;

    -- Create the Vision Round
    INSERT INTO rounds (
        event_id,
        name,
        description,
        type,
        order_index,
        duration_minutes,
        scoring_config,
        is_active
    ) VALUES (
        v_event_id,
        'Pixel Heist: The Vision Quest',
        'Use external AI tools (ChatGPT, Gemini) to analyze complex images and videos. You have 8 minutes and 3 attempts per challenge.',
        'VISION_CHALLENGE',
        30,
        40,
        '{"maxScore": 500}'::jsonb,
        true
    ) RETURNING id INTO v_round_id;

    -- Challenge 1: The Crowd Matrix (Image)
    INSERT INTO challenges (
        round_id,
        title,
        description,
        type,
        order_index,
        base_points,
        max_attempts,
        configuration
    ) VALUES (
        v_round_id,
        'The Crowd Matrix',
        'Analyze this dense crowd. We need a specific headcount.',
        'TEXT_INPUT',
        1,
        100,
        3,
        '{
            "mediaUrl": "https://images.unsplash.com/photo-1531058020387-3be344556be6",
            "mediaType": "image",
            "evaluationType": "NUMERIC",
            "correctAnswer": "42",
            "instructions": "Exactly how many people are wearing sunglasses? Use an external AI to help you count. Hint: The answer for this demo is 42.",
            "scoring": {
                "basePoints": 100,
                "attemptBonuses": [20, 10, 0],
                "speedBonuses": [
                    { "maxSeconds": 120, "bonus": 20 },
                    { "maxSeconds": 240, "bonus": 10 }
                ]
            }
        }'::jsonb
    );

    -- Challenge 2: The Decrypted Blueprint (Image)
    INSERT INTO challenges (
        round_id,
        title,
        description,
        type,
        order_index,
        base_points,
        max_attempts,
        configuration
    ) VALUES (
        v_round_id,
        'The Decrypted Blueprint',
        'Trace the power grid to find the failure point.',
        'TEXT_INPUT',
        2,
        150,
        3,
        '{
            "mediaUrl": "https://images.unsplash.com/photo-1503694978374-8a2fa686963a",
            "mediaType": "image",
            "evaluationType": "EXACT_MATCH",
            "correctAnswer": "T-492",
            "instructions": "Which terminal does the red wire connect to in the top right quadrant? Hint: The answer for this demo is T-492.",
            "scoring": {
                "basePoints": 150,
                "attemptBonuses": [20, 10, 0],
                "speedBonuses": [
                    { "maxSeconds": 120, "bonus": 30 },
                    { "maxSeconds": 300, "bonus": 15 }
                ]
            }
        }'::jsonb
    );

    -- Challenge 3: Video Observation (Video)
    INSERT INTO challenges (
        round_id,
        title,
        description,
        type,
        order_index,
        base_points,
        max_attempts,
        configuration
    ) VALUES (
        v_round_id,
        'The Shell Game',
        'Track the target across the city.',
        'TEXT_INPUT',
        3,
        200,
        3,
        '{
            "mediaUrl": "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4",
            "mediaType": "video",
            "evaluationType": "NORMALIZED_TEXT",
            "correctAnswer": "butterfly",
            "instructions": "What insect appears in the video? Hint: The answer for this demo is butterfly.",
            "scoring": {
                "basePoints": 200,
                "attemptBonuses": [30, 15, 0],
                "speedBonuses": [
                    { "maxSeconds": 180, "bonus": 40 }
                ]
            }
        }'::jsonb
    );

END $$;

