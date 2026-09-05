-- =====================================================
-- Round 5 Seed: STANDALONE FIX
-- Run this in Supabase SQL Editor (it bypasses RLS)
-- =====================================================

-- Ensure enum values exist
ALTER TYPE round_type ADD VALUE IF NOT EXISTS 'AI_SYSTEMS';
ALTER TYPE challenge_type ADD VALUE IF NOT EXISTS 'AI_ARCHITECT';
ALTER TYPE challenge_type ADD VALUE IF NOT EXISTS 'MODEL_DUEL';
ALTER TYPE challenge_type ADD VALUE IF NOT EXISTS 'AI_NEGOTIATOR';
ALTER TYPE challenge_type ADD VALUE IF NOT EXISTS 'EMERGENCE';
