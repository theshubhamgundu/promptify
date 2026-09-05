-- Fix Round 3 and Round 4 order_index and titles

DO $$
BEGIN
    -- Round 3: Pixel Heist
    UPDATE rounds
    SET order_index = 3,
        name = 'Round 3: Pixel Heist (Vision Quest)'
    WHERE type = 'VISION_CHALLENGE';

    -- Round 4: Nexus Protocol
    UPDATE rounds
    SET order_index = 4,
        name = 'Round 4: Nexus Protocol (AI Adversarial)'
    WHERE type = 'AI_ADVERSARIAL';
END $$;
