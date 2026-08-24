-- Migration 004: Seed Data

-- Insert a default event
INSERT INTO events (id, name, description, status, start_time, end_time)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Prompt Engineering Championship 2026',
  'The ultimate test of AI interaction skills.',
  'DRAFT',
  now(),
  now() + interval '5 hours'
) ON CONFLICT DO NOTHING;

-- Insert an Admin user (Assuming a mock UUID for local dev)
-- Note: In production, this user needs to exist in auth.users first.
-- For local dev without actual auth linked initially, this might fail foreign key on auth.users unless auth.users is populated.
-- To avoid issues with auth.users foreign key in local dev seed, we will create a dummy auth user if possible or skip.

-- We can insert rounds for the event
INSERT INTO rounds (id, event_id, name, description, type, order_index, duration_minutes, scoring_config, is_active)
VALUES 
  (
    '00000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-000000000001',
    'Round 1: The Qualifier',
    'Fast-paced multiple choice questions to test your AI knowledge.',
    'QUIZ',
    1,
    30,
    '{"base_points": 10, "penalty_per_attempt": 0}'::jsonb,
    false
  ),
  (
    '00000000-0000-0000-0000-000000000012',
    '00000000-0000-0000-0000-000000000001',
    'Round 2: Prompt Crafting',
    'Write prompts to generate specific outputs.',
    'PROMPT',
    2,
    45,
    '{"base_points": 50, "hint_penalty": 10}'::jsonb,
    false
  ),
  (
    '00000000-0000-0000-0000-000000000013',
    '00000000-0000-0000-0000-000000000001',
    'Round 3: AI Escape Room',
    'Solve logic puzzles using AI.',
    'ESCAPE_ROOM',
    3,
    60,
    '{"base_points": 100}'::jsonb,
    false
  )
ON CONFLICT DO NOTHING;
