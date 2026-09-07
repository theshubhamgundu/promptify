-- ═══════════════════════════════════════════════════════════════════
-- QUIZ SYSTEM - HELPFUL SQL QUERIES
-- ═══════════════════════════════════════════════════════════════════
-- Use these queries in Supabase SQL Editor for monitoring and debugging

-- ───────────────────────────────────────────────────────────────────
-- 1. VIEW ALL QUIZ ROUNDS
-- ───────────────────────────────────────────────────────────────────
SELECT 
    r.id,
    r.name,
    r.duration_minutes,
    COUNT(DISTINCT qq.id) as total_questions,
    SUM(qq.points) as total_points
FROM rounds r
LEFT JOIN quiz_questions qq ON qq.round_id = r.id
WHERE r.type = 'QUIZ'
GROUP BY r.id, r.name, r.duration_minutes
ORDER BY r.order_index;

-- ───────────────────────────────────────────────────────────────────
-- 2. VIEW QUESTIONS FOR A SPECIFIC ROUND
-- ───────────────────────────────────────────────────────────────────
-- Replace <ROUND_ID> with your actual round ID
SELECT 
    qq.question_number,
    qq.question_type,
    qq.points,
    LEFT(qq.question_text, 100) as question_preview,
    COUNT(qo.id) as num_options,
    COUNT(qo.id) FILTER (WHERE qo.is_correct = true) as correct_options
FROM quiz_questions qq
LEFT JOIN quiz_options qo ON qo.question_id = qq.id
WHERE qq.round_id = '<ROUND_ID>'
GROUP BY qq.id, qq.question_number, qq.question_type, qq.points, qq.question_text
ORDER BY qq.question_number;

-- ───────────────────────────────────────────────────────────────────
-- 3. VIEW QUIZ SESSION PROGRESS (Live Monitoring)
-- ───────────────────────────────────────────────────────────────────
SELECT 
    t.name as team_name,
    r.name as round_name,
    qs.status,
    qs.total_score,
    qs.correct_answers,
    qs.total_questions,
    ROUND((qs.correct_answers::numeric / qs.total_questions) * 100, 2) as accuracy_percent,
    qs.time_remaining_seconds,
    qs.started_at,
    qs.submitted_at
FROM quiz_sessions qs
JOIN teams t ON t.id = qs.team_id
JOIN rounds r ON r.id = qs.round_id
ORDER BY qs.started_at DESC;

-- ───────────────────────────────────────────────────────────────────
-- 4. VIEW TEAM ANSWERS FOR A SPECIFIC QUIZ
-- ───────────────────────────────────────────────────────────────────
-- Replace <TEAM_ID> and <ROUND_ID> with actual IDs
SELECT 
    qq.question_number,
    LEFT(qq.question_text, 80) as question,
    ARRAY_TO_STRING(qa.selected_options, ', ') as team_answer,
    ARRAY_TO_STRING(
        ARRAY(
            SELECT qo.option_label 
            FROM quiz_options qo 
            WHERE qo.question_id = qq.id AND qo.is_correct = true 
            ORDER BY qo.option_label
        ), 
        ', '
    ) as correct_answer,
    qa.is_correct,
    qa.points_earned,
    qq.points as max_points
FROM quiz_questions qq
LEFT JOIN quiz_answers qa ON qa.question_id = qq.id
JOIN quiz_sessions qs ON qs.round_session_id = qa.round_session_id
WHERE qs.team_id = '<TEAM_ID>' AND qq.round_id = '<ROUND_ID>'
ORDER BY qq.question_number;

-- ───────────────────────────────────────────────────────────────────
-- 5. LEADERBOARD FOR A SPECIFIC QUIZ ROUND
-- ───────────────────────────────────────────────────────────────────
-- Replace <ROUND_ID> with your actual round ID
SELECT 
    ROW_NUMBER() OVER (ORDER BY qs.total_score DESC, qs.submitted_at ASC) as rank,
    t.name as team_name,
    qs.total_score,
    qs.correct_answers,
    qs.total_questions,
    ROUND((qs.correct_answers::numeric / qs.total_questions) * 100, 2) as accuracy_percent,
    qs.submitted_at,
    EXTRACT(EPOCH FROM (qs.submitted_at - qs.started_at))::integer as time_taken_seconds
FROM quiz_sessions qs
JOIN teams t ON t.id = qs.team_id
WHERE qs.round_id = '<ROUND_ID>' AND qs.status = 'GRADED'
ORDER BY qs.total_score DESC, qs.submitted_at ASC;

-- ───────────────────────────────────────────────────────────────────
-- 6. QUESTION DIFFICULTY ANALYSIS
-- ───────────────────────────────────────────────────────────────────
-- Shows which questions are hardest based on team answers
-- Replace <ROUND_ID> with your actual round ID
SELECT 
    qq.question_number,
    LEFT(qq.question_text, 80) as question,
    qq.question_type,
    qq.points,
    COUNT(qa.id) as total_attempts,
    COUNT(qa.id) FILTER (WHERE qa.is_correct = true) as correct_attempts,
    COUNT(qa.id) FILTER (WHERE qa.is_correct = false) as incorrect_attempts,
    ROUND(
        (COUNT(qa.id) FILTER (WHERE qa.is_correct = true)::numeric / 
         NULLIF(COUNT(qa.id), 0)) * 100, 
        2
    ) as success_rate_percent
