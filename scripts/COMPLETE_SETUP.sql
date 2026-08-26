-- ========================================================================
-- COMPLETE SETUP - Create Event, Round, and Link Team
-- ========================================================================
-- This creates everything and links your existing team to the event
-- ========================================================================

-- STEP 1: Create Event
-- ========================================================================

INSERT INTO events (
    name,
    description,
    status,
    start_time,
    end_time
) VALUES (
    'Promptify Championship 2026',
    'Annual AI Prompt Engineering Competition',
    'LIVE',
    NOW(),
    NOW() + INTERVAL '7 days'
) RETURNING id, name, status;

-- ⬆️ Copy the returned ID, you'll need it in Step 2


-- STEP 2: Link Your Team to the Event
-- ========================================================================
-- First, find your team ID:

SELECT id, name, access_code FROM teams ORDER BY created_at DESC LIMIT 5;

-- Then update your team with the event_id from Step 1:

UPDATE teams 
SET event_id = 'PASTE_EVENT_ID_HERE'::uuid  -- ⚠️ Replace with event ID from Step 1
WHERE id = 'PASTE_YOUR_TEAM_ID_HERE'::uuid; -- ⚠️ Replace with your team ID

-- Verify the link:
SELECT t.id, t.name, t.event_id, e.name as event_name
FROM teams t
LEFT JOIN events e ON t.event_id = e.id
WHERE t.id = 'PASTE_YOUR_TEAM_ID_HERE'::uuid;


-- STEP 3: Create Quiz Round
-- ========================================================================

INSERT INTO rounds (
    event_id,
    name,
    description,
    type,
    order_index,
    duration_minutes,
    is_active,
    scoring_config
) VALUES (
    'PASTE_EVENT_ID_HERE'::uuid,  -- ⚠️ Replace with event ID from Step 1
    'Round 1: Prompt Engineering Quiz',
    'Test your prompt engineering knowledge with engaging questions.',
    'QUIZ',
    1,
    30,
    true,
    '{}'::jsonb
) RETURNING id, name, type, is_active;


-- STEP 4: Verify Everything
-- ========================================================================

-- Check event
SELECT id, name, status, start_time FROM events ORDER BY created_at DESC LIMIT 1;

-- Check team is linked to event
SELECT 
    t.name as team_name,
    e.name as event_name,
    e.status as event_status
FROM teams t
JOIN events e ON t.event_id = e.id
WHERE t.name = 'Team Beta Test'  -- Change to your team name
LIMIT 1;

-- Check rounds for the event
SELECT 
    r.name as round_name,
    r.type,
    r.is_active,
    r.duration_minutes,
    e.name as event_name
FROM rounds r
JOIN events e ON r.event_id = e.id
ORDER BY r.order_index;

-- ========================================================================
-- ✅ DONE! Now logout and login again to load the event
-- ========================================================================
