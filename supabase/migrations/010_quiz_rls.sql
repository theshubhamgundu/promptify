-- Migration 010: Row Level Security for Quiz System

-- Enable RLS on all quiz tables
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_sessions ENABLE ROW LEVEL SECURITY;

-- Quiz Questions Policies
-- Teams can read questions for active rounds
CREATE POLICY "Teams can view quiz questions for their active rounds"
ON quiz_questions FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM round_sessions rs
        WHERE rs.round_id = quiz_questions.round_id
        AND rs.team_id = (SELECT team_id FROM team_sessions WHERE id = current_setting('app.current_team_session_id', true)::uuid)
    )
    OR
    -- Admins can view all
    EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.role = 'ADMIN'
    )
);

-- Admins can manage quiz questions
CREATE POLICY "Admins can manage quiz questions"
ON quiz_questions FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.role IN ('ADMIN', 'COORDINATOR')
    )
);

-- Quiz Options Policies
-- Teams can read options for questions they can access
CREATE POLICY "Teams can view quiz options"
ON quiz_options FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM quiz_questions qq
        JOIN round_sessions rs ON qq.round_id = rs.round_id
        WHERE qq.id = quiz_options.question_id
        AND rs.team_id = (SELECT team_id FROM team_sessions WHERE id = current_setting('app.current_team_session_id', true)::uuid)
    )
    OR
    -- Admins can view all
    EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.role = 'ADMIN'
    )
);

-- Admins can manage options
CREATE POLICY "Admins can manage quiz options"
ON quiz_options FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.role IN ('ADMIN', 'COORDINATOR')
    )
);

-- Quiz Answers Policies
-- Teams can only view their own answers
CREATE POLICY "Teams can view their own quiz answers"
ON quiz_answers FOR SELECT
USING (
    team_id = (SELECT team_id FROM team_sessions WHERE id = current_setting('app.current_team_session_id', true)::uuid)
    OR
    -- Admins can view all answers
    EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.role IN ('ADMIN', 'COORDINATOR')
    )
);

-- Teams can insert their own answers
CREATE POLICY "Teams can submit their own quiz answers"
ON quiz_answers FOR INSERT
WITH CHECK (
    team_id = (SELECT team_id FROM team_sessions WHERE id = current_setting('app.current_team_session_id', true)::uuid)
);

-- Teams can update their own answers (if quiz allows)
CREATE POLICY "Teams can update their own quiz answers"
ON quiz_answers FOR UPDATE
USING (
    team_id = (SELECT team_id FROM team_sessions WHERE id = current_setting('app.current_team_session_id', true)::uuid)
    AND EXISTS (
        SELECT 1 FROM quiz_sessions qs
        WHERE qs.round_session_id = quiz_answers.round_session_id
        AND qs.status = 'IN_PROGRESS'
    )
);

-- Admins can manage all answers
CREATE POLICY "Admins can manage quiz answers"
ON quiz_answers FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.role IN ('ADMIN', 'COORDINATOR')
    )
);

-- Quiz Sessions Policies
-- Teams can view their own quiz sessions
CREATE POLICY "Teams can view their own quiz sessions"
ON quiz_sessions FOR SELECT
USING (
    team_id = (SELECT team_id FROM team_sessions WHERE id = current_setting('app.current_team_session_id', true)::uuid)
    OR
    -- Admins can view all
    EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.role IN ('ADMIN', 'COORDINATOR')
    )
);

-- Teams can create their own quiz sessions
CREATE POLICY "Teams can create their own quiz sessions"
ON quiz_sessions FOR INSERT
WITH CHECK (
    team_id = (SELECT team_id FROM team_sessions WHERE id = current_setting('app.current_team_session_id', true)::uuid)
);

-- Teams can update their own active quiz sessions
CREATE POLICY "Teams can update their own quiz sessions"
ON quiz_sessions FOR UPDATE
USING (
    team_id = (SELECT team_id FROM team_sessions WHERE id = current_setting('app.current_team_session_id', true)::uuid)
);

-- Admins can manage all quiz sessions
CREATE POLICY "Admins can manage quiz sessions"
ON quiz_sessions FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.role IN ('ADMIN', 'COORDINATOR')
    )
);

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION submit_quiz_answer TO authenticated, anon;
GRANT EXECUTE ON FUNCTION calculate_quiz_score TO authenticated, anon;
GRANT EXECUTE ON FUNCTION start_quiz_session TO authenticated, anon;

COMMENT ON POLICY "Teams can view quiz questions for their active rounds" ON quiz_questions IS 'Allow teams to read quiz questions during active rounds';
COMMENT ON POLICY "Teams can view their own quiz answers" ON quiz_answers IS 'Teams can only see their own submitted answers';
COMMENT ON POLICY "Teams can submit their own quiz answers" ON quiz_answers IS 'Teams can submit answers to quiz questions';
