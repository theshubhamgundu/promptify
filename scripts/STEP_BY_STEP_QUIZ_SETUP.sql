-- ========================================================================
-- STEP-BY-STEP QUIZ SETUP
-- ========================================================================
-- Follow these steps IN ORDER. Run each section separately.
-- ========================================================================

-- ========================================================================
-- STEP 1: Find your Event ID
-- ========================================================================
-- Run this query first to see your events:

SELECT 
    id, 
    name, 
    status,
    created_at
FROM events 
ORDER BY created_at DESC;

-- Copy the UUID from the 'id' column of the event you want to use
-- Example: c7e8f9a0-1b2c-3d4e-5f6g-7h8i9j0k1l2m

-- ========================================================================
-- STEP 2: Create the Quiz Round
-- ========================================================================
-- Replace the UUID below with your actual event ID from Step 1
-- Then run this INSERT statement:

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
    '00000000-0000-0000-0000-000000000001'::uuid, -- ⚠️ REPLACE THIS!
    'Quiz Round 1: Prompt Engineering Basics',
    'Test your understanding of prompt engineering fundamentals.',
    'QUIZ',
    1,
    15,
    true,
    '{"allow_review": true, "show_correct_answers": true}'::jsonb
) RETURNING id, name;

-- ⬆️ After running this, COPY THE RETURNED 'id' (the round UUID)
-- You'll need it for Step 3

-- ========================================================================
-- STEP 3: Add Questions to the Round
-- ========================================================================
-- Replace 'PASTE-YOUR-ROUND-ID-HERE' with the round ID from Step 2
-- Then run this entire block:

-- Question 1: Single Answer
WITH q1 AS (
    INSERT INTO quiz_questions (
        round_id,
        question_number,
        question_text,
        question_type,
        points,
        order_index
    ) VALUES (
        '81e3e152-f5e7-4518-ac45-f987ddbfa674'::uuid, -- ⚠️ REPLACE THIS!
        1,
        'What is the primary purpose of few-shot prompting?

Few-shot prompting involves providing the AI model with a few examples before asking it to perform a task.',
        'SINGLE_ANSWER',
        1,
        0
    ) RETURNING id
)
INSERT INTO quiz_options (question_id, option_label, option_text, is_correct, order_index)
SELECT q1.id, * FROM q1, (VALUES
    ('A', 'To reduce the cost of API calls', false, 0),
    ('B', 'To provide examples that guide the model toward the desired output format and style', true, 1),
    ('C', 'To make prompts shorter and more efficient', false, 2),
    ('D', 'To bypass content moderation filters', false, 3)
) AS opts(label, text, correct, idx);

-- Question 2: Single Answer
WITH q2 AS (
    INSERT INTO quiz_questions (
        round_id,
        question_number,
        question_text,
        question_type,
        points,
        order_index
    ) VALUES (
        'PASTE-YOUR-ROUND-ID-HERE'::uuid, -- ⚠️ REPLACE THIS!
        2,
        'A chatbot confidently states a fact that is completely incorrect. What is this behavior called?',
        'SINGLE_ANSWER',
        1,
        1
    ) RETURNING id
)
INSERT INTO quiz_options (question_id, option_label, option_text, is_correct, order_index)
SELECT q2.id, * FROM q2, (VALUES
    ('A', 'Model drift', false, 0),
    ('B', 'Hallucination', true, 1),
    ('C', 'Overfitting', false, 2),
    ('D', 'Temperature variation', false, 3)
) AS opts(label, text, correct, idx);

-- Question 3: Multi-Select
WITH q3 AS (
    INSERT INTO quiz_questions (
        round_id,
        question_number,
        question_text,
        question_type,
        points,
        order_index
    ) VALUES (
        'PASTE-YOUR-ROUND-ID-HERE'::uuid, -- ⚠️ REPLACE THIS!
        3,
        'Which of the following are effective strategies to reduce hallucinations in AI responses?

(Select ALL that apply)',
        'MULTI_SELECT',
        2,
        2
    ) RETURNING id
)
INSERT INTO quiz_options (question_id, option_label, option_text, is_correct, order_index)
SELECT q3.id, * FROM q3, (VALUES
    ('A', 'Provide source documents and ask the model to cite them', true, 0),
    ('B', 'Increase the temperature parameter to maximum', false, 1),
    ('C', 'Use retrieval-augmented generation (RAG)', true, 2),
    ('D', 'Make prompts as short as possible', false, 3)
) AS opts(label, text, correct, idx);

-- ========================================================================
-- STEP 4: Verify Everything Was Created
-- ========================================================================
-- Run this to check your quiz:

SELECT 
    r.name as round_name,
    r.is_active,
    r.duration_minutes,
    COUNT(qq.id) as total_questions,
    SUM(qq.points) as total_points
FROM rounds r
LEFT JOIN quiz_questions qq ON r.id = qq.round_id
WHERE r.type = 'QUIZ'
GROUP BY r.id, r.name, r.is_active, r.duration_minutes
ORDER BY r.created_at DESC
LIMIT 1;

-- View question details:
SELECT 
    qq.question_number,
    qq.question_text,
    qq.question_type,
    qq.points,
    COUNT(qo.id) as options,
    ARRAY_AGG(qo.option_label ORDER BY qo.order_index) FILTER (WHERE qo.is_correct) as correct_answers
FROM quiz_questions qq
LEFT JOIN quiz_options qo ON qq.id = qo.question_id
WHERE qq.round_id IN (
    SELECT id FROM rounds 
    WHERE type = 'QUIZ' 
    ORDER BY created_at DESC 
    LIMIT 1
)
GROUP BY qq.id, qq.question_number, qq.question_text, qq.question_type, qq.points
ORDER BY qq.question_number;

-- ========================================================================
-- ✅ DONE!
-- ========================================================================
-- Now you can:
-- 1. Login as a participant
-- 2. Go to Rounds page
-- 3. Click "Start Quiz"
-- ========================================================================