FROM quiz_questions qq
LEFT JOIN quiz_answers qa ON qa.question_id = qq.id
WHERE qq.round_id = '<ROUND_ID>'
GROUP BY qq.id, qq.question_number, qq.question_text, qq.question_type, qq.points
ORDER BY success_rate_percent ASC NULLS LAST, qq.question_number;

-- ───────────────────────────────────────────────────────────────────
-- 7. FIND TEAMS THAT HAVEN'T SUBMITTED YET
-- ───────────────────────────────────────────────────────────────────
-- Replace <ROUND_ID> with your actual round ID
SELECT 
    t.name as team_name,
    qs.status,
    qs.started_at,
    ROUND(EXTRACT(EPOCH FROM (NOW() - qs.started_at)) / 60, 0) as minutes_elapsed,
    qs.time_remaining_seconds / 60 as minutes_remaining,
    COUNT(qa.id) as questions_answered
FROM quiz_sessions qs
JOIN teams t ON t.id = qs.team_id
LEFT JOIN quiz_answers qa ON qa.round_session_id = qs.round_session_id
WHERE qs.round_id = '<ROUND_ID>' AND qs.status = 'IN_PROGRESS'
GROUP BY t.name, qs.status, qs.started_at, qs.time_remaining_seconds
ORDER BY qs.started_at;

-- ───────────────────────────────────────────────────────────────────
-- 8. RECALCULATE SCORE FOR A TEAM
-- ───────────────────────────────────────────────────────────────────
-- Replace <ROUND_SESSION_ID> with the actual round_session_id
SELECT calculate_quiz_score('<ROUND_SESSION_ID>');

-- ───────────────────────────────────────────────────────────────────
-- 9. VERIFY ALL QUESTIONS HAVE CORRECT ANSWERS
-- ───────────────────────────────────────────────────────────────────
-- Checks for questions that don't have any correct options marked
SELECT 
    qq.id,
    qq.question_number,
    LEFT(qq.question_text, 80) as question,
    COUNT(qo.id) as total_options,
    COUNT(qo.id) FILTER (WHERE qo.is_correct = true) as correct_options
FROM quiz_questions qq
LEFT JOIN quiz_options qo ON qo.question_id = qq.id
GROUP BY qq.id, qq.question_number, qq.question_text
HAVING COUNT(qo.id) FILTER (WHERE qo.is_correct = true) = 0
ORDER BY qq.question_number;

-- ───────────────────────────────────────────────────────────────────
-- 10. DELETE ALL QUIZ DATA FOR A ROUND (CAUTION!)
-- ───────────────────────────────────────────────────────────────────
-- Use this to reset a quiz round during testing
-- Replace <ROUND_ID> with your actual round ID
-- ⚠️ WARNING: This will delete all questions, options, and answers!

-- First, check what will be deleted:
SELECT 
    'Questions' as item_type, COUNT(*) as count FROM quiz_questions WHERE round_id = '<ROUND_ID>'
UNION ALL
SELECT 
    'Sessions' as item_type, COUNT(*) as count FROM quiz_sessions WHERE round_id = '<ROUND_ID>'
UNION ALL
SELECT 
    'Answers' as item_type, COUNT(*) as count 
FROM quiz_answers qa
JOIN quiz_sessions qs ON qa.round_session_id = qs.round_session_id
WHERE qs.round_id = '<ROUND_ID>';

-- Then, if you're sure, uncomment and run these DELETE statements:
-- DELETE FROM quiz_answers 
-- WHERE round_session_id IN (
--     SELECT round_session_id FROM quiz_sessions WHERE round_id = '<ROUND_ID>'
-- );

-- DELETE FROM quiz_sessions WHERE round_id = '<ROUND_ID>';
-- DELETE FROM quiz_options WHERE question_id IN (
--     SELECT id FROM quiz_questions WHERE round_id = '<ROUND_ID>'
-- );
-- DELETE FROM quiz_questions WHERE round_id = '<ROUND_ID>';

-- ───────────────────────────────────────────────────────────────────
-- 11. EXPORT QUIZ RESULTS AS CSV FORMAT
-- ───────────────────────────────────────────────────────────────────
-- Replace <ROUND_ID> with your actual round ID
-- Copy the results and save as CSV for Excel/Sheets
SELECT 
    t.name as "Team Name",
    qs.total_score as "Score",
    qs.correct_answers as "Correct Answers",
    qs.total_questions as "Total Questions",
    ROUND((qs.correct_answers::numeric / qs.total_questions) * 100, 2) as "Accuracy %",
    TO_CHAR(qs.started_at, 'YYYY-MM-DD HH24:MI:SS') as "Started At",
    TO_CHAR(qs.submitted_at, 'YYYY-MM-DD HH24:MI:SS') as "Submitted At",
    ROUND(EXTRACT(EPOCH FROM (qs.submitted_at - qs.started_at)) / 60, 2) as "Time Taken (minutes)"
FROM quiz_sessions qs
JOIN teams t ON t.id = qs.team_id
WHERE qs.round_id = '<ROUND_ID>' AND qs.status = 'GRADED'
ORDER BY qs.total_score DESC, qs.submitted_at ASC;

-- ═══════════════════════════════════════════════════════════════════
-- END OF QUERIES
-- ═══════════════════════════════════════════════════════════════════
