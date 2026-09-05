-- =====================================================
-- ROUND 5 DEFINITIVE FIX — Run this in Supabase SQL Editor
-- =====================================================
-- ROOT CAUSE: Two issues were blocking Round 5:
--   1. RLS blocked INSERT inside DO $$ blocks (no auth context)
--   2. RLS SELECT policy only shows rounds with is_active = true,
--      but the seed set is_active = false
--
-- This script runs as postgres (superuser) in Supabase SQL Editor,
-- so plain SQL statements bypass RLS. The DO $$ block was the problem
-- because it runs in a nested context that may not bypass RLS.
-- =====================================================

-- Clean up any previous failed attempts
DELETE FROM challenges WHERE round_id IN (
    SELECT id FROM rounds WHERE name = 'Round 5 — AI Systems Challenge'
);
DELETE FROM rounds WHERE name = 'Round 5 — AI Systems Challenge';

-- Insert the round directly (NOT inside a DO block)
-- is_active = true so the RLS SELECT policy allows participants to see it
INSERT INTO rounds (event_id, name, description, type, order_index, duration_minutes, scoring_config, is_active)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Round 5 — AI Systems Challenge',
    'Design, select, adapt, and discover. Four challenges testing your ability to work with AI systems — not just write prompts.',
    'AI_SYSTEMS'::round_type,
    5,
    40,
    '{"total_points": 1000, "challenges": {"AI_ARCHITECT": 200, "MODEL_DUEL": 200, "AI_NEGOTIATOR": 250, "EMERGENCE": 250}, "process_score": 100}'::jsonb,
    true
);
