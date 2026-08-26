-- Script to create a test quiz round
-- Run this in Supabase SQL Editor after running migrations 009 and 010

-- First, get your event ID (replace with actual event ID)
-- SELECT id, name FROM events ORDER BY created_at DESC LIMIT 5;

-- Create a quiz round (replace YOUR_EVENT_ID with actual UUID)
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
    'YOUR_EVENT_ID', -- Replace with your actual event ID
    'Round 1: Prompt Engineering Quiz',
    'Test your prompt engineering knowledge with 10 challenging questions covering fundamentals, best practices, and real-world scenarios.',
    'QUIZ',
    1,
    30, -- 30 minutes
    true, -- Set to true to make it accessible
    jsonb_build_object(
        'allow_review', true,
        'show_correct_answers', false,
        'shuffle_questions', false,
        'shuffle_options', false,
        'difficulty', 'intermediate',
        'year_level', '2nd'
    )
) RETURNING id, name;

-- After creating the round, note the returned ID
-- You'll need it for seeding questions

-- Example: Create a few sample questions for testing
-- Replace ROUND_ID with the ID returned above

-- Question 1
WITH q AS (
    INSERT INTO quiz_questions (
        round_id,
        question_number,
        question_text,
        question_type,
        points,
        order_index
    ) VALUES (
        'ROUND_ID', -- Replace
        1,
        'What is the primary purpose of few-shot prompting?

Few-shot prompting is a technique where you provide the AI model with a few examples before asking it to perform a task.',
        'SINGLE_ANSWER',
        1,
        0
    ) RETURNING id
)
INSERT INTO quiz_options (question_id, option_label, option_text, is_correct, order_index)
SELECT 
    q.id,
    opt.label,
    opt.text,
    opt.correct,
    opt.idx
FROM q, (
    VALUES 
        ('A', 'To reduce the cost of API calls', false, 0),
        ('B', 'To provide examples that guide the model toward the desired output format and style', true, 1),
        ('C', 'To make prompts shorter and more efficient', false, 2),
        ('D', 'To bypass content moderation filters', false, 3)
) AS opt(label, text, correct, idx);

-- Question 2
WITH q AS (
    INSERT INTO quiz_questions (
        round_id,
        question_number,
        question_text,
        question_type,
        points,
        order_index
    ) VALUES (
        'ROUND_ID', -- Replace
        2,
        'A chatbot confidently states a fact that is completely incorrect. What is this behavior called?',
        'SINGLE_ANSWER',
        1,
        1
    ) RETURNING id
)
INSERT INTO quiz_options (question_id, option_label, option_text, is_correct, order_index)
SELECT 
    q.id,
    opt.label,
    opt.text,
    opt.correct,
    opt.idx
FROM q, (
    VALUES 
        ('A', 'Model drift', false, 0),
        ('B', 'Hallucination', true, 1),
        ('C', 'Overfitting', false, 2),
        ('D', 'Temperature variation', false, 3)
) AS opt(label, text, correct, idx);

-- Question 3
WITH q AS (
    INSERT INTO quiz_questions (
        round_id,
        question_number,
        question_text,
        question_type,
        points,
        order_index
    ) VALUES (
        'ROUND_ID', -- Replace
        3,
        'Which of the following are effective strategies to reduce hallucinations in AI responses? (Select all that apply)',
        'MULTI_SELECT',
        2,
        2
    ) RETURNING id
)
INSERT INTO quiz_options (question_id, option_label, option_text, is_correct, order_index)
SELECT 
    q.id,
    opt.label,
    opt.text,
    opt.correct,
    opt.idx
FROM q, (
    VALUES 
        ('A', 'Provide source documents and ask the model to cite them', true, 0),
        ('B', 'Increase the temperature parameter to maximum', false, 1),
        ('C', 'Use retrieval-augmented generation (RAG)', true, 2),
        ('D', 'Make prompts as short as possible', false, 3)
) AS opt(label, text, correct, idx);

-- Verify questions were created
SELECT 
    qq.question_number,
    qq.question_text,
    qq.question_type,
    qq.points,
    COUNT(qo.id) as option_count,
    COUNT(qo.id) FILTER (WHERE qo.is_correct) as correct_count
FROM quiz_questions qq
LEFT JOIN quiz_options qo ON qq.id = qo.question_id
WHERE qq.round_id = 'ROUND_ID' -- Replace
GROUP BY qq.id, qq.question_number, qq.question_text, qq.question_type, qq.points
ORDER BY qq.question_number;
